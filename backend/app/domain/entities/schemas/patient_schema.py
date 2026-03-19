"""Pydantic schemas for patient management endpoints."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


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
