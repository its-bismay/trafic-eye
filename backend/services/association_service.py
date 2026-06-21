from typing import Dict, Any
from backend.ml.association import VehiclePersonAssociationEngine

class AssociationService:
    def __init__(self):
        self._engine = VehiclePersonAssociationEngine()

    def associate(self, active_tracks: Dict[int, Any], frame_idx: int) -> None:
        """
        Links person tracks to vehicle tracks over time.
        """
        self._engine.associate(active_tracks, frame_idx)

    def get_consistent_rider_count(self, vehicle_track_id: int) -> int:
        return self._engine.get_consistent_rider_count(vehicle_track_id)
        
    def get_associated_riders(self, vehicle_track_id: int) -> set:
        return self._engine.get_associated_riders(vehicle_track_id)
