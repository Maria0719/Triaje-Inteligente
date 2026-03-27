import AppLayout from '@/components/AppLayout';
import { Users, AlertTriangle, Clock, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell, } from 'recharts';
import {
  StatisticsApiService,
  StatisticsByLevelItem,
  StatisticsSummary,
  TopComplaintItem,
  WaitByLevelItem,
} from '@/infrastructure/api/StatisticsApiService';

const periods = ['Hoy', 'Esta semana', 'Este mes'] as const;
const statisticsApiService = new StatisticsApiService();

const DEFAULT_SUMMARY: StatisticsSummary = {
  totalActive: 0,
  criticalPatients: 0,
  averageWaitTime: 0,
  attendedToday: 0,
};

const DEFAULT_BY_LEVEL: StatisticsByLevelItem[] = [
  { level: 'Nivel 1', count: 0 },
  { level: 'Nivel 2', count: 0 },
  { level: 'Nivel 3', count: 0 },
  { level: 'Nivel 4', count: 0 },
  { level: 'Nivel 5', count: 0 },
];

const DEFAULT_WAIT_BY_LEVEL: WaitByLevelItem[] = [
  { level: 'Nivel 1', actual: 0, recommended: 0 },
  { level: 'Nivel 2', actual: 0, recommended: 10 },
  { level: 'Nivel 3', actual: 0, recommended: 30 },
  { level: 'Nivel 4', actual: 0, recommended: 60 },
  { level: 'Nivel 5', actual: 0, recommended: 120 },
];

