import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { cn } from '@/lib/utils';
import { ConsciousnessLevel, Patient, Sex, VitalSigns } from '@/types';
import { TriageApiService } from '@/infrastructure/api/TriageApiService';
import { ClassifyPatientUseCase } from '@/application/use-cases/ClassifyPatient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const triageService = new TriageApiService();
const classifyUseCase = new ClassifyPatientUseCase(triageService);

const symptomOptions = ['Dolor torácico', 'Dificultad respiratoria', 'Pérdida de consciencia', 'Fiebre', 'Trauma', 'Dolor abdominal', 'Cefalea', 'Vómito', 'Convulsiones', 'Hemorragia', 'Mareo', 'Otros'];
const historyOptions = ['Hipertensión', 'Diabetes', 'Cardiopatía', 'EPOC', 'Embarazo', 'Anticoagulantes', 'Ninguno'];
const avpuOptions: ConsciousnessLevel[] = ['Alerta', 'Voz', 'Dolor', 'No responde'];
const painEmojis = ['😊', '🙂', '😐', '😕', '😟', '😣', '😖', '😫', '😩', '🤯'];

type NewPatientLocationState = {
  patient?: Patient;
  isUpdate?: boolean;
};

export default function NewPatientPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const incomingState = location.state as NewPatientLocationState | null;
  const incomingPatient = incomingState?.patient;
  const isUpdate = incomingState?.isUpdate ?? false;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [docType, setDocType] = useState<'CC' | 'Pasaporte' | 'TI'>('CC');
  const [docNumber, setDocNumber] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState<Sex>('M');

  // Step 2
  const [complaint, setComplaint] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [painScale, setPainScale] = useState(5);

  // Step 3
  const [systolicBP, setSystolicBP] = useState('');
  const [diastolicBP, setDiastolicBP] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [respRate, setRespRate] = useState('');
  const [temp, setTemp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [avpu, setAvpu] = useState<ConsciousnessLevel>('Alerta');

  useEffect(() => {
    if (!incomingPatient) return;

    setFirstName(incomingPatient.firstName);
    setLastName(incomingPatient.lastName);
    setDocType(incomingPatient.documentType);
    setDocNumber(incomingPatient.documentNumber);
    setDob(incomingPatient.dateOfBirth);
    setSex(incomingPatient.sex);
    setComplaint(incomingPatient.chiefComplaint);
    setSymptoms(incomingPatient.symptoms);
    setHistory(incomingPatient.medicalHistory);
    setPainScale(incomingPatient.painScale);
    setSystolicBP(String(incomingPatient.vitalSigns.systolicBP));
    setDiastolicBP(String(incomingPatient.vitalSigns.diastolicBP));
    setHeartRate(String(incomingPatient.vitalSigns.heartRate));
    setRespRate(String(incomingPatient.vitalSigns.respiratoryRate));
    setTemp(String(incomingPatient.vitalSigns.temperature));
    setSpo2(String(incomingPatient.vitalSigns.oxygenSaturation));
    setAvpu(incomingPatient.vitalSigns.consciousnessLevel);
  }, [incomingPatient]);

  const calcAge = (d: string) => {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    return Math.floor(diff / 31557600000);
  };

  const toggleItem = (arr: string[], setArr: (v: string[]) => void, item: string) => {
    if (item === 'Ninguno') { setArr(['Ninguno']); return; }
    const without = arr.filter(i => i !== 'Ninguno');
    setArr(without.includes(item) ? without.filter(i => i !== item) : [...without, item]);
  };

 const handleClassify = async () => {
    setLoading(true);
    const vitals: VitalSigns = {
      systolicBP: Number(systolicBP) || 120,
      diastolicBP: Number(diastolicBP) || 80,
      heartRate: Number(heartRate) || 80,
      respiratoryRate: Number(respRate) || 16,
      temperature: Number(temp) || 36.5,
      oxygenSaturation: Number(spo2) || 98,
      consciousnessLevel: avpu,
    };
    const result = await classifyUseCase.execute(symptoms, vitals, painScale, history);
    navigate('/triage-result', {
      state: {
        ...result,
        isUpdate,
        patient: {
          id: incomingPatient?.id,
          firstName,
          lastName,
          docType,
          docNumber,
          dob,
          age: calcAge(dob),
          sex,
          complaint,
          symptoms,
          history,
          painScale,
          vitals,
        },
      },
    });
  };

  const steps = ['Datos Básicos', 'Evaluación Clínica', 'Signos Vitales'];

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Nuevo Paciente</h1>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                step > i + 1 ? "bg-mts-4 text-primary-foreground" : step === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {i + 1}
              </div>
              <span className={cn("text-sm hidden sm:block", step === i + 1 ? "font-medium" : "text-muted-foreground")}>{s}</span>
              {i < 2 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nombre</label>
                  <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nombre" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Apellido</label>
                  <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apellido" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Tipo de documento</label>
                  <select value={docType} onChange={e => setDocType(e.target.value as 'CC' | 'Pasaporte' | 'TI')} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                    <option value="CC">Cédula de Ciudadanía</option>
                    <option value="Pasaporte">Pasaporte</option>
                    <option value="TI">Tarjeta de Identidad</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Número de documento</label>
                  <Input value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="1234567890" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Fecha de nacimiento</label>
                  <Input type="date" value={dob} onChange={e => setDob(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Edad</label>
                  <div className="h-10 rounded-lg border border-input bg-muted px-3 flex items-center text-sm text-muted-foreground">
                    {dob ? `${calcAge(dob)} años` : 'Automático'}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Sexo</label>
                <div className="flex gap-2">
                  {(['M', 'F', 'Otro'] as Sex[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setSex(s)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                        sex === s ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {s === 'M' ? 'Masculino' : s === 'F' ? 'Femenino' : 'Otro'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium mb-1 block">¿Cuál es el motivo de consulta?</label>
                <textarea
                  value={complaint}
                  onChange={e => setComplaint(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Describa el motivo principal de consulta..."
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Síntomas</label>
                <div className="flex flex-wrap gap-2">
                  {symptomOptions.map(s => (
                    <button
                      key={s}
                      onClick={() => toggleItem(symptoms, setSymptoms, s)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        symptoms.includes(s) ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Antecedentes médicos</label>
                <div className="flex flex-wrap gap-2">
                  {historyOptions.map(h => (
                    <button
                      key={h}
                      onClick={() => toggleItem(history, setHistory, h)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        history.includes(h) ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Escala de dolor: {painScale}/10 {painEmojis[painScale - 1]}</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={painScale}
                  onChange={e => setPainScale(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Sin dolor</span>
                  <span>Dolor extremo</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Presión arterial (mmHg)</label>
                <div className="flex items-center gap-2">
                  <Input value={systolicBP} onChange={e => setSystolicBP(e.target.value)} placeholder="Sistólica" type="number" />
                  <span className="text-lg text-muted-foreground">/</span>
                  <Input value={diastolicBP} onChange={e => setDiastolicBP(e.target.value)} placeholder="Diastólica" type="number" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Normal: 120/80 mmHg</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Frecuencia cardíaca (bpm)</label>
                  <Input value={heartRate} onChange={e => setHeartRate(e.target.value)} placeholder="80" type="number" />
                  <p className="text-xs text-muted-foreground mt-1">Normal: 60-100 bpm</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Frecuencia respiratoria (rpm)</label>
                  <Input value={respRate} onChange={e => setRespRate(e.target.value)} placeholder="16" type="number" />
                  <p className="text-xs text-muted-foreground mt-1">Normal: 12-20 rpm</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Temperatura (°C)</label>
                  <Input value={temp} onChange={e => setTemp(e.target.value)} placeholder="36.5" type="number" step="0.1" />
                  <p className="text-xs text-muted-foreground mt-1">Normal: 36.5-37.5 °C</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">SpO2 (%)</label>
                  <Input value={spo2} onChange={e => setSpo2(e.target.value)} placeholder="98" type="number" />
                  <p className="text-xs text-muted-foreground mt-1">Normal: &gt;95%</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Nivel de consciencia (AVPU)</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {avpuOptions.map(a => (
                    <button
                      key={a}
                      onClick={() => setAvpu(a)}
                      className={cn(
                        "py-2.5 rounded-lg text-sm font-medium border transition-colors",
                        avpu === a ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
            ) : <div />}
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} className="bg-primary text-primary-foreground">
                Siguiente <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleClassify}
                disabled={loading}
                className="bg-primary text-primary-foreground px-6"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analizando signos vitales...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Clasificar Paciente
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
