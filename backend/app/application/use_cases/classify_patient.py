"""
Use case that receives patient symptoms and vital signs to return a triage classification result.
"""

from app.domain.services.triage_service import TriageService
from app.domain.entities.patient import VitalSigns, TriageResult
from typing import List

class ClassifyPatientUseCase:
    def __init__(self, triage_service: TriageService):
        self._triage_service = triage_service

    def execute(
        self,
        symptoms: List[str],
        vital_signs: VitalSigns,
        pain_scale: int,
        medical_history: List[str]
    ) -> TriageResult:
        return self._triage_service.classify_patient(
            symptoms=symptoms,
            vital_signs=vital_signs,
            pain_scale=pain_scale,
            medical_history=medical_history
        )