import { useLocation, useNavigate } from 'react-router-dom';
import { MTS_CONFIG, MTSLevel, Patient } from '@/types';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, RefreshCw, UserPlus } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
const mtsCircleColors: Record<number, string> = {
    1: 'bg-mts-1',
    2: 'bg-mts-2',
    3: 'bg-mts-3',
    4: 'bg-mts-4',
    5: 'bg-mts-5',
};
type TriageResultPatientState = {
    id?: string;
    firstName: string;
    lastName: string;
    docType: Patient['documentType'];
    docNumber: string;
    dob: string;
    age: number | '';
    sex: Patient['sex'];
    complaint: string;
    symptoms: string[];
    history: string[];
    painScale: number;
    vitals: Patient['vitalSigns'];
};
type TriageResultLocationState = {
    level: MTSLevel;
    factors: string[];
    patient: TriageResultPatientState;
    isUpdate?: boolean;
};
export default function TriageResultPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { setPatients } = useApp();
    const state = location.state as TriageResultLocationState | null;
    if (!state) {
        navigate('/patients/new');
        return null;
    }
    const { level, factors, patient } = state;
    const config = MTS_CONFIG[level];
    const handleAddToQueue = () => {
        if (state.isUpdate && patient.id) {
            setPatients(prev => prev.map(p => p.id === patient.id
                ? {
                    ...p,
                    firstName: patient.firstName,
                    lastName: patient.lastName,
                    documentType: patient.docType,
                    documentNumber: patient.docNumber,
                    dateOfBirth: patient.dob,
                    age: typeof patient.age === 'number' ? patient.age : p.age,
                    sex: patient.sex,
                    chiefComplaint: patient.complaint || 'No especificado',
                    symptoms: patient.symptoms,
                    medicalHistory: patient.history,
                    painScale: patient.painScale,
                    vitalSigns: patient.vitals,
                    mtsLevel: level,
                }
                : p));
            navigate('/dashboard');
            return;
        }
        const newPatient: Patient = {
            id: `P${Date.now()}`,
            firstName: patient.firstName,
            lastName: patient.lastName,
            documentType: patient.docType,
            documentNumber: patient.docNumber,
            dateOfBirth: patient.dob,
            age: patient.age,
            sex: patient.sex,
            chiefComplaint: patient.complaint || 'No especificado',
            symptoms: patient.symptoms,
            medicalHistory: patient.history,
            painScale: patient.painScale,
            vitalSigns: patient.vitals,
            mtsLevel: level,
            arrivalTime: new Date(),
            waitTimeMinutes: 0,
            status: 'waiting',
        };
        setPatients(prev => [...prev, newPatient]);
        navigate('/dashboard');
    };
    return (<AppLayout>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            
            <div className={cn("h-28 w-28 rounded-full mx-auto flex items-center justify-center animate-scale-in mb-6", mtsCircleColors[level])}>
              <span className="text-4xl font-extrabold text-primary-foreground">{level}</span>
            </div>

            <h1 className="text-2xl font-bold mb-1">{config.label.toUpperCase()}</h1>
            <p className="text-muted-foreground flex items-center justify-center gap-2 mb-6">
              <Clock className="h-4 w-4"/>
              {config.maxWait === 0 ? 'Atención inmediata requerida' : `Debe ser atendido en máximo ${config.maxWait} minutos`}
            </p>

            
            <div className="bg-muted/50 rounded-lg p-4 text-left mb-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-mts-2"/>
                <h3 className="text-sm font-semibold">Factores de riesgo identificados</h3>
              </div>
              <ul className="space-y-1.5">
                {factors.map((f, i) => (<li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0"/>
                    {f}
                  </li>))}
              </ul>
            </div>

            
            {patient.vitals && (<div className="grid grid-cols-3 gap-3 mb-6 text-center">
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-lg font-bold">{patient.vitals.heartRate}</p>
                  <p className="text-xs text-muted-foreground">FC (bpm)</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-lg font-bold">{patient.vitals.systolicBP}/{patient.vitals.diastolicBP}</p>
                  <p className="text-xs text-muted-foreground">PA (mmHg)</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-lg font-bold">{patient.vitals.oxygenSaturation}%</p>
                  <p className="text-xs text-muted-foreground">SpO2</p>
                </div>
              </div>)}

            
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/patients/new')}>
                <RefreshCw className="h-4 w-4 mr-1"/> Recalcular
              </Button>
              <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleAddToQueue}>
                <UserPlus className="h-4 w-4 mr-1"/> Agregar a lista
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>);
}
