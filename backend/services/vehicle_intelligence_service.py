from sqlalchemy.orm import Session
from typing import List, Dict, Any
from backend.models.vehicle_intelligence import VehicleIntelligenceRecord
from backend.models.track_history import TrackHistory
from backend.models.ocr_history import OCRHistory
from backend.models.rider_association import RiderAssociation
from backend.models.evidence_bundle import EvidenceBundle
from backend.models.violation import Violation

class VehicleIntelligenceService:
    def create_or_update_vir(self, db: Session, video_id: str, t_id: int, track: Any, evidence_bundles: List[Dict[str, Any]], raw_violations: List[Dict[str, Any]]) -> VehicleIntelligenceRecord:
        avg_conf = sum(h["confidence"] for h in track.history) / len(track.history) if track.history else 0.0
        max_plate_conf = max((x["confidence"] for x in track.ocr_history), default=0.0) if hasattr(track, 'ocr_history') and track.ocr_history else 0.0
        
        vir = VehicleIntelligenceRecord(
            video_id=video_id,
            track_id=t_id,
            vehicle_type=track.class_name,
            final_plate_number=track.final_plate_number,
            confidence_metrics={
                "average_detection_confidence": float(avg_conf),
                "final_plate_confidence": float(max_plate_conf)
            }
        )
        db.add(vir)
        db.flush() # get ID

        # Build Track Histories
        for i, h in enumerate(track.history):
            speed = track.speeds[i] if i < len(track.speeds) else track.current_speed
            db.add(TrackHistory(
                vir_id=vir.id,
                frame_number=h["frame_number"],
                timestamp=h["timestamp"],
                bbox=h["bbox"],
                centroid=list(h["centroid"]),
                speed=float(speed),
                confidence=float(h["confidence"])
            ))

        # Build OCR Histories
        if hasattr(track, 'ocr_history'):
            for o in track.ocr_history:
                db.add(OCRHistory(
                    vir_id=vir.id,
                    frame_number=o["frame_number"],
                    plate_text=o["plate"],
                    confidence=float(o["confidence"])
                ))

        # Build Rider Associations
        if hasattr(track, 'associated_riders'):
            for rider_id in track.associated_riders:
                db.add(RiderAssociation(
                    vir_id=vir.id,
                    rider_track_id=int(rider_id),
                    confidence=0.85, # default
                    start_frame=track.history[0]["frame_number"] if track.history else 0
                ))

        # Build Evidence
        for ev in evidence_bundles:
            db.add(EvidenceBundle(
                vir_id=vir.id,
                violation_type=ev["violation_type"],
                frame_number=ev["frame_number"],
                timestamp=ev["timestamp"],
                s3_url=ev["s3_url"],
                confidence=float(ev["confidence"])
            ))
            
        # Build Violations
        plate_slug = track.final_plate_number or f"UNKNOWN_TRACK_{t_id}"
        for viol in raw_violations:
            ev_match = next((e for e in evidence_bundles if e["violation_type"] == viol["violation_type"]), None)
            s3_url = ev_match["s3_url"] if ev_match else ""
            db.add(Violation(
                video_id=video_id,
                vir_id=vir.id,
                plate_number=plate_slug,
                violation_type=viol["violation_type"],
                frame_number=viol["frame_number"],
                timestamp_in_video=viol["timestamp"],
                confidence_score=viol["confidence_score"],
                annotated_frame_s3_url=s3_url,
                vehicle_type=track.class_name
            ))
            
        return vir

vehicle_intelligence_service = VehicleIntelligenceService()
