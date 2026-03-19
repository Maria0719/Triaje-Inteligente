/**
 * Service that calls the backend API for patient CRUD operations.
 */

import { Patient } from '@/types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type PatientStatus = 'waiting' | 'attended';

type BackendVitalSigns = {
    systolicBP: number;
    diastolicBP: number;
    heartRate: number;
    respiratoryRate: number;
    temperature: number;
    oxygenSaturation: number;
    consciousnessLevel: Patient['vitalSigns']['consciousnessLevel'];
};

type BackendPatient = {
    id: string;
    firstName: string;
    lastName: string;
    documentType: Patient['documentType'];
    documentNumber: string;
    dateOfBirth: string;
    age: number;
    sex: Patient['sex'];
    chiefComplaint: string;
    symptoms: string[];
    medicalHistory: string[];
    painScale: number;
    mtsLevel: Patient['mtsLevel'];
    status: PatientStatus;
    createdAt: string;
    vitalSigns: BackendVitalSigns | null;
};

type PatientCreateInput = {
    firstName: string;
    lastName: string;
    documentType: Patient['documentType'];
    documentNumber: string;
    dateOfBirth: string;
    age: number;
    sex: Patient['sex'];
    chiefComplaint: string;
    symptoms: string[];
    medicalHistory: string[];
    painScale: number;
    mtsLevel: Patient['mtsLevel'];
    vitalSigns: BackendVitalSigns;
};

const waitMinutesFromCreatedAt = (createdAt: string): number => {
    const created = new Date(createdAt).getTime();
    if (Number.isNaN(created)) {
        return 0;
    }

    return Math.max(0, Math.round((Date.now() - created) / 60000));
};

const toPatient = (data: BackendPatient): Patient => {
    const vitalSigns = data.vitalSigns ?? {
        systolicBP: 120,
        diastolicBP: 80,
        heartRate: 80,
        respiratoryRate: 16,
        temperature: 36.5,
        oxygenSaturation: 98,
        consciousnessLevel: 'Alerta',
    };

    return {
        id: data.id,
        firstName: data.firstName,
        lastName: data.lastName,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        dateOfBirth: data.dateOfBirth,
        age: data.age,
        sex: data.sex,
        chiefComplaint: data.chiefComplaint,
        symptoms: data.symptoms,
        medicalHistory: data.medicalHistory,
        painScale: data.painScale,
        vitalSigns,
        mtsLevel: data.mtsLevel,
        arrivalTime: new Date(data.createdAt),
        waitTimeMinutes: waitMinutesFromCreatedAt(data.createdAt),
        status: data.status,
    };
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

export class PatientApiService {
    async getActivePatients(): Promise<Patient[]> {
        try {
            const response = await fetch(`${API_URL}/api/patients`);
            if (!response.ok) {
                throw await buildError(response, 'Failed to load active patients');
            }

            const data = (await response.json()) as BackendPatient[];
            return data.map(toPatient);
        }
        catch (error) {
            console.error('PatientApiService.getActivePatients error:', error);
            return [];
        }
    }

    async createPatient(data: PatientCreateInput): Promise<Patient> {
        try {
            const response = await fetch(`${API_URL}/api/patients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw await buildError(response, 'Failed to create patient');
            }

            const created = (await response.json()) as BackendPatient;
            return toPatient(created);
        }
        catch (error) {
            console.error('PatientApiService.createPatient error:', error);
            throw error;
        }
    }

    async updatePatientStatus(id: string, status: PatientStatus): Promise<void> {
        try {
            const response = await fetch(`${API_URL}/api/patients/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });

            if (!response.ok) {
                throw await buildError(response, 'Failed to update patient status');
            }
        }
        catch (error) {
            console.error('PatientApiService.updatePatientStatus error:', error);
            throw error;
        }
    }

    async getPatientById(id: string): Promise<Patient> {
        try {
            const response = await fetch(`${API_URL}/api/patients/${id}`);
            if (!response.ok) {
                throw await buildError(response, 'Failed to load patient');
            }

            const data = (await response.json()) as BackendPatient;
            return toPatient(data);
        }
        catch (error) {
            console.error('PatientApiService.getPatientById error:', error);
            throw error;
        }
    }
}