export default function StatisticsPage() {
    const [period, setPeriod] = useState<string>('Hoy');
    const [summary, setSummary] = useState<StatisticsSummary>(DEFAULT_SUMMARY);
    const [byLevel, setByLevel] = useState<StatisticsByLevelItem[]>(DEFAULT_BY_LEVEL);
    const [topComplaints, setTopComplaints] = useState<TopComplaintItem[]>([]);
    const [waitByLevel, setWaitByLevel] = useState<WaitByLevelItem[]>(DEFAULT_WAIT_BY_LEVEL);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const loadStatistics = async () => {
        setLoading(true);
        const [summaryData, byLevelData, topComplaintsData, waitByLevelData] = await Promise.all([
          statisticsApiService.getSummary(),
          statisticsApiService.getByLevel(),
          statisticsApiService.getTopComplaints(),
          statisticsApiService.getWaitByLevel(),
        ]);

        setSummary(summaryData);
        setByLevel(byLevelData);
        setTopComplaints(topComplaintsData);
        setWaitByLevel(waitByLevelData);
        setLoading(false);
      };

      void loadStatistics();
    }, []);

    const kpis = [
        { label: 'Pacientes atendidos', value: summary.totalActive, change: '', up: true, icon: Users, accent: 'border-l-primary' },
        { label: 'Pacientes críticos', value: summary.criticalPatients, change: '', up: true, icon: AlertTriangle, accent: 'border-l-mts-1' },
        { label: 'Tiempo espera prom.', value: `${Math.round(summary.averageWaitTime)} min`, change: '', up: false, icon: Clock, accent: 'border-l-mts-3' },
        { label: 'Resueltos hoy', value: summary.attendedToday, change: '', up: true, icon: CheckCircle, accent: 'border-l-mts-4' },
    ];
    const barColors = ['hsl(0,72%,51%)', 'hsl(25,95%,53%)', 'hsl(48,96%,53%)', 'hsl(142,71%,45%)', 'hsl(217,91%,60%)'];
    return (<AppLayout>

      <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">

        <div className="flex items-center justify-between">

          <h1 className="text-xl font-bold">Estadísticas</h1>

          <div className="flex gap-1.5">

            {periods.map(p => (<button key={p} onClick={() => setPeriod(p)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", period === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>

                {p}

              </button>))}

          </div>

        </div>



        

        {loading && (<div className="flex items-center justify-center py-8">

            <div className="h-8 w-8 rounded-full border-2 border-muted border-t-primary animate-spin" aria-label="Cargando estadísticas"/>

          </div>)}


        {!loading && (<>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {kpis.map(k => (<div key={k.label} className={cn("bg-card rounded-xl border border-border border-l-4 p-4", k.accent)}>

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-2xl font-bold">{k.value}</p>

                  <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>

                </div>

                <div className="text-right">

                  <k.icon className="h-6 w-6 text-muted-foreground/30 mb-1 ml-auto"/>

                  <span className={cn("text-xs font-medium flex items-center gap-0.5 justify-end", k.up ? "text-mts-4" : "text-destructive")}>

                    {k.up ? <TrendingUp className="h-3 w-3"/> : <TrendingDown className="h-3 w-3"/>}

                  </span>

                </div>

              </div>

            </div>))}

        </div>



        

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          

          <div className="bg-card rounded-xl border border-border p-5">

            <h3 className="text-sm font-semibold mb-4">Pacientes por nivel MTS</h3>

            <ResponsiveContainer width="100%" height={250}>

              <BarChart data={byLevel}>

                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,95%,93%)"/>

                <XAxis dataKey="level" tick={{ fontSize: 12 }}/>

                <YAxis tick={{ fontSize: 12 }}/>

                <Tooltip />

                <Bar dataKey="count" radius={[6, 6, 0, 0]}>

                  {byLevel.map((_, i) => (<Cell key={i} fill={barColors[i]}/>))}

                </Bar>

              </BarChart>

            </ResponsiveContainer>

          </div>



          

          <div className="bg-card rounded-xl border border-border p-5">

            <h3 className="text-sm font-semibold mb-4">Volumen por hora del día</h3>

            <ResponsiveContainer width="100%" height={250}>

              <LineChart data={[]}>

                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,95%,93%)"/>

                <XAxis dataKey="hour" tick={{ fontSize: 12 }}/>

                <YAxis tick={{ fontSize: 12 }}/>

                <Tooltip />

                <Line type="monotone" dataKey="patients" stroke="hsl(224,73%,40%)" strokeWidth={2} dot={{ r: 4 }}/>

              </LineChart>

            </ResponsiveContainer>

          </div>

        </div>



        

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          

          <div className="bg-card rounded-xl border border-border p-5">

            <h3 className="text-sm font-semibold mb-4">Top 5 motivos de consulta</h3>

            <div className="space-y-3">

              {topComplaints.map((c, i) => (<div key={c.complaint} className="flex items-center gap-3">

                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>

                  <div className="flex-1">

                    <div className="flex items-center justify-between mb-1">

                      <span className="text-sm font-medium">{c.complaint}</span>

                      <span className="text-xs text-muted-foreground">{c.count}</span>

                    </div>

                    <div className="h-2 bg-muted rounded-full overflow-hidden">

                      <div className="h-full bg-primary rounded-full" style={{ width: `${(c.count / 8) * 100}%` }}/>

                    </div>

                  </div>

                </div>))}

            </div>

          </div>



          

          <div className="bg-card rounded-xl border border-border p-5">

            <h3 className="text-sm font-semibold mb-4">Tiempo de espera vs. recomendado</h3>

            <div className="space-y-1">

              <div className="grid grid-cols-4 text-xs text-muted-foreground font-medium py-2 border-b border-border">

                <span>Nivel</span>

                <span className="text-center">Actual</span>

                <span className="text-center">Recomendado</span>

                <span className="text-center">Estado</span>

              </div>

              {waitByLevel.map(w => {
            const exceeded = w.actual > w.recommended;
            return (<div key={w.level} className="grid grid-cols-4 text-sm py-2.5 border-b border-border/50">

                    <span className="font-medium">{w.level}</span>

                    <span className="text-center">{w.actual} min</span>

                    <span className="text-center text-muted-foreground">{w.recommended === 0 ? 'Inmediato' : `${w.recommended} min`}</span>

                    <span className={cn("text-center text-xs font-medium", exceeded ? "text-destructive" : "text-mts-4")}>

                      {exceeded ? '⚠ Excede' : '✓ OK'}

                    </span>

                  </div>);
        })}

            </div>

          </div>

        </div>

        </>)}

      </div>

    </AppLayout>);
}
