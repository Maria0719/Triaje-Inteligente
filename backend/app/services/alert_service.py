"""
Servicio de dominio para alertas clínicas y estimación de tiempo de espera.

Antes esta lógica vivía inline en routes/patients.py, repetida de forma
inconsistente entre create_patient (sin guard anti-duplicación) y
create_patient_from_kiosk (con guard). Se unifica aquí: ambos endpoints
deben pasar siempre por el mismo guard, y los umbrales clínicos quedan en
un solo lugar en vez de repetidos como literales en el router.

No depende de FastAPI ni de detalles HTTP — solo de la Session de SQLAlchemy
y de los modelos de persistencia, igual que TriageService/TriageClassifier.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.database import models

# Umbrales de negocio (antes literales inline en routes/patients.py)
ANOMALOUS_HEART_RATE_HIGH_BPM = 120
ANOMALOUS_HEART_RATE_LOW_BPM = 40
ANOMALOUS_SPO2_THRESHOLD = 90
LOW_CONFIDENCE_THRESHOLD = 0.5
MINUTES_PER_PATIENT_AHEAD = 7


class AlertService:
    def __init__(self, db: Session):
        self.db = db

    def _create_if_absent(
        self,
        *,
        patient_id: uuid.UUID,
        alert_type: str,
        message: str,
        severity: str,
    ) -> None:
        """Inserta una alerta solo si no existe ya una sin leer del mismo tipo
        para este paciente.

        Guard anti-duplicación: evita que reintentos del kiosco o peticiones
        concurrentes generen notificaciones duplicadas para el médico. Antes
        solo lo usaba create_patient_from_kiosk; ahora lo usan todos los
        puntos de creación de alertas por igual.
        """
        existing = (
            self.db.query(models.Alert)
            .filter(
                models.Alert.patient_id == patient_id,
                models.Alert.type == alert_type,
                models.Alert.read.is_(False),
            )
            .first()
        )
        if existing is None:
            self.db.add(
                models.Alert(
                    patient_id=patient_id,
                    message=message,
                    type=alert_type,
                    severity=severity,
                    read=False,
                )
            )

    def create_critical_alert_if_needed(
        self,
        *,
        patient_id: uuid.UUID,
        mts_level: int,
        source: str = "",
    ) -> None:
        """Alerta de nivel crítico (MTS 1 o 2).

        `source` es un fragmento opcional para el mensaje (p. ej. "por
        kiosco") que distingue el origen del registro sin duplicar lógica.
        """
        if mts_level not in (1, 2):
            return
        suffix = f" {source}" if source else ""
        self._create_if_absent(
            patient_id=patient_id,
            alert_type="critical_vitals",
            message=f"Paciente crítico ingresado{suffix} - Nivel {mts_level}",
            severity=str(mts_level),
        )

    def create_anomalous_vitals_alert_if_needed(
        self,
        *,
        patient_id: uuid.UUID,
        heart_rate: float,
        spo2: float,
    ) -> None:
        """Alerta cuando FC o SpO2 caen fuera de rango fisiológico normal."""
        is_anomalous = (
            heart_rate > ANOMALOUS_HEART_RATE_HIGH_BPM
            or heart_rate < ANOMALOUS_HEART_RATE_LOW_BPM
            or spo2 < ANOMALOUS_SPO2_THRESHOLD
        )
        if not is_anomalous:
            return
        self._create_if_absent(
            patient_id=patient_id,
            alert_type="anomalous_vitals",
            message=f"Signos vitales anómalos detectados: FC={heart_rate} bpm, SpO2={spo2:.0f}%",
            severity="2",
        )

    def create_low_confidence_alert_if_needed(
        self,
        *,
        patient_id: uuid.UUID,
        confidences: list[float | None],
    ) -> None:
        """Alerta cuando algún signo medido por el kiosco tiene confidence < 0.5."""
        if not any(c is not None and c < LOW_CONFIDENCE_THRESHOLD for c in confidences):
            return
        self._create_if_absent(
            patient_id=patient_id,
            alert_type="low_confidence",
            message="Medición de baja confianza: uno o más signos requieren verificación manual",
            severity="4",
        )

    def estimate_wait_minutes(self, *, mts_level: int) -> int:
        """Minutos estimados de espera según cuántos pacientes con igual o
        mayor prioridad ya están en la fila."""
        waiting_ahead = (
            self.db.query(models.Patient)
            .filter(models.Patient.status == "waiting", models.Patient.mts_level <= mts_level)
            .count()
        )
        return max(0, (waiting_ahead - 1) * MINUTES_PER_PATIENT_AHEAD)
