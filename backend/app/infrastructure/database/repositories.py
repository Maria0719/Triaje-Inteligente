"""Repository implementations backed by SQLAlchemy sessions."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.infrastructure.database import models


class PatientRepository:
    def __init__(self, db: Session):
        self.db = db

    def save(self, patient: models.Patient) -> models.Patient:
        self.db.add(patient)
        self.db.commit()
        self.db.refresh(patient)
        return patient

    def get_by_id(self, patient_id: uuid.UUID) -> models.Patient | None:
        return self.db.query(models.Patient).filter(models.Patient.id == patient_id).first()

    def get_all(self) -> list[models.Patient]:
        return self.db.query(models.Patient).order_by(models.Patient.created_at.desc()).all()

    def update_status(self, patient_id: uuid.UUID, status: str) -> models.Patient | None:
        patient = self.get_by_id(patient_id)
        if patient is None:
            return None

        patient.status = status
        self.db.commit()
        self.db.refresh(patient)
        return patient


class VitalSignsRepository:
    def __init__(self, db: Session):
        self.db = db

    def save(self, vital_signs: models.VitalSigns) -> models.VitalSigns:
        self.db.add(vital_signs)
        self.db.commit()
        self.db.refresh(vital_signs)
        return vital_signs

    def get_by_patient_id(self, patient_id: uuid.UUID) -> list[models.VitalSigns]:
        return (
            self.db.query(models.VitalSigns)
            .filter(models.VitalSigns.patient_id == patient_id)
            .order_by(models.VitalSigns.recorded_at.desc())
            .all()
        )

    def get_latest_by_patient_id(self, patient_id: uuid.UUID) -> models.VitalSigns | None:
        return (
            self.db.query(models.VitalSigns)
            .filter(models.VitalSigns.patient_id == patient_id)
            .order_by(models.VitalSigns.recorded_at.desc())
            .first()
        )


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def save(self, user: models.User) -> models.User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_by_email(self, email: str) -> models.User | None:
        return self.db.query(models.User).filter(models.User.email == email).first()


class AlertRepository:
    def __init__(self, db: Session):
        self.db = db

    def save(self, alert: models.Alert) -> models.Alert:
        self.db.add(alert)
        self.db.commit()
        self.db.refresh(alert)
        return alert

    def get_by_patient_id(self, patient_id: uuid.UUID) -> list[models.Alert]:
        return (
            self.db.query(models.Alert)
            .filter(models.Alert.patient_id == patient_id)
            .order_by(models.Alert.created_at.desc())
            .all()
        )

    def get_unread(self) -> list[models.Alert]:
        return (
            self.db.query(models.Alert)
            .filter(models.Alert.read.is_(False))
            .order_by(models.Alert.created_at.desc())
            .all()
        )


class TriageResultRepository:
    def __init__(self, db: Session):
        self.db = db

    def save(self, result: models.TriageResult) -> models.TriageResult:
        self.db.add(result)
        self.db.commit()
        self.db.refresh(result)
        return result

    def get_by_patient_id(self, patient_id: uuid.UUID) -> list[models.TriageResult]:
        return (
            self.db.query(models.TriageResult)
            .filter(models.TriageResult.patient_id == patient_id)
            .order_by(models.TriageResult.created_at.desc())
            .all()
        )
