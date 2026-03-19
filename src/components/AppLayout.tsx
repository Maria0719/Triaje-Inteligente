import { useLocation, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, Users, PlusCircle, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

const navItems = [
  { title: 'Inicio', path: '/dashboard', icon: LayoutDashboard },
  { title: 'Pacientes activos', path: '/dashboard', icon: Users },
  { title: 'Nuevo triaje', path: '/patients/new', icon: PlusCircle, highlight: true },
  { title: 'Estadísticas', path: '/estadisticas', icon: BarChart3 },
  { title: 'Configuración', path: '/configuracion', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { setIsLoggedIn, userName, userRole } = useApp();

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-300 relative",
        collapsed ? "w-16" : "w-64"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
          <Shield className="h-7 w-7 text-primary shrink-0" />
          {!collapsed && <span className="text-lg font-bold text-primary">TriageAI</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === '/dashboard' && location.pathname === '/dashboard');
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : item.highlight
                    ? "bg-secondary text-primary hover:bg-primary/10"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-border p-3">
          {!collapsed && (
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                AR
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-muted-foreground">{userRole}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => { setIsLoggedIn(false); navigate('/login'); }}
            className="flex items-center gap-2 w-full text-muted-foreground hover:text-destructive text-sm py-1.5 px-1 rounded transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-8 h-6 w-6 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  );
}
