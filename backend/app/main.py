from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker
from app.routes.triage import router as triage_router
from app.routes.patients import router as patients_router
from app.routes.auth import router as auth_router
from app.routes.statistics import router as statistics_router
from app.routes.alerts import router as alerts_router
from app.database.connection import engine, Base
from app.database import models
from app.database.repositories import UserRepository
import bcrypt

app = FastAPI(title="TriageAI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8080"],
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


def create_default_user():
    """Create a default admin user if it doesn't exist."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        user_repository = UserRepository(db)
        existing_user = user_repository.get_by_email("admin@triageai.com")
        
        if existing_user is None:
            # Hash the password using bcrypt
            salt = bcrypt.gensalt()
            hashed_password = bcrypt.hashpw(b"admin123", salt).decode('utf-8')
            
            admin_user = models.User(
                email="admin@triageai.com",
                hashed_password=hashed_password,
                name="Administrador",
                role="Administrador",
            )
            user_repository.save(admin_user)
            print("Default admin user created: admin@triageai.com")
        else:
            print("Admin user already exists")
    finally:
        db.close()


# Create default user on startup
create_default_user()


app.include_router(triage_router)
app.include_router(patients_router, prefix="/api/patients", tags=["patients"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(statistics_router, prefix="/api/statistics", tags=["statistics"])
app.include_router(alerts_router, prefix="/api/alerts", tags=["alerts"])

@app.get("/health")
def health():
    return {"status": "ok", "architecture": "hexagonal"}