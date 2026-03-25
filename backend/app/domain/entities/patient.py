"""
Defines core patient entities, vital signs, and triage result data structures used by the domain.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import List, Literal

MTSLevel = Literal[1, 2, 3, 4, 5]

@dataclass
class VitalSigns:
    systolicBP: float
    diastolicBP: float
    heartRate: float
    respiratoryRate: float
    temperature: float
    oxygenSaturation: float
    consciousnessLevel: Literal["Alerta", "Voz", "Dolor", "No responde"]

@dataclass
class Patient:
    id: str
    firstName: str
    lastName: str
    documentType: str
    documentNumber: str
    dateOfBirth: str
    age: int
    sex: str
    chiefComplaint: str
    symptoms: List[str]
    medicalHistory: List[str]
    painScale: int
    vitalSigns: VitalSigns
    mtsLevel: int
    arrivalTime: datetime
    status: str = "waiting"

@dataclass
class TriageResult:
    level: int
    factors: List[str]
    confidence: float