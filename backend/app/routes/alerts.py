"""FastAPI router that exposes alert management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import Alert, Patient

router = APIRouter()


@router.get("/unread")
def get_unread_alerts(db: Session = Depends(get_db)):
    alert_rows = (
        db.query(Alert, Patient)
        .join(Patient, Patient.id == Alert.patient_id)
        .filter(Alert.read.is_(False))
        .order_by(Alert.created_at.desc())
        .all()
    )

    return [
        {
            "id": str(alert.id),
            "patient_id": str(alert.patient_id),
            "patient_name": f"{patient.first_name} {patient.last_name}",
            "message": alert.message,
            "type": alert.type,
            "severity": alert.severity,
            "read": alert.read,
            "created_at": alert.created_at,
        }
        for alert, patient in alert_rows
    ]
