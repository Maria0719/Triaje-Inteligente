"""
FastAPI router that exposes patient management endpoints.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import models
from app.database.connection import get_db
from app.database.repositories import PatientRepository, TriageResultRepository, VitalSignsRepository
from app.domain.entities import VitalSigns
from app.domain.schemas import (
    PatientCreateRequest,
    PatientResponse,
    PatientStatusUpdate,
    TriageHistoryItem,
    VitalSignsPayload,
)
from app.services.classifier import TriageClassifier
from app.services.triage_service import ClassifyPatientUseCase, TriageService

router = APIRouter()
classifier = TriageClassifier()
triage_service = TriageService(classifier)
classify_use_case = ClassifyPatientUseCase(triage_service)


def _to_patient_response(
    patient: models.Patient,
    vital_signs: models.VitalSigns | None,
) -> PatientResponse:
    payload = None
    if vital_signs is not None:
        payload = VitalSignsPayload(
            systolicBP=vital_signs.systolic_bp,
            diastolicBP=vital_signs.diastolic_bp,
            heartRate=vital_signs.heart_rate,
            respiratoryRate=vital_signs.respiratory_rate,
            temperature=vital_signs.temperature,
            oxygenSaturation=vital_signs.oxygen_saturation,
            consciousnessLevel=vital_signs.consciousness_level,
        )

    return PatientResponse(
        id=patient.id,
        firstName=patient.first_name,
        lastName=patient.last_name,
        documentType=patient.document_type,
        documentNumber=patient.document_number,
        dateOfBirth=patient.date_of_birth,
        age=patient.age,
        sex=patient.sex,
        chiefComplaint=patient.chief_complaint,
        symptoms=patient.symptoms,
        medicalHistory=patient.medical_history,
        painScale=patient.pain_scale,
        mtsLevel=patient.mts_level,
        status=patient.status,
        createdAt=patient.created_at,
        vitalSigns=payload,
    )


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(data: PatientCreateRequest, db: Session = Depends(get_db)):
    patient_repository = PatientRepository(db)
    vital_signs_repository = VitalSignsRepository(db)

    patient = models.Patient(
        first_name=data.firstName,
        last_name=data.lastName,
        document_type=data.documentType,
        document_number=data.documentNumber,
        date_of_birth=data.dateOfBirth,
        age=data.age,
        sex=data.sex,
        chief_complaint=data.chiefComplaint,
        symptoms=data.symptoms,
        medical_history=data.medicalHistory,
        pain_scale=data.painScale,
        mts_level=data.mtsLevel,
        status="waiting",
        updated_at=datetime.utcnow(),
    )
    patient = patient_repository.save(patient)

    vital_signs = models.VitalSigns(
        patient_id=patient.id,
        systolic_bp=data.vitalSigns.systolicBP,
        diastolic_bp=data.vitalSigns.diastolicBP,
        heart_rate=data.vitalSigns.heartRate,
        respiratory_rate=data.vitalSigns.respiratoryRate,
        temperature=data.vitalSigns.temperature,
        oxygen_saturation=data.vitalSigns.oxygenSaturation,
        consciousness_level=data.vitalSigns.consciousnessLevel,
    )
    vital_signs = vital_signs_repository.save(vital_signs)

    if data.mtsLevel in (1, 2):
        critical_alert = models.Alert(
            patient_id=patient.id,
            message=f"Paciente cr\u00edtico ingresado - Nivel {data.mtsLevel}",
            type="critical_vitals",
            severity=str(data.mtsLevel),
            read=False,
        )
        db.add(critical_alert)
        db.commit()

    return _to_patient_response(patient, vital_signs)


@router.get("", response_model=list[PatientResponse])
def get_active_patients(db: Session = Depends(get_db)):
    patient_repository = PatientRepository(db)
    vital_signs_repository = VitalSignsRepository(db)

    patients = [patient for patient in patient_repository.get_all() if patient.status == "waiting"]
    return [
        _to_patient_response(patient, vital_signs_repository.get_latest_by_patient_id(patient.id))
        for patient in patients
    ]


@router.get("/{id}", response_model=PatientResponse)
def get_patient_by_id(id: UUID, db: Session = Depends(get_db)):
    patient_repository = PatientRepository(db)
    vital_signs_repository = VitalSignsRepository(db)

    patient = patient_repository.get_by_id(id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    vital_signs = vital_signs_repository.get_latest_by_patient_id(patient.id)
    return _to_patient_response(patient, vital_signs)


@router.patch("/{id}/status", response_model=PatientResponse)
def update_patient_status(id: UUID, data: PatientStatusUpdate, db: Session = Depends(get_db)):
    patient_repository = PatientRepository(db)
    vital_signs_repository = VitalSignsRepository(db)

    patient = patient_repository.update_status(id, data.status)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    vital_signs = vital_signs_repository.get_latest_by_patient_id(patient.id)
    return _to_patient_response(patient, vital_signs)


@router.put("/{patient_id}/vitals", response_model=PatientResponse)
def update_patient_vitals(
    patient_id: UUID,
    payload: VitalSignsPayload,
    db: Session = Depends(get_db),
):
    patient_repository = PatientRepository(db)
    vital_signs_repository = VitalSignsRepository(db)
    triage_result_repository = TriageResultRepository(db)

    patient = patient_repository.get_by_id(patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    vital_signs = vital_signs_repository.get_latest_by_patient_id(patient.id)
    if vital_signs is None:
        vital_signs = models.VitalSigns(patient_id=patient.id)
        db.add(vital_signs)

    vital_signs.systolic_bp = payload.systolicBP
    vital_signs.diastolic_bp = payload.diastolicBP
    vital_signs.heart_rate = payload.heartRate
    vital_signs.respiratory_rate = payload.respiratoryRate
    vital_signs.temperature = payload.temperature
    vital_signs.oxygen_saturation = payload.oxygenSaturation
    vital_signs.consciousness_level = payload.consciousnessLevel
    vital_signs.recorded_at = datetime.utcnow()

    domain_vitals = VitalSigns(
        systolicBP=payload.systolicBP,
        diastolicBP=payload.diastolicBP,
        heartRate=payload.heartRate,
        respiratoryRate=payload.respiratoryRate,
        temperature=payload.temperature,
        oxygenSaturation=payload.oxygenSaturation,
        consciousnessLevel=payload.consciousnessLevel,
    )
    triage_result = classify_use_case.execute(
        symptoms=patient.symptoms,
        vital_signs=domain_vitals,
        pain_scale=patient.pain_scale,
        medical_history=patient.medical_history,
    )

    patient.mts_level = triage_result.level
    patient.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(patient)
    db.refresh(vital_signs)

    triage_result_repository.save(
        models.TriageResult(
            patient_id=patient.id,
            level=triage_result.level,
            factors=triage_result.factors,
            confidence=triage_result.confidence,
        )
    )

    return _to_patient_response(patient, vital_signs)


@router.get("/{patient_id}/history", response_model=list[TriageHistoryItem])
def get_patient_triage_history(patient_id: UUID, db: Session = Depends(get_db)):
    patient_repository = PatientRepository(db)
    triage_result_repository = TriageResultRepository(db)

    patient = patient_repository.get_by_id(patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    history = triage_result_repository.get_by_patient_id(patient_id)
    return [
        TriageHistoryItem(
            id=item.id,
            patientId=item.patient_id,
            level=item.level,
            factors=item.factors,
            confidence=item.confidence,
            createdAt=item.created_at,
        )
        for item in history
    ]
