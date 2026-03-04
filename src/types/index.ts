export type MTSLevel = 1 | 2 | 3 | 4 | 5;

export type Sex = 'M' | 'F' | 'Otro';

export type ConsciousnessLevel = 'Alerta' | 'Voz' | 'Dolor' | 'No responde';

export type UserRole = 'Doctor' | 'Enfermero' | 'Administrador';

export interface VitalSigns {
  systolicBP: number;
  diastolicBP: number;
  heartRate: number;
  respiratoryRate: number;
  temperature: number;
  oxygenSaturation: number;
  consciousnessLevel: ConsciousnessLevel;
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

export interface Alert {
  id: string;
  patientId: string;
  patientName: string;
  message: string;
  type: 'wait_exceeded' | 'risk_escalated' | 'critical_vitals';
  severity: MTSLevel;
  timeAgo: string;
  read: boolean;
}

export const MTS_CONFIG: Record<MTSLevel, { name: string; label: string; maxWait: number; color: string }> = {
  1: { name: 'Resucitación', label: 'Nivel 1 — Resucitación', maxWait: 0, color: 'mts-1' },
  2: { name: 'Emergencia', label: 'Nivel 2 — Emergencia', maxWait: 10, color: 'mts-2' },
  3: { name: 'Urgente', label: 'Nivel 3 — Urgente', maxWait: 30, color: 'mts-3' },
  4: { name: 'Menos urgente', label: 'Nivel 4 — Menos urgente', maxWait: 60, color: 'mts-4' },
  5: { name: 'No urgente', label: 'Nivel 5 — No urgente', maxWait: 120, color: 'mts-5' },
};
