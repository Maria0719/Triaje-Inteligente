import { Alert } from '@/types';

export const mockAlerts: Alert[] = [
    {
        id: 'A001',
        patientId: 'P003',
        patientName: 'Andrés López Herrera',
        message: 'Tiempo de espera excedido — Nivel 2 debe ser atendido en 10 min (lleva 18 min)',
        type: 'wait_exceeded',
        severity: 2,
        timeAgo: 'Hace 8 min',
        read: false,
    },
    {
        id: 'A002',
        patientId: 'P005',
        patientName: 'Jorge Castaño Mejía',
        message: 'Tiempo de espera excedido — Nivel 3 debe ser atendido en 30 min (lleva 42 min)',
        type: 'wait_exceeded',
        severity: 3,
        timeAgo: 'Hace 12 min',
        read: false,
    },
    {
        id: 'A003',
        patientId: 'P001',
        patientName: 'Carlos Martínez Restrepo',
        message: 'Signos vitales críticos — SpO2 89%, FC 120 bpm, PA 180/110',
        type: 'critical_vitals',
        severity: 1,
        timeAgo: 'Hace 3 min',
        read: false,
    },
    {
        id: 'A004',
        patientId: 'P007',
        patientName: 'Santiago Ospina Giraldo',
        message: 'Riesgo escalado — Fiebre persistente con temperatura 38.9°C',
        type: 'risk_escalated',
        severity: 4,
        timeAgo: 'Hace 20 min',
        read: false,
    },
];
