from pydantic import BaseModel
from typing import List, Literal

class VitalSigns(BaseModel):
    systolicBP: float
    diastolicBP: float
    heartRate: float
    respiratoryRate: float
    temperature: float
    oxygenSaturation: float
    consciousnessLevel: Literal["Alerta", "Voz", "Dolor", "No responde"]

class TriageRequest(BaseModel):
    symptoms: List[str]
    vitalSigns: VitalSigns
    painScale: int
    medicalHistory: List[str]

class TriageResponse(BaseModel):
    level: int
    factors: List[str]
    confidence: float