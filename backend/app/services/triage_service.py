"""
Domain service and triage use case definitions.
"""

from abc import ABC, abstractmethod
from typing import List

from app.domain.entities import VitalSigns, TriageResult


class ITriageClassifier(ABC):
    @abstractmethod
    def classify(
        self,
        symptoms: List[str],
        vital_signs: VitalSigns,
        pain_scale: int,
        medical_history: List[str],
    ) -> TriageResult:
        pass


class TriageService:
    def __init__(self, classifier: ITriageClassifier):
        self._classifier = classifier

    def classify_patient(
        self,
        symptoms: List[str],
        vital_signs: VitalSigns,
        pain_scale: int,
        medical_history: List[str],
    ) -> TriageResult:
        return self._classifier.classify(
            symptoms=symptoms,
            vital_signs=vital_signs,
            pain_scale=pain_scale,
            medical_history=medical_history,
        )


class ClassifyPatientUseCase:
    def __init__(self, triage_service: TriageService):
        self._triage_service = triage_service

    def execute(
        self,
        symptoms: List[str],
        vital_signs: VitalSigns,
        pain_scale: int,
        medical_history: List[str],
    ) -> TriageResult:
        return self._triage_service.classify_patient(
            symptoms=symptoms,
            vital_signs=vital_signs,
            pain_scale=pain_scale,
            medical_history=medical_history,
        )
