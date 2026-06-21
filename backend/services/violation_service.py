from typing import List, Dict, Any, Optional
import numpy as np
from ml.violation_rules import ViolationRulesEngine

class ViolationService:
    def __init__(self):
        self._engine = ViolationRulesEngine()

    def process_temporal_violations(self, tracks: Dict[int, Any], association_engine: Any, frame_img: np.ndarray, frame_idx: int, timestamp: float, speed_limit: int, stop_line_y: Optional[int]) -> List[Dict[str, Any]]:
        return self._engine.process_temporal_violations(tracks, association_engine, frame_img, frame_idx, timestamp, speed_limit, stop_line_y)
