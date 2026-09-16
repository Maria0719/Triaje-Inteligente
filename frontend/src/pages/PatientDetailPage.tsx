/**
 * Página de detalle de un paciente para la vista del médico.
 *
 * Capa: Presentación (pages)
 *
 * Muestra todos los signos vitales, síntomas, antecedentes y alertas de un
 * paciente. Cuando el paciente tiene datos rPPG (kiosco con cámara), agrega
 * cards adicionales para HRV y SpO2 estimada por cámara. Si la confianza de
 * una medición rPPG es baja (< 0.5), la card se muestra con borde amber y
 * un aviso "Verificar manualmente".
 *
 * Fase 4 — Notas del sistema:
 *   Al montar, carga TODAS las alertas del paciente (leídas y sin leer) desde
 *   GET /api/alerts/patient/{id} y las muestra en una sección "Notas del sistema"
 *   con iconos diferenciados por tipo de alerta.
 *
 * Relación con el sistema:
 *   - Lee pacientes desde AppContext (cargados por DashboardPage).
 *   - Usa PatientApiService para marcar como atendido.
 *   - Usa AlertApiService.getAlertsByPatient() para el historial completo.
 *   - No renderiza campos rPPG si son undefined (backward-compatible con
 *     pacientes registrados por el formulario médico sin cámara).
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { MTS_CONFIG } from '@/types';
import { ArrowLeft, Heart, Thermometer, Wind, Droplets, Brain, CheckCircle, RefreshCw, Clock, AlertTriangle, Bell, ShieldAlert } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PatientApiService } from '@/infrastructure/api/PatientApiService';
import { AlertApiService, type BackendAlert } from '@/infrastructure/api/AlertApiService';
import type { Alert } from '@/domain/entities/Patient';

const patientApiService = new PatientApiService();
const alertApiService = new AlertApiService();

/** Devuelve el icono y color adecuados según el tipo de alerta. */
function alertMeta(type: Alert['type']): { icon: React.ElementType; color: string } {
    switch (type) {
        case 'anomalous_vitals': return { icon: ShieldAlert, color: 'text-destructive' };
        case 'low_confidence':   return { icon: AlertTriangle, color: 'text-amber-500' };
        case 'critical_vitals':  return { icon: ShieldAlert, color: 'text-destructive' };
        default:                 return { icon: Bell, color: 'text-muted-foreground' };
    }
}

const mtsBadgeColors: Record<number, string> = {
    1: 'bg-mts-1-light text-mts-1 border border-mts-1/30',
    2: 'bg-mts-2-light text-mts-2 border border-mts-2/30',
    3: 'bg-mts-3-light text-mts-3 border border-mts-3/30',
    4: 'bg-mts-4-light text-mts-4 border border-mts-4/30',
    5: 'bg-mts-5-light text-mts-5 border border-mts-5/30',
};

function isNormal(key: string, val: number): boolean {
    switch (key) {
        case 'heartRate':         return val >= 60 && val <= 100;
        case 'systolicBP':        return val >= 90 && val <= 140;
        case 'diastolicBP':       return val >= 60 && val <= 90;
        case 'temperature':       return val >= 36.5 && val <= 37.5;
        case 'respiratoryRate':   return val >= 12 && val <= 20;
        case 'oxygenSaturation':  return val >= 95;
        default:                  return true;
    }
}

/** true cuando la confianza de una medición rPPG es demasiado baja para confiar. */
const isLowConfidence = (confidence: number | undefined) =>
    confidence !== undefined && confidence < 0.5;

