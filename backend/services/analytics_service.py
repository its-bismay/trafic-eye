from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any
from backend.models.violation import Violation
from backend.models.vehicle_intelligence import VehicleIntelligenceRecord

class AnalyticsService:
    def get_dashboard_metrics(self, db: Session) -> Dict[str, Any]:
        total_virs = db.query(VehicleIntelligenceRecord).count()
        total_violations = db.query(Violation).count()
        return {
            "total_vehicle_records": total_virs,
            "total_violations": total_violations
        }

analytics_service = AnalyticsService()
