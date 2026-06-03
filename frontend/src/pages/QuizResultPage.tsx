import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, RotateCcw, Sparkles, Check, X } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import QuizLayout from '@/quiz/QuizLayout';
import { useQuiz } from '@/quiz/QuizContext';
import { cn } from '@/lib/utils';

export default function QuizResultPage() {
  const navigate = useNavigate();
  const { lastResult, currentQuiz, setCurrentQuiz } = useQuiz();

  useEffect(() => {
    if (!lastResult) navigate('/');
  }, [lastResult, navigate]);

  if (!lastResult) return null;

  const incorrect = lastResult.total - lastResult.correct;
  const tone =
    lastResult.score >= 80 ? 'emerald' : lastResult.score >= 60 ? 'amber' : 'rose';
  const toneColor = tone === 'emerald' ? '#10b981' : tone === 'amber' ? '#f59e0b' : '#f43f5e';

  const message =
    lastResult.score >= 90 ? '¡Excelente trabajo! 🏆' :
    lastResult.score >= 75 ? '¡Muy bien hecho! 🎉' :
    lastResult.score >= 60 ? 'Buen intento, sigue practicando 💪' :
    'No te rindas, ¡tú puedes! 🚀';

  const chartData = lastResult.perQuestion.map((p, i) => ({
    name: `Q${i + 1}`,
    time: p.timeSec,
    correct: p.correct,
  }));

  return (
    <QuizLayout>
      <div className="mx-auto max-w-2xl">
        {/* Hero */}
        <div className="text-center animate-pop-in">
          <div className={cn('mx-auto inline-flex h-20 w-20 items-center justify-center rounded-3xl shadow-glow', `bg-${tone}-500/20`)}>
            <Trophy className={cn('h-10 w-10', `text-${tone}-400`)} />
          </div>
          <p className="mt-4 text-sm uppercase tracking-wider text-muted-foreground">Tu puntaje</p>
          <h1 className="mt-1 text-7xl sm:text-8xl font-bold text-gradient">{lastResult.score}%</h1>
          <p className="mt-2 text-lg text-muted-foreground">{message}</p>
          <p className="mt-1 text-sm text-muted-foreground">{lastResult.topic}</p>
        </div>

        {/* Breakdown */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-2 text-emerald-400">
              <Check className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Correctas</span>
            </div>
            <p className="mt-2 text-3xl font-bold">{lastResult.correct}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
            <div className="flex items-center gap-2 text-rose-400">
              <X className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Incorrectas</span>
            </div>
            <p className="mt-2 text-3xl font-bold">{incorrect}</p>
          </div>
        </div>

        {/* Chart */}
        <div className="mt-6 rounded-2xl border border-border bg-card/60 p-5 shadow-card backdrop-blur">
          <h3 className="mb-3 text-sm font-semibold">Rendimiento por pregunta</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="s" />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                  }}
                  formatter={(v: number, _n, p) => [`${v}s`, p.payload.correct ? 'Correcta' : 'Incorrecta']}
                />
                <Bar dataKey="time" radius={[8, 8, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.correct ? '#10b981' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => {
              if (currentQuiz) {
                navigate('/quiz');
              }
            }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-4 font-semibold transition-colors hover:bg-secondary"
          >
            <RotateCcw className="h-5 w-5" /> Repetir
          </button>
          <button
            onClick={() => {
              setCurrentQuiz(null);
              navigate('/crear');
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-4 font-bold text-white shadow-glow transition-transform hover:scale-[1.01]"
          >
            <Sparkles className="h-5 w-5" /> Nuevo tema
          </button>
        </div>
      </div>
    </QuizLayout>
  );
}
