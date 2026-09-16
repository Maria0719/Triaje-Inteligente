import { useLocation, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, Users, PlusCircle, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';

const navItems = [
    { title: 'Inicio', path: '/dashboard', icon: LayoutDashboard },
    { title: 'Pacientes activos', path: '/dashboard', icon: Users },
    { title: 'Nuevo triaje', path: '/patients/new', icon: PlusCircle, highlight: true },
    { title: 'Estadísticas', path: '/estadisticas', icon: BarChart3 },
    { title: 'Configuración', path: '/configuracion', icon: Settings },
];

/**
 * Contenido del sidebar, compartido entre el <aside> fijo de escritorio
 * (md: y superior) y el drawer/Sheet superpuesto de mobile — evita duplicar
 * el markup de navegación en dos layouts distintos.
 *
 * @param collapsed - Solo aplica al modo escritorio (oculta etiquetas de
 *   texto, deja solo iconos). El drawer de mobile siempre se renderiza
 *   expandido porque ya se superpone al contenido, no compite por espacio.
 * @param onNavigate - Se invoca al elegir un item o cerrar sesión, para que
 *   el drawer de mobile se cierre solo tras la navegación.
 */
function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { setIsLoggedIn, userName, userRole } = useApp();

    const go = (path: string) => {
        navigate(path);
        onNavigate?.();
    };

    return (
        <>
            <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
                <Shield className="h-7 w-7 text-primary shrink-0" />
                {!collapsed && <span className="text-lg font-bold text-primary">TriageAI</span>}
            </div>

            <nav className="flex-1 py-4 space-y-1 px-2">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path ||
                        (item.path === '/dashboard' && location.pathname === '/dashboard');
                    return (
                        <button
                            key={item.title}
                            onClick={() => go(item.path)}
                            className={cn(
                                "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : item.highlight
                                        ? "bg-secondary text-primary hover:bg-primary/10"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                        >
                            <item.icon className="h-5 w-5 shrink-0" />
                            {!collapsed && <span>{item.title}</span>}
                        </button>
                    );
                })}
            </nav>

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
                    onClick={() => { setIsLoggedIn(false); onNavigate?.(); navigate('/login'); }}
                    className="flex items-center gap-2 w-full text-muted-foreground hover:text-destructive text-sm py-1.5 px-1 rounded transition-colors"
                >
                    <LogOut className="h-4 w-4" />
                    {!collapsed && <span>Cerrar sesión</span>}
                </button>
            </div>
        </>
    );
}

export default function AppLayout({ children }: {
    children: React.ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="flex min-h-screen w-full bg-background">

            {/* Sidebar fijo — solo md: y superior. Empuja el contenido al costado,
                igual que antes; en mobile no se renderiza (ver drawer más abajo). */}
            <aside className={cn(
                "hidden md:flex flex-col border-r border-border bg-card transition-all duration-300 relative shrink-0",
                collapsed ? "w-16" : "w-64",
            )}>
                <SidebarNav collapsed={collapsed} />

                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="absolute -right-[22px] top-8 h-11 w-11 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm"
                    aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
            </aside>

            {/* Drawer superpuesto — solo por debajo de md:. Se abre con el botón de
                hamburguesa del header móvil; nunca empuja el contenido, se
                superpone (position fixed vía Sheet/Radix Dialog). */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetContent side="left" className="w-72 p-0 flex flex-col md:hidden">
                    <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
                    <SheetDescription className="sr-only">
                        Navegación principal de TriageAI
                    </SheetDescription>
                    <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
                </SheetContent>
            </Sheet>

            <div className="flex-1 flex flex-col min-h-screen min-w-0">
                {/* Header móvil con botón de hamburguesa — solo por debajo de md:.
                    En md: y superior el sidebar fijo ya cumple este rol. */}
                <div className="md:hidden flex items-center justify-between border-b border-border bg-card px-4 h-14 shrink-0">
                    <div className="flex items-center gap-2">
                        <Shield className="h-6 w-6 text-primary" />
                        <span className="font-bold text-primary">TriageAI</span>
                    </div>
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="h-11 w-11 -mr-2 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground"
                        aria-label="Abrir menú"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </div>

                <main className="flex-1 flex flex-col min-w-0 overflow-auto">
                    {children}
                </main>
            </div>

        </div>
    );
}
