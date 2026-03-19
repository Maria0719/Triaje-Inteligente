"""
Implements triage classification using a scikit-learn model and feature extraction logic.
"""

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from domain.entities.patient import VitalSigns, TriageResult
from domain.ports.triage_classifier import ITriageClassifier
from typing import List
import joblib, os

SYMPTOM_LIST = [
    "Dolor torácico", "Dificultad respiratoria", "Pérdida de consciencia",
    "Fiebre", "Trauma", "Dolor abdominal", "Cefalea", "Vómito",
    "Convulsiones", "Hemorragia", "Mareo", "Otros"
]
CONSCIOUSNESS_MAP = {"Alerta": 0, "Voz": 1, "Dolor": 2, "No responde": 3}

class SklearnTriageClassifier(ITriageClassifier):
    def __init__(self):
        self._model = self._load_or_train()

    def _load_or_train(self):
        path = "infrastructure/ml/triage_classifier.pkl"
        if os.path.exists(path):
            return joblib.load(path)
        from sklearn.datasets import make_classification
        X, y = make_classification(n_samples=500, n_features=20, n_classes=5,
                                    n_informative=10, random_state=42)
        y = y + 1
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(X, y)
        joblib.dump(model, path)
        return model

    def _extract_features(self, symptoms: List[str], vital_signs: VitalSigns,
                           pain_scale: int) -> np.ndarray:
        features = [
            vital_signs.systolicBP, vital_signs.diastolicBP,
            vital_signs.heartRate, vital_signs.respiratoryRate,
            vital_signs.temperature, vital_signs.oxygenSaturation,
            CONSCIOUSNESS_MAP[vital_signs.consciousnessLevel],
            pain_scale,
        ]
        for s in SYMPTOM_LIST:
            features.append(1 if s in symptoms else 0)
        return np.array(features).reshape(1, -1)

    def classify(self, symptoms: List[str], vital_signs: VitalSigns,
                 pain_scale: int, medical_history: List[str]) -> TriageResult:
        features = self._extract_features(symptoms, vital_signs, pain_scale)
        level = int(self._model.predict(features)[0])
        confidence = float(max(self._model.predict_proba(features)[0]))

        factors = []
        if vital_signs.consciousnessLevel == "No responde":
            factors.append("Paciente no responde")
        elif vital_signs.consciousnessLevel == "Dolor":
            factors.append("Responde solo al dolor")
        elif vital_signs.consciousnessLevel == "Voz":
            factors.append("Nivel de consciencia alterado")
        if vital_signs.oxygenSaturation < 90:
            factors.append(f"SpO2 crítica: {vital_signs.oxygenSaturation}%")
        if vital_signs.heartRate > 120 or vital_signs.heartRate < 40:
            factors.append(f"Frecuencia cardíaca: {vital_signs.heartRate} bpm")
        if vital_signs.systolicBP > 180 or vital_signs.systolicBP < 80:
            factors.append(f"Presión arterial: {vital_signs.systolicBP}/{vital_signs.diastolicBP} mmHg")
        if not factors:
            factors = ["Signos vitales dentro de parámetros normales"]

        return TriageResult(level=level, factors=factors, confidence=confidence)