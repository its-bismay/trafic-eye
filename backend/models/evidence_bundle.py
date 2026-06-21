import uuid
from sqlalchemy import Column, String, Float, Integer, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class EvidenceBundle(Base):
    __tablename__ = "evidence_bundles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vir_id = Column(String(36), ForeignKey("vehicle_intelligence_records.id"), nullable=False)
    violation_type = Column(String(100), nullable=False)
    frame_number = Column(Integer, nullable=False)
    timestamp = Column(Float, nullable=False)
    s3_url = Column(String(1024), nullable=False)
    confidence = Column(Float, nullable=False)

    vir = relationship("VehicleIntelligenceRecord", back_populates="evidence_bundles")
