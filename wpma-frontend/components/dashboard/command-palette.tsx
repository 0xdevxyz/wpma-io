'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Globe, Shield, Zap, HardDrive, RefreshCw, Activity, Package,
  FileText, Bot, TrendingUp, FlaskConical, Link2, CreditCard, User,
  Settings, ChevronRight, Command, BarChart2, ArrowUpRight, X, Clock,
} from 'lucide-react';
import { sitesApi, backupApi, syncApi, securityApi, agentApi } from '../../lib/api';
import { toast } from 'react-hot-toast';

interface CommandItem {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: React.FC<{ className?: string }>;
  iconColor: string;
  action: () => void;
  keywords?: string[];
}

let paletteOpenFn: (() => void) | null = null;

export function openCommandPalette() {
  paletteOpenFn?.();
}

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const r = await sitesApi.getSites();
      return r.success ? r.data || [] : [];
    },
    staleTime: 60000,
    enabled: isOpen,
  });

  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || (sitesData as any)?.sites || [];

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setActiveIdx(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  // Register global open fn
  useEffect(() => {
    paletteOpenFn = open;
    return () => { paletteOpenFn = null; };
  }, [open]);

  // Cmd+K / Ctrl+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        isOpen ? close() : open();
      }
      if (e.key === 'Escape' && isOpen) close();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, open, close]);

  // Navigation
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => i + 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); }
      if (e.key === 'Enter') { e.preventDefault(); /* handled by button */ }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const staticCommands: CommandItem[] = useMemo(() => [
    // Navigation
    { id: 'nav-dashboard', group: 'Navigation', label: 'Dashboard', sub: 'Zur Übersicht', icon: Globe, iconColor: 'text-blue-500', action: () => router.push('/dashboard'), keywords: ['home', 'start', 'übersicht'] },
    { id: 'nav-agent', group: 'Navigation', label: 'Autonomer Agent', sub: 'KI-gesteuerte Automatisierung', icon: Bot, iconColor: 'text-violet-500', action: () => router.push('/dashboard/agent'), keywords: ['ki', 'ai', 'automation'] },
    { id: 'nav-content', group: 'Navigation', label: 'Content Hub', sub: 'KI-Content erstellen & publishen', icon: FileText, iconColor: 'text-pink-500', action: () => router.push('/dashboard/content'), keywords: ['artikel', 'blog', 'publish'] },
    { id: 'nav-whitelabel', group: 'Navigation', label: 'White-Label', sub: 'Branding konfigurieren', icon: BarChart2, iconColor: 'text-amber-500', action: () => router.push('/dashboard/white-label'), keywords: ['branding', 'logo', 'agency'] },
    { id: 'nav-clients', group: 'Navigation', label: 'Clients', sub: 'Kundenverwaltung', icon: User, iconColor: 'text-emerald-500', action: () => router.push('/dashboard/clients'), keywords: ['kunden', 'agency'] },
    { id: 'nav-billing', group: 'Navigation', label: 'Abrechnung', sub: 'Plan & Zahlungen', icon: CreditCard, iconColor: 'text-orange-500', action: () => router.push('/billing'), keywords: ['zahlung', 'abo', 'plan', 'payment'] },
    { id: 'nav-profile', group: 'Navigation', label: 'Profil', sub: 'Account-Einstellungen', icon: Settings, iconColor: 'text-gray-500', action: () => router.push('/profile'), keywords: ['account', 'einstellungen', 'password'] },
    { id: 'nav-bulk', group: 'Navigation', label: 'Bulk-Operationen', sub: 'Alle Sites gleichzeitig', icon: Activity, iconColor: 'text-blue-500', action: () => router.push('/bulk-operations'), keywords: ['bulk', 'all sites', 'massenupdate'] },
    // Global actions
    {
      id: 'action-sync-all', group: 'Aktionen', label: 'Alle Sites synchronisieren', sub: 'Daten aller Sites aktualisieren', icon: RefreshCw, iconColor: 'text-blue-500',
      action: async () => {
        close();
        toast.loading('Sync gestartet...', { id: 'sync-all' });
        try {
          await Promise.allSettled(sites.map(s => syncApi.syncSite(String(s.id))));
          toast.success(`${sites.length} Sites synchronisiert`, { id: 'sync-all' });
        } catch { toast.error('Sync fehlgeschlagen', { id: 'sync-all' }); }
      },
      keywords: ['sync', 'aktualisieren', 'refresh']
    },
    {
      id: 'action-backup-all', group: 'Aktionen', label: 'Alle Sites sichern', sub: 'Backup für alle Sites erstellen', icon: HardDrive, iconColor: 'text-green-500',
      action: async () => {
        close();
        toast.loading('Backups werden erstellt...', { id: 'backup-all' });
        try {
          await Promise.allSettled(sites.map(s => backupApi.createBackup(String(s.id))));
          toast.success(`Backups für ${sites.length} Sites gestartet`, { id: 'backup-all' });
        } catch { toast.error('Backup fehlgeschlagen', { id: 'backup-all' }); }
      },
      keywords: ['backup', 'sichern', 'sicherung']
    },
    {
      id: 'action-scan-all', group: 'Aktionen', label: 'Security-Scan für alle Sites', sub: 'Schwachstellen prüfen', icon: Shield, iconColor: 'text-red-500',
      action: async () => {
        close();
        toast.loading('Security-Scans gestartet...', { id: 'scan-all' });
        try {
          await Promise.allSettled(sites.map(s => securityApi.runSecurityScan(String(s.id))));
          toast.success('Security-Scans gestartet', { id: 'scan-all' });
        } catch { toast.error('Scan fehlgeschlagen', { id: 'scan-all' }); }
      },
      keywords: ['security', 'scan', 'sicherheit', 'schwachstellen']
    },
    {
      id: 'action-agent-scan', group: 'Aktionen', label: 'Agent: Alle Sites prüfen', sub: 'KI-Agent analysiert alle Sites', icon: Bot, iconColor: 'text-violet-500',
      action: async () => {
        close();
        toast.loading('Agent analysiert...', { id: 'agent-scan' });
        try {
          await agentApi.scanAll();
          toast.success('Agent-Scans gestartet', { id: 'agent-scan' });
        } catch { toast.error('Agent-Scan fehlgeschlagen', { id: 'agent-scan' }); }
      },
      keywords: ['agent', 'ki', 'analyse', 'probleme']
    },
    { id: 'action-new-content', group: 'Aktionen', label: 'Content erstellen', sub: 'Neuen KI-Content generieren', icon: FileText, iconColor: 'text-pink-500', action: () => { close(); router.push('/dashboard/content/create'); }, keywords: ['content', 'artikel', 'blog', 'erstellen'] },
  ], [sites, router, close]);

  const siteCommands: CommandItem[] = useMemo(() =>
    sites.flatMap(site => [
      {
        id: `site-open-${site.id}`, group: `Site: ${site.domain}`, label: site.domain,
        sub: `Health ${site.healthScore}% · ${site.siteName}`,
        icon: Globe, iconColor: 'text-blue-500',
        action: () => { close(); router.push(`/sites/${site.id}`); },
        keywords: [site.domain, site.siteName?.toLowerCase()],
      },
      {
        id: `site-security-${site.id}`, group: `Site: ${site.domain}`, label: `Security: ${site.domain}`,
        sub: 'Security-Scan öffnen', icon: Shield, iconColor: 'text-red-500',
        action: () => { close(); router.push(`/sites/${site.id}/security`); },
        keywords: ['security', 'scan', site.domain],
      },
      {
        id: `site-perf-${site.id}`, group: `Site: ${site.domain}`, label: `Performance: ${site.domain}`,
        sub: 'Lighthouse-Analyse', icon: Zap, iconColor: 'text-yellow-500',
        action: () => { close(); router.push(`/sites/${site.id}/performance`); },
        keywords: ['performance', 'lighthouse', 'speed', site.domain],
      },
      {
        id: `site-backup-${site.id}`, group: `Site: ${site.domain}`, label: `Backup: ${site.domain}`,
        sub: 'Sofortiges Backup erstellen', icon: HardDrive, iconColor: 'text-green-500',
        action: async () => {
          close();
          const tid = toast.loading(`Backup für ${site.domain}...`);
          try { await backupApi.createBackup(String(site.id)); toast.success('Backup gestartet', { id: String(tid) }); }
          catch { toast.error('Backup fehlgeschlagen', { id: String(tid) }); }
        },
        keywords: ['backup', 'sichern', site.domain],
      },
      {
        id: `site-plugins-${site.id}`, group: `Site: ${site.domain}`, label: `Plugins: ${site.domain}`,
        sub: `${site.pluginsUpdates ?? 0} Updates ausstehend`, icon: Package, iconColor: 'text-violet-500',
        action: () => { close(); router.push(`/sites/${site.id}/plugins`); },
        keywords: ['plugins', 'update', site.domain],
      },
    ]),
  [sites, close, router]);

  const allCommands = [...staticCommands, ...siteCommands];

  const filtered = useMemo(() => {
    if (!query.trim()) return staticCommands.slice(0, 8);
    const q = query.toLowerCase();
    return allCommands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.sub?.toLowerCase().includes(q) ||
      cmd.group.toLowerCase().includes(q) ||
      cmd.keywords?.some(k => k?.toLowerCase().includes(q))
    ).slice(0, 12);
  }, [query, allCommands, staticCommands]);

  // Clamp active index
  const clampedIdx = Math.min(activeIdx, Math.max(0, filtered.length - 1));

  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filtered.forEach(cmd => {
      if (!groups[cmd.group]) groups[cmd.group] = [];
      groups[cmd.group].push(cmd);
    });
    return groups;
  }, [filtered]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4"
      onClick={close}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl bg-white dark:bg-[#141420] rounded-2xl shadow-2xl shadow-black/30 overflow-hidden border border-gray-200 dark:border-white/[0.08]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-white/[0.08]">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder="Suche nach Sites, Aktionen, Seiten..."
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none"
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded border border-gray-200 dark:border-white/10 text-gray-400 bg-gray-50 dark:bg-white/[0.04] font-mono">
              ESC
            </kbd>
            <button onClick={close} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              Keine Ergebnisse für „{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([group, cmds]) => (
              <div key={group}>
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">
                  {group}
                </div>
                {cmds.map((cmd, i) => {
                  const globalIdx = filtered.indexOf(cmd);
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => { cmd.action(); if (!['action-sync-all', 'action-backup-all', 'action-scan-all', 'action-agent-scan'].includes(cmd.id)) close(); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                        ${globalIdx === clampedIdx
                          ? 'bg-blue-50 dark:bg-blue-500/10'
                          : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]'}`}
                      onMouseEnter={() => setActiveIdx(globalIdx)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <Icon className={`w-4 h-4 ${cmd.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{cmd.label}</p>
                        {cmd.sub && <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{cmd.sub}</p>}
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] font-mono text-[10px]">↑↓</kbd>
            Navigieren
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] font-mono text-[10px]">↵</kbd>
            Öffnen
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 ml-auto">
            <Command className="w-3 h-3" /><kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] font-mono text-[10px]">K</kbd>
            Öffnen/Schließen
          </div>
        </div>
      </div>
    </div>
  );
}
