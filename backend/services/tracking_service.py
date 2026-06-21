from typing import List, Dict, Any
import numpy as np
from ml.tracker import ByteTracker

class TrackingService:
    def __init__(self):
        self._tracker = ByteTracker()

    def update(self, detections: List[Dict[str, Any]], frame_idx: int, timestamp: float, native_fps: int, step_val: int) -> Dict[int, Any]:
        """
        Updates the tracking state and returns a dict of active tracks.
        Keys are track IDs, values are Track objects.
        """
        return self._tracker.update(detections, frame_idx, timestamp, native_fps, step_val)

    def get_all_tracks(self):
        return self._tracker.tracks
