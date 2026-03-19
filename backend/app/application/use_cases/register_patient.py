"""
Use case that registers a new patient and computes the initial triage result.
"""

from domain.entities.patient import Patient, VitalSigns, TriageResult
from domain.ports.patient_repository import IPatientRepository
from domain.services.triage_service import TriageService
from datetime import datetime
from typing import List
import uuid

class RegisterPatientUseCase:
    def __init__(self, repository: IPatientRepository, triage_service: TriageService):
        self._repository = repository
        self._triage_service = triage_service

    def execute(
        self,
        first_name: str,
        last_name: str,
        document_type: str,
        document_number: str,
        date_of_birth: str,
        age: int,
        sex: str,
        chief_complaint: str,
        symptoms: List[str],
        medical_history: List[str],
        pain_scale: int,
        vital_signs: VitalSigns
    ) -> tuple[Patient, TriageResult]:
        result = self._triage_service.classify_patient(
            symptoms=symptoms,
            vital_signs=vital_signs,
            pain_scale=pain_scale,
            medical_history=medical_history
        )
        patient = Patient(
            id=str(uuid.uuid4()),
            firstName=first_name,
            lastName=last_name,
            documentType=document_type,
            documentNumber=document_number,
            dateOfBirth=date_of_birth,
            age=age,
            sex=sex,
            chiefComplaint=chief_complaint,
            symptoms=symptoms,
            medicalHistory=medical_history,
            painScale=pain_scale,
            vitalSigns=vital_signs,
            mtsLevel=result.level,
            arrivalTime=datetime.now(),
            status="waiting"
        )
        return self._repository.save(patient), result