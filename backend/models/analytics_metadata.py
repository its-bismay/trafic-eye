import uuid
from sqlalchemy import Column, String, Float, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.database import Base

class AnalyticsMetadata(Base):
    __tablename__ = "analytics_metadata"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vir_id = Column(String(36), ForeignKey("vehicle_intelligence_records.id"), nullable=False)
    behavior_profile = Column(JSON, nullable=True)
    hotspot_location = Column(String(255), nullable=True)
    peak_hour_flag = Column(String(50), nullable=True)

    vir = relationship("VehicleIntelligenceRecord", back_populates="analytics_metadata")
