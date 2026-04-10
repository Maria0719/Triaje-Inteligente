import { useNavigate } from 'react-router-dom';
import { Shield, Stethoscope, UserRound } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-100 flex items-center justify-center px-6">
      <div className="w-full max-w-4xl rounded-3xl border border-blue-100 bg-white/95 shadow-xl p-8 md:p-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-4">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">TriageAI</h1>
          <p className="mt-2 text-base md:text-lg text-slate-600">Hospital Universitario San Jose</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => navigate('/paciente')}
            className="group rounded-2xl border-2 border-primary/20 bg-primary/5 p-8 text-left transition hover:border-primary hover:bg-primary/10"
          >
            <UserRound className="h-10 w-10 text-primary mb-4" />
            <h2 className="text-2xl font-bold text-slate-900">Soy Paciente</h2>
            <p className="mt-2 text-base text-slate-600">Registro rapido en kiosco sin contrasena.</p>
          </button>

          <button
            onClick={() => navigate('/login')}
            className="group rounded-2xl border-2 border-slate-200 bg-white p-8 text-left transition hover:border-primary/40 hover:bg-slate-50"
          >
            <Stethoscope className="h-10 w-10 text-primary mb-4" />
            <h2 className="text-2xl font-bold text-slate-900">Soy Personal de Salud</h2>
            <p className="mt-2 text-base text-slate-600">Acceder al panel clinico y gestion de triaje.</p>
          </button>
        </div>
      </div>
    </main>
  );
}
