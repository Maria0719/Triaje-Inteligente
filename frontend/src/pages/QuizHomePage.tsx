import { useNavigate } from 'react-router-dom';
import { Sparkles, Flame, BookOpen, Target, ListChecks, ArrowRight, Trophy } from 'lucide-react';
import QuizLayout from '@/quiz/QuizLayout';
import { useQuiz } from '@/quiz/QuizContext';
import { cn } from '@/lib/utils';

const diffStyle: Record<string, string> = {
  easy: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  hard: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};
const diffLabel: Record<string, string> = { easy: 'Fácil', medium: 'Media', hard: 'Difícil' };

export default function QuizHomePage() {
  const navigate = useNavigate();
  const { attempts, userName, streak } = useQuiz();
  const totalQuestions = attempts.reduce((s, a) => s + a.total, 0);
  const avg = Math.round(attempts.reduce((s, a) => s + a.score, 0) / (attempts.length || 1));
  const topics = new Set(attempts.map((a) => a.topic)).size;

  const stats = [
    { label: 'Racha', value: `${streak} días`, icon: Flame, color: 'text-orange-400' },
    { label: 'Temas', value: topics, icon: BookOpen, color: 'text-blue-400' },
    { label: 'Promedio', value: `${avg}%`, icon: Target, color: 'text-emerald-400' },
    { label: 'Preguntas', value: totalQuestions, icon: ListChecks, color: 'text-violet-400' },
  ];

  return (
    <QuizLayout>
      <section className="animate-fade-up space-y-1.5">
        <p className="text-sm text-muted-foreground">Bienvenido de vuelta</p>
        <h1 className="text-3xl sm:text-4xl font-bold">
          Hola, <span className="text-gradient">{userName}</span> 👋
        </h1>
        <p className="text-muted-foreground">¿Listo para aprender algo nuevo hoy?</p>
      </section>

      {/* Stats */}
      <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card/60 p-4 shadow-card backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <s.icon className={cn('h-4 w-4', s.color)} />
            </div>
            <p className="mt-2 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="mt-8">
        <button
          onClick={() => navigate('/crear')}
          className="group relative w-full overflow-hidden rounded-3xl bg-gradient-primary p-px shadow-glow transition-transform hover:scale-[1.005] active:scale-[0.99]"
        >
          <div className="rounded-3xl bg-gradient-primary px-6 py-7 sm:py-8 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80">Genera con IA</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Crear nuevo quiz</h2>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur w-fit">
                Empezar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        </button>
      </section>

      {/* Recent quizzes */}
      <section className="mt-10">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-xl font-bold">Quizzes recientes</h2>
          <button onClick={() => navigate('/estadisticas')} className="text-sm text-muted-foreground hover:text-foreground">
            Ver todo
          </button>
        </div>
        <div className="grid gap-3">
          {attempts.slice(0, 6).map((a) => (
            <div
              key={a.id}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <Trophy className={cn('h-5 w-5', a.score >= 80 ? 'text-emerald-400' : a.score >= 60 ? 'text-amber-400' : 'text-rose-400')} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{a.topic}</p>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', diffStyle[a.difficulty])}>
                    {diffLabel[a.difficulty]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {a.correct}/{a.total} correctas · {new Date(a.date).toLocaleDateString('es')}
                </p>
              </div>
              <div className="text-right">
                <p className={cn('text-2xl font-bold', a.score >= 80 ? 'text-emerald-400' : a.score >= 60 ? 'text-amber-400' : 'text-rose-400')}>
                  {a.score}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </QuizLayout>
  );
}
