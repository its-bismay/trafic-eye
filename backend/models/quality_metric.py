import uuid
from sqlalchemy import Column, String, Float, Integer, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base

class QualityMetric(Base):
    __tablename__ = "quality_metrics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = Column(String(36), ForeignKey("videos.id"), nullable=False)
    frame_number = Column(Integer, nullable=False)
    brightness = Column(Float, nullable=False)
    blur_score = Column(Float, nullable=False)
    contrast = Column(Float, nullable=False)
    visibility_score = Column(Float, nullable=True)
    fog_score = Column(Float, nullable=True)
    rain_score = Column(Float, nullable=True)
    
    video = relationship("Video")
