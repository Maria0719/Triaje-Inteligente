/**
 * Service that calls the backend API for alert operations.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export type BackendAlert = {
    id: string;
    patientId?: string;
    patient_id?: string;
    patientName?: string;
    patient_name?: string;
    message: string;
    type: 'wait_exceeded' | 'risk_escalated' | 'critical_vitals';
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
