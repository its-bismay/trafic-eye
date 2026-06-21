import os
import cv2
import tempfile
from typing import Dict, List, Any
import numpy as np
from backend.ml.annotator import annotate_frame
from backend.services.s3_service import storage_service

class EvidenceService:
    def generate_evidence_bundle(self, video_id: str, plate_slug: str, v_type: str, frame_idx: int, timestamp: float, conf: float, render_frame: np.ndarray, detections: List, violations: List) -> Dict[str, Any]:
        annotated_frame = annotate_frame(
            original_frame=render_frame,
            detections=detections,
            violations_in_frame=violations,
            target_shape=(640, 640),
            frame_number=frame_idx,
            timestamp=timestamp
        )

        temp_name = f"violation_{video_id}_{plate_slug}_{v_type}_frame{frame_idx}.jpg"
        temp_path = os.path.join(tempfile.gettempdir(), temp_name)
        cv2.imwrite(temp_path, annotated_frame)

        s3_dest_key = f"violations/{video_id}/{plate_slug}/{v_type}_frame{frame_idx}.jpg"
        storage_service.upload_file(temp_path, s3_dest_key)
        presigned_url = storage_service.get_presigned_url(s3_dest_key) or ""

        if os.path.exists(temp_path):
            os.remove(temp_path)

        return {
            "violation_type": v_type,
            "frame_number": frame_idx,
            "timestamp": timestamp,
            "s3_url": presigned_url,
            "confidence": conf
        }

evidence_service = EvidenceService()
