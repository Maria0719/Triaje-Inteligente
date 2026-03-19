import type { MTSLevel } from '@/domain/entities/Patient';
export type { MTSLevel, Sex, ConsciousnessLevel, VitalSigns, Patient, TriageResult, Alert, } from '@/domain/entities/Patient';
export const MTS_CONFIG: Record<MTSLevel, {
    name: string;
    label: string;
    maxWait: number;
    color: string;
}> = {
    1: { name: 'Resucitación', label: 'Nivel 1 – Resucitación', maxWait: 0, color: 'mts-1' },
    2: { name: 'Emergencia', label: 'Nivel 2 – Emergencia', maxWait: 10, color: 'mts-2' },
    3: { name: 'Urgente', label: 'Nivel 3 – Urgente', maxWait: 30, color: 'mts-3' },
    4: { name: 'Menos urgente', label: 'Nivel 4 – Menos urgente', maxWait: 60, color: 'mts-4' },
    5: { name: 'No urgente', label: 'Nivel 5 – No urgente', maxWait: 120, color: 'mts-5' },
};
