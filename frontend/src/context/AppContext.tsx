import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Patient, Alert } from '@/types';
import { PatientApiService } from '@/infrastructure/api/PatientApiService';

const patientApiService = new PatientApiService();
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type BackendAlert = {
    id: string;
    patient_id: string;
    patient_name?: string;
    message: string;
    type: Alert['type'];
    severity: string | number;
    read: boolean;
    created_at: string;
};

const toTimeAgo = (createdAt: string): string => {
    const createdMs = new Date(createdAt).getTime();
    if (Number.isNaN(createdMs)) {
        return 'Hace un momento';
    }

    const diffMinutes = Math.max(0, Math.floor((Date.now() - createdMs) / 60000));
    if (diffMinutes < 1) {
        return 'Hace un momento';
    }

    if (diffMinutes < 60) {
        return `Hace ${diffMinutes} min`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
        return `Hace ${diffHours} h`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} d`;
};

export interface AppContextType {
    patients: Patient[];
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    loadPatients: () => Promise<void>;
    alerts: Alert[];
    setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
    loadAlerts: () => Promise<void>;
    isLoggedIn: boolean;
    setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
    userName: string;
    setUserName: React.Dispatch<React.SetStateAction<string>>;
    userRole: string;
    setUserRole: React.Dispatch<React.SetStateAction<string>>;
}
const AppContext = createContext<AppContextType | undefined>(undefined);
export function AppProvider({ children }: {
    children: ReactNode;
}) {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState('');

    const loadAlerts = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/api/alerts/unread`);
            if (!response.ok) {
                throw new Error('Failed to load alerts');
            }

            const data = (await response.json()) as BackendAlert[];
            const mapped: Alert[] = data.map(item => {
                const parsedSeverity = Number(item.severity);
                const severity = ([1, 2, 3, 4, 5] as const).includes(parsedSeverity as 1 | 2 | 3 | 4 | 5)
                    ? (parsedSeverity as 1 | 2 | 3 | 4 | 5)
                    : 3;

                return {
                    id: item.id,
                    patientId: item.patient_id,
                    patientName: item.patient_name ?? 'Paciente',
                    message: item.message,
                    type: item.type,
                    severity,
                    timeAgo: toTimeAgo(item.created_at),
                    read: item.read,
                };
            });

            setAlerts(mapped);
        }
        catch (error) {
            console.error('AppContext.loadAlerts error:', error);
            setAlerts([]);
        }
    }, []);

    const loadPatients = useCallback(async () => {
        const activePatients = await patientApiService.getActivePatients();
        setPatients(activePatients);
        await loadAlerts();
    }, [loadAlerts]);

    useEffect(() => {
        localStorage.setItem('isLoggedIn', String(isLoggedIn));
    }, [isLoggedIn]);

    useEffect(() => {
        if (isLoggedIn) {
            void loadPatients();
            void loadAlerts();
        }
    }, [isLoggedIn, loadPatients, loadAlerts]);

    return (<AppContext.Provider value={{ patients, setPatients, loadPatients, alerts, setAlerts, loadAlerts, isLoggedIn, setIsLoggedIn, userName, setUserName, userRole, setUserRole }}> 

      {children} 

    </AppContext.Provider>);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
    const context = useContext(AppContext);
    if (!context)
        throw new Error('useApp must be used within AppProvider');
    return context;
}
