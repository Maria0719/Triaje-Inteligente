"""
Provides an in-memory implementation of the patient repository port.
"""

from domain.entities.patient import Patient
from domain.ports.patient_repository import IPatientRepository
from typing import List, Optional

class InMemoryPatientRepository(IPatientRepository):
    def __init__(self):
        self._patients: List[Patient] = []

    def save(self, patient: Patient) -> Patient:
        self._patients.append(patient)
        return patient

    def find_by_id(self, patient_id: str) -> Optional[Patient]:
        return next((p for p in self._patients if p.id == patient_id), None)

    def find_all(self) -> List[Patient]:
        return self._patients

    def update_status(self, patient_id: str, status: str) -> Optional[Patient]:
        for p in self._patients:
            if p.id == patient_id:
                p.status = status
                return p
        return None