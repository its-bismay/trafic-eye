import numpy as np
import math
from typing import List, Dict, Any, Tuple

def get_iou(box1: List[int], box2: List[int]) -> float:
    """Calculates Intersection over Union (IoU) of two bounding boxes."""
    xA = max(box1[0], box2[0])
    yA = max(box1[1], box2[1])
    xB = min(box1[2], box2[2])
    yB = min(box1[3], box2[3])
    
    interArea = max(0, xB - xA) * max(0, yB - yA)
    box1Area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2Area = (box2[2] - box2[0]) * (box2[3] - box2[1])
    
    if box1Area + box2Area - interArea == 0:
        return 0.0
        
    return interArea / float(box1Area + box2Area - interArea)

class Track:
    def __init__(self, track_id: int, bbox: List[int], confidence: float, class_name: str, frame_num: int, timestamp: float):
        self.track_id = track_id
        self.class_name = class_name
        self.is_active = True
        self.lost_frames = 0
        
        # Centroid
        cx = int((bbox[0] + bbox[2]) / 2.0)
        cy = int((bbox[1] + bbox[3]) / 2.0)
        
        self.history = [{
            "bbox": bbox,
            "centroid": (cx, cy),
            "confidence": confidence,
            "frame_number": frame_num,
            "timestamp": timestamp
        }]
        
        self.speeds = [0.0]
        self.current_speed = 0.0
        self.stationary_frames = 0
        
        # OCR plate info
        self.ocr_history = []  # List of {"plate": str, "confidence": float, "frame_number": int}
        self.final_plate_number = None
        self.associated_riders = set()  # Set of rider track IDs

    def update(self, bbox: List[int], confidence: float, frame_num: int, timestamp: float, fps: int, step: int):
        self.lost_frames = 0
        self.is_active = True
        
        cx = int((bbox[0] + bbox[2]) / 2.0)
        cy = int((bbox[1] + bbox[3]) / 2.0)
        
        # Time delta from exact video frame timestamps
        prev_timestamp = self.history[-1]["timestamp"]
        dt = timestamp - prev_timestamp
        if dt <= 0:
            dt = step / fps if fps > 0 else 0.125
        
        # Dynamic Camera Calibration Heuristics (no manual angle configuration required):
        # A vehicle's pixel height is a proxy for its distance from the camera.
        # We determine the real height by class: Motorcycle (1.0m), Truck/Bus (3.0m), others (1.5m).
        h_pixel = bbox[3] - bbox[1]
        real_h = 1.0 if self.class_name == "motorcycle" else (3.0 if self.class_name in {"bus", "truck"} else 1.5)
        meters_per_pixel = real_h / h_pixel if h_pixel > 0 else 0.05
        
        # Speed estimate
        prev_centroid = self.history[-1]["centroid"]
        dx = cx - prev_centroid[0]
        dy = cy - prev_centroid[1]
        dist_pixels = math.sqrt(dx*dx + dy*dy)
        
        dist_meters = dist_pixels * meters_per_pixel
        speed_kmh = (dist_meters / dt) * 3.6 if dt > 0 else 0.0
        
        # Smooth speed
        self.current_speed = 0.6 * self.current_speed + 0.4 * speed_kmh
        self.speeds.append(self.current_speed)
        
        # Stationary check
        if dist_pixels < 10.0:
            self.stationary_frames += 1
        else:
            self.stationary_frames = 0
            
        self.history.append({
            "bbox": bbox,
            "centroid": (cx, cy),
            "confidence": confidence,
            "frame_number": frame_num,
            "timestamp": timestamp
        })

    def mark_lost(self):
        self.lost_frames += 1
        self.is_active = False

