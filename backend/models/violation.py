import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Float, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.database import Base

class Violation(Base):
    __tablename__ = "violations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = Column(String(36), ForeignKey("videos.id"), nullable=False)
    vir_id = Column(String(36), ForeignKey("vehicle_intelligence_records.id"), nullable=True)
    plate_number = Column(String(50), index=True, nullable=False)
    violation_type = Column(String(100), nullable=False)  # helmet_non_compliance, triple_riding, stop_line_violation, seatbelt_non_compliance, illegal_parking, overspeeding
    frame_number = Column(Integer, nullable=False)
    timestamp_in_video = Column(Float, nullable=False)
    confidence_score = Column(Float, nullable=False)
    annotated_frame_s3_url = Column(String(1024), nullable=False)
    bounding_boxes = Column(JSON, nullable=True)  # JSON list of all boxes on that frame
    vehicle_type = Column(String(50), nullable=True)  # car, motorcycle, bus, truck, etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    video = relationship("Video", back_populates="violations")
    vir = relationship("VehicleIntelligenceRecord", back_populates="violations")
