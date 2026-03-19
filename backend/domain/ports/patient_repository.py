from abc import ABC, abstractmethod
from domain.entities.patient import Patient
from typing import List, Optional

class IPatientRepository(ABC):
    @abstractmethod
    def save(self, patient: Patient) -> Patient:
        pass

    @abstractmethod
    def find_by_id(self, patient_id: str) -> Optional[Patient]:
        pass

    @abstractmethod
    def find_all(self) -> List[Patient]:
        pass

    @abstractmethod
    def update_status(self, patient_id: str, status: str) -> Optional[Patient]:
        pass