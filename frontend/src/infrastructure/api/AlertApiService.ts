/**
 * Service that calls the backend API for alert operations.
 *
 * Capa: Infraestructura (api)
 *
 * Métodos disponibles:
 *   - getUnreadAlerts()         → GET /api/alerts  (todas las alertas sin leer)
 *   - getAlertsByPatient(id)    → GET /api/alerts/patient/{id}  (todas: leídas + sin leer)
 *   - markAsRead(id)            → PATCH /api/alerts/{id}/read
 *
 * Relación con el sistema:
 *   - AppContext.loadAlerts() usa getUnreadAlerts() para el panel lateral.
 *   - PatientDetailPage usa getAlertsByPatient() para "Notas del sistema".
 */

import type { Alert } from '@/domain/entities/Patient';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export type BackendAlert = {
    id: string;
    patientId?: string;
    patient_id?: string;
    patientName?: string;
    patient_name?: string;
    message: string;
    /** Incluye tipos de Fase 4: 'anomalous_vitals' | 'low_confidence'. */
    type: Alert['type'];
    severity: string | number;
    read: boolean;
    createdAt?: string;
    created_at?: string;
};

const buildError = async (response: Response, fallback: string): Promise<Error> => {
    try {
        const body = await response.json();
        const detail = typeof body?.detail === 'string' ? body.detail : fallback;
        return new Error(detail);
    }
    catch {
        return new Error(fallback);
    }
};

export class AlertApiService {
    async getUnreadAlerts(): Promise<BackendAlert[]> {
        const response = await fetch(`${API_URL}/api/alerts`);
        if (!response.ok) {
            throw await buildError(response, 'Failed to load alerts');
        }

        return (await response.json()) as BackendAlert[];
    }

    /**
     * Devuelve TODAS las alertas de un paciente (leídas y sin leer), ordenadas
     * por fecha descendente. Usado por "Notas del sistema" en PatientDetailPage.
     */
    async getAlertsByPatient(patientId: string): Promise<BackendAlert[]> {
        const response = await fetch(`${API_URL}/api/alerts/patient/${patientId}`);
        if (!response.ok) {
            throw await buildError(response, 'Failed to load patient alerts');
        }

        return (await response.json()) as BackendAlert[];
    }

    async markAsRead(id: string): Promise<BackendAlert> {
        const response = await fetch(`${API_URL}/api/alerts/${id}/read`, {
            method: 'PATCH',
        });

        if (!response.ok) {
            throw await buildError(response, 'Failed to mark alert as read');
        }

        return (await response.json()) as BackendAlert;
    }
}
