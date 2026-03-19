import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import NewPatientPage from "./pages/NewPatientPage";
import TriageResultPage from "./pages/TriageResultPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import StatisticsPage from "./pages/StatisticsPage";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/AppLayout";
const queryClient = new QueryClient();
function ConfiguracionPlaceholderPage() {
    return (<AppLayout> 
      <div className="flex min-h-screen items-center justify-center p-6"> 
        <h1 className="text-2xl font-semibold text-foreground">Configuración — Próximamente</h1> 
      </div>
    </AppLayout>);
}
function AppRoutes() {
    const { isLoggedIn } = useApp();
    if (!isLoggedIn) {
        return (<Routes> 
        <Route path="/login" element={<LoginPage />}/> 
        <Route path="*" element={<Navigate to="/login" replace/>}/> 
      </Routes>);
    }
    return (<Routes> 
      <Route path="/" element={<Navigate to="/dashboard" replace/>}/> 
      <Route path="/dashboard" element={<DashboardPage />}/> 
      <Route path="/patients" element={<Navigate to="/dashboard" replace/>}/> 
      <Route path="/patients/new" element={<NewPatientPage />}/> 
      <Route path="/patients/:id" element={<PatientDetailPage />}/> 
      <Route path="/triage-result" element={<TriageResultPage />}/> 
      <Route path="/estadisticas" element={<StatisticsPage />}/> 
      <Route path="/configuracion" element={<ConfiguracionPlaceholderPage />}/> 
      <Route path="/login" element={<Navigate to="/dashboard" replace/>}/> 
      <Route path="*" element={<NotFound />}/> 
    </Routes>);
}
const App = () => (<QueryClientProvider client={queryClient}> 
    <TooltipProvider> 
      <Toaster /> 
      <Sonner /> 
      <AppProvider> 
        <BrowserRouter> 
          <AppRoutes /> 
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>);
export default App;
