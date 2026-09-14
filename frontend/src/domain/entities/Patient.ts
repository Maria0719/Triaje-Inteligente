export type MTSLevel = 1 | 2 | 3 | 4 | 5;
export type Sex = 'M' | 'F' | 'Otro';
export type ConsciousnessLevel = 'Alerta' | 'Voz' | 'Dolor' | 'No responde';
export interface VitalSigns {
    systolicBP: number;
    diastolicBP: number;
    heartRate: number;
    respiratoryRate: number;
    temperature: number;
    oxygenSaturation: number;
    consciousnessLevel: ConsciousnessLevel;
    /** HRV RMSSD en ms — solo en pacientes del kiosco con medición rPPG. */
    hrv?: number;
    /** SpO2 estimado por cámara — no clínico. Solo en pacientes del kiosco rPPG. */
    spo2?: number;
    heartRateConfidence?: number;
    respiratoryRateConfidence?: number;
    hrvConfidence?: number;
    spo2Confidence?: number;
}
export interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    documentType: 'CC' | 'Pasaporte' | 'TI';
    documentNumber: string;
    dateOfBirth: string;
    age: number;
    sex: Sex;
    chiefComplaint: string;
    symptoms: string[];
    medicalHistory: string[];
    painScale: number;
    vitalSigns: VitalSigns;
    mtsLevel: MTSLevel;
    arrivalTime: Date;
    waitTimeMinutes: number;
    status: 'waiting' | 'attended';
}
export interface TriageResult {
    level: MTSLevel;
    factors: string[];
    confidence?: number;
}
export interface Alert {
    id: string;
    patientId: string;
    patientName: string;
    message: string;
    /** Fase 4 adds 'anomalous_vitals' (FC/SpO2 fuera de rango) y 'low_confidence'. */
    type: 'wait_exceeded' | 'risk_escalated' | 'critical_vitals' | 'anomalous_vitals' | 'low_confidence';
    severity: MTSLevel;
    timeAgo: string;
    read: boolean;
}
