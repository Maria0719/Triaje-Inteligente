import { NavLink } from 'react-router-dom';
import { Sparkles, Home, Plus, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/crear', label: 'Crear quiz', icon: Plus },
  { to: '/estadisticas', label: 'Estadísticas', icon: BarChart3 },
];

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full">
      {/* Top bar (mobile + desktop) */}
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">QuizAI</span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  )
                }
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
            AX
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-10">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border glass md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-2 py-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 rounded-lg px-4 py-1.5 text-xs font-medium',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              <l.icon className="h-5 w-5" />
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
