import { Patient, MTS_CONFIG } from '@/types';
import { Heart, Thermometer, Wind, Droplets, Clock, Eye, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface PatientCardProps {
  patient: Patient;
  onMarkAttended?: (id: string) => void;
}

const mtsColorMap: Record<number, string> = {
  1: 'border-l-mts-1',
  2: 'border-l-mts-2',
  3: 'border-l-mts-3',
  4: 'border-l-mts-4',
  5: 'border-l-mts-5',
};

const mtsBgMap: Record<number, string> = {
  1: 'bg-mts-1-light text-mts-1',
  2: 'bg-mts-2-light text-mts-2',
  3: 'bg-mts-3-light text-mts-3',
  4: 'bg-mts-4-light text-mts-4',
  5: 'bg-mts-5-light text-mts-5',
};

const elapsedMinutesSince = (arrivalTime: Date) => Math.max(0, Math.floor((Date.now() - arrivalTime.getTime()) / 60000));

export default function PatientCard({ patient, onMarkAttended }: PatientCardProps) {
  const navigate = useNavigate();
  const config = MTS_CONFIG[patient.mtsLevel];
  const [waitTimeMinutes, setWaitTimeMinutes] = useState(() => elapsedMinutesSince(patient.arrivalTime));

  useEffect(() => {
    const updateWaitTime = () => {
      setWaitTimeMinutes(elapsedMinutesSince(patient.arrivalTime));
    };

    updateWaitTime();
    const intervalId = window.setInterval(updateWaitTime, 60000);
    return () => window.clearInterval(intervalId);
  }, [patient.arrivalTime]);

  const waitExceeded = waitTimeMinutes > config.maxWait;

  return (
    <div className={cn(
      "bg-card rounded-xl border border-border border-l-4 p-4 transition-all hover:shadow-md hover:shadow-primary/5 cursor-pointer",
      mtsColorMap[patient.mtsLevel]
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">{patient.firstName} {patient.lastName}</h3>
          <p className="text-sm text-muted-foreground">{patient.age} años • {patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Femenino' : 'Otro'}</p>
        </div>
        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", mtsBgMap[patient.mtsLevel])}>
          {config.label}
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-3 line-clamp-1">{patient.chiefComplaint}</p>

      {/* Vital signs row */}
      <div className="flex flex-wrap gap-3 mb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{patient.vitalSigns.heartRate} bpm</span>
        <span className="flex items-center gap-1"><Droplets className="h-3.5 w-3.5" />{patient.vitalSigns.systolicBP}/{patient.vitalSigns.diastolicBP}</span>
        <span className="flex items-center gap-1"><Thermometer className="h-3.5 w-3.5" />{patient.vitalSigns.temperature}°C</span>
        <span className="flex items-center gap-1"><Wind className="h-3.5 w-3.5" />SpO2 {patient.vitalSigns.oxygenSaturation}%</span>
      </div>

      {/* Wait time + actions */}
      <div className="flex items-center justify-between">
        <span className={cn(
          "flex items-center gap-1 text-sm font-medium",
          waitExceeded ? "text-destructive" : "text-muted-foreground"
        )}>
          <Clock className="h-4 w-4" />
          Esperando: {waitTimeMinutes} min
          {waitExceeded && <span className="text-xs ml-1">(excede {config.maxWait} min)</span>}
        </span>

        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patient.id}`); }}
            className="flex items-center gap-1 text-xs font-medium text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> Ver detalle
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMarkAttended?.(patient.id); }}
            className="flex items-center gap-1 text-xs font-medium text-primary-foreground bg-mts-4 rounded-lg px-3 py-1.5 hover:opacity-90 transition-colors"
          >
            <CheckCircle className="h-3.5 w-3.5" /> Atendido
          </button>
        </div>
      </div>
    </div>
  );
}
