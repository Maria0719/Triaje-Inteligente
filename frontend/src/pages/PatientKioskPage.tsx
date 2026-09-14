/**
 * Página de kiosco de autoregistro para pacientes.
 *
 * Capa: Presentación (pages)
 *
 * Guía al paciente por un flujo de hasta 6 pasos:
 *   1. identify      — recoge nombre, cédula y EPS
 *   2. camera        — abre la cámara y mide FC, FR, HRV y SpO2 via IVitalSignsDetector
 *   3. camera_error  — (condicional) confianza promedio < 0.3 → ofrece reintentar
 *   4. pain          — el paciente auto-reporta su nivel de dolor (0–10)
 *   5. consciousness — el paciente auto-reporta su nivel de consciencia
 *   6. done          — confirma el registro y muestra el nivel MTS asignado
 *
 * Reglas de calidad (Fase 4):
 *   - Si la confianza PROMEDIO de los signos medidos es < 0.3, se descarta la
 *     medición completa y se muestra el paso 'camera_error' con botón de reintentar.
 *   - Si UN solo signo tiene confidence < 0.5, se registra de todos modos; el
 *     campo *Confidence se envía al backend y el doctor verá la advertencia.
 *
 * La medición objetiva (FC, FR, HRV, SpO2) se delega al detector
 * (Fase 2: RppgVitalSignsDetector real, con SimulatedVitalSignsDetector como
 * fallback "Modo demo" si la cámara o MediaPipe no están disponibles).
 *
 * Relación con el sistema:
 *   - Consume IVitalSignsDetector (port) sin conocer la implementación concreta.
 *   - RppgVitalSignsDetector expone su propio callback de calidad (mismo dato
 *     que antes venía de useFaceCapture); este componente ya no instancia
 *     useFaceCapture por separado para evitar correr dos veces MediaPipe en
 *     paralelo durante la medición real.
 *   - Envía el registro a POST /api/patients/kiosk con todos los vitales.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, HeartPulse, Activity, Waves, Droplet, RefreshCw, AlertTriangle } from 'lucide-react';
import { IVitalSignsDetector, VitalSignsMeasurement } from '@/domain/ports/IVitalSignsDetector';
import { SimulatedVitalSignsDetector } from '@/domain/services/SimulatedVitalSignsDetector';
import { RppgVitalSignsDetector } from '@/infrastructure/vision/RppgVitalSignsDetector';
import type { FaceCaptureQuality } from '@/infrastructure/vision/RoiSignalTypes';
import type { ConsciousnessLevel } from '@/domain/entities/Patient';

// ─── Tipos locales ────────────────────────────────────────────────────────────

type KioskStep = 'identify' | 'camera' | 'camera_error' | 'pain' | 'consciousness' | 'done';

/** Las 4 métricas que mide la cámara (sin dolor ni consciencia, autoreportados aparte). */
type MeasurementKey = 'heartRate' | 'respiratoryRate' | 'hrv' | 'spo2';

type MeasurementState = {
  loading: boolean;
  progress: number;
  /** Valor ya formateado para mostrar en pantalla (p. ej. "72 bpm"). */
  value: string;
  /** confidence del signo medido; undefined mientras loading es true. */
  confidence?: number;
};

