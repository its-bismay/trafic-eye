from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from backend.database import get_db
from backend.models.violation import Violation
from backend.models.vehicle_intelligence import VehicleIntelligenceRecord
from backend.models.evidence_bundle import EvidenceBundle
from backend.models.track_history import TrackHistory
from backend.schemas import ViolationOut
from backend.routers.auth import get_current_user
from backend.models.user import User
from backend.services.s3_service import storage_service

router = APIRouter(prefix="/violations", tags=["violations"])

@router.get("", response_model=List[ViolationOut])
def search_violations(
    plate: str = Query(..., description="Plate number to search for (exact match or partial)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    clean_plate = plate.upper().strip()
    
    violations = db.query(Violation).filter(Violation.plate_number.contains(clean_plate)).order_by(Violation.created_at.desc()).all()
    
    for viol in violations:
        if not viol.annotated_frame_s3_url.startswith("http"):
            s3_key = f"violations/{viol.video_id}/{viol.plate_number}/{viol.violation_type}_frame{viol.frame_number}.jpg"
            viol.annotated_frame_s3_url = storage_service.get_presigned_url(s3_key)
        
    return violations

@router.get("/{video_id}", response_model=List[ViolationOut])
def get_violations_by_video(
    video_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    violations = db.query(Violation).filter(Violation.video_id == video_id).order_by(Violation.frame_number.asc()).all()
    
    for viol in violations:
        if not viol.annotated_frame_s3_url.startswith("http"):
            s3_key = f"violations/{viol.video_id}/{viol.plate_number}/{viol.violation_type}_frame{viol.frame_number}.jpg"
            viol.annotated_frame_s3_url = storage_service.get_presigned_url(s3_key)
        
    return violations

# --- ANALYTICS & VEHICLE INTELLIGENCE RECORD ENDPOINTS ---

@router.get("/analytics/repeat-offenders")
def get_repeat_offenders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    records = db.query(VehicleIntelligenceRecord).options(joinedload(VehicleIntelligenceRecord.evidence_bundles)).filter(
        VehicleIntelligenceRecord.final_plate_number != None,
        VehicleIntelligenceRecord.final_plate_number != "UNKNOWN",
        VehicleIntelligenceRecord.final_plate_number != ""
    ).all()
    
    plate_groups: Dict[str, Dict[str, Any]] = {}
    for r in records:
        plate = r.final_plate_number
        if plate not in plate_groups:
            plate_groups[plate] = {
                "plate_number": plate,
                "vehicle_type": r.vehicle_type,
                "total_violations": 0,
                "violation_details": [],
                "last_seen": r.created_at,
                "video_ids": set()
            }
        
        viols = [eb.violation_type for eb in r.evidence_bundles]
        plate_groups[plate]["total_violations"] += len(viols)
        for v in viols:
            plate_groups[plate]["violation_details"].append({
                "violation_type": v,
                "timestamp": r.created_at,
                "video_id": r.video_id
            })
        plate_groups[plate]["video_ids"].add(r.video_id)
        if r.created_at > plate_groups[plate]["last_seen"]:
            plate_groups[plate]["last_seen"] = r.created_at
            
    repeaters = [
        {
            "plate_number": p["plate_number"],
            "vehicle_type": p["vehicle_type"],
            "total_violations": p["total_violations"],
            "violation_details": p["violation_details"],
            "last_seen": p["last_seen"],
            "video_count": len(p["video_ids"])
        }
        for p in plate_groups.values() if p["total_violations"] >= 2
    ]
    repeaters.sort(key=lambda x: x["total_violations"], reverse=True)
    return repeaters

@router.get("/analytics/hotspots")
def get_violation_hotspots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    violation_counts = db.query(
        Violation.violation_type, func.count(Violation.id)
    ).group_by(Violation.violation_type).all()
    
    counts_dict = {vt: count for vt, count in violation_counts}
    
    records = db.query(VehicleIntelligenceRecord).options(
        joinedload(VehicleIntelligenceRecord.track_histories),
        joinedload(VehicleIntelligenceRecord.evidence_bundles)
    ).all()
    
    spatial_data = []
    speed_data = []
    
    for r in records:
        traj = r.track_histories
        viols = [eb.violation_type for eb in r.evidence_bundles]
        
        if viols and traj:
            last_point = traj[-1]
            spatial_data.append({
                "track_id": r.track_id,
                "vehicle_type": r.vehicle_type,
                "centroid": last_point.centroid,
                "violations": viols
            })
            
        for pt in traj:
            speed = pt.speed or 0.0
            if speed > 0.0:
                speed_data.append(speed)
                
    avg_speed = sum(speed_data) / len(speed_data) if speed_data else 0.0
    max_speed = max(speed_data) if speed_data else 0.0
    
    return {
        "violation_type_distribution": counts_dict,
        "average_speed_detected": round(avg_speed, 1),
        "maximum_speed_detected": round(max_speed, 1),
        "hotspot_centroids": spatial_data
    }

def _serialize_vir(r: VehicleIntelligenceRecord) -> Dict[str, Any]:
    ev_frames = {}
    for eb in r.evidence_bundles:
        url = eb.s3_url
        if not url.startswith("http"):
            plate_slug = r.final_plate_number or f"UNKNOWN_TRACK_{r.track_id}"
            s3_key = f"violations/{r.video_id}/{plate_slug}/{eb.violation_type}_frame{eb.frame_number}.jpg"
            url = storage_service.get_presigned_url(s3_key)
        
        ev_frames[eb.violation_type] = {
            "frame_number": eb.frame_number,
            "timestamp": eb.timestamp,
            "url": url,
            "confidence_score": eb.confidence
        }
        
    return {
        "id": r.id,
        "video_id": r.video_id,
        "track_id": r.track_id,
        "vehicle_type": r.vehicle_type,
        "final_plate_number": r.final_plate_number,
        "trajectory_history": [
            {
                "bbox": th.bbox,
                "centroid": th.centroid,
                "frame_number": th.frame_number,
                "speed": th.speed,
                "timestamp": th.timestamp
            } for th in r.track_histories
        ],
        "associated_riders": [ra.rider_track_id for ra in r.rider_associations],
        "detected_violations": [eb.violation_type for eb in r.evidence_bundles],
        "evidence_frames": ev_frames,
        "ocr_history": [
            {
                "plate": oh.plate_text,
                "confidence": oh.confidence,
                "frame_number": oh.frame_number
            } for oh in r.ocr_histories
        ],
        "confidence_metrics": r.confidence_metrics,
        "created_at": r.created_at
    }

@router.get("/records/{video_id}")
def get_records_by_video(
    video_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    records = db.query(VehicleIntelligenceRecord).filter(
        VehicleIntelligenceRecord.video_id == video_id
    ).options(
        joinedload(VehicleIntelligenceRecord.track_histories),
        joinedload(VehicleIntelligenceRecord.ocr_histories),
        joinedload(VehicleIntelligenceRecord.rider_associations),
        joinedload(VehicleIntelligenceRecord.evidence_bundles)
    ).order_by(VehicleIntelligenceRecord.track_id.asc()).all()
    
    return [_serialize_vir(r) for r in records]

@router.get("/records/track/{record_id}")
def get_record_by_id(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    r = db.query(VehicleIntelligenceRecord).filter(VehicleIntelligenceRecord.id == record_id).options(
        joinedload(VehicleIntelligenceRecord.track_histories),
        joinedload(VehicleIntelligenceRecord.ocr_histories),
        joinedload(VehicleIntelligenceRecord.rider_associations),
        joinedload(VehicleIntelligenceRecord.evidence_bundles)
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Vehicle record not found.")
        
    return _serialize_vir(r)

@router.get("/records/all/list")
def get_all_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    records = db.query(VehicleIntelligenceRecord).options(
        joinedload(VehicleIntelligenceRecord.track_histories),
        joinedload(VehicleIntelligenceRecord.ocr_histories),
        joinedload(VehicleIntelligenceRecord.rider_associations),
        joinedload(VehicleIntelligenceRecord.evidence_bundles)
    ).order_by(VehicleIntelligenceRecord.created_at.desc()).all()
    
    return [_serialize_vir(r) for r in records]
