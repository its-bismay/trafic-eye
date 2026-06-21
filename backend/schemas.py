from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any
from datetime import datetime

# --- AUTH SCHEMAS ---
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "authority"  # admin, authority

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- VIOLATION SCHEMAS ---
class ViolationOut(BaseModel):
    id: str
    video_id: str
    plate_number: str
    violation_type: str
    frame_number: int
    timestamp_in_video: float
    confidence_score: float
    annotated_frame_s3_url: str
    bounding_boxes: Optional[Any] = None
    vehicle_type: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- VIDEO SCHEMAS ---
class VideoOut(BaseModel):
    id: str
    uploaded_by: str
    original_filename: str
    status: str
    duration_seconds: Optional[float] = None
    fps_extracted: int
    speed_limit: int
    stop_line_y: Optional[int] = None
    created_at: datetime
    processed_at: Optional[datetime] = None
    s3_url: Optional[str] = None

    class Config:
        from_attributes = True

class VideoStatusOut(BaseModel):
    status: str
    violation_count: int
    processed_at: Optional[datetime] = None

class VideoResultsOut(BaseModel):
    video_metadata: VideoOut
    violations: List[ViolationOut]
