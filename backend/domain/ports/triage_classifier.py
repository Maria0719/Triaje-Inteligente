from abc import ABC, abstractmethod
from domain.entities.patient import VitalSigns, TriageResult
from typing import List

class ITriageClassifier(ABC):
    @abstractmethod
    def classify(
        self,
        symptoms: List[str],
        vital_signs: VitalSigns,
        pain_scale: int,
        medical_history: List[str]
    ) -> TriageResult:
        pass