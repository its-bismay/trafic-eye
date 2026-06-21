from typing import Tuple, Dict, Any
import numpy as np
from backend.ml.quality import QualityAssessmentLayer
from backend.ml.preprocessor import preprocess_video

class EnhancementService:
    def __init__(self):
        self._quality_layer = QualityAssessmentLayer()

    def assess_frame(self, frame: np.ndarray) -> Dict[str, float]:
        return self._quality_layer.assess_frame(frame)

    def enhance_frame(self, frame: np.ndarray, assessment: Dict[str, float]) -> Tuple[np.ndarray, bool]:
        return self._quality_layer.enhance_frame(frame, assessment)

    def process_video_generator(self, video_path: str, target_fps: int):
        return preprocess_video(video_path, target_fps=target_fps)
