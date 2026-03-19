import { Toaster } from "@/components/ui/toaster"; // Imports toast component
import { Toaster as Sonner } from "@/components/ui/sonner"; // Imports sonner toaster alias
import { TooltipProvider } from "@/components/ui/tooltip"; // Imports tooltip provider
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; // Imports query client providers
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // Imports router components
import { AppProvider, useApp } from "@/context/AppContext"; // Imports app context helpers
import LoginPage from "./pages/LoginPage"; // Imports login page
import DashboardPage from "./pages/DashboardPage"; // Imports dashboard page
import NewPatientPage from "./pages/NewPatientPage"; // Imports new patient page
import TriageResultPage from "./pages/TriageResultPage"; // Imports triage result page
import PatientDetailPage from "./pages/PatientDetailPage"; // Imports patient detail page
import StatisticsPage from "./pages/StatisticsPage"; // Imports statistics page
import NotFound from "./pages/NotFound"; // Imports not found page
import AppLayout from "./components/AppLayout"; // Imports app layout

const queryClient = new QueryClient(); // Creates query client

function ConfiguracionPlaceholderPage() { // Renders config placeholder
  return ( // Returns placeholder layout
    <AppLayout> // Wraps content in layout
      <div className="flex min-h-screen items-center justify-center p-6"> // Centers placeholder content
        <h1 className="text-2xl font-semibold text-foreground">Configuración — Próximamente</h1> // Shows placeholder message
      </div>
    </AppLayout>
  );
}

function AppRoutes() { // Defines app route switch
  const { isLoggedIn } = useApp(); // Reads login status

  if (!isLoggedIn) { // Checks unauthenticated state
    return ( // Returns public routes
      <Routes> // Groups route definitions
        <Route path="/login" element={<LoginPage />} /> // Maps login path
        <Route path="*" element={<Navigate to="/login" replace />} /> // Redirects unknown public paths
      </Routes>
    );
  }

  return ( // Returns authenticated routes
    <Routes> // Groups private routes
      <Route path="/" element={<Navigate to="/dashboard" replace />} /> // Redirects root path
      <Route path="/dashboard" element={<DashboardPage />} /> // Maps dashboard path
      <Route path="/patients" element={<Navigate to="/dashboard" replace />} /> // Redirects patients base path
      <Route path="/patients/new" element={<NewPatientPage />} /> // Maps new patient path
      <Route path="/patients/:id" element={<PatientDetailPage />} /> // Maps patient detail path
      <Route path="/triage-result" element={<TriageResultPage />} /> // Maps triage result path
      <Route path="/estadisticas" element={<StatisticsPage />} /> // Maps statistics path
      <Route path="/configuracion" element={<ConfiguracionPlaceholderPage />} /> // Maps settings path
      <Route path="/login" element={<Navigate to="/dashboard" replace />} /> // Redirects login while authenticated
      <Route path="*" element={<NotFound />} /> // Maps fallback path
    </Routes>
  );
}

const App = () => ( // Composes app providers
  <QueryClientProvider client={queryClient}> // Provides query client
    <TooltipProvider> // Provides tooltip context
      <Toaster /> // Renders shadcn toaster
      <Sonner /> // Renders sonner toaster
      <AppProvider> // Provides app state
        <BrowserRouter> // Provides browser routing
          <AppRoutes /> // Renders route tree
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App; // Exports root component
