"""
FastAPI router that handles user authentication.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.domain.entities.schemas.auth_schema import LoginRequest, LoginResponse, RegisterRequest
from app.infrastructure.database import models
from app.infrastructure.database.connection import get_db
from app.infrastructure.database.repositories import UserRepository

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user_repository = UserRepository(db)
    user = user_repository.get_by_email(data.email)

    if user is None or user.hashed_password != data.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return LoginResponse(id=user.id, email=user.email, name=user.name, role=user.role)


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    user_repository = UserRepository(db)

    existing_user = user_repository.get_by_email(data.email)
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = models.User(
        email=data.email,
        hashed_password=data.password,
        name=data.name,
        role=data.role,
    )
    user = user_repository.save(user)

    return LoginResponse(id=user.id, email=user.email, name=user.name, role=user.role)
