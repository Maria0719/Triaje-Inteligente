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
  type: 'wait_exceeded' | 'risk_escalated' | 'critical_vitals';
  severity: MTSLevel;
  timeAgo: string;
  read: boolean;
}