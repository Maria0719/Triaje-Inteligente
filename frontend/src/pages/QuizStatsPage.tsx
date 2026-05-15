import { TrendingUp, Flame, BookOpen, AlertTriangle } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import QuizLayout from '@/quiz/QuizLayout';
import { mockHeatmap, mockProgressOverTime, mockTopTopics, mockWeakTopics } from '@/quiz/mockData';
import { cn } from '@/lib/utils';

const heatColor = (v: number) => {
  if (v === 0) return 'bg-secondary';
  if (v === 1) return 'bg-primary/25';
  if (v === 2) return 'bg-primary/45';
  if (v === 3) return 'bg-primary/70';
  return 'bg-primary';
};

const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function QuizStatsPage() {
  return (
    <QuizLayout>
      <header className="animate-fade-up">
        <h1 className="text-3xl sm:text-4xl font-bold">Mis estadísticas</h1>
        <p className="mt-1 text-muted-foreground">Sigue tu evolución y descubre dónde mejorar.</p>
      </header>

      {/* Progress over time */}
      <section className="mt-8 rounded-3xl border border-border bg-card/60 p-5 sm:p-6 shadow-card backdrop-blur">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Progreso</h2>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockProgressOverTime}>
              <defs>
                <linearGradient id="prog" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(250 85% 65%)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="hsl(250 85% 65%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="%" />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 12,
                }}
              />
              <Area type="monotone" dataKey="score" stroke="hsl(250 85% 65%)" strokeWidth={2.5} fill="url(#prog)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Top topics */}
        <section className="rounded-3xl border border-border bg-card/60 p-5 sm:p-6 shadow-card backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-bold">Más estudiados</h2>
          </div>
          <ul className="space-y-3">
            {mockTopTopics.map((t) => {
              const max = mockTopTopics[0].count;
              return (
                <li key={t.topic}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{t.topic}</span>
                    <span className="text-muted-foreground">{t.count} quizzes</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${(t.count / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Weak topics */}
        <section className="rounded-3xl border border-border bg-card/60 p-5 sm:p-6 shadow-card backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
            <h2 className="text-lg font-bold">Necesitan repaso</h2>
          </div>
          <ul className="space-y-3">
            {mockWeakTopics.map((t) => (
              <li key={t.topic}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{t.topic}</span>
                  <span className={cn('font-semibold', t.avgScore < 50 ? 'text-rose-400' : 'text-amber-400')}>{t.avgScore}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn('h-full rounded-full', t.avgScore < 50 ? 'bg-rose-500' : 'bg-amber-500')}
                    style={{ width: `${t.avgScore}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Heatmap */}
      <section className="mt-6 rounded-3xl border border-border bg-card/60 p-5 sm:p-6 shadow-card backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-400" />
            <h2 className="text-lg font-bold">Actividad semanal</h2>
          </div>
          <span className="text-xs text-muted-foreground">Últimas 12 semanas</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <div className="flex flex-col gap-1.5 pt-1 pr-1 text-[10px] text-muted-foreground">
            {days.map((d) => (
              <div key={d} className="h-3.5 leading-none">{d}</div>
            ))}
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 12 }).map((_, w) => (
              <div key={w} className="flex flex-col gap-1.5">
                {mockHeatmap.map((row, d) => (
                  <div
                    key={d}
                    className={cn('h-3.5 w-3.5 rounded-[3px] transition-transform hover:scale-125', heatColor(row[w]))}
                    title={`${row[w]} quizzes`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
          <span>Menos</span>
          {[0, 1, 2, 3, 4].map((v) => (
            <div key={v} className={cn('h-3 w-3 rounded-[3px]', heatColor(v))} />
          ))}
          <span>Más</span>
        </div>
      </section>
    </QuizLayout>
  );
}
