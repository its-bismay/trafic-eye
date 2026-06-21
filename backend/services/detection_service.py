from typing import List, Dict, Any
import numpy as np
from ml.detector import detector

class DetectionService:
    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Abstracted detection interface. 
        Returns list of dicts: {'bbox': [x1, y1, x2, y2], 'confidence': float, 'class': str}
        """
        return detector.detect(frame)

detection_service = DetectionService()
