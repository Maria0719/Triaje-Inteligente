/**
 * Tarjeta compacta de paciente para la lista del dashboard del médico.
 *
 * Capa: Presentación (components)
 *
 * Muestra los signos vitales más relevantes en chips de una línea.
 * Cuando el paciente tiene datos rPPG (kiosco con cámara):
 *   - HRV se muestra si está disponible.
 *   - SpO2 de cámara reemplaza la SpO2 clínica en los chips; si la
 *     confianza es baja (< 0.5) se añade un badge ⚠ amber con
 *     "Verificar manualmente" como title accesible.
 *
 * Fase 4 — hasAnomalousAlert:
 *   Si el prop es true, se muestra un badge rojo pulsante "Signos anómalos"
 *   en la esquina superior derecha de la tarjeta para llamar la atención
 *   del médico inmediatamente.
 *
 * Relación: PatientCard no modifica datos, solo los muestra.
 * DashboardPage la usa para cada paciente de la lista de espera.
 */

import { Patient, MTS_CONFIG } from '@/types';
import { Heart, Thermometer, Wind, Droplets, Clock, Eye, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface PatientCardProps {
    patient: Patient;
    onMarkAttended?: (id: string) => void;
    /** Cuando true, muestra badge rojo pulsante indicando signos vitales anómalos. */
    hasAnomalousAlert?: boolean;
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

const elapsedMinutesSince = (arrivalTime: Date) =>
    Math.max(0, Math.floor((Date.now() - arrivalTime.getTime()) / 60000));

/** true cuando la confianza de una medición rPPG es demasiado baja para confiar. */
const isLowConfidence = (confidence: number | undefined) =>
    confidence !== undefined && confidence < 0.5;

export default function PatientCard({ patient, onMarkAttended, hasAnomalousAlert = false }: PatientCardProps) {
    const navigate = useNavigate();
    const config = MTS_CONFIG[patient.mtsLevel];
    const [waitTimeMinutes, setWaitTimeMinutes] = useState(() => elapsedMinutesSince(patient.arrivalTime));

    useEffect(() => {
        const updateWaitTime = () => setWaitTimeMinutes(elapsedMinutesSince(patient.arrivalTime));
        updateWaitTime();
        const intervalId = window.setInterval(updateWaitTime, 60000);
        return () => window.clearInterval(intervalId);
    }, [patient.arrivalTime]);

    const waitExceeded = waitTimeMinutes > config.maxWait;
    const vs = patient.vitalSigns;

    // Mostrar SpO2 de cámara si está disponible, si no la clínica
    const spo2Value  = vs.spo2           ?? vs.oxygenSaturation;
    const spo2Label  = vs.spo2 !== undefined ? 'SpO2 (cám.)' : 'SpO2';
    const spo2LowConf = isLowConfidence(vs.spo2Confidence);

    return (
        <div className={cn(
            "bg-card rounded-xl border border-border border-l-4 p-4 transition-all hover:shadow-md hover:shadow-primary/5 cursor-pointer",
            mtsColorMap[patient.mtsLevel],
        )}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{patient.firstName} {patient.lastName}</h3>
                    <p className="text-sm text-muted-foreground">
                        {patient.age} años • {patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Femenino' : 'Otro'}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                    {/* Badge rojo pulsante — visible cuando hay alerta de signos anómalos */}
                    {hasAnomalousAlert && (
                        <span className="flex items-center gap-1 bg-destructive text-destructive-foreground text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse">
                            <AlertTriangle className="h-3 w-3" /> Anómalos
                        </span>
                    )}
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", mtsBgMap[patient.mtsLevel])}>
                        {config.label}
                    </span>
                </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3 line-clamp-1">{patient.chiefComplaint}</p>

            {/* Chips de signos vitales */}
            <div className="flex flex-wrap gap-3 mb-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5"/>
                    {vs.heartRate} bpm
                </span>
                <span className="flex items-center gap-1">
                    <Droplets className="h-3.5 w-3.5"/>
                    {vs.systolicBP}/{vs.diastolicBP}
                </span>
                <span className="flex items-center gap-1">
                    <Thermometer className="h-3.5 w-3.5"/>
                    {vs.temperature}°C
                </span>
                {/* SpO2: con badge de advertencia si confianza baja */}
                <span
                    className={cn("flex items-center gap-1", spo2LowConf && "text-amber-600")}
                    title={spo2LowConf ? 'Verificar manualmente — confianza baja' : undefined}
                >
                    <Wind className="h-3.5 w-3.5"/>
                    {spo2Label} {spo2Value}%
                    {spo2LowConf && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                </span>
                {/* HRV: solo si disponible */}
                {vs.hrv !== undefined && (
                    <span
                        className={cn("flex items-center gap-1", isLowConfidence(vs.hrvConfidence) && "text-amber-600")}
                        title={isLowConfidence(vs.hrvConfidence) ? 'Verificar manualmente — confianza baja' : undefined}
                    >
                        <Heart className="h-3.5 w-3.5 opacity-60"/>
                        VFC {vs.hrv.toFixed(0)} ms
                        {isLowConfidence(vs.hrvConfidence) && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                    </span>
                )}
            </div>

            <div className="flex items-center justify-between">
                <span className={cn(
                    "flex items-center gap-1 text-sm font-medium",
                    waitExceeded ? "text-destructive" : "text-muted-foreground",
                )}>
                    <Clock className="h-4 w-4"/>
                    Esperando: {waitTimeMinutes} min
                    {waitExceeded && <span className="text-xs ml-1">(excede {config.maxWait} min)</span>}
                </span>

                <div className="flex gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patient.id}`); }}
                        className="flex items-center gap-1 text-xs font-medium text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
                    >
                        <Eye className="h-3.5 w-3.5"/> Ver detalle
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onMarkAttended?.(patient.id); }}
                        className="flex items-center gap-1 text-xs font-medium text-primary-foreground bg-mts-4 rounded-lg px-3 py-1.5 hover:opacity-90 transition-colors"
                    >
                        <CheckCircle className="h-3.5 w-3.5"/> Atendido
                    </button>
                </div>
            </div>
        </div>
    );
}
