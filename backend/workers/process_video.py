import os
import cv2
import numpy as np
import tempfile
import asyncio
from datetime import datetime
from sqlalchemy.orm import Session
from typing import Dict, List, Any, Optional

from backend.database import SessionLocal
from backend.config import settings
from backend.models.video import Video
from backend.services.s3_service import storage_service
from backend.services.ws_manager import ws_manager
from backend.services.detection_service import detection_service
from backend.services.tracking_service import TrackingService
from backend.services.association_service import AssociationService
from backend.services.ocr_service import ocr_service_instance as ocr_service
from backend.services.enhancement_service import EnhancementService
from backend.services.violation_service import ViolationService
from backend.services.evidence_service import evidence_service
from backend.services.vehicle_intelligence_service import vehicle_intelligence_service

def _send_ws(video_id: str, payload: dict):
    """Synchronous WS broadcast helper safe for background threads."""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(ws_manager.broadcast_status(video_id, payload))
        loop.close()
    except Exception as e:
        print(f"[WS] broadcast error: {e}")

def process_video_task(video_id: str):
    """
    Main background task — modular ML pipeline:
      Quality assessment → Detection → ByteTrack → Association →
      Temporal Rules → OCR convergence → Evidence → DB records.
    """
    db: Session = SessionLocal()
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        print(f"[WORKER] Video {video_id} not found in DB.")
        db.close()
        return

    temp_video_path: Optional[str] = None

    try:
        video.status = "processing"
        db.commit()

        def send_ws_update(stage: str):
            _send_ws(video_id, {"video_id": video_id, "status": "processing", "stage": stage})

        # ── STEP 1: Resolve video file ──────────────────────────────────────
        send_ws_update("Downloading / Loading Video")
        if storage_service.use_s3:
            suffix = os.path.splitext(video.original_filename)[1]
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            temp_video_path = tmp.name
            tmp.close()
            print(f"[WORKER] Downloading {video.s3_key} from S3...")
            storage_service.s3_client.download_file(
                storage_service.bucket_name, video.s3_key, temp_video_path
            )
        else:
            temp_video_path = str(settings.MEDIA_DIR / video.s3_key)

        if not os.path.exists(temp_video_path):
            raise FileNotFoundError(f"Video file not found: {temp_video_path}")

        # ── STEP 2: Preprocessing ───────────────────────────────────────────
        send_ws_update("Extracting & Assessing Video Frames")
        enhancement_service = EnhancementService()

        extracted_frames, duration_seconds, native_fps = enhancement_service.process_video_generator(temp_video_path, target_fps=8)
        if not extracted_frames:
            raise ValueError("No frames could be extracted from the video.")

        video.duration_seconds = duration_seconds
        video.fps_extracted = 8
        db.commit()

        native_fps = max(native_fps, 1)
        step_val = max(1, round(native_fps / 8))

        # ── STEP 3: Initialize pipeline engines ─────────────────────────────
        tracking_service = TrackingService()
        association_service = AssociationService()
        violation_service = ViolationService()

        frame_logs: List[Dict[str, Any]] = []
        frame_log_index: Dict[int, int] = {}

        send_ws_update("Running Multi-Object Tracking & Association")

        # ── STEP 3a: Frame loop ──────────────────────────────────────────────
        for frame_idx, enhanced_img, timestamp in extracted_frames:
            # Quality selective enhancement
            try:
                assessment = enhancement_service.assess_frame(enhanced_img)
                enhanced_img, _ = enhancement_service.enhance_frame(enhanced_img, assessment)
            except Exception as qe:
                print(f"[WORKER] Quality layer error on frame {frame_idx}: {qe}")

            # Detection
            try:
                detections = detection_service.detect(enhanced_img)
            except Exception as de:
                print(f"[WORKER] Detection error on frame {frame_idx}: {de}")
                detections = []

            # Tracking
            try:
                active_tracks = tracking_service.update(detections, frame_idx, timestamp, native_fps, step_val)
            except Exception as te:
                print(f"[WORKER] Tracker error on frame {frame_idx}: {te}")
                active_tracks = {}

            # Association
            try:
                association_service.associate(active_tracks, frame_idx)
            except Exception as ae:
                print(f"[WORKER] Association error on frame {frame_idx}: {ae}")

            # OCR on vehicle crops
            send_ws_update("Reading License Plates")
            for track_id, track in active_tracks.items():
                if track.class_name in {"car", "motorcycle", "bus", "truck"}:
                    try:
                        bbox = track.history[-1]["bbox"]
                        vx1, vy1, vx2, vy2 = bbox
                        plate_number, ocr_conf = ocr_service.extract_plate(
                            frame_img=enhanced_img,
                            vehicle_bbox=[vx1, vy1, vx2, vy2],
                            video_id=video_id,
                            frame_num=frame_idx
                        )
                        if not hasattr(track, 'ocr_history'):
                            track.ocr_history = []
                        track.ocr_history.append({
                            "plate": plate_number,
                            "confidence": ocr_conf,
                            "frame_number": frame_idx
                        })
                        track.final_plate_number = ocr_service.converge_plate_identity(track.ocr_history)
                    except Exception as oe:
                        print(f"[WORKER] OCR error track {track_id} frame {frame_idx}: {oe}")

            # Temporal violation rules
            try:
                frame_violations = violation_service.process_temporal_violations(
                    tracks=active_tracks,
                    association_engine=association_service._engine,
                    frame_img=enhanced_img,
                    frame_idx=frame_idx,
                    timestamp=timestamp,
                    speed_limit=video.speed_limit or 60,
                    stop_line_y=video.stop_line_y
                )
            except Exception as ve:
                print(f"[WORKER] Violation rules error on frame {frame_idx}: {ve}")
                frame_violations = []

            log_entry = {
                "frame_idx": frame_idx,
                "timestamp": timestamp,
                "detections": detections,
                "violations": frame_violations,
                "enhanced_img": enhanced_img,
            }
            frame_log_index[frame_idx] = len(frame_logs)
            frame_logs.append(log_entry)

        send_ws_update("Consolidating Evidence & Analytics")

        # ── STEP 4: Group violations by track ───────────────────────────────
        grouped_violations: Dict[int, Dict[str, List[Dict[str, Any]]]] = {}
        for log in frame_logs:
            for viol in log["violations"]:
                t_id = viol.get("track_id")
                if t_id is None:
                    continue
                v_type = viol["violation_type"]
                grouped_violations.setdefault(t_id, {}).setdefault(v_type, []).append({
                    "frame_idx": log["frame_idx"],
                    "timestamp": log["timestamp"],
                    "confidence_score": viol["confidence_score"],
                    "violation": viol
                })

        # ── STEP 5: Evidence generation & DB write ──────────────────────────
        total_violations_saved = 0
        records_to_save_count = 0

        send_ws_update("Generating Evidence Frames")

        all_tracks = tracking_service.get_all_tracks()
        for t_id, track in all_tracks.items():
            if track.class_name not in {"car", "motorcycle", "bus", "truck"}:
                continue

            plate_slug = track.final_plate_number or f"UNKNOWN_TRACK_{t_id}"
            vehicle_violations = grouped_violations.get(t_id, {})
            
            evidence_bundles = []
            raw_violations = []

            for v_type, occurrences in vehicle_violations.items():
                try:
                    occurrences.sort(key=lambda x: x["confidence_score"], reverse=True)
                    best = occurrences[0]

                    best_frame_idx = best["frame_idx"]
                    best_timestamp = best["timestamp"]
                    best_conf = best["confidence_score"]

                    log_pos = frame_log_index.get(best_frame_idx)
                    if log_pos is not None:
                        log_for_frame = frame_logs[log_pos]
                        render_frame = log_for_frame["enhanced_img"].copy()
                    else:
                        render_frame = np.zeros((640, 640, 3), dtype=np.uint8)
                        log_for_frame = {"detections": [], "violations": []}

                    annotated_violations_in_frame = []
                    for v in log_for_frame["violations"]:
                        v_tid = v.get("track_id")
                        v_plate = "UNKNOWN"
                        if v_tid is not None and v_tid in all_tracks:
                            v_plate = all_tracks[v_tid].final_plate_number or "UNKNOWN"
                        v_annot = v.copy()
                        v_annot["plate_number"] = v_plate
                        annotated_violations_in_frame.append(v_annot)

                    evidence_record = evidence_service.generate_evidence_bundle(
                        video_id=video_id,
                        plate_slug=plate_slug,
                        v_type=v_type,
                        frame_idx=best_frame_idx,
                        timestamp=best_timestamp,
                        conf=best_conf,
                        render_frame=render_frame,
                        detections=log_for_frame["detections"],
                        violations=annotated_violations_in_frame
                    )
                    evidence_bundles.append(evidence_record)
                    
                    # Create dict for the violation
                    raw_violations.append({
                        "violation_type": v_type,
                        "frame_number": best_frame_idx,
                        "timestamp": best_timestamp,
                        "confidence_score": best_conf
                    })
                    
                    total_violations_saved += 1

                except Exception as ev_err:
                    print(f"[WORKER] Evidence error track {t_id} violation {v_type}: {ev_err}")

            # Save VIR via VehicleIntelligenceService
            try:
                vehicle_intelligence_service.create_or_update_vir(
                    db=db,
                    video_id=video_id,
                    t_id=t_id,
                    track=track,
                    evidence_bundles=evidence_bundles,
                    raw_violations=raw_violations
                )
                records_to_save_count += 1
            except Exception as e:
                print(f"[WORKER] Failed to save VIR for track {t_id}: {e}")

        for log in frame_logs:
            log.pop("enhanced_img", None)

        # ── STEP 6: DB commit ───────────────────────────────────────────────
        video.status = "completed"
        video.processed_at = datetime.utcnow()
        db.commit()

        if storage_service.use_s3 and temp_video_path and os.path.exists(temp_video_path):
            os.remove(temp_video_path)

        _send_ws(video_id, {
            "video_id": video_id,
            "status": "completed",
            "violation_count": total_violations_saved
        })
        print(f"[WORKER] Video {video_id} completed — {records_to_save_count} vehicle records, {total_violations_saved} violations.")

    except Exception as e:
        print(f"[WORKER] FATAL error processing video {video_id}: {e}")
        import traceback; traceback.print_exc()

        try:
            video.status = "failed"
            db.commit()
        except Exception:
            pass

        _send_ws(video_id, {"video_id": video_id, "status": "failed", "error": str(e)})

    finally:
        db.close()
