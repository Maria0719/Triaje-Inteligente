import { createContext, useContext, useState, ReactNode } from 'react';
import { Quiz, QuizAttempt } from './types';
import { mockRecentAttempts } from './mockData';

interface QuizCtx {
  attempts: QuizAttempt[];
  addAttempt: (a: QuizAttempt) => void;
  currentQuiz: Quiz | null;
  setCurrentQuiz: (q: Quiz | null) => void;
  lastResult: QuizAttempt | null;
  setLastResult: (a: QuizAttempt | null) => void;
  userName: string;
  streak: number;
}

const Ctx = createContext<QuizCtx | undefined>(undefined);

export const QuizProvider = ({ children }: { children: ReactNode }) => {
  const [attempts, setAttempts] = useState<QuizAttempt[]>(mockRecentAttempts);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [lastResult, setLastResult] = useState<QuizAttempt | null>(null);

  return (
    <Ctx.Provider
      value={{
        attempts,
        addAttempt: (a) => setAttempts((prev) => [a, ...prev]),
        currentQuiz,
        setCurrentQuiz,
        lastResult,
        setLastResult,
        userName: 'Alex',
        streak: 12,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useQuiz = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useQuiz must be used within QuizProvider');
  return ctx;
};
