import { Quiz, QuizAttempt, Difficulty } from './types';

const sampleQuestions = (topic: string, n: number): Quiz['questions'] => {
  const base = [
    {
      text: `¿Cuál es el concepto principal de ${topic}?`,
      options: [`Definición correcta de ${topic}`, 'Una idea relacionada', 'Algo distinto', 'Ninguna de las anteriores'],
      correctIndex: 0,
      explanation: `${topic} se define principalmente por su concepto base.`,
    },
    {
      text: `¿Qué año es relevante para ${topic}?`,
      options: ['1492', '1969', '1989', '2007'],
      correctIndex: 2,
      explanation: 'Año clave en el desarrollo del tema.',
    },
    {
      text: `¿Quién es figura clave en ${topic}?`,
      options: ['Persona A', 'Persona B', 'Persona C', 'Persona D'],
      correctIndex: 1,
    },
    {
      text: `¿Cuál NO es característica de ${topic}?`,
      options: ['Característica 1', 'Característica 2', 'Característica falsa', 'Característica 3'],
      correctIndex: 2,
    },
    {
      text: `Aplicación práctica de ${topic}:`,
      options: ['Uso A', 'Uso B', 'Uso C', 'Todas las anteriores'],
      correctIndex: 3,
    },
    {
      text: `¿Qué herramienta se asocia más con ${topic}?`,
      options: ['Herramienta X', 'Herramienta Y', 'Herramienta Z', 'Herramienta W'],
      correctIndex: 0,
    },
    {
      text: `Beneficio principal de aprender ${topic}:`,
      options: ['Beneficio A', 'Beneficio B', 'Beneficio C', 'Beneficio D'],
      correctIndex: 1,
    },
  ];
  return Array.from({ length: n }, (_, i) => ({
    id: `q-${i}`,
    ...base[i % base.length],
  }));
};

export const generateMockQuiz = (topic: string, count: number, difficulty: Difficulty): Quiz => ({
  id: `quiz-${Date.now()}`,
  topic,
  difficulty,
  questions: sampleQuestions(topic, count),
  createdAt: new Date().toISOString(),
});

export const mockRecentAttempts: QuizAttempt[] = [
  { id: 'a1', quizId: 'q1', topic: 'Historia de Roma', difficulty: 'medium', score: 85, correct: 17, total: 20, date: new Date(Date.now() - 86400000).toISOString(), perQuestion: [] },
  { id: 'a2', quizId: 'q2', topic: 'JavaScript ES6', difficulty: 'hard', score: 70, correct: 7, total: 10, date: new Date(Date.now() - 2 * 86400000).toISOString(), perQuestion: [] },
  { id: 'a3', quizId: 'q3', topic: 'Biología celular', difficulty: 'easy', score: 95, correct: 19, total: 20, date: new Date(Date.now() - 3 * 86400000).toISOString(), perQuestion: [] },
  { id: 'a4', quizId: 'q4', topic: 'Filosofía griega', difficulty: 'medium', score: 60, correct: 6, total: 10, date: new Date(Date.now() - 5 * 86400000).toISOString(), perQuestion: [] },
  { id: 'a5', quizId: 'q5', topic: 'React Hooks', difficulty: 'hard', score: 78, correct: 11, total: 14, date: new Date(Date.now() - 7 * 86400000).toISOString(), perQuestion: [] },
];

// Progress over time (last 14 days)
export const mockProgressOverTime = Array.from({ length: 14 }, (_, i) => ({
  day: `D${i + 1}`,
  score: 50 + Math.round(Math.sin(i / 2) * 15 + i * 2 + Math.random() * 8),
}));

export const mockTopTopics = [
  { topic: 'JavaScript', count: 12 },
  { topic: 'Historia', count: 9 },
  { topic: 'Biología', count: 7 },
  { topic: 'Matemáticas', count: 5 },
  { topic: 'Filosofía', count: 4 },
];

export const mockWeakTopics = [
  { topic: 'Cálculo', avgScore: 42 },
  { topic: 'Química orgánica', avgScore: 51 },
  { topic: 'Filosofía', avgScore: 58 },
  { topic: 'Estadística', avgScore: 63 },
];

// 7x12 contribution-style grid
export const mockHeatmap: number[][] = Array.from({ length: 7 }, () =>
  Array.from({ length: 12 }, () => Math.floor(Math.random() * 5))
);
