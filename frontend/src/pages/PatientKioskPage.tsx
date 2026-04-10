import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, HeartPulse, Activity, Frown, Eye } from 'lucide-react';

type MeasurementKey = 'heartRate' | 'respiratoryRate' | 'painScale' | 'consciousnessLevel';
type AVPU = 'Alerta' | 'Voz' | 'Dolor' | 'No responde';

type MeasurementState = {
  loading: boolean;
  progress: number;
  value: string;
};

type KioskResponse = {
  patientId: string;
  estimatedWaitMinutes?: number | null;
  mtsLevel: number;
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

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

const createInitialMeasurements = (): Record<MeasurementKey, MeasurementState> => ({
  heartRate: { loading: true, progress: 0, value: '' },
  respiratoryRate: { loading: true, progress: 0, value: '' },
  painScale: { loading: true, progress: 0, value: '' },
  consciousnessLevel: { loading: true, progress: 0, value: '' },
});

export default function PatientKioskPage() {
  const [step, setStep] = useState<'identify' | 'camera' | 'done'>('identify');
  const [fullName, setFullName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [eps, setEps] = useState<(typeof EPS_OPTIONS)[number]>(EPS_OPTIONS[0]);
  const [measurements, setMeasurements] = useState<Record<MeasurementKey, MeasurementState>>(createInitialMeasurements);
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState<KioskResponse | null>(null);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const nameParts = useMemo(() => fullName.trim().split(/\s+/).filter(Boolean), [fullName]);

  const resetToStepOne = () => {
    setStep('identify');
    setFullName('');
    setDocumentNumber('');
    setEps(EPS_OPTIONS[0]);
    setMeasurements(createInitialMeasurements());
    setRegistering(false);
    setSuccess(null);
    setError('');
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (step !== 'camera') {
      stopCamera();
      return;
    }

    let cancelled = false;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
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
        setError('No se pudo acceder a la camara. Continuaremos con el modo demo.');
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [step]);

  useEffect(() => {
    if (step !== 'camera') {
      return;
    }

    const keys: MeasurementKey[] = ['heartRate', 'respiratoryRate', 'painScale', 'consciousnessLevel'];
    const timers: number[] = [];

    keys.forEach(key => {
      let ticks = 0;
      const interval = window.setInterval(() => {
        ticks += 1;
        const progress = Math.min(100, Math.round((ticks / 50) * 100));
        setMeasurements(prev => ({
          ...prev,
          [key]: { ...prev[key], progress },
        }));
      }, 200);
      timers.push(interval);

      const timeout = window.setTimeout(() => {
        window.clearInterval(interval);
        const generatedValue =
          key === 'heartRate'
            ? `${Math.floor(65 + Math.random() * 46)} bpm`
            : key === 'respiratoryRate'
              ? `${Math.floor(14 + Math.random() * 9)} rpm`
              : key === 'painScale'
                ? `${Math.floor(1 + Math.random() * 7)} / 10`
                : 'Alerta';

        setMeasurements(prev => ({
          ...prev,
          [key]: { loading: false, progress: 100, value: generatedValue },
        }));
      }, 10000);
      timers.push(timeout);
    });

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, [step]);

  useEffect(() => {
    if (step !== 'camera') {
      return;
    }

    const allDone = (Object.keys(measurements) as MeasurementKey[]).every(
      key => !measurements[key].loading,
    );

    if (!allDone || registering || success) {
      return;
    }

    const heartRate = Number(measurements.heartRate.value.replace(' bpm', ''));
    const respiratoryRate = Number(measurements.respiratoryRate.value.replace(' rpm', ''));
    const painScale = Number(measurements.painScale.value.split(' / ')[0]);
    const consciousnessLevel = 'Alerta' as AVPU;

    const payload = {
      firstName: nameParts[0] ?? 'Paciente',
      lastName: nameParts.slice(1).join(' ') || 'Sin apellido',
      documentNumber,
      eps,
      vitalSigns: {
        heartRate,
        respiratoryRate,
        painScale,
        consciousnessLevel,
      },
      source: 'kiosk' as const,
    };

    setRegistering(true);
    setError('');

    const register = async () => {
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
      } finally {
        setRegistering(false);
      }
    };

    void register();
  }, [documentNumber, eps, measurements, nameParts, registering, step, success]);

  useEffect(() => {
    if (step !== 'done' || !success) {
      return;
    }

    const resetTimer = window.setTimeout(() => {
      resetToStepOne();
    }, 10000);

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-100 px-4 py-6 md:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="text-center mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-primary">TriageAI</h1>
          <p className="text-base md:text-lg text-slate-700 mt-1">Hospital Universitario San Jose</p>
        </header>

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
                    <option key={option} value={option}>
                      {option}
                    </option>
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

        {step === 'camera' && (
          <section className="rounded-3xl border border-blue-100 bg-white p-6 md:p-10 shadow-lg space-y-6">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Hola, {nameParts[0] ?? 'Paciente'}</h2>
              <p className="text-base md:text-lg text-slate-600 mt-1">Estamos tomando tus signos vitales.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              {!streamRef.current && (
                <div className="absolute flex flex-col items-center text-slate-600">
                  <Camera className="h-10 w-10 mb-2" />
                  <span>Modo demo</span>
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
                title="Nivel de dolor"
                icon={<Frown className="h-5 w-5 text-primary" />}
                state={measurements.painScale}
              />
              <MeasurementCard
                title="Nivel de consciencia"
                icon={<Eye className="h-5 w-5 text-primary" />}
                state={measurements.consciousnessLevel}
              />
            </div>

            {registering && (
              <p className="text-center text-lg font-semibold text-primary flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Registrando en sistema...
              </p>
            )}
            {error && <p className="text-center text-base text-destructive">{error}</p>}
          </section>
        )}

        {step === 'done' && success && (
          <section className="rounded-3xl border border-blue-100 bg-white p-8 md:p-12 shadow-lg text-center">
            <h2 className="text-3xl font-extrabold text-primary mb-3">Registro completado</h2>
            <p className="text-lg text-slate-700 mb-2">El personal de salud lo atendera pronto.</p>
            <p className="text-base text-slate-600">Nivel MTS asignado: {success.mtsLevel}</p>
            {typeof success.estimatedWaitMinutes === 'number' && (
              <p className="text-base text-slate-600 mt-1">Tiempo estimado de espera: {success.estimatedWaitMinutes} minutos</p>
            )}
            <p className="text-sm text-slate-500 mt-5">Este kiosco se reiniciara automaticamente en 10 segundos.</p>
          </section>
        )}
      </div>
    </main>
  );
}

function MeasurementCard({ title, icon, state }: { title: string; icon: React.ReactNode; state: MeasurementState }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className="text-base font-semibold text-slate-800">{title}</p>
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
