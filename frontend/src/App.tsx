import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import PatientKioskPage from "./pages/PatientKioskPage";
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

function ProtectedRoute({ children }: { children: JSX.Element }) {
    const { isLoggedIn } = useApp();
    if (!isLoggedIn) {
        return <Navigate to="/login" replace />;
    }
    return children;
}

function AppRoutes() {
    const { isLoggedIn } = useApp();

    return (<Routes> 

      <Route path="/" element={<LandingPage />}/> 

      <Route path="/paciente" element={<PatientKioskPage />}/> 

      <Route path="/login" element={isLoggedIn ? <Navigate to="/dashboard" replace/> : <LoginPage />}/> 

      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}/> 

      <Route path="/patients" element={<Navigate to="/dashboard" replace/>}/> 

      <Route path="/patients/new" element={<ProtectedRoute><NewPatientPage /></ProtectedRoute>}/> 

      <Route path="/patients/:id" element={<ProtectedRoute><PatientDetailPage /></ProtectedRoute>}/> 

      <Route path="/triage-result" element={<ProtectedRoute><TriageResultPage /></ProtectedRoute>}/> 

      <Route path="/estadisticas" element={<ProtectedRoute><StatisticsPage /></ProtectedRoute>}/> 

      <Route path="/configuracion" element={<ProtectedRoute><ConfiguracionPlaceholderPage /></ProtectedRoute>}/> 

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
