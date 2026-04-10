"""
FastAPI router that exposes the triage classification endpoint.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import models
from app.database.connection import get_db
from app.database.repositories import PatientRepository, TriageResultRepository
from app.domain.entities import VitalSigns
from app.domain.schemas import TriageRequest, TriageResponse
from app.services.classifier import TriageClassifier
from app.services.triage_service import ClassifyPatientUseCase, TriageService

router = APIRouter(prefix="/api/triage", tags=["triage"])

classifier = TriageClassifier()
triage_service = TriageService(classifier)
classify_use_case = ClassifyPatientUseCase(triage_service)


@router.post("/classify", response_model=TriageResponse)
def classify_patient(data: TriageRequest, db: Session = Depends(get_db)):
    try:
        vital_signs = VitalSigns(
            systolicBP=data.vitalSigns.systolicBP,
            diastolicBP=data.vitalSigns.diastolicBP,
            heartRate=data.vitalSigns.heartRate,
            respiratoryRate=data.vitalSigns.respiratoryRate,
            temperature=data.vitalSigns.temperature,
            oxygenSaturation=data.vitalSigns.oxygenSaturation,
            consciousnessLevel=data.vitalSigns.consciousnessLevel,
        )
        result = classify_use_case.execute(
            symptoms=data.symptoms,
            vital_signs=vital_signs,
            pain_scale=data.painScale,
            medical_history=data.medicalHistory,
        )

        if data.patientId is not None:
            patient_repository = PatientRepository(db)
            triage_result_repository = TriageResultRepository(db)

            patient = patient_repository.get_by_id(data.patientId)
            if patient is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

            triage_result_repository.save(
                models.TriageResult(
                    patient_id=data.patientId,
                    level=result.level,
                    factors=result.factors,
                    confidence=result.confidence,
                )
            )

        return TriageResponse(level=result.level, factors=result.factors, confidence=result.confidence)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
