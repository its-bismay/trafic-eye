import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.database import Base

class VehicleIntelligenceRecord(Base):
    __tablename__ = "vehicle_intelligence_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = Column(String(36), ForeignKey("videos.id"), nullable=False)
    track_id = Column(Integer, nullable=False)
    vehicle_type = Column(String(50), nullable=False)
    final_plate_number = Column(String(50), index=True, nullable=True)
    confidence_metrics = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    video = relationship("Video")
    track_histories = relationship("TrackHistory", back_populates="vir", cascade="all, delete-orphan")
    ocr_histories = relationship("OCRHistory", back_populates="vir", cascade="all, delete-orphan")
    rider_associations = relationship("RiderAssociation", back_populates="vir", cascade="all, delete-orphan")
    evidence_bundles = relationship("EvidenceBundle", back_populates="vir", cascade="all, delete-orphan")
    analytics_metadata = relationship("AnalyticsMetadata", back_populates="vir", cascade="all, delete-orphan", uselist=False)
    violations = relationship("Violation", back_populates="vir", cascade="all, delete-orphan")