class ByteTracker:
    def __init__(self, max_lost_frames: int = 15, high_conf_thresh: float = 0.4, low_conf_thresh: float = 0.1):
        self.next_track_id = 1
        self.tracks: Dict[int, Track] = {}
        self.max_lost_frames = max_lost_frames
        self.high_conf_thresh = high_conf_thresh
        self.low_conf_thresh = low_conf_thresh

    def update(self, detections: List[Dict[str, Any]], frame_num: int, timestamp: float, fps: int, step: int) -> Dict[int, Track]:
        """
        Runs ByteTrack tracking logic.
        detections: List of {"class": str, "bbox": [x1,y1,x2,y2], "confidence": float}
        """
        # Split detections
        high_dets = []
        low_dets = []
        
        for det in detections:
            if det["confidence"] >= self.high_conf_thresh:
                high_dets.append(det)
            elif det["confidence"] >= self.low_conf_thresh:
                low_dets.append(det)
                
        # Group active and lost tracks
        active_tracks = []
        lost_tracks = []
        for track in self.tracks.values():
            if track.is_active or track.lost_frames < self.max_lost_frames:
                active_tracks.append(track)
            else:
                lost_tracks.append(track)
                
        # Remove completely lost tracks
        for lt in lost_tracks:
            if lt.track_id in self.tracks:
                del self.tracks[lt.track_id]
                
        # Re-fetch remaining valid tracks (active or temporarily lost)
        valid_tracks = [t for t in self.tracks.values() if t.lost_frames < self.max_lost_frames]
        
        # 1. Match active tracks with high-confidence detections
        matched_tracks_high, unmatched_tracks, unmatched_dets_high = self._associate(valid_tracks, high_dets)
        
        # Update matched high-confidence tracks
        for track_id, det in matched_tracks_high:
            track = self.tracks[track_id]
            track.update(det["bbox"], det["confidence"], frame_num, timestamp, fps, step)
            
        # 2. Match remaining unmatched tracks with low-confidence detections
        remaining_tracks = [self.tracks[tid] for tid in unmatched_tracks]
        matched_tracks_low, unmatched_tracks_final, unmatched_dets_low = self._associate(remaining_tracks, low_dets)
        
        # Update matched low-confidence tracks
        for track_id, det in matched_tracks_low:
            track = self.tracks[track_id]
            track.update(det["bbox"], det["confidence"], frame_num, timestamp, fps, step)
            
        # Mark remaining tracks as lost
        for tid in unmatched_tracks_final:
            self.tracks[tid].mark_lost()
            
        # 3. Create new tracks for unmatched high-confidence detections
        for det in unmatched_dets_high:
            new_track = Track(
                track_id=self.next_track_id,
                bbox=det["bbox"],
                confidence=det["confidence"],
                class_name=det["class"],
                frame_num=frame_num,
                timestamp=timestamp
            )
            self.tracks[self.next_track_id] = new_track
            self.next_track_id += 1
            
        return {tid: t for tid, t in self.tracks.items() if t.is_active}

    def _associate(self, tracks: List[Track], detections: List[Dict[str, Any]], iou_threshold: float = 0.2) -> Tuple[List[Tuple[int, Dict[str, Any]]], List[int], List[Dict[str, Any]]]:
        """
        Greedy IoU association. Matches tracks to detections of the SAME class.
        """
        if not tracks or not detections:
            return [], [t.track_id for t in tracks], detections
            
        # Create cost matrix (IoU)
        matches = []
        used_tracks = set()
        used_dets = set()
        
        # Sort candidate pairs by IoU in descending order
        candidates = []
        for i, track in enumerate(tracks):
            for j, det in enumerate(detections):
                # Ensure the class match or matching generic vehicle types to handle tiny YOLO classification flips
                is_class_compatible = (track.class_name == det["class"]) or \
                                     (track.class_name in {"car", "bus", "truck"} and det["class"] in {"car", "bus", "truck"})
                                     
                if is_class_compatible:
                    iou = get_iou(track.history[-1]["bbox"], det["bbox"])
                    if iou > iou_threshold:
                        candidates.append((iou, track.track_id, j))
                        
        candidates.sort(key=lambda x: x[0], reverse=True)
        
        for iou, track_id, det_idx in candidates:
            if track_id not in used_tracks and det_idx not in used_dets:
                matches.append((track_id, detections[det_idx]))
                used_tracks.add(track_id)
                used_dets.add(det_idx)
                
        unmatched_tracks = [t.track_id for t in tracks if t.track_id not in used_tracks]
        unmatched_dets = [det for j, det in enumerate(detections) if j not in used_dets]
        
        return matches, unmatched_tracks, unmatched_dets
