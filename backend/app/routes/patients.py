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
    KioskPatientCreateRequest,
    KioskPatientCreateResponse,
    PatientCreateRequest,
    PatientResponse,
    PatientStatusUpdate,
    TriageHistoryItem,
    VitalSignsPayload,
)
from app.services.alert_service import AlertService
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
            # Campos rPPG opcionales — None para pacientes sin medición por cámara
            hrv=vital_signs.hrv,
            spo2=vital_signs.spo2,
            heartRateConfidence=vital_signs.heart_rate_confidence,
            respiratoryRateConfidence=vital_signs.respiratory_rate_confidence,
            hrvConfidence=vital_signs.hrv_confidence,
            spo2Confidence=vital_signs.spo2_confidence,
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

    alert_service = AlertService(db)
    alert_service.create_critical_alert_if_needed(patient_id=patient.id, mts_level=data.mtsLevel)
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


@router.post("/kiosk", response_model=KioskPatientCreateResponse, status_code=status.HTTP_201_CREATED)
def create_patient_from_kiosk(data: KioskPatientCreateRequest, db: Session = Depends(get_db)):
    patient_repository = PatientRepository(db)
    vital_signs_repository = VitalSignsRepository(db)

    # Si el kiosco envía SpO2 medida por cámara, usarla para la clasificación;
    # de lo contrario asumir saturación normal (98%).
    effective_spo2 = data.vitalSigns.spo2 if data.vitalSigns.spo2 is not None else 98.0

    domain_vitals = VitalSigns(
        systolicBP=120,
        diastolicBP=80,
        heartRate=data.vitalSigns.heartRate,
        respiratoryRate=data.vitalSigns.respiratoryRate,
        temperature=36.6,
        oxygenSaturation=effective_spo2,
        consciousnessLevel=data.vitalSigns.consciousnessLevel,
    )
    triage_result = classify_use_case.execute(
        symptoms=[],
        vital_signs=domain_vitals,
        pain_scale=data.vitalSigns.painScale,
        medical_history=[],
        hrv_rmssd=data.vitalSigns.hrv,
        age=data.age,
    )

    # date_of_birth es NOT NULL en el modelo (lo exige el formulario del médico,
    # que sí captura una fecha real), pero el kiosco solo pide la edad en años,
    # no la fecha de nacimiento completa. Se sintetiza una fecha con el año
    # correcto (1 de enero) únicamente para satisfacer la columna — nada en la
    # UI lee mes/día para pacientes de kiosco, solo `age` (que sí es el valor
    # real capturado, no derivado de esta fecha).
    synthetic_date_of_birth = datetime(datetime.utcnow().year - data.age, 1, 1).date()

    patient = models.Patient(
        first_name=data.firstName,
        last_name=data.lastName,
        document_type="CC",
        document_number=data.documentNumber,
        date_of_birth=synthetic_date_of_birth,
        age=data.age,
        sex=data.sex,
        chief_complaint="Registro por kiosco",
        symptoms=[],
        medical_history=[],
        pain_scale=data.vitalSigns.painScale,
        mts_level=triage_result.level,
        status="waiting",
        updated_at=datetime.utcnow(),
    )
    patient = patient_repository.save(patient)

    vital_signs_repository.save(
        models.VitalSigns(
            patient_id=patient.id,
            systolic_bp=120,
            diastolic_bp=80,
            heart_rate=data.vitalSigns.heartRate,
            respiratory_rate=data.vitalSigns.respiratoryRate,
            temperature=36.6,
            oxygen_saturation=effective_spo2,
            consciousness_level=data.vitalSigns.consciousnessLevel,
            hrv=data.vitalSigns.hrv,
            spo2=data.vitalSigns.spo2,
            heart_rate_confidence=data.vitalSigns.heartRateConfidence,
            respiratory_rate_confidence=data.vitalSigns.respiratoryRateConfidence,
            hrv_confidence=data.vitalSigns.hrvConfidence,
            spo2_confidence=data.vitalSigns.spo2Confidence,
        )
    )

    # \u2500\u2500 Alertas autom\u00e1ticas del kiosco (Fase 4) \u2500\u2500
    #
    # Delegadas a AlertService, que aplica el mismo guard anti-duplicaci\u00f3n
    # para los 3 tipos de alerta (antes solo lo aplicaba este endpoint, no
    # create_patient).
    alert_service = AlertService(db)
    alert_service.create_critical_alert_if_needed(
        patient_id=patient.id, mts_level=triage_result.level, source="por kiosco"
    )
    alert_service.create_anomalous_vitals_alert_if_needed(
        patient_id=patient.id, heart_rate=data.vitalSigns.heartRate, spo2=effective_spo2
    )
    alert_service.create_low_confidence_alert_if_needed(
        patient_id=patient.id,
        confidences=[
            data.vitalSigns.heartRateConfidence,
            data.vitalSigns.respiratoryRateConfidence,
            data.vitalSigns.hrvConfidence,
            data.vitalSigns.spo2Confidence,
        ],
    )
    db.commit()

    estimated_wait_minutes = alert_service.estimate_wait_minutes(mts_level=triage_result.level)

    return KioskPatientCreateResponse(
        patientId=patient.id,
        estimatedWaitMinutes=estimated_wait_minutes,
        mtsLevel=triage_result.level,
    )


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
