import React, { createContext, useContext, useState, ReactNode } from 'react'; // React context tools
import { Patient, Alert } from '@/types'; // Imports app types
import { mockPatients, mockAlerts } from '@/data/mockData'; // Imports mock data

export interface AppContextType { // Context value contract
  patients: Patient[]; // Patient list state
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>; // Updates patient list
  alerts: Alert[]; // Alert list state
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>; // Updates alert list
  isLoggedIn: boolean; // Login flag state
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>; // Updates login flag
  userName: string; // Current user name
  setUserName: React.Dispatch<React.SetStateAction<string>>; // Updates user name
  userRole: string; // Current user role
  setUserRole: React.Dispatch<React.SetStateAction<string>>; // Updates user role
}

const AppContext = createContext<AppContextType | undefined>(undefined); // Creates app context

export function AppProvider({ children }: { children: ReactNode }) { // Provides global state
  const [patients, setPatients] = useState<Patient[]>(mockPatients); // Initializes patients state
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts); // Initializes alerts state
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Initializes login state
  const [userName, setUserName] = useState(''); // Initializes username state
  const [userRole, setUserRole] = useState(''); // Initializes user role state

  return ( // Returns provider tree
    <AppContext.Provider value={{ patients, setPatients, alerts, setAlerts, isLoggedIn, setIsLoggedIn, userName, setUserName, userRole, setUserRole }}> // Supplies context values
      {children} // Renders nested content
    </AppContext.Provider>
  );
}

export function useApp() { // Exposes context hook
  const context = useContext(AppContext); // Reads context value
  if (!context) throw new Error('useApp must be used within AppProvider'); // Guards missing provider
  return context; // Returns context value
}
