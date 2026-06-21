import numpy as np
from typing import Dict, List, Set, Tuple
from backend.ml.tracker import Track

def get_overlap_ratio(person_box: List[int], vehicle_box: List[int]) -> float:
    """
    Calculates what fraction of the person's bounding box is inside/overlapping
    the vehicle's bounding box.
    """
    px1, py1, px2, py2 = person_box
    vx1, vy1, vx2, vy2 = vehicle_box
    
    xA = max(px1, vx1)
    yA = max(py1, vy1)
    xB = min(px2, vx2)
    yB = min(py2, vy2)
    
    interArea = max(0, xB - xA) * max(0, yB - yA)
    personArea = (px2 - px1) * (py2 - py1)
    
    if personArea == 0:
        return 0.0
    return interArea / float(personArea)

class VehiclePersonAssociationEngine:
    def __init__(self, min_overlap: float = 0.20, frame_threshold: int = 3):
        self.min_overlap = min_overlap
        self.frame_threshold = frame_threshold
        # Maps motorcycle_track_id -> {rider_track_id -> count_of_frames_associated}
        self.association_history: Dict[int, Dict[int, int]] = {}
        # Maps motorcycle_track_id -> list of rider counts per frame
        self.rider_counts_per_frame: Dict[int, List[int]] = {}

    def associate(self, tracks: Dict[int, Track], frame_num: int):
        """
        Processes the active tracks in the current frame and updates associations.
        """
        motorcycles = [t for t in tracks.values() if t.class_name == "motorcycle" and t.is_active]
        persons = [t for t in tracks.values() if t.class_name == "person" and t.is_active]
        
        for mc in motorcycles:
            mc_id = mc.track_id
            if mc_id not in self.association_history:
                self.association_history[mc_id] = {}
            if mc_id not in self.rider_counts_per_frame:
                self.rider_counts_per_frame[mc_id] = []
                
            mc_box = mc.history[-1]["bbox"]
            current_frame_riders = []
            
            for p in persons:
                p_id = p.track_id
                p_box = p.history[-1]["bbox"]
                
                # Check spatial overlap ratio of person inside motorcycle
                overlap = get_overlap_ratio(p_box, mc_box)
                
                # Alternate checks: close centroids
                p_centroid = p.history[-1]["centroid"]
                mc_centroid = mc.history[-1]["centroid"]
                dist = np.linalg.norm(np.array(p_centroid) - np.array(mc_centroid))
                
                # A person is overlapping or extremely close to the center
                if overlap >= self.min_overlap or (overlap > 0.05 and dist < 120.0):
                    current_frame_riders.append(p_id)
                    # Increment association frame counter
                    self.association_history[mc_id][p_id] = self.association_history[mc_id].get(p_id, 0) + 1
                    
            # Record rider count in this frame
            self.rider_counts_per_frame[mc_id].append(len(current_frame_riders))
            
            # Update the motorcycle track's associated riders set
            # A rider belongs if they were associated in >= self.frame_threshold frames
            for rid, count in self.association_history[mc_id].items():
                if count >= self.frame_threshold:
                    mc.associated_riders.add(rid)

    def get_associated_riders(self, mc_id: int) -> List[int]:
        """
        Which riders belong to Motorcycle #mc_id?
        """
        if mc_id not in self.association_history:
            return []
        return [rid for rid, count in self.association_history[mc_id].items() if count >= self.frame_threshold]

    def get_consistent_rider_count(self, mc_id: int) -> int:
        """
        How many riders were consistently associated with Motorcycle #mc_id during its lifetime?
        Uses the median of active rider counts when the motorcycle was visible to avoid temporary tracking drops.
        """
        counts = self.rider_counts_per_frame.get(mc_id, [])
        if not counts:
            return 0
        # Median rider count or majority count
        return int(np.round(np.median(counts)))
