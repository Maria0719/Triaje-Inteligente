import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Bell, Search, Users, AlertTriangle, Clock, CheckCircle, PlusCircle, Activity } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import PatientCard from '@/components/PatientCard';
import AppLayout from '@/components/AppLayout';
import { cn } from '@/lib/utils';
import { PatientApiService } from '@/infrastructure/api/PatientApiService';

const patientApiService = new PatientApiService();

export default function DashboardPage() {
  const { patients, setPatients, alerts, markAlertAsRead, userName, loadPatients } = useApp();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'critical' | 'urgent' | 'mild'>('all');

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadPatients();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadPatients]);

    const activePatients = patients.filter(p => p.status === 'waiting');
    const criticalCount = activePatients.filter(p => p.mtsLevel <= 2).length;
    const avgWait = Math.round(activePatients.reduce((s, p) => s + p.waitTimeMinutes, 0) / (activePatients.length || 1));
    const attendedCount = patients.filter(p => p.status === 'attended').length;
    const unreadAlerts = alerts.filter(a => !a.read).length;
    let filtered = activePatients;
    if (filter === 'critical')
        filtered = filtered.filter(p => p.mtsLevel <= 2);
    else if (filter === 'urgent')
        filtered = filtered.filter(p => p.mtsLevel === 3);
    else if (filter === 'mild')
        filtered = filtered.filter(p => p.mtsLevel >= 4);
    if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(s) || p.id.toLowerCase().includes(s));
    }
    filtered.sort((a, b) => a.mtsLevel - b.mtsLevel || b.waitTimeMinutes - a.waitTimeMinutes);
    const handleMarkAttended = (id: string) => {
        setPatients(prev => prev.map(p => p.id === id ? { ...p, status: 'attended' as const } : p));

      void patientApiService
        .updatePatientStatus(id, 'attended')
        .then(() => loadPatients())
        .catch((error) => {
          console.error('Failed to update patient status:', error);
        });
    };
    const stats = [
        { label: 'Pacientes activos', value: activePatients.length, icon: Users, accent: 'border-l-primary' },
        { label: 'Críticos (Nivel 1-2)', value: criticalCount, icon: AlertTriangle, accent: 'border-l-mts-1' },
        { label: 'Tiempo espera prom.', value: `${avgWait} min`, icon: Clock, accent: 'border-l-mts-3' },
      { label: 'Atendidos hoy', value: attendedCount, icon: CheckCircle, accent: 'border-l-mts-4' },
    ];
    return (<AppLayout> 

      

      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0"> 

        <div className="flex items-center gap-2"> 

          <Shield className="h-6 w-6 text-primary"/> 

          <span className="font-bold text-primary">TriageAI</span> 

        </div>

        <span className="text-sm font-medium text-muted-foreground hidden md:block">Hospital Universitario San José</span> 

        <div className="flex items-center gap-4"> 

          <button className="relative p-2 hover:bg-muted rounded-lg transition-colors"> 

            <Bell className="h-5 w-5 text-muted-foreground"/> 

            {unreadAlerts > 0 && (<span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-semibold"> 

                {unreadAlerts} 

              </span>)}

          </button>

          <div className="flex items-center gap-2"> 

            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">AR</div> 

            <span className="text-sm font-medium hidden md:block">{userName}</span> 

          </div>

        </div>

      </header>



      <div className="p-6 space-y-6"> 

        

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"> 

          {stats.map((s) => (<div key={s.label} className={cn("bg-card rounded-xl border border-border border-l-4 p-4", s.accent)}> 

              <div className="flex items-center justify-between"> 

                <div> 

                  <p className="text-2xl font-bold">{s.value}</p> 

                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p> 

                </div>

                <s.icon className="h-8 w-8 text-muted-foreground/30"/> 

              </div>

            </div>))}

        </div>



        

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6"> 

          

          <div className="space-y-4"> 

            <div className="flex items-center justify-between"> 

              <div className="flex items-center gap-2"> 

                <h2 className="text-lg font-semibold">Pacientes en Espera</h2> 

                <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">{filtered.length}</span> 

              </div>

              <button onClick={() => navigate('/patients/new')} className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">

                <PlusCircle className="h-4 w-4"/> Nuevo triaje 

              </button>

            </div>



            

            <div className="flex flex-col sm:flex-row gap-3"> 

              <div className="relative flex-1"> 

                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/> 

                <input placeholder="Buscar por nombre o ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"/>

              </div>

              <div className="flex gap-1.5"> 

                {[
            { key: 'all', label: 'Todos' },
            { key: 'critical', label: 'Crítico' },
            { key: 'urgent', label: 'Urgente' },
            { key: 'mild', label: 'Leve' },
        ].map((f) => (<button key={f.key} onClick={() => setFilter(f.key as typeof filter)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>

                    {f.label} 

                  </button>))}

              </div>

            </div>



            

            <div className="space-y-3"> 

              {filtered.length === 0 ? (<div className="text-center py-12 text-muted-foreground"> 

                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-30"/> 

                  <p className="font-medium">No hay pacientes en esta categoría</p> 

                </div>) : (filtered.map(p => (<PatientCard key={p.id} patient={p} onMarkAttended={handleMarkAttended}/>)))}

            </div>

          </div>



          

          <div className="bg-card rounded-xl border border-border p-4 h-fit lg:sticky lg:top-6"> 

            <div className="flex items-center gap-2 mb-4"> 

              <h2 className="text-base font-semibold">Alertas Activas</h2> 

              {unreadAlerts > 0 && <span className="h-2 w-2 rounded-full bg-destructive animate-pulse-dot"/>} 

            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto"> 

              {alerts.filter(a => !a.read).length === 0 ? (<p className="text-sm text-muted-foreground text-center py-6">Sin alertas activas</p>) : (alerts.filter(a => !a.read).map(alert => (<div key={alert.id} className={cn("border-l-4 rounded-lg p-3 bg-muted/30", alert.severity === 1 ? "border-l-mts-1" : alert.severity === 2 ? "border-l-mts-2" : alert.severity === 3 ? "border-l-mts-3" : "border-l-mts-4")}>

                    <p className="text-sm font-medium">{alert.patientName}</p> 

                    <p className="text-xs text-muted-foreground mt-1">{alert.message}</p> 

                    <div className="flex items-center justify-between mt-2"> 

                      <span className="text-xs text-muted-foreground">{alert.timeAgo}</span> 

                      <button onClick={() => { void markAlertAsRead(alert.id); }} className="text-xs text-primary hover:underline">

                        Marcar como vista 

                      </button>

                    </div>

                  </div>)))}

            </div>

          </div>

        </div>

      </div>

    </AppLayout>);
}
