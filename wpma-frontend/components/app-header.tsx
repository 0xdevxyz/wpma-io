'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sun, Moon, LogOut, Receipt, Settings, ChevronDown, Zap, Bot, X, Command, Bell,
} from 'lucide-react';
import { useAuthStore } from '../lib/auth-store';
import { useThemeStore } from '../lib/theme-store';
import { openCommandPalette } from './dashboard/command-palette';
import { io as socketIo } from 'socket.io-client';

interface AgentToast {
  id: number;
  title: string;
  message: string;
  issueCount: number;
}

let toastIdCounter = 0;

const PLAN_LABELS: Record<string, { label: string; cls: string }> = {
  basic:      { label: 'Basic',      cls: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400' },
  pro:        { label: 'Pro',        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  enterprise: { label: 'Enterprise', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400' },
};

export function AppHeader() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<AgentToast[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Wait for Zustand store hydration from localStorage
  useEffect(() => { setMounted(true); }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Socket.io — listen for agent scan results
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.wpma.io';
    const socket = socketIo(API_BASE, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 2,
      reconnectionDelay: 5000,
      timeout: 5000,
    });
    socket.on('connect_error', () => { /* still ohne Konsolen-Spam */ });

    socket.on('connect', () => {
      if (user?.id) socket.emit('join_user_room', user.id);
    });

    socket.on('agent_scan_complete', (data: { title: string; message: string; issueCount: number }) => {
      const id = ++toastIdCounter;
      setToasts(prev => [...prev, { id, title: data.title, message: data.message, issueCount: data.issueCount }]);
      // Auto-dismiss after 10s
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 10000);
    });

    return () => { socket.disconnect(); };
  }, [isAuthenticated, user]);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  // Always render the header shell; hide user content until hydrated
  const showUser = mounted && isAuthenticated && !!user;

  const initials = showUser
    ? ([user!.firstName?.[0], user!.lastName?.[0]].filter(Boolean).join('').toUpperCase() || user!.email?.[0]?.toUpperCase() || '?')
    : '';
  const plan = showUser ? (PLAN_LABELS[user!.planType] ?? PLAN_LABELS.basic) : PLAN_LABELS.basic;

  return (
    <>
    {/* Agent scan toasts */}
    {toasts.length > 0 && (
      <div className="fixed top-16 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className="flex items-start gap-3 bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl p-4 animate-in slide-in-from-right-5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${t.issueCount > 0 ? 'bg-amber-100 dark:bg-amber-500/15' : 'bg-green-100 dark:bg-green-500/15'}`}>
              <Bot className={`w-4 h-4 ${t.issueCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{t.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{t.message}</p>
              {t.issueCount > 0 && (
                <button onClick={() => router.push('/dashboard/agent')}
                  className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  Agent-Dashboard öffnen →
                </button>
              )}
            </div>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    )}
    <header className="fixed top-0 left-0 right-0 z-50 h-14
      bg-white/90 dark:bg-[#0d0d14]/90 backdrop-blur-md
      border-b border-gray-200/60 dark:border-white/[0.06]">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">

        {/* Logo */}
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 group"
          aria-label="Zur Startseite"
        >
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-600/30
            group-hover:bg-blue-500 transition-colors">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[15px] tracking-tight text-gray-900 dark:text-white">
            wpma<span className="text-blue-600">.io</span>
          </span>
        </button>

        {/* Right side */}
        <div className="flex items-center gap-2">

          {/* Cmd+K Trigger */}
          {mounted && isAuthenticated && (
            <button
              onClick={openCommandPalette}
              title="Befehlspalette öffnen (⌘K)"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                text-gray-500 hover:text-gray-900 hover:bg-gray-100
                dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10
                transition-colors border border-gray-200 dark:border-white/[0.08] text-xs font-medium"
            >
              <Command className="w-3.5 h-3.5" />
              <span className="text-[11px]">⌘K</span>
            </button>
          )}

          {/* Mobile Cmd+K icon */}
          {mounted && isAuthenticated && (
            <button
              onClick={openCommandPalette}
              title="Suche"
              className="flex sm:hidden w-8 h-8 items-center justify-center rounded-lg
                text-gray-500 hover:text-gray-900 hover:bg-gray-100
                dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10
                transition-colors"
            >
              <Command className="w-4 h-4" />
            </button>
          )}

          {/* Dark / Light Toggle — always visible */}
          {mounted && (
            <button
              onClick={toggle}
              title={isDark ? 'Hellen Modus aktivieren' : 'Dunklen Modus aktivieren'}
              className="w-8 h-8 flex items-center justify-center rounded-lg
                text-gray-500 hover:text-gray-900 hover:bg-gray-100
                dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10
                transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          {/* Profile Dropdown — only when authenticated */}
          {showUser && <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen(v => !v)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg
                hover:bg-gray-100 dark:hover:bg-white/10
                transition-colors group"
            >
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center
                text-[11px] font-bold text-white flex-shrink-0">
                {initials}
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[140px] truncate">
                {user.firstName || user.email?.split('@')[0]}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1.5 w-64
                bg-white dark:bg-[#141420]
                border border-gray-200 dark:border-white/[0.08]
                rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40
                overflow-hidden z-50"
              >
                {/* User info */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center
                      text-sm font-bold text-white flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Nutzer'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <span className={`inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${plan.cls}`}>
                    {plan.label} · {user.siteCount ?? 0} Sites
                  </span>
                </div>

                {/* Menu items */}
                <div className="p-1.5">
                  <MenuItem
                    icon={<Settings className="w-4 h-4" />}
                    label="Profil-Einstellungen"
                    onClick={() => { setOpen(false); router.push('/profile'); }}
                  />
                  <MenuItem
                    icon={<Receipt className="w-4 h-4" />}
                    label="Rechnungen & Abo"
                    onClick={() => { setOpen(false); router.push('/billing'); }}
                  />
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg
                    hover:bg-gray-50 dark:hover:bg-white/[0.05] cursor-pointer transition-colors"
                    onClick={toggle}
                  >
                    <div className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      {isDark ? 'Heller Modus' : 'Dunkler Modus'}
                    </div>
                    {/* Toggle pill */}
                    <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0
                      ${isDark ? 'bg-blue-600' : 'bg-gray-200 dark:bg-white/20'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                        ${isDark ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </div>
                  </div>
                </div>

                {/* Logout */}
                <div className="p-1.5 border-t border-gray-100 dark:border-white/[0.06]">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
                      text-sm text-red-600 dark:text-red-400
                      hover:bg-red-50 dark:hover:bg-red-500/10
                      transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Abmelden
                  </button>
                </div>
              </div>
            )}
          </div>}
        </div>
      </div>
    </header>
    </>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
        text-sm text-gray-700 dark:text-gray-300
        hover:bg-gray-50 dark:hover:bg-white/[0.05]
        transition-colors text-left"
    >
      {icon}
      {label}
    </button>
  );
}
