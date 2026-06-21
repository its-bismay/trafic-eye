import cv2
import numpy as np
from datetime import datetime
from typing import List, Dict, Any

def scale_bbox(bbox: List[int], original_shape: tuple, target_shape: tuple = (640, 640)) -> List[int]:
    """
    Scales a bounding box from target_shape (640x640) back to original_shape (H, W).
    """
    orig_h, orig_w = original_shape[:2]
    tgt_h, tgt_w = target_shape[:2]
    
    scale_x = orig_w / tgt_w
    scale_y = orig_h / tgt_h
    
    x1, y1, x2, y2 = bbox
    return [
        int(x1 * scale_x),
        int(y1 * scale_y),
        int(x2 * scale_x),
        int(y2 * scale_y)
    ]

def annotate_frame(
    original_frame: np.ndarray,
    detections: List[Dict[str, Any]],
    violations_in_frame: List[Dict[str, Any]],
    target_shape: tuple = (640, 640),
    frame_number: int = 0,
    timestamp: float = 0.0
) -> np.ndarray:
    """
    Draws boxes, labels, and watermarks on the original frame.
    
    detections: all detected objects in the frame (coordinates in target_shape 640x640)
    violations_in_frame: violations flagged in this frame
    """
    # Create a copy of the frame to avoid modifying the original in-place
    annotated = original_frame.copy()
    orig_shape = annotated.shape
    
    # 1. Draw green boxes around all detected objects
    for det in detections:
        x1, y1, x2, y2 = scale_bbox(det["bbox"], orig_shape, target_shape)
        cls_name = det["class"]
        conf = det["confidence"]
        
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(
            annotated,
            f"{cls_name} ({conf:.2f})",
            (x1, max(15, y1 - 5)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 255, 0),
            1
        )
        
    # 2. Draw red boxes and violation labels around violating entities
    for viol in violations_in_frame:
        subject_bbox = viol["subject_bbox"]
        sx1, sy1, sx2, sy2 = scale_bbox(subject_bbox, orig_shape, target_shape)
        
        v_type = viol["violation_type"]
        plate = viol.get("plate_number", "UNKNOWN")
        v_conf = viol["confidence_score"]
        
        # Red bounding box for violators
        cv2.rectangle(annotated, (sx1, sy1), (sx2, sy2), (0, 0, 255), 3)
        
        # Details overlay label
        speed_str = f" ({viol['speed']} km/h)" if "speed" in viol else ""
        label_text = f"VIOLATION: {v_type.replace('_', ' ').upper()}{speed_str} | Plate: {plate} | Conf: {v_conf:.2f}"
        
        # Calculate text background box
        (w, h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(annotated, (sx1, max(0, sy1 - h - 10)), (sx1 + w + 10, sy1), (0, 0, 255), -1)
        
        cv2.putText(
            annotated,
            label_text,
            (sx1 + 5, max(15, sy1 - 5)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )

    # 3. Timestamp overlay bottom-left: "Frame: X | Time: Ys"
    timestamp_text = f"Frame: {frame_number} | Time: {timestamp:.1f}s"
    cv2.putText(
        annotated,
        timestamp_text,
        (20, orig_shape[0] - 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2,
        cv2.LINE_AA
    )
    
    # 4. Watermark top-right: "AUTO-DETECTED | <datetime UTC>"
    utc_now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    watermark_text = f"AUTO-DETECTED | {utc_now}"
    
    (wm_w, wm_h), _ = cv2.getTextSize(watermark_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
    cv2.putText(
        annotated,
        watermark_text,
        (orig_shape[1] - wm_w - 20, 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (0, 255, 255),  # Yellow watermark
        2,
        cv2.LINE_AA
    )
    
    return annotated
