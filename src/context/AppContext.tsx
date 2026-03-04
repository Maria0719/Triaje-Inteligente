import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Patient, Alert } from '@/types';
import { mockPatients, mockAlerts } from '@/data/mockData';

interface AppContextType {
  patients: Patient[];
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  userName: string;
  userRole: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>(mockPatients);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName] = useState('Dr. Alejandra Ruiz');
  const [userRole] = useState('Doctor');

  return (
    <AppContext.Provider value={{ patients, setPatients, alerts, setAlerts, isLoggedIn, setIsLoggedIn, userName, userRole }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
