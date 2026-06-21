import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Float, Integer, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Video(Base):
    __tablename__ = "videos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    uploaded_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    original_filename = Column(String(255), nullable=False)
    s3_key = Column(String(512), nullable=True)  # path on local disk or S3 key
    s3_url = Column(String(1024), nullable=True) # presigned or local URL
    status = Column(String(50), default="pending")  # pending, processing, completed, failed
    duration_seconds = Column(Float, nullable=True)
    fps_extracted = Column(Integer, default=8)
    speed_limit = Column(Integer, default=50) # Speed limit set by user in km/h
    stop_line_y = Column(Integer, nullable=True) # Stop line horizontal y coordinate
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    # Relationships
    uploader = relationship("User")
    violations = relationship("Violation", back_populates="video", cascade="all, delete-orphan")
