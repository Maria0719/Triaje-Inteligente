"""FastAPI router that exposes alert management endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import Alert, Patient
from app.database.repositories import AlertRepository
from app.domain.schemas import AlertResponse

router = APIRouter()


def _serialize_alert(alert: Alert, patient: Patient | None = None) -> AlertResponse:
    patient_name = None
    if patient is not None:
        patient_name = f"{patient.first_name} {patient.last_name}"

    return AlertResponse(
        id=alert.id,
        patientId=alert.patient_id,
        patientName=patient_name,
        message=alert.message,
        type=alert.type,
        severity=alert.severity,
        read=alert.read,
        createdAt=alert.created_at,
    )


@router.get("", response_model=list[AlertResponse])
def get_alerts(db: Session = Depends(get_db)):
    alert_rows = (
        db.query(Alert, Patient)
        .join(Patient, Patient.id == Alert.patient_id)
        .filter(Alert.read.is_(False))
        .order_by(Alert.created_at.desc())
        .all()
    )

    return [_serialize_alert(alert, patient) for alert, patient in alert_rows]


@router.get("/unread", response_model=list[AlertResponse])
def get_unread_alerts(db: Session = Depends(get_db)):
    return get_alerts(db)


@router.get("/patient/{patient_id}", response_model=list[AlertResponse])
def get_alerts_by_patient(patient_id: UUID, db: Session = Depends(get_db)):
    """Return all alerts for a specific patient (read and unread), newest first.

    Used by PatientDetailPage "Notas del sistema" to show the full history
    of system-generated alerts regardless of read status.
    """
    alert_repository = AlertRepository(db)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    alerts = alert_repository.get_by_patient_id(patient_id)
    return [_serialize_alert(alert, patient) for alert in alerts]


@router.patch("/{alert_id}/read", response_model=AlertResponse)
def mark_alert_as_read(alert_id: UUID, db: Session = Depends(get_db)):
    alert_repository = AlertRepository(db)
    alert = alert_repository.mark_as_read(alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    patient = db.query(Patient).filter(Patient.id == alert.patient_id).first()
    return _serialize_alert(alert, patient)
