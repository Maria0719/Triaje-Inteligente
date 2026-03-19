import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Patient, Alert } from '@/types';
import { mockAlerts } from '@/data/mockData';
import { PatientApiService } from '@/infrastructure/api/PatientApiService';

const patientApiService = new PatientApiService();

export interface AppContextType {
    patients: Patient[];
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    loadPatients: () => Promise<void>;
    alerts: Alert[];
    setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
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
    const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
    const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState('');

    const loadPatients = useCallback(async () => {
        const activePatients = await patientApiService.getActivePatients();
        setPatients(activePatients);
    }, []);

    useEffect(() => {
        localStorage.setItem('isLoggedIn', String(isLoggedIn));
    }, [isLoggedIn]);

    useEffect(() => {
        if (isLoggedIn) {
            void loadPatients();
        }
    }, [isLoggedIn, loadPatients]);

    return (<AppContext.Provider value={{ patients, setPatients, loadPatients, alerts, setAlerts, isLoggedIn, setIsLoggedIn, userName, setUserName, userRole, setUserRole }}> 

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
