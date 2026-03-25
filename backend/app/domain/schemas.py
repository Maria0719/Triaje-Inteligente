"""Pydantic schemas for triage, patient management, and authentication endpoints."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    id: UUID
    email: str
    name: str
    role: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str


class VitalSigns(BaseModel):
    systolicBP: float
    diastolicBP: float
    heartRate: float
    respiratoryRate: float
    temperature: float
    oxygenSaturation: float
    consciousnessLevel: Literal["Alerta", "Voz", "Dolor", "No responde"]


class TriageRequest(BaseModel):
    symptoms: list[str]
    vitalSigns: VitalSigns
    painScale: int
    medicalHistory: list[str]


class TriageResponse(BaseModel):
    level: int
    factors: list[str]
    confidence: float


class VitalSignsPayload(BaseModel):
    systolicBP: int
    diastolicBP: int
    heartRate: int
    respiratoryRate: int
    temperature: float
    oxygenSaturation: float
    consciousnessLevel: Literal["Alerta", "Voz", "Dolor", "No responde"]


class PatientCreateRequest(BaseModel):
    firstName: str
    lastName: str
    documentType: str
    documentNumber: str
    dateOfBirth: date
    age: int = Field(ge=0)
    sex: str
    chiefComplaint: str
    symptoms: list[str] = Field(default_factory=list)
    medicalHistory: list[str] = Field(default_factory=list)
    painScale: int = Field(ge=0, le=10)
    mtsLevel: int = Field(default=3, ge=1, le=5)
    vitalSigns: VitalSignsPayload


class PatientResponse(BaseModel):
    id: UUID
    firstName: str
    lastName: str
    documentType: str
    documentNumber: str
    dateOfBirth: date
    age: int
    sex: str
    chiefComplaint: str
    symptoms: list[str]
    medicalHistory: list[str]
    painScale: int
    mtsLevel: int
    status: str
    createdAt: datetime
    vitalSigns: VitalSignsPayload | None = None


class PatientStatusUpdate(BaseModel):
    status: Literal["waiting", "attended"]