type KioskResponse = {
  patientId: string;
  estimatedWaitMinutes?: number | null;
  mtsLevel: number;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/**
 * Umbral de confianza PROMEDIO por debajo del cual se descarta la medición
 * completa y se solicita al paciente que lo intente de nuevo.
 */
const CONFIDENCE_DISCARD_THRESHOLD = 0.3;

/**
 * Umbral de confianza INDIVIDUAL por debajo del cual un signo se considera
 * poco confiable (se registra igual, con advertencia para el doctor).
 */
const CONFIDENCE_WARN_THRESHOLD = 0.5;

/** Número máximo de reintentos antes de permitir continuar de todos modos. */
const MAX_RETRIES = 3;

const EPS_OPTIONS = [
  'Sura',
  'Sanitas',
  'Nueva EPS',
  'Compensar',
  'Coomeva',
  'Famisanar',
  'Salud Total',
  'Cafesalud',
  'Medimas',
  'Coosalud',
  'Mutual SER',
  'Asmet Salud',
  'Emssanar',
  'Capital Salud',
  'Convida',
  'SOS',
  'Comfenalco Valle',
  'Particular/No asegurado',
] as const;

const CONSCIOUSNESS_OPTIONS: { value: ConsciousnessLevel; label: string; description: string }[] = [
  { value: 'Alerta',      label: 'Alerta',                   description: 'Estoy completamente despierto/a' },
  { value: 'Voz',         label: 'Respondo cuando me hablan', description: 'Me despertó cuando me llamaron' },
  { value: 'Dolor',       label: 'Solo siento dolor',        description: 'Solo reacciono al dolor físico' },
  { value: 'No responde', label: 'No respondo',              description: 'No reacciono a nada' },
];

const createInitialMeasurements = (): Record<MeasurementKey, MeasurementState> => ({
  heartRate:       { loading: true, progress: 0, value: '' },
  respiratoryRate: { loading: true, progress: 0, value: '' },
  hrv:             { loading: true, progress: 0, value: '' },
  spo2:            { loading: true, progress: 0, value: '' },
});

const DEFAULT_QUALITY: FaceCaptureQuality = {
  status: 'idle',
  faceDetected: false,
  faceCentered: false,
  lightAdequate: false,
  motionStable: false,
  message: 'Esperando cámara...',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calcula la confianza promedio de todos los campos de VitalSignsMeasurement
 * que tienen un valor de `confidence` definido.
 * Devuelve 1 (confianza máxima) si ningún campo tiene `confidence`.
 */
function averageConfidence(result: VitalSignsMeasurement): number {
  const values: number[] = [];
  if (result.heartRate.confidence !== undefined)      values.push(result.heartRate.confidence);
  if (result.respiratoryRate.confidence !== undefined) values.push(result.respiratoryRate.confidence);
  if (result.hrv?.confidence !== undefined)           values.push(result.hrv.confidence);
  if (result.spo2?.confidence !== undefined)          values.push(result.spo2.confidence);
  if (values.length === 0) return 1;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PatientKioskPage() {
  const [step, setStep] = useState<KioskStep>('identify');

  // Paso 1: datos de identificación
  const [fullName, setFullName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [eps, setEps] = useState<(typeof EPS_OPTIONS)[number]>(EPS_OPTIONS[0]);

  // Paso 2: medición por cámara
  const [measurements, setMeasurements] = useState<Record<MeasurementKey, MeasurementState>>(createInitialMeasurements);
  /** Número de veces que se ha intentado la medición en esta sesión. */
  const [measurementAttempts, setMeasurementAttempts] = useState(0);

  // Paso 3: dolor auto-reportado (null = sin selección)
  const [painScale, setPainScale] = useState<number | null>(null);

  // Paso 4: consciencia auto-reportada (pre-selecciona 'Alerta')
  const [consciousnessLevel, setConsciousnessLevel] = useState<ConsciousnessLevel>('Alerta');

  // Estado de registro
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState<KioskResponse | null>(null);
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** Valores crudos de la última medición por cámara (FC, FR, HRV, SpO2). */
  const detectedRef = useRef<VitalSignsMeasurement | null>(null);
  /** Evita doble envío al backend. */
  const registeringRef = useRef(false);

  // Calidad de captura facial (rostro detectado/centrado, luz, movimiento).
  // La alimenta directamente RppgVitalSignsDetector durante la medición real
  // (ver constructor de RppgVitalSignsDetector); no se usa useFaceCapture
  // aquí para no instanciar un segundo FaceLandmarker en paralelo.
  const [quality, setQuality] = useState<FaceCaptureQuality>(DEFAULT_QUALITY);

  const nameParts = useMemo(() => fullName.trim().split(/\s+/).filter(Boolean), [fullName]);

  const resetToStepOne = () => {
    setStep('identify');
    setFullName('');
    setDocumentNumber('');
    setEps(EPS_OPTIONS[0]);
    setMeasurements(createInitialMeasurements());
    setMeasurementAttempts(0);
    setPainScale(null);
    setConsciousnessLevel('Alerta');
    setRegistering(false);
    setSuccess(null);
    setError('');
    setQuality(DEFAULT_QUALITY);
    detectedRef.current = null;
    registeringRef.current = false;
  };

  /** Reinicia solo la medición para volver a intentarla. */
  const retryMeasurement = () => {
    setMeasurements(createInitialMeasurements());
    setQuality(DEFAULT_QUALITY);
    detectedRef.current = null;
    setMeasurementAttempts(prev => prev + 1);
    setStep('camera');
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Abre (o cierra) el stream de cámara solo mientras estamos en el paso 'camera'.
  useEffect(() => {
    if (step !== 'camera') {
      stopCamera();
      return;
    }

    let cancelled = false;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (cameraError) {
        console.error('Unable to start kiosk camera:', cameraError);
        // Mensajes dirigidos al paciente, no al desarrollador: explican qué
        // hacer en vez de solo describir el error técnico. El flujo sigue
        // igual (se intenta medir y, si la señal resulta inutilizable, se
        // muestra la pantalla de reintento 'camera_error'), así que el texto
        // no promete "modo demo" aquí.
        if (cameraError instanceof DOMException && cameraError.name === 'NotAllowedError') {
          setError('Necesitamos acceso a tu cámara para continuar. Actívalo en la configuración de tu navegador e inténtalo de nuevo.');
        } else {
          setError('No pudimos acceder a tu cámara. Verifica que esté conectada e inténtalo de nuevo.');
        }
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [step]);

  // Mide FC, FR, HRV y SpO2 via el detector.
  // Usa RppgVitalSignsDetector (real) cuando hay cámara disponible; si la
  // API de cámara no existe o el detector real falla por completo (MediaPipe
  // no cargó), cae a SimulatedVitalSignsDetector en "Modo demo".
  // Aplica reglas de calidad antes de avanzar al paso 'pain'.
  useEffect(() => {
    if (step !== 'camera') return;

    let cancelled = false;
    let detector: IVitalSignsDetector;

    const video = videoRef.current;
    const cameraApiAvailable = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

    if (video && cameraApiAvailable) {
      detector = new RppgVitalSignsDetector(video, {
        onQuality: q => {
          if (!cancelled) setQuality(q);
        },
      });
    } else {
      detector = new SimulatedVitalSignsDetector();
      setError('No se detectó cámara disponible. Modo demo activo.');
    }

    const handleProgress = (progress: number) => {
      if (cancelled) return;
      setMeasurements(prev => ({
        heartRate:       { ...prev.heartRate,       progress },
        respiratoryRate: { ...prev.respiratoryRate, progress },
        hrv:             { ...prev.hrv,             progress },
        spo2:            { ...prev.spo2,            progress },
      }));
    };

    const applyResult = (result: VitalSignsMeasurement) => {
      if (cancelled) return;

      const avgConf = averageConfidence(result);

      // Descarte total: confianza promedio demasiado baja para ser útil.
      if (avgConf < CONFIDENCE_DISCARD_THRESHOLD) {
        setMeasurements(createInitialMeasurements());
        setStep('camera_error');
        return;
      }

      // Guardamos los valores crudos; el registro los leerá desde aquí.
      // Los campos de confidence quedan en el objeto para que el backend
      // y el doctor puedan ver qué signos eran poco fiables.
      detectedRef.current = result;
      setMeasurements({
        heartRate:       { loading: false, progress: 100, value: `${result.heartRate.value} bpm`, confidence: result.heartRate.confidence },
        respiratoryRate: { loading: false, progress: 100, value: `${result.respiratoryRate.value} rpm`, confidence: result.respiratoryRate.confidence },
        hrv:             { loading: false, progress: 100, value: `${result.hrv?.value ?? 0} ms`, confidence: result.hrv?.confidence },
        spo2:            { loading: false, progress: 100, value: `${result.spo2?.value ?? 0} %`, confidence: result.spo2?.confidence },
      });
      setStep('pain');
    };

    detector.measure(handleProgress).then(applyResult).catch(err => {
      if (cancelled) return;
      // RppgVitalSignsDetector rechaza measure() solo cuando MediaPipe no
      // pudo cargar en absoluto; en ese caso caemos a la simulación.
      console.error('[PatientKioskPage] RppgVitalSignsDetector failed, falling back to demo:', err);
      setError('No se pudo usar la cámara para medir signos vitales. Modo demo activo.');
      const fallback = new SimulatedVitalSignsDetector();
      detector = fallback; // para que la limpieza cancele el detector correcto
      fallback.measure(handleProgress).then(applyResult);
    });

    return () => {
      cancelled = true;
      detector.cancel();
    };
  }, [step]);

  /**
   * Dispara el registro en el backend combinando vitales de cámara +
   * dolor y consciencia auto-reportados por el paciente.
   * Solo se llama una vez (guardado por registeringRef).
   */
  const registerPatient = async (pain: number, consciousness: ConsciousnessLevel) => {
    if (registeringRef.current) return;
    registeringRef.current = true;

    const detected = detectedRef.current;
    if (!detected) {
      setError('No se pudo recuperar los datos de la medición. Intente nuevamente.');
      registeringRef.current = false;
      return;
    }

    const payload = {
      firstName: nameParts[0] ?? 'Paciente',
      lastName: nameParts.slice(1).join(' ') || 'Sin apellido',
      documentNumber,
      eps,
      vitalSigns: {
        heartRate:            detected.heartRate.value,
        respiratoryRate:      detected.respiratoryRate.value,
        painScale:            pain,
        consciousnessLevel:   consciousness,
        hrv:                  detected.hrv?.value                          ?? null,
        spo2:                 detected.spo2?.value                         ?? null,
        heartRateConfidence:  detected.heartRate.confidence                ?? null,
        respiratoryRateConfidence: detected.respiratoryRate.confidence     ?? null,
        hrvConfidence:        detected.hrv?.confidence                     ?? null,
        spo2Confidence:       detected.spo2?.confidence                    ?? null,
      },
      source: 'kiosk' as const,
    };

    setRegistering(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/patients/kiosk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('No se pudo registrar en el sistema.');
      }

      const data = (await response.json()) as KioskResponse;
      setSuccess(data);
      setStep('done');
    } catch (registerError) {
      console.error('Kiosk registration failed:', registerError);
      setError('No se pudo completar el registro. Intente nuevamente.');
      registeringRef.current = false;
    } finally {
      setRegistering(false);
    }
  };

  // Auto-reset del kiosco 10 s después de mostrar la confirmación.
  useEffect(() => {
    if (step !== 'done' || !success) return;
    const resetTimer = window.setTimeout(resetToStepOne, 10000);
    return () => window.clearTimeout(resetTimer);
  }, [step, success]);

  const onContinue = () => {
    if (!fullName.trim() || !documentNumber.trim() || !eps) {
      setError('Completa todos los campos para continuar.');
      return;
    }
    setError('');
    setStep('camera');
  };

  const onConfirmConsciousness = () => {
    void registerPatient(painScale ?? 0, consciousnessLevel);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-100 px-4 py-6 md:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="text-center mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-primary">TriageAI</h1>
          <p className="text-base md:text-lg text-slate-700 mt-1">Hospital Universitario San Jose</p>
        </header>

        {/* ── Paso 1: Identificación ── */}
        {step === 'identify' && (
          <section className="rounded-3xl border border-blue-100 bg-white p-6 md:p-10 shadow-lg">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">Registro de Paciente</h2>

            <div className="space-y-4 md:space-y-5">
              <div>
                <label className="block text-lg font-semibold text-slate-800 mb-2">Nombre completo</label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Escribe tu nombre y apellidos"
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-slate-800 mb-2">Cedula</label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={documentNumber}
                  onChange={e => setDocumentNumber(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  placeholder="Numero de documento"
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-slate-800 mb-2">EPS</label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={eps}
                  onChange={e => setEps(e.target.value as (typeof EPS_OPTIONS)[number])}
                >
                  {EPS_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {error && <p className="text-base text-destructive font-medium">{error}</p>}

              <button
                onClick={onContinue}
                className="mt-2 w-full rounded-2xl bg-primary py-4 text-xl font-bold text-white transition hover:bg-primary/90"
              >
                Continuar
              </button>
            </div>
          </section>
        )}

        {/* ── Paso 2: Medición por cámara ── */}
        {step === 'camera' && (
          <section className="rounded-3xl border border-blue-100 bg-white p-6 md:p-10 shadow-lg space-y-6">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Hola, {nameParts[0] ?? 'Paciente'}</h2>
              <p className="text-base md:text-lg text-slate-600 mt-1">Estamos tomando tus signos vitales. Mira a la cámara.</p>
            </div>

            <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              {!streamRef.current && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                  <Camera className="h-10 w-10 mb-2" />
                  <span>Modo demo</span>
                </div>
              )}
              {streamRef.current && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
                  <span className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white">
                    {quality.message}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MeasurementCard
                title="Frecuencia cardiaca"
                icon={<HeartPulse className="h-5 w-5 text-primary" />}
                state={measurements.heartRate}
              />
              <MeasurementCard
                title="Frecuencia respiratoria"
                icon={<Activity className="h-5 w-5 text-primary" />}
                state={measurements.respiratoryRate}
              />
              <MeasurementCard
                title="Variabilidad cardiaca (HRV)"
                icon={<Waves className="h-5 w-5 text-primary" />}
                state={measurements.hrv}
              />
              <MeasurementCard
                title="SpO2 estimado"
                icon={<Droplet className="h-5 w-5 text-primary" />}
                state={measurements.spo2}
              />
            </div>

            {error && <p className="text-center text-base text-destructive">{error}</p>}
          </section>
        )}

        {/* ── Paso 3 (condicional): Error de calidad ── */}
        {step === 'camera_error' && (
          <section className="rounded-3xl border border-amber-200 bg-white p-8 md:p-12 shadow-lg text-center space-y-6">
            <div className="flex justify-center">
              <AlertTriangle className="h-16 w-16 text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                No pudimos medir tus signos
              </h2>
              <p className="text-base text-slate-600">
                Inténtalo de nuevo en un ambiente mejor iluminado, mirando directamente
                a la cámara y sin moverte.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={retryMeasurement}
                className="w-full rounded-2xl bg-primary py-4 text-xl font-bold text-white transition hover:bg-primary/90 flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-5 w-5" /> Intentar de nuevo
              </button>

              {/* Tras MAX_RETRIES intentos, permitir continuar de todas formas para
                  no bloquear al paciente si las condiciones no pueden mejorar. */}
              {measurementAttempts >= MAX_RETRIES && (
                <button
                  onClick={() => {
                    // Avanzar con medición vacía; el doctor verá confidences = null
                    detectedRef.current = {
                      heartRate:       { value: 0 },
                      respiratoryRate: { value: 0 },
                    };
                    setStep('pain');
                  }}
                  className="w-full rounded-2xl border border-slate-300 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Continuar de todos modos
                </button>
              )}
            </div>

            {measurementAttempts > 0 && (
              <p className="text-xs text-slate-400">
                Intento {measurementAttempts} de {MAX_RETRIES}
              </p>
            )}
          </section>
        )}

        {/* ── Paso 4: Nivel de dolor ── */}
        {step === 'pain' && (
          <section className="rounded-3xl border border-blue-100 bg-white p-6 md:p-10 shadow-lg space-y-6">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                {nameParts[0] ?? 'Paciente'}, ¿cuánto es tu dolor?
              </h2>
              <p className="text-base text-slate-500 mt-1">0 = sin dolor · 10 = dolor insoportable</p>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPainScale(i)}
                  className={[
                    'rounded-2xl py-5 text-2xl font-bold transition',
                    painScale === i
                      ? 'bg-primary text-white shadow-md scale-105'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200',
                    i >= 8 ? 'border-2 border-red-200' : '',
                  ].join(' ')}
                >
                  {i}
                </button>
              ))}
            </div>

            <button
              disabled={painScale === null}
              onClick={() => setStep('consciousness')}
              className="w-full rounded-2xl bg-primary py-4 text-xl font-bold text-white transition hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar
            </button>
          </section>
        )}

        {/* ── Paso 5: Nivel de consciencia ── */}
        {step === 'consciousness' && (
          <section className="rounded-3xl border border-blue-100 bg-white p-6 md:p-10 shadow-lg space-y-6">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">¿Cómo te sientes ahora mismo?</h2>
              <p className="text-base text-slate-500 mt-1">Selecciona la opción que mejor te describe</p>
            </div>

            <div className="flex flex-col gap-3">
              {CONSCIOUSNESS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setConsciousnessLevel(opt.value)}
                  className={[
                    'rounded-2xl border-2 px-6 py-5 text-left transition',
                    consciousnessLevel === opt.value
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <p className="text-lg font-bold text-slate-900">{opt.label}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>

            {registering ? (
              <p className="text-center text-lg font-semibold text-primary flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Registrando en sistema...
              </p>
            ) : (
              <button
                onClick={onConfirmConsciousness}
                className="w-full rounded-2xl bg-primary py-4 text-xl font-bold text-white transition hover:bg-primary/90"
              >
                Confirmar y registrar
              </button>
            )}

            {error && <p className="text-center text-base text-destructive">{error}</p>}
          </section>
        )}

        {/* ── Paso 6: Confirmación ── */}
        {step === 'done' && success && (
          <section className="rounded-3xl border border-blue-100 bg-white p-8 md:p-12 shadow-lg text-center">
            <h2 className="text-3xl font-extrabold text-primary mb-3">Registro completado</h2>
            <p className="text-lg text-slate-700 mb-2">El personal de salud lo atendera pronto.</p>
            <p className="text-base text-slate-600">Nivel MTS asignado: {success.mtsLevel}</p>
            {typeof success.estimatedWaitMinutes === 'number' && (
              <p className="text-base text-slate-600 mt-1">
                Tiempo estimado de espera: {success.estimatedWaitMinutes} minutos
              </p>
            )}
            <p className="text-sm text-slate-500 mt-5">Este kiosco se reiniciara automaticamente en 10 segundos.</p>
          </section>
        )}
      </div>
    </main>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function MeasurementCard({ title, icon, state }: { title: string; icon: React.ReactNode; state: MeasurementState }) {
  // Advertencia visual cuando el signo terminó de medirse pero con confianza
  // baja (< CONFIDENCE_WARN_THRESHOLD): el valor se muestra igual (el doctor
  // decide qué hacer con él) pero se marca para no leerse como confiable.
  const lowConfidence = !state.loading && state.confidence !== undefined && state.confidence < CONFIDENCE_WARN_THRESHOLD;

  return (
    <div className={[
      'rounded-2xl border p-4 bg-slate-50',
      lowConfidence ? 'border-amber-300 bg-amber-50' : 'border-slate-200',
    ].join(' ')}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className="text-base font-semibold text-slate-800">{title}</p>
        {lowConfidence && (
          <AlertTriangle className="h-4 w-4 text-amber-500 ml-auto" aria-label="Confianza baja" />
        )}
      </div>

      <div className="h-2 w-full rounded bg-slate-200 overflow-hidden mb-3">
        <div className="h-full bg-primary transition-all duration-200" style={{ width: `${state.progress}%` }} />
      </div>

      {state.loading ? (
        <div className="text-slate-600 flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Midiendo...
        </div>
      ) : (
        <div className="text-2xl font-bold text-slate-900">{state.value}</div>
      )}
    </div>
  );
}

// Re-export threshold so PatientKioskPage tests can assert on it without
// importing a magic number.
export { CONFIDENCE_WARN_THRESHOLD };
