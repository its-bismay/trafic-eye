import os
import shutil
import tempfile
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.video import Video
from backend.models.violation import Violation
from backend.schemas import VideoOut, VideoStatusOut, VideoResultsOut
from backend.routers.auth import get_current_user
from backend.models.user import User
from backend.services.s3_service import storage_service
from backend.workers.process_video import process_video_task

router = APIRouter(prefix="/videos", tags=["videos"])

@router.post("/upload", response_model=VideoOut, status_code=status.HTTP_201_CREATED)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    stop_line_y: Optional[int] = Form(None),
    speed_limit: int = Form(50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Validate file type
    allowed_extensions = {".mp4", ".avi", ".mov", ".mkv"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid video format. Allowed formats: {', '.join(allowed_extensions)}"
        )
        
    video_id = str(uuid.uuid4())
    filename = f"{video_id}{ext}"
    
    # 2. Upload file (either to S3 or copy to local media directory)
    # Write incoming file to temporary path first
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, filename)
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Target destination key
        s3_key = f"videos/{filename}"
        
        # Upload
        storage_service.upload_file(temp_path, s3_key)
        
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write uploaded file: {str(e)}"
        )
        
    finally:
        # Clean up temp file only if S3 was used (if local fallback was used, the file is copied)
        if storage_service.use_s3 and os.path.exists(temp_path):
            os.remove(temp_path)

    # Generate presigned/local URL for video playback
    video_url = storage_service.get_presigned_url(s3_key)

    # 3. Create Video DB Record
    db_video = Video(
        id=video_id,
        uploaded_by=current_user.id,
        original_filename=file.filename,
        s3_key=s3_key,
        s3_url=video_url,
        status="pending",
        speed_limit=speed_limit,
        stop_line_y=stop_line_y
    )
    
    db.add(db_video)
    db.commit()
    db.refresh(db_video)
    
    # 4. Dispatch processing to FastAPI background tasks
    background_tasks.add_task(process_video_task, video_id)
    
    return db_video

@router.get("/my", response_model=List[VideoOut])
def get_my_videos(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    videos = db.query(Video).filter(Video.uploaded_by == current_user.id).order_by(Video.created_at.desc()).all()
    
    # Refresh urls in case signatures expired
    for v in videos:
        if v.s3_key:
            v.s3_url = storage_service.get_presigned_url(v.s3_key)
            
    return videos

@router.get("/{video_id}/status", response_model=VideoStatusOut)
def get_video_status(video_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
        
    violation_count = db.query(Violation).filter(Violation.video_id == video_id).count()
    
    return {
        "status": video.status,
        "violation_count": violation_count,
        "processed_at": video.processed_at
    }

@router.get("/{video_id}/results", response_model=VideoResultsOut)
def get_video_results(video_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
        
    # Refresh pre-signed URL in case it has expired
    if video.s3_key:
        video.s3_url = storage_service.get_presigned_url(video.s3_key)
        
    violations = db.query(Violation).filter(Violation.video_id == video_id).all()
    
    # Refresh presigned urls for violations too
    for viol in violations:
        # Resolve key from url structure. Key looks like violations/{video_id}/{plate}/{v_type}_frame{frame}.jpg
        # Let's extract the key. Or we can reconstruct it from our schema
        s3_key = f"violations/{video.id}/{viol.plate_number}/{viol.violation_type}_frame{viol.frame_number}.jpg"
        viol.annotated_frame_s3_url = storage_service.get_presigned_url(s3_key)
        
    return {
        "video_metadata": video,
        "violations": violations
    }