export default function PatientDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { patients, setPatients } = useApp();
    const [markError, setMarkError] = useState('');
    /** Todas las alertas del paciente (leídas + sin leer) para "Notas del sistema". */
    const [systemNotes, setSystemNotes] = useState<BackendAlert[]>([]);

    useEffect(() => {
        if (!id) return;
        alertApiService
            .getAlertsByPatient(id)
            .then(setSystemNotes)
            .catch(err => console.warn('Could not load system notes:', err));
    }, [id]);

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
    const vs = patient.vitalSigns;

    const vitals = [
        { label: 'Frecuencia cardíaca', value: `${vs.heartRate} bpm`,                                  icon: Heart,       key: 'heartRate',        raw: vs.heartRate },
        { label: 'Presión arterial',    value: `${vs.systolicBP}/${vs.diastolicBP} mmHg`,              icon: Droplets,    key: 'systolicBP',       raw: vs.systolicBP },
        { label: 'Temperatura',         value: `${vs.temperature} °C`,                                 icon: Thermometer, key: 'temperature',      raw: vs.temperature },
        { label: 'Frecuencia resp.',    value: `${vs.respiratoryRate} rpm`,                             icon: Wind,        key: 'respiratoryRate',  raw: vs.respiratoryRate },
        { label: 'SpO2',                value: `${vs.oxygenSaturation}%`,                              icon: Droplets,    key: 'oxygenSaturation', raw: vs.oxygenSaturation },
        { label: 'Consciencia',         value: vs.consciousnessLevel,                                  icon: Brain,       key: 'consciousness',    raw: 0 },
    ];

    const handleMarkAttended = async () => {
        if (!id) {
            setMarkError('No se pudo identificar el paciente.');
            return;
        }
        setMarkError('');
        try {
            await patientApiService.updatePatientStatus(id, 'attended');
            setPatients(prev => prev.map(p => p.id === id ? { ...p, status: 'attended' as const } : p));
            navigate('/dashboard');
        } catch (error) {
            console.error('Failed to persist patient attended status:', error);
            setMarkError('No se pudo marcar como atendido. Intenta nuevamente.');
        }
    };

    return (
        <AppLayout>
            <div className="p-6 max-w-4xl mx-auto w-full space-y-6">

                {/* Cabecera */}
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-muted rounded-lg">
                        <ArrowLeft className="h-5 w-5"/>
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold">{patient.firstName} {patient.lastName}</h1>
                        <p className="text-sm text-muted-foreground">
                            {patient.age} años • {patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Femenino' : 'Otro'} • {patient.documentType}: {patient.documentNumber}
                        </p>
                    </div>
                    <span className={cn("px-4 py-2 rounded-xl text-sm font-bold", mtsBadgeColors[patient.mtsLevel])}>
                        {config.label}
                    </span>
                </div>

                {/* Barra de tiempo de espera */}
                <div className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center gap-4">
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground">Ingreso</p>
                            <p className="text-sm font-semibold">
                                {patient.arrivalTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </p>
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
                        <Clock className="h-4 w-4"/> Esperando: {patient.waitTimeMinutes} min
                    </p>
                </div>

                {/* Grilla de signos vitales clínicos */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {vitals.map(v => {
                        const normal = v.key === 'consciousness'
                            ? vs.consciousnessLevel === 'Alerta'
                            : isNormal(v.key, v.raw);
                        return (
                            <div key={v.key} className={cn("bg-card rounded-xl border p-4", normal ? "border-mts-4/30" : "border-destructive/30")}>
                                <div className="flex items-center gap-2 mb-2">
                                    <v.icon className={cn("h-4 w-4", normal ? "text-mts-4" : "text-destructive")}/>
                                    <span className="text-xs text-muted-foreground">{v.label}</span>
                                </div>
                                <p className={cn("text-lg font-bold", normal ? "text-foreground" : "text-destructive")}>{v.value}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Cards rPPG opcionales — solo visibles para pacientes del kiosco con cámara */}
                {(vs.hrv !== undefined || vs.spo2 !== undefined) && (
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                            Medición por cámara (rPPG)
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

                            {vs.hrv !== undefined && (() => {
                                const lowConf = isLowConfidence(vs.hrvConfidence);
                                return (
                                    <div className={cn("bg-card rounded-xl border p-4", lowConf ? "border-amber-300" : "border-mts-4/30")}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Heart className={cn("h-4 w-4", lowConf ? "text-amber-500" : "text-mts-4")}/>
                                            <span className="text-xs text-muted-foreground">VFC / HRV</span>
                                            {lowConf && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 ml-auto"/>}
                                        </div>
                                        <p className={cn("text-lg font-bold", lowConf ? "text-amber-700" : "text-foreground")}>
                                            {vs.hrv.toFixed(0)} ms RMSSD
                                        </p>
                                        {vs.hrvConfidence !== undefined && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Confianza: {(vs.hrvConfidence * 100).toFixed(0)}%
                                            </p>
                                        )}
                                        {lowConf && (
                                            <p className="text-xs text-amber-600 mt-1 font-medium">Verificar manualmente</p>
                                        )}
                                    </div>
                                );
                            })()}

                            {vs.spo2 !== undefined && (() => {
                                const lowConf = isLowConfidence(vs.spo2Confidence);
                                const normal = vs.spo2 >= 95;
                                return (
                                    <div className={cn(
                                        "bg-card rounded-xl border p-4",
                                        lowConf ? "border-amber-300" : normal ? "border-mts-4/30" : "border-destructive/30",
                                    )}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Wind className={cn("h-4 w-4", lowConf ? "text-amber-500" : normal ? "text-mts-4" : "text-destructive")}/>
                                            <span className="text-xs text-muted-foreground">SpO2 (estimado por cámara, no clínico)</span>
                                            {lowConf && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 ml-auto"/>}
                                        </div>
                                        <p className={cn("text-lg font-bold", lowConf ? "text-amber-700" : normal ? "text-foreground" : "text-destructive")}>
                                            {vs.spo2.toFixed(0)}%
                                        </p>
                                        {vs.spo2Confidence !== undefined && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Confianza: {(vs.spo2Confidence * 100).toFixed(0)}%
                                            </p>
                                        )}
                                        {lowConf && (
                                            <p className="text-xs text-amber-600 mt-1 font-medium">Verificar manualmente</p>
                                        )}
                                    </div>
                                );
                            })()}

                        </div>
                    </div>
                )}

                {/* Notas del sistema — alertas automáticas generadas por el servidor */}
                {systemNotes.length > 0 && (
                    <div className="bg-card rounded-xl border border-border p-4">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Bell className="h-4 w-4 text-muted-foreground" /> Notas del sistema
                        </h3>
                        <div className="space-y-2">
                            {systemNotes.map(note => {
                                const meta = alertMeta(note.type as Alert['type']);
                                const Icon = meta.icon;
                                const ts = note.createdAt ?? note.created_at;
                                const timeLabel = ts
                                    ? new Date(ts).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                                    : '';
                                return (
                                    <div
                                        key={note.id}
                                        className={cn(
                                            "flex items-start gap-2 border-l-2 pl-3 py-1",
                                            note.read ? "border-l-muted-foreground/30" : "border-l-destructive/60",
                                        )}
                                    >
                                        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", meta.color)} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-foreground">{note.message}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {timeLabel}
                                                {note.read && <span className="ml-2 text-muted-foreground/60">· Vista</span>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Síntomas y antecedentes */}
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

                {/* Acciones — apiladas en mobile: el texto de los botones con
                    whitespace-nowrap no cabía a la mitad del ancho en pantallas
                    angostas y se recortaba en el borde derecho. */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate('/patients/new', { state: { patient, isUpdate: true, returnTo: `/patients/${patient.id}` } })}
                    >
                        <RefreshCw className="h-4 w-4 mr-1"/> Actualizar signos vitales
                    </Button>
                    <Button
                        className="flex-1 bg-mts-4 hover:bg-mts-4/90 text-primary-foreground"
                        onClick={handleMarkAttended}
                    >
                        <CheckCircle className="h-4 w-4 mr-1"/> Marcar como atendido
                    </Button>
                </div>

                {markError && <p className="text-sm text-destructive">{markError}</p>}
            </div>
        </AppLayout>
    );
}
