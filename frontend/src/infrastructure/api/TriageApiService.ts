/**
 * Triage service that calls the FastAPI backend and falls back to the local classifier if unavailable.
 */

import { VitalSigns, TriageResult } from '@/domain/entities/Patient';
import { ITriageService } from '@/domain/ports/ITriageService';
import { LocalTriageClassifier } from '@/domain/services/TriageClassifier';
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
export class TriageApiService implements ITriageService {
    private fallback = new LocalTriageClassifier();
    async classify(symptoms: string[], vitalSigns: VitalSigns, painScale: number, medicalHistory: string[]): Promise<TriageResult> {
        try {
            const res = await fetch(`${API_URL}/api/triage/classify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symptoms, vitalSigns, painScale, medicalHistory }),
            });
            if (!res.ok)
                throw new Error('API error');
            const data = await res.json();
            return { level: data.level, factors: data.factors, confidence: data.confidence };
        }
        catch (err) {
            // Sin esto, un fallo momentáneo del backend hacía que el médico viera
            // una clasificación de LocalTriageClassifier (heurística local, no el
            // modelo ML real) sin ningún indicio de que era un resultado de
            // respaldo. Todavía no hay aviso visible en la UI — queda pendiente.
            console.error('[TriageApiService] Backend classify() failed, falling back to LocalTriageClassifier:', err);
            return this.fallback.classify(symptoms, vitalSigns, painScale, medicalHistory);
        }
    }
}
