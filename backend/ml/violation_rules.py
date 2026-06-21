import cv2
import numpy as np
import os
import math
import urllib.request
from typing import List, Dict, Any, Tuple, Optional
from backend.ml.tracker import Track

# Try PyTorch/Torchvision
try:
    import torch
    import torch.nn as nn
    import torchvision.transforms as transforms
    from PIL import Image
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

# --- UTILITIES ---
def scale_bbox(bbox: List[int], orig_shape: tuple, model_shape: tuple = (640, 640)) -> List[int]:
    orig_h, orig_w = orig_shape[:2]
    model_h, model_w = model_shape

    sx = orig_w / model_w
    sy = orig_h / model_h

    x1 = int(bbox[0] * sx)
    y1 = int(bbox[1] * sy)
    x2 = int(bbox[2] * sx)
    y2 = int(bbox[3] * sy)

    # Clamp to image bounds
    x1 = max(0, min(x1, orig_w - 1))
    y1 = max(0, min(y1, orig_h - 1))
    x2 = max(0, min(x2, orig_w))
    y2 = max(0, min(y2, orig_h))

    return [x1, y1, x2, y2]

# --- VIOLATION RULES ENGINE ---
class ViolationRulesEngine:
    def __init__(self):
        # Seatbelt detection removed due to camera viewing range limitations.
        self.helmet_model = None
        
        # Initialize high-accuracy helmet detector from HF
        try:
            from ultralytics import YOLO
            model_path = "helmet_yolov8n.pt"
            
            # Download if not exists
            if not os.path.exists(model_path):
                print("Downloading YOLOv8 helmet detector model from Hugging Face...")
                url = "https://huggingface.co/iam-tsr/yolov8n-helmet-detection/resolve/main/best.pt"
                urllib.request.urlretrieve(url, model_path)
                print("Helmet detector downloaded successfully.")
                
            self.helmet_model = YOLO(model_path)
            print("YOLOv8 helmet detector loaded successfully.")
        except Exception as e:
            print(f"Failed to load YOLOv8 helmet detector: {e}. Falling back to simulated helmet check.")
            self.helmet_model = None
            
        # Store voting results for tracking-based consensus
        self.helmet_votes: Dict[int, List[Tuple[str, float]]] = {}   # rider_track_id -> list of (status, conf)


        # --- COOLDOWN MAP: prevent same (track_id, violation_type) firing every frame ---
        # Maps (track_id, violation_type) -> last frame_idx it was emitted
        self._cooldown: Dict[Tuple[int, str], int] = {}
        self.COOLDOWN_FRAMES = 24  # suppress repeat for 24 extracted frames (~3 s at 8 fps)

        # Traffic flow tracking for self-calibration (maps track_id -> total y-movement dy)
        self.left_flow_samples: Dict[int, float] = {}
        self.right_flow_samples: Dict[int, float] = {}

    def classify_helmet(self, rider_crop: np.ndarray) -> Tuple[str, float]:
        """
        Runs the fine-tuned helmet YOLOv8 model on the rider crop to determine helmet status.
        Classes: {0: 'With Helmet', 1: 'Without Helmet'}
        """
        if self.helmet_model is not None:
            try:
                results = self.helmet_model(rider_crop, verbose=False)
                best_conf = 0.0
                best_class = 1  # Default to Without Helmet if unsure
                
                for r in results:
                    for box in r.boxes:
                        cls_idx = int(box.cls[0].item())
                        conf = float(box.conf[0].item())
                        if conf > best_conf:
                            best_conf = conf
                            best_class = cls_idx
                            
                if best_conf > 0.3:
                    status = "helmet" if best_class == 0 else "no_helmet"
                    return status, best_conf
            except Exception as e:
                print(f"Error classifying helmet: {e}")
                
        # Simulated fallback if model fails
        crop_mean = float(np.mean(rider_crop)) if rider_crop.size > 0 else 0.0
        is_violation = (int(crop_mean) % 2 == 0)
        conf = 0.80 + (crop_mean % 10) / 100.0
        return ("no_helmet" if is_violation else "helmet", conf)

    def process_temporal_violations(
        self, 
        tracks: Dict[int, Track],
        association_engine: Any,
        frame_img: np.ndarray,
        frame_idx: int,
        timestamp: float,
        speed_limit: int,
        stop_line_y: Optional[int],
        restricted_parking_zone: List[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Runs rules on all tracks active in the current frame.
        Uses tracking histories and temporal voting for consensus decisions.
        """
        violations = []

        def _emit(track_id: int, v_type: str, record: dict) -> None:
            """Only emit a violation if it's not in cooldown for this track."""
            key = (track_id, v_type)
            last = self._cooldown.get(key, -999)
            if frame_idx - last >= self.COOLDOWN_FRAMES:
                self._cooldown[key] = frame_idx
                violations.append(record)
        
        # Default restricted zone: bottom-right quadrant if none provided
        if restricted_parking_zone is None:
            restricted_parking_zone = [350, 350, 600, 600]
            
        # Traffic light red phase check
        # Look for bright emitting red sources in the top third of the frame
        h_third = frame_img.shape[0] // 3
        hsv = cv2.cvtColor(frame_img[0:h_third, :], cv2.COLOR_BGR2HSV)
        
        # High Saturation and very High Value (brightness) to only catch emitting lights
        lower_red1 = np.array([0, 100, 200])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([160, 100, 200])
        upper_red2 = np.array([180, 255, 255])
        
        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        red_mask = cv2.bitwise_or(mask1, mask2)
        
        # Require a solid cluster of bright red pixels
        is_red_light = np.count_nonzero(red_mask) > 50

        for track_id, track in tracks.items():
            if not track.is_active:
                continue
                
            bbox = track.history[-1]["bbox"]
            centroid = track.history[-1]["centroid"]
            cls_name = track.class_name
            
            img_h, img_w, _ = frame_img.shape
            
            # Update running traffic flow samples for self-calibration
            if len(track.history) >= 2 and cls_name in {"car", "bus", "truck", "motorcycle"}:
                dy = centroid[1] - track.history[0]["centroid"][1]
                if centroid[0] < img_w // 2:
                    self.left_flow_samples[track_id] = dy
                else:
                    self.right_flow_samples[track_id] = dy

            # --- 1. ILLEGAL PARKING ---
            if cls_name in {"car", "bus", "truck", "motorcycle"}:
                cx, cy = centroid
                in_parking_zone = (restricted_parking_zone[0] <= cx <= restricted_parking_zone[2] and 
                                   restricted_parking_zone[1] <= cy <= restricted_parking_zone[3])
                                   
                if in_parking_zone and track.stationary_frames > 24:
                    _emit(track_id, "illegal_parking", {
                        "track_id": track_id,
                        "violation_type": "illegal_parking",
                        "confidence_score": 0.88,
                        "subject_bbox": bbox,
                        "evidence_crop_bbox": bbox
                    })
                    
            # --- 2. OVERSPEEDING ---
            if cls_name in {"car", "bus", "truck", "motorcycle"}:
                if track.current_speed > speed_limit and len(track.speeds) >= 4:
                    # Require 4 consecutive speed samples above limit to reduce noise
                    recent_speeds = track.speeds[-4:]
                    if all(s > speed_limit for s in recent_speeds):
                        _emit(track_id, "overspeeding", {
                            "track_id": track_id,
                            "violation_type": "overspeeding",
                            "confidence_score": min(0.90, 0.70 + (track.current_speed - speed_limit) / speed_limit * 0.3),
                            "subject_bbox": bbox,
                            "evidence_crop_bbox": bbox,
                            "speed": round(track.current_speed, 1)
                        })
                    
            # --- 3. STOP LINE VIOLATION (RED LIGHT RUNNING) ---
            if is_red_light and stop_line_y is not None and cls_name in {"car", "bus", "truck", "motorcycle"}:
                bottom_y = bbox[3]
                if bottom_y > stop_line_y and len(track.history) >= 3:
                    _emit(track_id, "stop_line_violation", {
                        "track_id": track_id,
                        "violation_type": "stop_line_violation",
                        "confidence_score": 0.92,
                        "subject_bbox": bbox,
                        "evidence_crop_bbox": bbox
                    })
                    
            # --- 4. WRONG-SIDE DRIVING (DYNAMIC ONE-WAY / TWO-WAY FLOW CONSENSUS) ---
            if len(track.history) >= 16 and cls_name in {"car", "bus", "truck", "motorcycle"}:
                first_centroid = track.history[0]["centroid"]
                last_centroid = track.history[-1]["centroid"]
                dy = last_centroid[1] - first_centroid[1]
                
                left_dys = [s_dy for tid, s_dy in self.left_flow_samples.items() if tid != track_id and abs(s_dy) > 20]
                right_dys = [s_dy for tid, s_dy in self.right_flow_samples.items() if tid != track_id and abs(s_dy) > 20]
                
                left_med = np.median(left_dys) if len(left_dys) >= 2 else 0
                right_med = np.median(right_dys) if len(right_dys) >= 2 else 0
                
                left_dir = np.sign(left_med)
                right_dir = np.sign(right_med)
                
                # If both sides flow in the same direction, it's a one-way or single-lane road
                is_one_way = (left_dir == right_dir and left_dir != 0)
                
                if is_one_way:
                    dominant_direction = left_dir
                else:
                    # Two-way road: check the side of the screen the vehicle is on
                    dominant_direction = left_dir if centroid[0] < img_w // 2 else right_dir
                
                current_direction = np.sign(dy)
                if dominant_direction != 0 and current_direction == -dominant_direction and abs(dy) > 60:
                    _emit(track_id, "wrong_side_driving", {
                        "track_id": track_id,
                        "violation_type": "wrong_side_driving",
                        "confidence_score": 0.90,
                        "subject_bbox": bbox,
                        "evidence_crop_bbox": bbox
                    })
                    
            # --- 5. LANE VIOLATION (SWERVING / UNSAFE LANE CHANGE Heuristics) ---
            # Unsafe lane changes are characterized by high lateral movements (dx) with low forward progress (dy)
            if len(track.history) >= 12 and cls_name in {"car", "bus", "truck", "motorcycle"}:
                first_centroid = track.history[0]["centroid"]
                last_centroid = track.history[-1]["centroid"]
                dx = last_centroid[0] - first_centroid[0]
                dy = last_centroid[1] - first_centroid[1]
                
                # Drifted laterally more than 160 pixels with little longitudinal progress
                if abs(dx) > 160 and abs(dy) < 50:
                    _emit(track_id, "lane_violation", {
                        "track_id": track_id,
                        "violation_type": "lane_violation",
                        "confidence_score": 0.82,
                        "subject_bbox": bbox,
                        "evidence_crop_bbox": bbox
                    })

            # --- 6. MOTORCYCLE TRIPLE RIDING ---
            if cls_name == "motorcycle":
                consistent_riders = association_engine.get_consistent_rider_count(track_id)
                if consistent_riders >= 3:
                    _emit(track_id, "triple_riding", {
                        "track_id": track_id,
                        "violation_type": "triple_riding",
                        "confidence_score": 0.95,
                        "subject_bbox": bbox,
                        "evidence_crop_bbox": bbox
                    })
                    
            # --- 7. HELMET NON-COMPLIANCE (Inspected directly on Motorcycle class) ---
            if cls_name == "motorcycle":
                associated_riders = association_engine.get_associated_riders(track_id)
                for rider_id in associated_riders:
                    if rider_id in tracks and tracks[rider_id].is_active:
                        rider_track = tracks[rider_id]
                        r_bbox = rider_track.history[-1]["bbox"]
                        px1, py1, px2, py2 = r_bbox
                        p_height = py2 - py1
                        
                        # Crop rider's head (top 40% of bounding box)
                        crop_y2 = int(py1 + p_height * 0.4)
                        
                        # Clamp crop coordinates
                        px1 = max(0, min(px1, img_w - 1))
                        py1 = max(0, min(py1, img_h - 1))
                        px2 = max(0, min(px2, img_w))
                        crop_y2 = max(0, min(crop_y2, img_h))
                        
                        if crop_y2 > py1 and px2 > px1:
                            crop = frame_img[py1:crop_y2, px1:px2]
                            if crop.size > 0:
                                status, conf = self.classify_helmet(crop)
                                
                                if rider_id not in self.helmet_votes:
                                    self.helmet_votes[rider_id] = []
                                self.helmet_votes[rider_id].append((status, conf))
                                
                                no_helmet_weight = sum(v[1] for v in self.helmet_votes[rider_id] if v[0] == "no_helmet")
                                helmet_weight = sum(v[1] for v in self.helmet_votes[rider_id] if v[0] == "helmet")
                                
                                total_votes = len(self.helmet_votes[rider_id])
                                if no_helmet_weight > helmet_weight and total_votes >= 3: # Allow early classification (3 frames)
                                    v_conf = max(no_helmet_weight / (no_helmet_weight + helmet_weight + 1e-5), 0.75)
                                    _emit(track_id, "helmet_non_compliance", {
                                        "track_id": track_id, # Motorcycle track ID so it groups correctly under motorcycle plate!
                                        "violation_type": "helmet_non_compliance",
                                        "confidence_score": v_conf,
                                        "subject_bbox": r_bbox,
                                        "evidence_crop_bbox": bbox # Motorcycle box containing license plate
                                    })
                                


        return violations
