import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, ArrowLeft } from 'lucide-react';
import QuizLayout from '@/quiz/QuizLayout';
import { useQuiz } from '@/quiz/QuizContext';
import { generateMockQuiz } from '@/quiz/mockData';
import { Difficulty } from '@/quiz/types';
import { cn } from '@/lib/utils';

const difficulties: { key: Difficulty; label: string; desc: string; color: string }[] = [
  { key: 'easy', label: 'Fácil', desc: 'Conceptos básicos', color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/40' },
  { key: 'medium', label: 'Media', desc: 'Nivel intermedio', color: 'from-amber-500/20 to-amber-500/5 border-amber-500/40' },
  { key: 'hard', label: 'Difícil', desc: 'Reto avanzado', color: 'from-rose-500/20 to-rose-500/5 border-rose-500/40' },
];

export default function QuizCreatePage() {
  const navigate = useNavigate();
  const { setCurrentQuiz } = useQuiz();
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(8);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1800));
    const quiz = generateMockQuiz(topic.trim(), count, difficulty);
    setCurrentQuiz(quiz);
    navigate('/quiz');
  };

  return (
    <QuizLayout>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Atrás
      </button>

      <div className="mx-auto max-w-2xl animate-fade-up">
        <div className="text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold">Crear nuevo quiz</h1>
          <p className="mt-2 text-muted-foreground">Personaliza tu quiz y deja que la IA genere las preguntas.</p>
        </div>

        <div className="mt-8 rounded-3xl border border-border bg-card/60 p-5 sm:p-7 shadow-card backdrop-blur space-y-6">
          {/* Topic */}
          <div>
            <label className="mb-2 block text-sm font-semibold">Tema</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej: Revolución Francesa, React Hooks, Mitocondria…"
              className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3.5 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Number of questions */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold">Número de preguntas</label>
              <span className="rounded-lg bg-secondary px-2.5 py-1 text-sm font-bold text-primary">{count}</span>
            </div>
            <input
              type="range"
              min={3}
              max={15}
              step={1}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>3</span>
              <span>15</span>
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="mb-2 block text-sm font-semibold">Dificultad</label>
            <div className="grid grid-cols-3 gap-2.5">
              {difficulties.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDifficulty(d.key)}
                  className={cn(
                    'rounded-2xl border bg-gradient-to-br p-3.5 text-left transition-all',
                    d.color,
                    difficulty === d.key
                      ? 'ring-2 ring-primary scale-[1.02]'
                      : 'opacity-70 hover:opacity-100'
                  )}
                >
                  <p className="font-bold">{d.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            disabled={!topic.trim() || loading}
            onClick={handleGenerate}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-4 font-bold text-white shadow-glow transition-all',
              (!topic.trim() || loading) && 'opacity-50 cursor-not-allowed',
              !loading && topic.trim() && 'hover:scale-[1.01] active:scale-[0.99]'
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Generando con IA…
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" /> Generar con IA
              </>
            )}
          </button>
        </div>
      </div>
    </QuizLayout>
  );
}
