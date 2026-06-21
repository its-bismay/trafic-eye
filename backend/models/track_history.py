import uuid
from sqlalchemy import Column, String, Float, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.database import Base

class TrackHistory(Base):
    __tablename__ = "track_histories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vir_id = Column(String(36), ForeignKey("vehicle_intelligence_records.id"), nullable=False)
    frame_number = Column(Integer, nullable=False)
    timestamp = Column(Float, nullable=False)
    bbox = Column(JSON, nullable=False) # [x1, y1, x2, y2]
    centroid = Column(JSON, nullable=False) # [cx, cy]
    speed = Column(Float, nullable=True)
    confidence = Column(Float, nullable=False)
    
    vir = relationship("VehicleIntelligenceRecord", back_populates="track_histories")
