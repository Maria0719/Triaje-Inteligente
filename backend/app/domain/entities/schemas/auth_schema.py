"""Pydantic schemas for authentication endpoints."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


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
