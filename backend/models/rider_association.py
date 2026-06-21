import uuid
from sqlalchemy import Column, String, Float, Integer, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base

class RiderAssociation(Base):
    __tablename__ = "rider_associations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vir_id = Column(String(36), ForeignKey("vehicle_intelligence_records.id"), nullable=False)
    rider_track_id = Column(Integer, nullable=False)
    confidence = Column(Float, nullable=False)
    start_frame = Column(Integer, nullable=False)
    end_frame = Column(Integer, nullable=True)

    vir = relationship("VehicleIntelligenceRecord", back_populates="rider_associations")
