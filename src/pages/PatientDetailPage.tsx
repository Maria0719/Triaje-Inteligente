import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { MTS_CONFIG } from '@/types';
import { ArrowLeft, Heart, Thermometer, Wind, Droplets, Brain, CheckCircle, RefreshCw, Clock } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const mtsBadgeColors: Record<number, string> = {
  1: 'bg-mts-1-light text-mts-1 border border-mts-1/30',
  2: 'bg-mts-2-light text-mts-2 border border-mts-2/30',
  3: 'bg-mts-3-light text-mts-3 border border-mts-3/30',
  4: 'bg-mts-4-light text-mts-4 border border-mts-4/30',
  5: 'bg-mts-5-light text-mts-5 border border-mts-5/30',
};

function isNormal(key: string, val: number): boolean {
  switch (key) {
    case 'heartRate': return val >= 60 && val <= 100;
    case 'systolicBP': return val >= 90 && val <= 140;
    case 'diastolicBP': return val >= 60 && val <= 90;
    case 'temperature': return val >= 36.5 && val <= 37.5;
    case 'respiratoryRate': return val >= 12 && val <= 20;
    case 'oxygenSaturation': return val >= 95;
    default: return true;
  }
}

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { patients, setPatients, alerts } = useApp();
  const patient = patients.find(p => p.id === id);

  if (!patient) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Paciente no encontrado</p>
        </div>
      </AppLayout>
    );
  }

  const config = MTS_CONFIG[patient.mtsLevel];
  const patientAlerts = alerts.filter(a => a.patientId === patient.id);

  const vitals = [
    { label: 'Frecuencia cardíaca', value: `${patient.vitalSigns.heartRate} bpm`, icon: Heart, key: 'heartRate', raw: patient.vitalSigns.heartRate },
    { label: 'Presión arterial', value: `${patient.vitalSigns.systolicBP}/${patient.vitalSigns.diastolicBP} mmHg`, icon: Droplets, key: 'systolicBP', raw: patient.vitalSigns.systolicBP },
    { label: 'Temperatura', value: `${patient.vitalSigns.temperature} °C`, icon: Thermometer, key: 'temperature', raw: patient.vitalSigns.temperature },
    { label: 'Frecuencia resp.', value: `${patient.vitalSigns.respiratoryRate} rpm`, icon: Wind, key: 'respiratoryRate', raw: patient.vitalSigns.respiratoryRate },
    { label: 'SpO2', value: `${patient.vitalSigns.oxygenSaturation}%`, icon: Droplets, key: 'oxygenSaturation', raw: patient.vitalSigns.oxygenSaturation },
    { label: 'Consciencia', value: patient.vitalSigns.consciousnessLevel, icon: Brain, key: 'consciousness', raw: 0 },
  ];

  const handleMarkAttended = () => {
    setPatients(prev => prev.map(p => p.id === id ? { ...p, status: 'attended' as const } : p));
    navigate('/dashboard');
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-muted rounded-lg"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{patient.firstName} {patient.lastName}</h1>
            <p className="text-sm text-muted-foreground">{patient.age} años • {patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Femenino' : 'Otro'} • {patient.documentType}: {patient.documentNumber}</p>
          </div>
          <span className={cn("px-4 py-2 rounded-xl text-sm font-bold", mtsBadgeColors[patient.mtsLevel])}>
            {config.label}
          </span>
        </div>

        {/* Timeline */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Ingreso</p>
              <p className="text-sm font-semibold">{patient.arrivalTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="flex-1 h-2 bg-muted rounded-full relative overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", patient.waitTimeMinutes > config.maxWait ? "bg-destructive" : "bg-mts-4")}
                style={{ width: `${Math.min((patient.waitTimeMinutes / Math.max(config.maxWait, 1)) * 100, 100)}%` }}
              />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Tiempo máx.</p>
              <p className="text-sm font-semibold">{config.maxWait === 0 ? 'Inmediato' : `${config.maxWait} min`}</p>
            </div>
          </div>
          <p className={cn("text-sm mt-2 flex items-center gap-1", patient.waitTimeMinutes > config.maxWait ? "text-destructive font-medium" : "text-muted-foreground")}>
            <Clock className="h-4 w-4" /> Esperando: {patient.waitTimeMinutes} min
          </p>
        </div>

        {/* Vitals grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {vitals.map(v => {
            const normal = v.key === 'consciousness' ? patient.vitalSigns.consciousnessLevel === 'Alerta' : isNormal(v.key, v.raw);
            return (
              <div key={v.key} className={cn("bg-card rounded-xl border p-4", normal ? "border-mts-4/30" : "border-destructive/30")}>
                <div className="flex items-center gap-2 mb-2">
                  <v.icon className={cn("h-4 w-4", normal ? "text-mts-4" : "text-destructive")} />
                  <span className="text-xs text-muted-foreground">{v.label}</span>
                </div>
                <p className={cn("text-lg font-bold", normal ? "text-foreground" : "text-destructive")}>{v.value}</p>
              </div>
            );
          })}
        </div>

        {/* Symptoms + History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">Síntomas</h3>
            <div className="flex flex-wrap gap-2">
              {patient.symptoms.map(s => (
                <span key={s} className="bg-secondary text-secondary-foreground text-xs px-2.5 py-1 rounded-full">{s}</span>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-3">{patient.chiefComplaint}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">Antecedentes</h3>
            <div className="flex flex-wrap gap-2">
              {patient.medicalHistory.map(h => (
                <span key={h} className="bg-secondary text-secondary-foreground text-xs px-2.5 py-1 rounded-full">{h}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Alert history */}
        {patientAlerts.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">Historial de alertas</h3>
            <div className="space-y-2">
              {patientAlerts.map(a => (
                <div key={a.id} className="text-sm text-muted-foreground border-l-2 border-destructive/40 pl-3 py-1">
                  {a.message} — <span className="text-xs">{a.timeAgo}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/patients/new')}>
            <RefreshCw className="h-4 w-4 mr-1" /> Actualizar signos vitales
          </Button>
          <Button className="flex-1 bg-mts-4 hover:bg-mts-4/90 text-primary-foreground" onClick={handleMarkAttended}>
            <CheckCircle className="h-4 w-4 mr-1" /> Marcar como atendido
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
