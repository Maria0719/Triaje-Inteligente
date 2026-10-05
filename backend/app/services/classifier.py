"""
Implements triage classification using a scikit-learn model and feature extraction logic.
"""

import os
from typing import List, Optional

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

from app.domain.entities import VitalSigns, TriageResult
from app.services.triage_service import ITriageClassifier

SYMPTOM_LIST = [
    "Dolor torácico",
    "Dificultad respiratoria",
    "Pérdida de consciencia",
    "Fiebre",
    "Trauma",
    "Dolor abdominal",
    "Cefalea",
    "Vómito",
    "Convulsiones",
    "Hemorragia",
    "Mareo",
    "Otros",
]
CONSCIOUSNESS_MAP = {"Alerta": 0, "Voz": 1, "Dolor": 2, "No responde": 3}

# Base vitals (8) + HRV (1) + Age (1) + una bandera por síntoma conocido. Se
# define como constante (en vez de dejar que _extract_features "simplemente
# tenga N elementos") para que _load_or_train pueda detectar cuándo el modelo
# guardado en disco quedó desalineado con el vector de features actual —
# p. ej. al agregar HRV o Age, el .pkl viejo con menos features rompería
# predict() con un error de forma en vez de fallar de manera legible.
EXPECTED_FEATURE_COUNT = 10 + len(SYMPTOM_LIST)

# Valor de HRV (RMSSD, ms) usado cuando no hay medición de cámara disponible
# (paciente registrado por el médico, o medición del kiosco descartada por
# baja confianza). Es un punto medio del rango normal en reposo — ver
# clasificaciones típicas de RMSSD en adultos sanos — elegido para NO sesgar
# la clasificación de pacientes sin cámara hacia "estrés fisiológico" ni
# hacia "sin estrés": es un relleno neutro, no una medición real.
HRV_DEFAULT_WHEN_MISSING = 40.0

# Edad usada cuando no se provee (llamadas existentes al classify() que aún
# no pasan age, p. ej. el endpoint de triage manual /api/triage/classify).
# Es un punto medio razonable de la población adulta general — igual que
# HRV_DEFAULT_WHEN_MISSING, es un relleno neutro, no una medición real. Se
# agrega porque Age es una variable con peso importante en el dataset KTAS
# (Kaggle) que se usará para el próximo modelo — dejar el vector de features
# preparado ahora evita otro reentrenamiento de esquema más adelante.
AGE_DEFAULT_WHEN_MISSING = 45.0


class TriageClassifier(ITriageClassifier):
    def __init__(self):
        self._model = self._load_or_train()

    def _load_or_train(self):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(base_dir, "triage_classifier.pkl")
        if os.path.exists(path):
            model = joblib.load(path)
            # Si el modelo guardado se entrenó con un número distinto de
            # features (p. ej. antes de agregar HRV al vector), se descarta
            # y se reentrena en vez de dejar que predict() falle más adelante
            # con un error de forma poco claro para quien lo depure.
            if getattr(model, "n_features_in_", None) == EXPECTED_FEATURE_COUNT:
                return model

        from sklearn.datasets import make_classification

        x_data, y_data = make_classification(
            n_samples=500,
            n_features=EXPECTED_FEATURE_COUNT,
            n_classes=5,
            n_informative=10,
            random_state=42,
        )
        y_data = y_data + 1
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(x_data, y_data)
        joblib.dump(model, path)
        return model

    def _extract_features(
        self,
        symptoms: List[str],
        vital_signs: VitalSigns,
        pain_scale: int,
        hrv_rmssd: Optional[float] = None,
        age: Optional[int] = None,
    ) -> np.ndarray:
        features = [
            vital_signs.systolicBP,
            vital_signs.diastolicBP,
            vital_signs.heartRate,
            vital_signs.respiratoryRate,
            vital_signs.temperature,
            vital_signs.oxygenSaturation,
            CONSCIOUSNESS_MAP[vital_signs.consciousnessLevel],
            pain_scale,
            hrv_rmssd if hrv_rmssd is not None else HRV_DEFAULT_WHEN_MISSING,
            age if age is not None else AGE_DEFAULT_WHEN_MISSING,
        ]
        for symptom in SYMPTOM_LIST:
            features.append(1 if symptom in symptoms else 0)
        return np.array(features).reshape(1, -1)

    def classify(
        self,
        symptoms: List[str],
        vital_signs: VitalSigns,
        pain_scale: int,
        medical_history: List[str],
        hrv_rmssd: Optional[float] = None,
        age: Optional[int] = None,
    ) -> TriageResult:
        # SpO2 ya influye en el nivel asignado vía oxygenSaturation (siempre
        # fue parte del vector); HRV y Age también participan en la
        # predicción del modelo, además de HRV aparecer como factor
        # informativo más abajo.
        features = self._extract_features(symptoms, vital_signs, pain_scale, hrv_rmssd, age)
        level = int(self._model.predict(features)[0])
        confidence = float(max(self._model.predict_proba(features)[0]))

        factors: list[str] = []
        if vital_signs.consciousnessLevel == "No responde":
            factors.append("Paciente no responde")
        elif vital_signs.consciousnessLevel == "Dolor":
            factors.append("Responde solo al dolor")
        elif vital_signs.consciousnessLevel == "Voz":
            factors.append("Nivel de consciencia alterado")

        if vital_signs.oxygenSaturation < 90:
            factors.append(f"SpO2 crítica: {vital_signs.oxygenSaturation:.0f}%")
        elif vital_signs.oxygenSaturation < 95:
            # Rango de alerta: requiere seguimiento pero no es inmediatamente crítico
            factors.append(f"SpO2 en rango de alerta: {vital_signs.oxygenSaturation:.0f}%")

        if vital_signs.heartRate > 120 or vital_signs.heartRate < 40:
            factors.append(f"Frecuencia cardíaca: {vital_signs.heartRate} bpm")
        if vital_signs.systolicBP > 180 or vital_signs.systolicBP < 80:
            factors.append(
                f"Presión arterial: {vital_signs.systolicBP}/{vital_signs.diastolicBP} mmHg"
            )

        # HRV muy baja indica estrés fisiológico (activación simpática excesiva)
        if hrv_rmssd is not None and hrv_rmssd < 20:
            factors.append(f"VFC baja — estrés fisiológico: {hrv_rmssd:.1f} ms RMSSD")

        if not factors:
            factors = ["Signos vitales dentro de parámetros normales"]

        return TriageResult(level=level, factors=factors, confidence=confidence)
