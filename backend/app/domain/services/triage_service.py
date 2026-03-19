"""
Domain service that coordinates triage classification through the configured classifier port.
"""

from app.domain.entities.patient import VitalSigns, TriageResult
from app.domain.ports.triage_classifier import ITriageClassifier
from typing import List

class TriageService:
    def __init__(self, classifier: ITriageClassifier):
        self._classifier = classifier

    def classify_patient(
        self,
        symptoms: List[str],
        vital_signs: VitalSigns,
        pain_scale: int,
        medical_history: List[str]
    ) -> TriageResult:
        return self._classifier.classify(
            symptoms=symptoms,
            vital_signs=vital_signs,
            pain_scale=pain_scale,
            medical_history=medical_history
        )