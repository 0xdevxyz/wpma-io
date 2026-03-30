'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Bot, RefreshCw, Shield, Gauge, Activity,
  HardDrive, Layers, FileText, Newspaper,
  ChevronLeft, ChevronRight, ChevronDown, Menu, X, Zap,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentApi } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { toast } from 'react-hot-toast';

const MANUAL_ITEMS = [
  { href: '/dashboard/updates',     label: 'Updates',     icon: RefreshCw },
  { href: '/dashboard/security',    label: 'Sicherheit',  icon: Shield },
  { href: '/dashboard/performance', label: 'Performance', icon: Gauge },
  { href: '/dashboard/monitoring',  label: 'Monitoring',  icon: Activity },
  { href: '/dashboard/backups',     label: 'Backups',     icon: HardDrive },
  { href: '/dashboard/staging',     label: 'Staging',     icon: Layers },
];

const MANUAL_HREFS = new Set(MANUAL_ITEMS.map(i => i.href));

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const qc = useQueryClient();

  const { data: tasksData } = useQuery({
    queryKey: ['agent-tasks'],
    queryFn: () => agentApi.getTasks(),
    refetchInterval: 8000,
  });
  const tasks: any[] = (tasksData as any)?.data || [];
  const activeTasks = tasks.filter(t => ['analyzing', 'executing', 'running', 'action_planned'].includes(t.status));
  const isAgentActive = activeTasks.length > 0;

  const { data: settingsData } = useQuery({
    queryKey: ['agent-settings'],
    queryFn: agentApi.getSettings,
    refetchInterval: 30000,
  });
  const isManualMode: boolean = (settingsData as any)?.data?.manual_mode ?? false;

  const reactivateMut = useMutation({
    mutationFn: () => agentApi.setManualMode(false),
    onSuccess: () => {
      toast.success('Agent reaktiviert – übernimmt wieder die Kontrolle');
      qc.invalidateQueries({ queryKey: ['agent-settings'] });
    },
    onError: () => toast.error('Reaktivierung fehlgeschlagen'),
  });

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
    const savedManual = localStorage.getItem('sidebar-manual-open');
    if (savedManual === 'true') setManualOpen(true);
  }, []);

  useEffect(() => {
    if (MANUAL_HREFS.has(pathname || '')) {
      setManualOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  }

  function toggleManual() {
    const next = !manualOpen;
    setManualOpen(next);
    localStorage.setItem('sidebar-manual-open', String(next));
  }

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname?.startsWith(href);

  const isInManualSection = MANUAL_HREFS.has(pathname || '');

  if (!mounted) return <div className="pt-14 min-h-screen bg-[#08080f]">{children}</div>;

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={`
        flex flex-col
        ${mobile
          ? 'fixed inset-y-0 left-0 z-50 w-64'
          : `hidden lg:flex fixed top-14 left-0 bottom-0 z-40 transition-all duration-200 ${collapsed ? 'w-[52px]' : 'w-[220px]'}`
        }
        bg-[#08080f] border-r border-white/[0.06] overflow-y-auto overflow-x-hidden
      `}
    >
      <nav className="flex-1 py-4 px-2 space-y-0.5">

        {/* Übersicht */}
        {(!collapsed || mobile) && (
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest select-none text-white/20">
            Übersicht
          </p>
        )}
        {collapsed && !mobile && <div className="mb-1.5 border-t border-white/[0.04] mx-1" />}

        {[
          { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/dashboard/agent', label: 'Einstellungen', icon: Bot },
        ].map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              title={collapsed && !mobile ? item.label : undefined}
              className={`relative w-full flex items-center gap-3 rounded-lg text-sm transition-all duration-150
                ${collapsed && !mobile ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
                ${active ? 'bg-white/[0.06] text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'}`}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r-full bg-blue-500" />}
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-400' : ''}`} />
              {(!collapsed || mobile) && <span className="truncate font-medium">{item.label}</span>}
            </button>
          );
        })}

        {/* Manuelle Administration – Dropdown */}
        <div className="mt-4">
          {(!collapsed || mobile) ? (
            <button
              onClick={toggleManual}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-colors select-none
                ${isInManualSection ? 'text-amber-400/70' : 'text-white/20 hover:text-white/40'}`}
            >
              <span>Manuelle Administration</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${manualOpen ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <div className="mb-1.5 border-t border-white/[0.04] mx-1" />
          )}

          {(manualOpen || collapsed) && (
            <ul className="space-y-0.5 mt-0.5">
              {MANUAL_ITEMS.map(item => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <button
                      onClick={() => router.push(item.href)}
                      title={collapsed && !mobile ? item.label : undefined}
                      className={`relative w-full flex items-center gap-3 rounded-lg text-sm transition-all duration-150
                        ${collapsed && !mobile ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
                        ${active
                          ? 'bg-amber-500/[0.08] text-white'
                          : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'}`}
                    >
                      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r-full bg-amber-500" />}
                      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-amber-400' : ''}`} />
                      {(!collapsed || mobile) && <span className="truncate font-medium">{item.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Content & Marketing */}
        <div className="mt-4">
          {(!collapsed || mobile) && (
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest select-none text-white/20">
              Content & Marketing
            </p>
          )}
          {collapsed && !mobile && <div className="mb-1.5 border-t border-white/[0.04] mx-1" />}
          {[
            { href: '/dashboard/content', label: 'Content Hub', icon: Newspaper },
            { href: '/dashboard/reports', label: 'Berichte', icon: FileText },
          ].map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                title={collapsed && !mobile ? item.label : undefined}
                className={`relative w-full flex items-center gap-3 rounded-lg text-sm transition-all duration-150
                  ${collapsed && !mobile ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
                  ${active ? 'bg-white/[0.06] text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'}`}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r-full bg-blue-500" />}
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-400' : ''}`} />
                {(!collapsed || mobile) && <span className="truncate font-medium">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bottom: agent status + collapse toggle */}
      <div className="border-t border-white/[0.06] p-3 space-y-2">
        {(!collapsed || mobile) ? (
          <div className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors
            ${isManualMode ? 'bg-amber-500/[0.06]' : ''}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
              ${isManualMode ? 'bg-amber-500/70' : isAgentActive ? 'bg-blue-400 animate-pulse' : 'bg-green-500/60'}`} />
            <span className="text-[11px] text-white/30 truncate">
              {isManualMode ? 'Manuell – nur Monitoring' : isAgentActive ? `Agent aktiv (${activeTasks.length})` : 'Agent bereit'}
            </span>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <span className={`w-1.5 h-1.5 rounded-full
              ${isManualMode ? 'bg-amber-500/70' : isAgentActive ? 'bg-blue-400 animate-pulse' : 'bg-green-500/60'}`} />
          </div>
        )}

        {isManualMode && (!collapsed || mobile) && (
          <button
            onClick={() => reactivateMut.mutate()}
            disabled={reactivateMut.isPending}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg
              bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all text-[11px] font-semibold"
          >
            <Zap className="w-3 h-3" />
            {reactivateMut.isPending ? 'Reaktiviert…' : 'Agent reaktivieren'}
          </button>
        )}

        {!mobile && (
          <button
            onClick={toggleCollapsed}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg
              text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-all text-xs"
            title={collapsed ? 'Ausklappen' : 'Einklappen'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : (
              <>
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="text-[11px]">Einklappen</span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <div className="pt-14 min-h-screen bg-[#08080f]">
      <Sidebar />

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <Sidebar mobile />
        </>
      )}

      <button
        onClick={() => setMobileOpen(v => !v)}
        className="fixed bottom-5 right-5 z-50 lg:hidden w-11 h-11 rounded-full
          bg-[#0a0a12] border border-white/10 text-white/60 shadow-xl
          flex items-center justify-center hover:text-white hover:border-white/20 transition-all"
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      <main className={`transition-all duration-200 ${collapsed ? 'lg:pl-[52px]' : 'lg:pl-[220px]'}`}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
