'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Bot, RefreshCw, Shield, Gauge, Activity,
  HardDrive, Layers, FileText, Newspaper,
  ChevronLeft, ChevronRight, Menu, X, Zap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { agentApi } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Übersicht',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/dashboard/agent', label: 'KI Agent', icon: Bot },
    ],
  },
  {
    title: 'Site-Management',
    items: [
      { href: '/dashboard/updates', label: 'Updates', icon: RefreshCw },
      { href: '/dashboard/security', label: 'Sicherheit', icon: Shield },
      { href: '/dashboard/performance', label: 'Performance', icon: Gauge },
      { href: '/dashboard/monitoring', label: 'Monitoring', icon: Activity },
      { href: '/dashboard/backups', label: 'Backups', icon: HardDrive },
      { href: '/dashboard/staging', label: 'Staging', icon: Layers },
    ],
  },
  {
    title: 'Content & Marketing',
    items: [
      { href: '/dashboard/content', label: 'Content Hub', icon: Newspaper },
      { href: '/dashboard/reports', label: 'Berichte', icon: FileText },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { data: tasksData } = useQuery({
    queryKey: ['agent-tasks'],
    queryFn: () => agentApi.getTasks(),
    refetchInterval: 8000,
  });
  const tasks: any[] = (tasksData as any)?.data || [];
  const activeTasks = tasks.filter(t => ['analyzing', 'executing', 'running', 'action_planned'].includes(t.status));
  const isAgentActive = activeTasks.length > 0;

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  }

  if (!mounted) return <div className="pt-14 min-h-screen bg-[#08080f]">{children}</div>;

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname?.startsWith(href);

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
      {/* Nav */}
      <nav className="flex-1 py-4 space-y-5 px-2">
        {NAV_GROUPS.map(group => (
          <div key={group.title}>
            {(!collapsed || mobile) && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/20 select-none">
                {group.title}
              </p>
            )}
            {collapsed && !mobile && <div className="mb-1.5 border-t border-white/[0.04] mx-1" />}
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <button
                      onClick={() => router.push(item.href)}
                      title={collapsed && !mobile ? item.label : undefined}
                      className={`
                        relative w-full flex items-center gap-3 rounded-lg text-sm transition-all duration-150
                        ${collapsed && !mobile ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
                        ${active
                          ? 'bg-white/[0.06] text-white'
                          : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
                        }
                      `}
                    >
                      {/* Active accent line */}
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r-full bg-blue-500" />
                      )}
                      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-400' : ''}`} />
                      {(!collapsed || mobile) && (
                        <span className="truncate font-medium">{item.label}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom: agent status + collapse toggle */}
      <div className="border-t border-white/[0.06] p-3 space-y-2">
        {/* Agent status */}
        {(!collapsed || mobile) ? (
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAgentActive ? 'bg-blue-400 animate-pulse' : 'bg-green-500/60'}`} />
            <span className="text-[11px] text-white/30 truncate">
              {isAgentActive ? `Agent aktiv (${activeTasks.length})` : 'Agent bereit'}
            </span>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isAgentActive ? 'bg-blue-400 animate-pulse' : 'bg-green-500/60'}`} />
          </div>
        )}

        {/* Collapse toggle (desktop only) */}
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
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <Sidebar mobile />
        </>
      )}

      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(v => !v)}
        className="fixed bottom-5 right-5 z-50 lg:hidden w-11 h-11 rounded-full
          bg-[#0a0a12] border border-white/10 text-white/60 shadow-xl
          flex items-center justify-center hover:text-white hover:border-white/20 transition-all"
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Main content */}
      <main className={`transition-all duration-200 ${collapsed ? 'lg:pl-[52px]' : 'lg:pl-[220px]'}`}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
