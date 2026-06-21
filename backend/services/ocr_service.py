from typing import List, Dict, Any, Tuple
import numpy as np
from backend.ml.ocr_service import ocr_service as ml_ocr_service

class OCRService:
    def extract_plate(self, frame_img: np.ndarray, vehicle_bbox: List[int], video_id: str, frame_num: int) -> Tuple[str, float]:
        return ml_ocr_service.extract_plate(frame_img, vehicle_bbox, video_id, frame_num)

    def converge_plate_identity(self, ocr_history: List[Dict[str, Any]]) -> str:
        """
        Voting-based aggregation across multiple frames.
        ocr_history is a list of {'plate': str, 'confidence': float, 'frame_number': int}
        """
        return ml_ocr_service.converge_plate_identity(ocr_history)

ocr_service_instance = OCRService()
