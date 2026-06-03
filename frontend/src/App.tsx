import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QuizProvider } from "@/quiz/QuizContext";
import QuizHomePage from "./pages/QuizHomePage";
import QuizCreatePage from "./pages/QuizCreatePage";
import QuizInProgressPage from "./pages/QuizInProgressPage";
import QuizResultPage from "./pages/QuizResultPage";
import QuizStatsPage from "./pages/QuizStatsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <QuizProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<QuizHomePage />} />
            <Route path="/crear" element={<QuizCreatePage />} />
            <Route path="/quiz" element={<QuizInProgressPage />} />
            <Route path="/resultado" element={<QuizResultPage />} />
            <Route path="/estadisticas" element={<QuizStatsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </QuizProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
