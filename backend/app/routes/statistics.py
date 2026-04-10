"""
FastAPI router that returns real statistics calculated from the patients table.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import Patient

router = APIRouter()


@router.get("/summary")
def get_statistics_summary(db: Session = Depends(get_db)):
    waiting_query = db.query(Patient).filter(Patient.status == "waiting")

    total_active = waiting_query.count()
    critical_patients = waiting_query.filter(Patient.mts_level <= 2).count()

    waiting_patients = waiting_query.all()
    if waiting_patients:
        now = datetime.now()
        waits = [max(0.0, (now - patient.created_at).total_seconds() / 60.0) for patient in waiting_patients]
        average_wait_time = round(sum(waits) / len(waits), 2)
    else:
        average_wait_time = 0

    today_midnight = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    attended_today = (
        db.query(Patient)
        .filter(
            Patient.status == "attended",
            func.date(Patient.updated_at) == func.date("now"),
        )
        .count()
    )

    return {
        "totalActive": total_active,
        "criticalPatients": critical_patients,
        "averageWaitTime": average_wait_time,
        "attendedToday": attended_today,
    }


@router.get("/by-level")
def get_statistics_by_level(db: Session = Depends(get_db)):
    rows = (
        db.query(Patient.mts_level, func.count(Patient.id))
        .group_by(Patient.mts_level)
        .all()
    )
    counts_by_level = {int(level): int(count) for level, count in rows if level is not None}

    return [{"level": f"Nivel {level}", "count": counts_by_level.get(level, 0)} for level in range(1, 6)]


@router.get("/top-complaints")
def get_top_complaints(db: Session = Depends(get_db)):
    rows = (
        db.query(Patient.chief_complaint, func.count(Patient.id).label("count"))
        .filter(Patient.chief_complaint.isnot(None), Patient.chief_complaint != "")
        .group_by(Patient.chief_complaint)
        .order_by(func.count(Patient.id).desc())
        .limit(5)
        .all()
    )

    return [{"complaint": complaint, "count": int(count)} for complaint, count in rows]


@router.get("/wait-by-level")
def get_wait_by_level(db: Session = Depends(get_db)):
    recommended_by_level = {1: 0, 2: 10, 3: 30, 4: 60, 5: 120}

    waiting_patients = db.query(Patient).filter(Patient.status == "waiting").all()
    now = datetime.now()

    waits_by_level: dict[int, list[float]] = {level: [] for level in range(1, 6)}
    for patient in waiting_patients:
        if patient.mts_level in waits_by_level:
            waits_by_level[patient.mts_level].append(
                max(0.0, (now - patient.created_at).total_seconds() / 60.0)
            )

    response: list[dict[str, str | float | int]] = []
    for level in range(1, 6):
        waits = waits_by_level[level]
        actual = round(sum(waits) / len(waits), 2) if waits else 0.0
        response.append(
            {
                "level": f"Nivel {level}",
                "actual": actual,
                "recommended": recommended_by_level[level],
            }
        )

    return response
