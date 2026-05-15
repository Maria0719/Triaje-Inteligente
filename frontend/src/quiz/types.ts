export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface Quiz {
  id: string;
  topic: string;
  difficulty: Difficulty;
  questions: Question[];
  createdAt: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  topic: string;
  difficulty: Difficulty;
  score: number; // 0-100
  correct: number;
  total: number;
  date: string; // ISO
  perQuestion: { correct: boolean; timeSec: number }[];
}
