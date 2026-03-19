import { useState } from 'react'; // Imports state hook
import { useNavigate } from 'react-router-dom'; // Imports navigation hook
import { Shield, Bell, Search, Users, AlertTriangle, Clock, CheckCircle, PlusCircle, Activity } from 'lucide-react'; // Imports dashboard icons
import { useApp } from '@/context/AppContext'; // Imports app context
import PatientCard from '@/components/PatientCard'; // Imports patient card
import AppLayout from '@/components/AppLayout'; // Imports app layout
import { cn } from '@/lib/utils'; // Imports class helper

export default function DashboardPage() { // Declares dashboard page
  const { patients, setPatients, alerts, setAlerts, userName } = useApp(); // Reads app state
  const navigate = useNavigate(); // Gets navigation helper
  const [search, setSearch] = useState(''); // Stores search text
  const [filter, setFilter] = useState<'all' | 'critical' | 'urgent' | 'mild'>('all'); // Stores active filter

  const activePatients = patients.filter(p => p.status === 'waiting'); // Filters waiting patients
  const criticalCount = activePatients.filter(p => p.mtsLevel <= 2).length; // Counts critical patients
  const avgWait = Math.round(activePatients.reduce((s, p) => s + p.waitTimeMinutes, 0) / (activePatients.length || 1)); // Calculates average wait
  const attendedCount = patients.filter(p => p.status === 'attended').length; // Counts attended patients
  const unreadAlerts = alerts.filter(a => !a.read).length; // Counts unread alerts

  let filtered = activePatients; // Starts filtered collection
  if (filter === 'critical') filtered = filtered.filter(p => p.mtsLevel <= 2); // Applies critical filter
  else if (filter === 'urgent') filtered = filtered.filter(p => p.mtsLevel === 3); // Applies urgent filter
  else if (filter === 'mild') filtered = filtered.filter(p => p.mtsLevel >= 4); // Applies mild filter

  if (search) { // Checks search value
    const s = search.toLowerCase(); // Normalizes search text
    filtered = filtered.filter(p => // Filters by search text
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(s) || p.id.toLowerCase().includes(s) // Matches name or id
    );
  }

  filtered.sort((a, b) => a.mtsLevel - b.mtsLevel || b.waitTimeMinutes - a.waitTimeMinutes); // Sorts by priority wait

  const handleMarkAttended = (id: string) => { // Handles attended action
    setPatients(prev => prev.map(p => p.id === id ? { ...p, status: 'attended' as const } : p)); // Updates patient status
  };

  const stats = [ // Defines stats cards
    { label: 'Pacientes activos', value: activePatients.length, icon: Users, accent: 'border-l-primary' }, // Card activos
    { label: 'Críticos (Nivel 1-2)', value: criticalCount, icon: AlertTriangle, accent: 'border-l-mts-1' }, // Card criticos
    { label: 'Tiempo espera prom.', value: `${avgWait} min`, icon: Clock, accent: 'border-l-mts-3' }, // Card espera promedio
    { label: 'Atendidos hoy', value: attendedCount + 23, icon: CheckCircle, accent: 'border-l-mts-4' }, // Card atendidos hoy
  ];

  return ( // Renders dashboard page
    <AppLayout> {/* Usa layout principal */}
      {/* Top navbar */}
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0"> {/* Barra superior */}
        <div className="flex items-center gap-2"> {/* Grupo logo */}
          <Shield className="h-6 w-6 text-primary" /> {/* Icono de marca */}
          <span className="font-bold text-primary">TriageAI</span> {/* Nombre del sistema */}
        </div>
        <span className="text-sm font-medium text-muted-foreground hidden md:block">Hospital Universitario San José</span> {/* Nombre del hospital */}
        <div className="flex items-center gap-4"> {/* Grupo derecha */}
          <button className="relative p-2 hover:bg-muted rounded-lg transition-colors"> {/* Boton notificaciones */}
            <Bell className="h-5 w-5 text-muted-foreground" /> {/* Icono de campana */}
            {unreadAlerts > 0 && ( // Muestra badge si hay alertas
              <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-semibold"> {/* Badge de alertas */}
                {unreadAlerts} {/* Total alertas nuevas */}
              </span>
            )}
          </button>
          <div className="flex items-center gap-2"> {/* Grupo usuario */}
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">AR</div> {/* Avatar usuario */}
            <span className="text-sm font-medium hidden md:block">{userName}</span> {/* Nombre del usuario */}
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6"> {/* Cuerpo principal */}
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"> {/* Grilla de estadisticas */}
          {stats.map((s) => ( // Recorre tarjetas stats
            <div key={s.label} className={cn("bg-card rounded-xl border border-border border-l-4 p-4", s.accent)}> {/* Tarjeta estadistica */}
              <div className="flex items-center justify-between"> {/* Contenido de tarjeta */}
                <div> {/* Bloque de texto */}
                  <p className="text-2xl font-bold">{s.value}</p> {/* Valor del indicador */}
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p> {/* Etiqueta del indicador */}
                </div>
                <s.icon className="h-8 w-8 text-muted-foreground/30" /> {/* Icono del indicador */}
              </div>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6"> {/* Grilla del contenido */}
          {/* Left — Patient list */}
          <div className="space-y-4"> {/* Columna de pacientes */}
            <div className="flex items-center justify-between"> {/* Encabezado pacientes */}
              <div className="flex items-center gap-2"> {/* Titulo y conteo */}
                <h2 className="text-lg font-semibold">Pacientes en Espera</h2> {/* Titulo de lista */}
                <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">{filtered.length}</span> {/* Total filtrado */}
              </div>
              <button // Boton nuevo triaje
                onClick={() => navigate('/patients/new')} // Navega a nuevo triaje
                className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors" // Estilo boton accion
              >
                <PlusCircle className="h-4 w-4" /> Nuevo triaje {/* Texto boton nuevo */}
              </button>
            </div>

            {/* Search + filters */}
            <div className="flex flex-col sm:flex-row gap-3"> {/* Barra de filtros */}
              <div className="relative flex-1"> {/* Campo de busqueda */}
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /> {/* Icono busqueda */}
                <input // Input de busqueda
                  placeholder="Buscar por nombre o ID..." // Placeholder de busqueda
                  value={search} // Valor de busqueda
                  onChange={(e) => setSearch(e.target.value)} // Actualiza busqueda
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" // Estilo del input
                />
              </div>
              <div className="flex gap-1.5"> {/* Grupo filtros */}
                {[ // Opciones de filtro
                  { key: 'all', label: 'Todos' }, // Opcion todos
                  { key: 'critical', label: 'Crítico' }, // Opcion critico
                  { key: 'urgent', label: 'Urgente' }, // Opcion urgente
                  { key: 'mild', label: 'Leve' }, // Opcion leve
                ].map((f) => ( // Renderiza cada filtro
                  <button // Boton de filtro
                    key={f.key} // Clave unica del filtro
                    onClick={() => setFilter(f.key as typeof filter)} // Cambia filtro activo
                    className={cn( // Define clases dinamicas
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", // Clases base filtro
                      filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80" // Clase segun estado
                    )}
                  >
                    {f.label} {/* Texto del filtro */}
                  </button>
                ))}
              </div>
            </div>

            {/* Patient cards */}
            <div className="space-y-3"> {/* Lista de tarjetas */}
              {filtered.length === 0 ? ( // Evalua lista vacia
                <div className="text-center py-12 text-muted-foreground"> {/* Estado vacio */}
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" /> {/* Icono sin resultados */}
                  <p className="font-medium">No hay pacientes en esta categoría</p> {/* Mensaje sin pacientes */}
                </div>
              ) : ( // Caso con resultados
                filtered.map(p => ( // Recorre pacientes filtrados
                  <PatientCard key={p.id} patient={p} onMarkAttended={handleMarkAttended} /> // Renderiza tarjeta paciente
                ))
              )}
            </div>
          </div>

          {/* Right — Alerts */}
          <div className="bg-card rounded-xl border border-border p-4 h-fit lg:sticky lg:top-6"> {/* Panel de alertas */}
            <div className="flex items-center gap-2 mb-4"> {/* Encabezado alertas */}
              <h2 className="text-base font-semibold">Alertas Activas</h2> {/* Titulo alertas */}
              {unreadAlerts > 0 && <span className="h-2 w-2 rounded-full bg-destructive animate-pulse-dot" />} {/* Indicador de actividad */}
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto"> {/* Lista desplazable alertas */}
              {alerts.filter(a => !a.read).length === 0 ? ( // Evalua alertas pendientes
                <p className="text-sm text-muted-foreground text-center py-6">Sin alertas activas</p> // Mensaje sin alertas
              ) : ( // Caso con alertas
                alerts.filter(a => !a.read).map(alert => ( // Recorre alertas activas
                  <div key={alert.id} className={cn( // Tarjeta de alerta
                    "border-l-4 rounded-lg p-3 bg-muted/30", // Clases base alerta
                    alert.severity === 1 ? "border-l-mts-1" : alert.severity === 2 ? "border-l-mts-2" : alert.severity === 3 ? "border-l-mts-3" : "border-l-mts-4" // Color segun severidad
                  )}>
                    <p className="text-sm font-medium">{alert.patientName}</p> {/* Nombre del paciente */}
                    <p className="text-xs text-muted-foreground mt-1">{alert.message}</p> {/* Mensaje de alerta */}
                    <div className="flex items-center justify-between mt-2"> {/* Fila inferior alerta */}
                      <span className="text-xs text-muted-foreground">{alert.timeAgo}</span> {/* Tiempo relativo alerta */}
                      <button // Boton marcar vista
                        onClick={() => setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, read: true } : a))} // Marca alerta como leida
                        className="text-xs text-primary hover:underline" // Estilo boton alerta
                      >
                        Marcar como vista {/* Texto boton alerta */}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
