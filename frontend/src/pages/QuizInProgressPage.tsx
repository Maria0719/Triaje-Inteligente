import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, X, Check } from 'lucide-react';
import QuizLayout from '@/quiz/QuizLayout';
import { useQuiz } from '@/quiz/QuizContext';
import { cn } from '@/lib/utils';

export default function QuizInProgressPage() {
  const navigate = useNavigate();
  const { currentQuiz, addAttempt, setLastResult } = useQuiz();
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  const [answers, setAnswers] = useState<{ correct: boolean; timeSec: number }[]>([]);
  const [time, setTime] = useState(0);
  const [qStart, setQStart] = useState(Date.now());

  useEffect(() => {
    if (!currentQuiz) navigate('/crear');
  }, [currentQuiz, navigate]);

  useEffect(() => {
    const t = setInterval(() => setTime((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const q = currentQuiz?.questions[idx];
  const total = currentQuiz?.questions.length ?? 0;
  const progress = useMemo(() => ((idx) / Math.max(total, 1)) * 100, [idx, total]);

  if (!currentQuiz || !q) return null;

  const choose = (i: number) => {
    if (reveal) return;
    setSelected(i);
    setReveal(true);
  };

  const next = () => {
    const correct = selected === q.correctIndex;
    const elapsed = Math.round((Date.now() - qStart) / 1000);
    const newAnswers = [...answers, { correct, timeSec: elapsed }];
    setAnswers(newAnswers);

    if (idx + 1 < total) {
      setIdx(idx + 1);
      setSelected(null);
      setReveal(false);
      setQStart(Date.now());
    } else {
      const correctCount = newAnswers.filter((a) => a.correct).length;
      const attempt = {
        id: `att-${Date.now()}`,
        quizId: currentQuiz.id,
        topic: currentQuiz.topic,
        difficulty: currentQuiz.difficulty,
        score: Math.round((correctCount / total) * 100),
        correct: correctCount,
        total,
        date: new Date().toISOString(),
        perQuestion: newAnswers,
      };
      addAttempt(attempt);
      setLastResult(attempt);
      navigate('/resultado');
    }
  };

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <QuizLayout>
      {/* Top: progress + meta */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            Pregunta <span className="text-primary">{idx + 1}</span> de {total}
          </span>
          <div className="flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-mono text-xs font-semibold">{fmtTime(time)}</span>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div key={idx} className="mt-8 animate-fade-up">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{currentQuiz.topic}</p>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight">{q.text}</h2>

        <div className="mt-6 grid gap-3">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correctIndex;
            const isSelected = i === selected;
            const showCorrect = reveal && isCorrect;
            const showWrong = reveal && isSelected && !isCorrect;
            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={reveal}
                className={cn(
                  'group flex items-center gap-4 rounded-2xl border-2 bg-card/60 p-4 text-left transition-all',
                  !reveal && 'hover:border-primary/60 hover:bg-card',
                  isSelected && !reveal && 'border-primary bg-primary/10',
                  showCorrect && 'border-emerald-500 bg-emerald-500/10',
                  showWrong && 'border-rose-500 bg-rose-500/10',
                  !isSelected && reveal && !isCorrect && 'opacity-50',
                  reveal && 'cursor-default',
                  !reveal && 'border-border'
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 font-bold text-sm',
                    showCorrect && 'border-emerald-500 bg-emerald-500 text-white',
                    showWrong && 'border-rose-500 bg-rose-500 text-white',
                    !reveal && 'border-border bg-secondary text-muted-foreground group-hover:border-primary group-hover:text-primary',
                    isSelected && !reveal && 'border-primary bg-primary text-primary-foreground'
                  )}
                >
                  {showCorrect ? <Check className="h-4 w-4" /> : showWrong ? <X className="h-4 w-4" /> : String.fromCharCode(65 + i)}
                </div>
                <span className="font-medium">{opt}</span>
              </button>
            );
          })}
        </div>

        {reveal && q.explanation && (
          <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-4 animate-fade-up">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Explicación</p>
            <p className="text-sm text-muted-foreground">{q.explanation}</p>
          </div>
        )}

        {reveal && (
          <button
            onClick={next}
            className="mt-6 w-full rounded-2xl bg-gradient-primary py-4 font-bold text-white shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            {idx + 1 < total ? 'Siguiente pregunta' : 'Ver resultados'}
          </button>
        )}
      </div>
    </QuizLayout>
  );
}
