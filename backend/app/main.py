from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.infrastructure.api.routes.triage import router as triage_router

app = FastAPI(title="TriageAI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(triage_router)

@app.get("/health")
def health():
    return {"status": "ok", "architecture": "hexagonal"}