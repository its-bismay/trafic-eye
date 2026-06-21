import uuid
from sqlalchemy import Column, String, Float, Integer, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base

class OCRHistory(Base):
    __tablename__ = "ocr_histories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vir_id = Column(String(36), ForeignKey("vehicle_intelligence_records.id"), nullable=False)
    frame_number = Column(Integer, nullable=False)
    plate_text = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)

    vir = relationship("VehicleIntelligenceRecord", back_populates="ocr_histories")
