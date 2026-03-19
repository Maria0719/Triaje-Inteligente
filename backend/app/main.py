from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.infrastructure.api.routes.triage import router as triage_router
from app.infrastructure.api.routes.patients import router as patients_router
from app.infrastructure.api.routes.auth import router as auth_router
from app.infrastructure.database.connection import engine, Base
from app.infrastructure.database import models

app = FastAPI(title="TriageAI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8080"],
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(triage_router)
app.include_router(patients_router, prefix="/api/patients", tags=["patients"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

@app.get("/health")
def health():
    return {"status": "ok", "architecture": "hexagonal"}