'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe, Shield, AlertTriangle, CheckCircle, Plus, Search,
  Activity, Package, FileText, LayoutList, LayoutGrid, CreditCard,
  RefreshCw, RotateCw, Zap, BarChart2, Bot,
  Play, X, ChevronRight, Sparkles, Command, ArrowUpCircle,
} from 'lucide-react';
import { sitesApi, backupApi, syncApi, bulkApi, agentApi } from '../../lib/api';
import { openCommandPalette } from '../../components/dashboard/command-palette';
import { useAuthStore } from '../../lib/auth-store';
import { OnboardingStepper } from '../../components/dashboard/onboarding-stepper';
import { AIAssistantOverlay } from '../../components/dashboard/ai-assistant-overlay';
import { CommandPalette } from '../../components/dashboard/command-palette';
import { SiteTable } from '../../components/dashboard/site-table';
import { SiteCard } from '../../components/dashboard/site-card';
import { BulkActionBar } from '../../components/dashboard/bulk-action-bar';
import { ColumnConfigDropdown } from '../../components/dashboard/column-config-dropdown';
import { toast } from 'react-hot-toast';
import {
  Site, SortConfig, BulkAction, ViewMode,
  DEFAULT_COLUMNS, LOCAL_STORAGE_KEYS,
} from '../../lib/dashboard-config';

function getLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch { return fallback; }
}

const SEV_LABEL: Record<string, string> = {
  critical: 'Kritisch', high: 'Hoch', medium: 'Mittel', low: 'Niedrig',
};
const SEV_CLS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
};

// ─── MISSION CONTROL ─────────────────────────────────────────────────────────
// Always visible. Shows: pending approvals (inline), running tasks, recent completions.
function MissionControlPanel({ sites }: { sites: Site[] }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const { data: statsData } = useQuery({
    queryKey: ['agent-stats'],
    queryFn: agentApi.getStats,
    refetchInterval: 10000,
  });
  const { data: tasksData } = useQuery({
    queryKey: ['agent-tasks', 'all'],
    queryFn: () => agentApi.getTasks(),
    refetchInterval: 8000,
  });
  const { data: settingsData } = useQuery({
    queryKey: ['agent-settings'],
    queryFn: agentApi.getSettings,
    staleTime: 60000,
  });

  const stats = (statsData as any)?.data || {};
  const allTasks: any[] = (tasksData as any)?.data || [];
  const agentEnabled: boolean = (settingsData as any)?.data?.enabled ?? true;

  const pendingTasks = allTasks.filter(t => t.status === 'awaiting_approval');
  const activeTasks = allTasks.filter(t => ['analyzing', 'executing', 'action_planned'].includes(t.status));
  const recentDone = allTasks.filter(t => t.status === 'done').slice(0, 4);
  const failedTasks = allTasks.filter(t => t.status === 'failed').slice(0, 2);

  const hasApprovals = pendingTasks.length > 0;
  const isRunning = activeTasks.length > 0;
  const connectedCount = sites.filter(s => s.isConnected).length;

  const approveMutation = useMutation({
    mutationFn: (id: number) => agentApi.approve(id),
    onMutate: id => setApprovingId(id),
    onSuccess: () => {
      toast.success('Aktion gestartet');
      qc.invalidateQueries({ queryKey: ['agent-tasks'] });
      qc.invalidateQueries({ queryKey: ['agent-stats'] });
    },
    onError: () => toast.error('Fehler beim Ausführen'),
    onSettled: () => setApprovingId(null),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => agentApi.reject(id, 'Vom Dashboard abgelehnt'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-tasks'] }),
  });

  const headerBorder = hasApprovals
    ? 'border-amber-300/60 dark:border-amber-500/30 shadow-lg shadow-amber-500/8'
    : isRunning ? 'border-blue-300/40 dark:border-blue-500/20'
    : 'border-gray-200 dark:border-white/[0.07]';

  const headerBg = hasApprovals
    ? 'bg-amber-50/60 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/15'
    : 'border-gray-100 dark:border-white/[0.06]';

  const botBg = hasApprovals
    ? 'bg-amber-100 dark:bg-amber-500/20'
    : isRunning ? 'bg-blue-100 dark:bg-blue-500/20'
    : 'bg-gray-100 dark:bg-white/[0.07]';

  const botColor = hasApprovals
    ? 'text-amber-600 dark:text-amber-400'
    : isRunning ? 'text-blue-600 dark:text-blue-400'
    : 'text-gray-400';

  const statusBadge = !agentEnabled
    ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
    : hasApprovals ? 'bg-amber-500 text-white animate-pulse'
    : isRunning ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
    : 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400';

  const statusLabel = !agentEnabled ? '○ Pausiert'
    : hasApprovals ? `⚡ ${pendingTasks.length} Freigabe${pendingTasks.length !== 1 ? 'n' : ''} nötig`
    : isRunning ? `● Läuft (${activeTasks.length})`
    : '● Bereit';

  const subtitleText = isRunning
    ? activeTasks.slice(0, 2).map((t: any) => `${t.domain || t.site_name}: ${t.title}`).join(' · ')
    : `Überwacht ${connectedCount} Site${connectedCount !== 1 ? 's' : ''} · automatisch alle 6h`;

  return (
    <div className={`mb-4 rounded-xl overflow-hidden border transition-all ${headerBorder} bg-white dark:bg-white/[0.03]`}>

      {/* Status header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${headerBg}`}>
        <div className={`relative w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${botBg}`}>
          <Bot className={`w-4 h-4 ${botColor}`} />
          {(hasApprovals || isRunning) && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-[#0d0d14]">
              <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Autonomer Agent</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{subtitleText}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {(stats.completed ?? 0) > 0 && (
            <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/15 px-2 py-0.5 rounded-full font-medium">
              ✓ {stats.completed} heute
            </span>
          )}
          {(stats.failed ?? 0) > 0 && (
            <span className="text-[10px] text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/15 px-2 py-0.5 rounded-full font-medium">
              ✗ {stats.failed} Fehler
            </span>
          )}
          <button onClick={() => router.push('/dashboard/agent')}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">
            Mission Control <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Pending approvals — prominent, inline */}
      {pendingTasks.length > 0 && (
        <div className="divide-y divide-amber-50/80 dark:divide-amber-500/10">
          {pendingTasks.slice(0, 3).map((task: any) => (
            <div key={task.id} className="px-4 py-3 bg-amber-50/40 dark:bg-amber-500/5 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${SEV_CLS[task.severity] || SEV_CLS.medium}`}>
                    {SEV_LABEL[task.severity] || task.severity}
                  </span>
                  <span className="text-[11px] text-gray-400">{task.domain || task.site_name}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{task.title}</p>
                {task.ai_analysis?.root_cause && (
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{task.ai_analysis.root_cause}</p>
                )}
                {(task.action_plan || task.actions || []).length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Plan: {(task.action_plan || task.actions).slice(0, 2).map((s: any) => s.label).join(' → ')}
                    {(task.action_plan || task.actions).length > 2 && ` +${(task.action_plan || task.actions).length - 2}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                <button onClick={() => rejectMutation.mutate(task.id)} title="Ablehnen"
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => approveMutation.mutate(task.id)} disabled={approvingId === task.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-sm shadow-blue-600/20 disabled:opacity-50">
                  {approvingId === task.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Ausführen
                </button>
              </div>
            </div>
          ))}
          {pendingTasks.length > 3 && (
            <button onClick={() => router.push('/dashboard/agent')}
              className="w-full py-2 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-500/5 hover:bg-amber-100/50 dark:hover:bg-amber-500/8 transition-colors text-center">
              +{pendingTasks.length - 3} weitere Freigaben → Mission Control
            </button>
          )}
        </div>
      )}

      {/* Active tasks — animated live feed */}
      {isRunning && !hasApprovals && (
        <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
          {activeTasks.slice(0, 3).map((task: any) => (
            <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
              <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate block">{task.title}</span>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {task.domain || task.site_name} ·&nbsp;
                  {task.status === 'analyzing' ? 'KI analysiert…'
                    : task.status === 'action_planned' ? 'Plan bereit'
                    : 'Führt aus…'}
                </p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SEV_CLS[task.severity] || SEV_CLS.medium}`}>
                {SEV_LABEL[task.severity] || task.severity}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Idle — show completions + failures */}
      {!hasApprovals && !isRunning && (
        <div className="px-4 py-3">
          {recentDone.length > 0 || failedTasks.length > 0 ? (
            <div className="space-y-1.5">
              {failedTasks.map((task: any) => (
                <div key={task.id} className="flex items-center gap-2">
                  <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-600 dark:text-red-400 truncate flex-1">
                    {task.domain || task.site_name}: {task.title}
                  </span>
                  <button onClick={() => router.push('/dashboard/agent')}
                    className="text-[10px] text-red-500 hover:underline flex-shrink-0">Details →</button>
                </div>
              ))}
              {recentDone.map((task: any) => (
                <div key={task.id} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">
                    <span className="text-gray-400 dark:text-gray-600">{task.domain || task.site_name}: </span>
                    {task.title}
                  </span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">erledigt</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Alles ruhig. Der Agent überwacht alle Sites — Probleme werden automatisch erkannt und behoben.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── UPDATES INBOX ────────────────────────────────────────────────────────────
// Appears only when updates are available. Shows per-site breakdown.
function UpdatesInbox({ sites, onBulkAction }: { sites: Site[]; onBulkAction: (action: BulkAction, ids: number[]) => void }) {
  const sitesWithUpdates = sites.filter(s =>
    (s.pluginsUpdates ?? 0) > 0 || (s.themesUpdates ?? 0) > 0 || s.coreUpdateAvailable
  );
  if (sitesWithUpdates.length === 0) return null;

  const totalUpdates = sitesWithUpdates.reduce((acc, s) =>
    acc + (s.pluginsUpdates ?? 0) + (s.themesUpdates ?? 0) + (s.coreUpdateAvailable ? 1 : 0), 0);
  const allIds = sitesWithUpdates.map(s => s.id);

  return (
    <div className="mb-4 rounded-xl border border-orange-200/80 dark:border-orange-500/25 overflow-hidden bg-white dark:bg-white/[0.03]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-orange-100 dark:border-orange-500/15 bg-orange-50/50 dark:bg-orange-500/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center flex-shrink-0">
            <ArrowUpCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {totalUpdates} Update{totalUpdates !== 1 ? 's' : ''} verfügbar
            <span className="text-xs font-normal text-gray-500 ml-1.5">· {sitesWithUpdates.length} Site{sitesWithUpdates.length !== 1 ? 's' : ''}</span>
          </span>
        </div>
        <button onClick={() => onBulkAction('plugin-update', allIds)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold transition-colors shadow-sm">
          <Zap className="w-3 h-3" />
          Alle jetzt updaten
        </button>
      </div>
      <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
        {sitesWithUpdates.slice(0, 5).map(site => (
          <div key={site.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 min-w-0 truncate">{site.domain}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
              {(site.pluginsUpdates ?? 0) > 0 && (
                <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-white/[0.07] px-1.5 py-0.5 rounded-full">
                  {site.pluginsUpdates} Plugin{site.pluginsUpdates !== 1 ? 's' : ''}
                </span>
              )}
              {(site.themesUpdates ?? 0) > 0 && (
                <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-white/[0.07] px-1.5 py-0.5 rounded-full">
                  {site.themesUpdates} Theme{site.themesUpdates !== 1 ? 's' : ''}
                </span>
              )}
              {site.coreUpdateAvailable && (
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/15 px-1.5 py-0.5 rounded-full">
                  Core
                </span>
              )}
              <button onClick={() => onBulkAction('plugin-update', [site.id])}
                className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                Jetzt →
              </button>
            </div>
          </div>
        ))}
        {sitesWithUpdates.length > 5 && (
          <div className="px-4 py-2 text-xs text-gray-400 text-center">
            +{sitesWithUpdates.length - 5} weitere Sites
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [newSiteData, setNewSiteData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => getLS<ViewMode>(LOCAL_STORAGE_KEYS.viewMode, 'table'));
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadingIds, setLoadingIds] = useState<Record<number, string>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => getLS<SortConfig>(LOCAL_STORAGE_KEYS.sortConfig, { key: 'healthScore', direction: 'asc' }));
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => getLS<string[]>(LOCAL_STORAGE_KEYS.visibleColumns, DEFAULT_COLUMNS));
  const [syncing, setSyncing] = useState(false);

  const { data: sitesData, isLoading, refetch } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const r = await sitesApi.getSites();
      if (r.success) return r.data || [];
      throw new Error(r.error || 'Fehler');
    },
    refetchInterval: 30000,
  });

  const sites: Site[] = sitesData || [];

  const stats = useMemo(() => ({
    total: sites.length,
    critical: sites.filter(s => s.healthScore < 70).length,
    avg: sites.length > 0 ? Math.round(sites.reduce((s, x) => s + x.healthScore, 0) / sites.length) : 0,
    updates: sites.reduce((s, x) => s + (x.pluginsUpdates ?? 0) + (x.themesUpdates ?? 0) + (x.coreUpdateAvailable ? 1 : 0), 0),
    connected: sites.filter(s => s.isConnected).length,
  }), [sites]);

  const filteredSites = useMemo(() =>
    sites.filter(s =>
      s.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.siteName.toLowerCase().includes(searchTerm.toLowerCase())
    ), [sites, searchTerm]);

  const sortedSites = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredSites;
    return [...filteredSites].sort((a, b) => {
      const av = (a as any)[sortConfig.key] ?? '';
      const bv = (b as any)[sortConfig.key] ?? '';
      const o = sortConfig.direction === 'asc' ? 1 : -1;
      return av < bv ? -o : av > bv ? o : 0;
    });
  }, [filteredSites, sortConfig]);

  function handleSortChange(key: string) {
    setSortConfig(prev => {
      const next: SortConfig =
        prev.key !== key ? { key, direction: 'asc' } :
        prev.direction === 'asc' ? { key, direction: 'desc' } :
        { key: '', direction: null };
      localStorage.setItem(LOCAL_STORAGE_KEYS.sortConfig, JSON.stringify(next));
      return next;
    });
  }

  function switchView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(LOCAL_STORAGE_KEYS.viewMode, JSON.stringify(mode));
    setSelectedIds([]);
  }

  const handleInstallPlugin = useCallback(async (site: Site) => {
    try {
      const r = await sitesApi.regenerateSetupToken(String(site.id));
      const token = r?.data?.setupToken || r?.setupToken || site.setupToken || '';
      setNewSiteData({ id: site.id, domain: site.domain, siteName: site.siteName, siteUrl: site.siteUrl, setupToken: token });
      setIsOnboardingOpen(true);
    } catch {
      toast.error('Token konnte nicht generiert werden');
    }
  }, []);

  const handleVerifyPlugin = useCallback(async (site: Site) => {
    const tid = toast.loading(`Prüfe Verbindung zu ${site.domain}…`);
    try {
      const r = await syncApi.verifyPlugin(String(site.id));
      toast.dismiss(tid);
      if (r?.data?.pluginStatus === 'connected') {
        toast.success('Plugin verbunden! Daten werden geladen…');
        await refetch();
      } else if (r?.data?.pluginStatus === 'installed_not_configured') {
        toast.error('Plugin installiert, aber API-Key fehlt.');
      } else {
        toast.error('Plugin nicht gefunden. Bitte installieren & aktivieren.');
      }
    } catch {
      toast.dismiss(tid);
      toast.error('Verbindungsprüfung fehlgeschlagen');
    }
  }, [refetch]);

  const handleSiteAction = useCallback(async (action: 'update' | 'backup' | 'healthcheck' | 'sync', siteId: number) => {
    setLoadingIds(prev => ({ ...prev, [siteId]: action }));
    try {
      if (action === 'backup') {
        const r = await backupApi.createBackup(String(siteId));
        r.success ? toast.success('Backup gestartet') : toast.error(r.error || 'Backup fehlgeschlagen');
      } else if (action === 'healthcheck') {
        const r = await sitesApi.runHealthCheck(String(siteId));
        if (r.success) {
          const d = r.data;
          if (d?.issues?.length > 0) {
            toast(`${d.issues.map((i: any) => i.message).join(' · ')}`,
              { icon: d.issues.some((i: any) => i.severity === 'critical') ? '🔴' : '⚠️', duration: 6000 });
          } else {
            toast.success('Health Check: Alles in Ordnung');
          }
          await refetch();
          agentApi.scanSite(String(siteId)).catch(() => {});
        } else {
          toast.error(r.error || 'Health Check fehlgeschlagen');
        }
      } else if (action === 'sync') {
        const r = await syncApi.syncSite(String(siteId));
        r.success ? toast.success('Site synchronisiert') : toast.error('Sync fehlgeschlagen');
        await refetch();
      } else {
        toast('Updates über die Update-Inbox oben', { icon: 'ℹ️' });
      }
    } finally {
      setLoadingIds(prev => { const n = { ...prev }; delete n[siteId]; return n; });
    }
  }, [refetch]);

  const handleSyncAll = useCallback(async () => {
    setSyncing(true);
    const toastId = toast.loading(`Verbinde mit ${sites.length} Sites...`);
    try {
      const results = await Promise.allSettled(sites.map(s => syncApi.syncSite(String(s.id))));
      const ok = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.success).length;
      const fail = results.length - ok;
      toast.dismiss(toastId);
      if (fail === 0) toast.success(`Alle ${ok} Sites synchronisiert`);
      else if (ok === 0) toast.error('Sync fehlgeschlagen – Plugin verbunden?', { duration: 6000 });
      else toast(`${ok} synchronisiert, ${fail} nicht erreichbar`, { icon: '⚠️', duration: 5000 });
      await refetch();
    } catch {
      toast.error('Sync fehlgeschlagen', { id: String(toastId) });
    } finally {
      setSyncing(false);
    }
  }, [sites, refetch]);

  const handleBulkAction = useCallback(async (action: BulkAction, ids: number[]) => {
    if (action === 'delete') {
      if (!window.confirm(`${ids.length} Site(s) wirklich löschen?`)) return;
      toast.loading(`Lösche ${ids.length} Site(s)...`, { id: 'delete' });
      try {
        await Promise.allSettled(ids.map(id => sitesApi.deleteSite(String(id))));
        toast.success(`${ids.length} Site(s) gelöscht`, { id: 'delete' });
        await refetch();
        setSelectedIds([]);
      } catch { toast.error('Fehler beim Löschen', { id: 'delete' }); }
      return;
    }
    const label = { 'core-update': 'Core-Updates', 'plugin-update': 'Plugin-Updates', 'theme-update': 'Theme-Updates', backup: 'Backups', healthcheck: 'Health Checks' }[action];
    toast.loading(`${label} für ${ids.length} Sites...`, { id: action });
    try {
      if (action === 'core-update') await bulkApi.runUpdates(ids, { updatePlugins: false, updateThemes: false, updateCore: true });
      else if (action === 'plugin-update') await bulkApi.runUpdates(ids, { updatePlugins: true, updateThemes: false, updateCore: false });
      else if (action === 'theme-update') await bulkApi.runUpdates(ids, { updatePlugins: false, updateThemes: true, updateCore: false });
      else await Promise.allSettled(ids.map(id =>
        action === 'backup' ? backupApi.createBackup(String(id)) :
        action === 'healthcheck' ? sitesApi.runHealthCheck(String(id)) :
        Promise.resolve()
      ));
      toast.success(`${label} gestartet`, { id: action });
      await refetch();
      setSelectedIds([]);
    } catch { toast.error(`Fehler bei ${label}`, { id: action }); }
  }, [refetch]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] transition-colors duration-200">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Guten Tag, <span className="text-blue-600 dark:text-blue-400">{user?.firstName || user?.email?.split('@')[0]}</span>
            </h1>
            {/* Inline stat pills */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
                <Globe className="w-3.5 h-3.5" />
                {stats.total} Sites
              </span>
              {stats.critical > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/15 px-2 py-0.5 rounded-full">
                  <Shield className="w-3 h-3" />
                  {stats.critical} kritisch
                </span>
              )}
              {stats.updates > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/15 px-2 py-0.5 rounded-full">
                  <ArrowUpCircle className="w-3 h-3" />
                  {stats.updates} Updates
                </span>
              )}
              {stats.avg > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
                  <Activity className="w-3.5 h-3.5" />
                  Ø {stats.avg}% Health
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleSyncAll}
              disabled={syncing || sites.length === 0}
              title="Alle Sites synchronisieren"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300
                dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-400 dark:hover:bg-white/[0.08]
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Sync...' : 'Alle syncen'}</span>
            </button>
            <button
              onClick={() => { setNewSiteData(null); setIsOnboardingOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-sm shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Site hinzufügen</span>
            </button>
          </div>
        </div>

        {/* ── Empty State ── */}
        {sites.length === 0 && !isLoading && (
          <div className="mb-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50
            dark:border-blue-500/20 dark:from-blue-500/5 dark:via-transparent dark:to-violet-500/5 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900 dark:text-white">Willkommen bei wpma.io</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Füge deine erste WordPress-Site hinzu und aktiviere das Plugin — dann übernimmt wpma alles Weitere für dich.
            </p>
            <button
              onClick={() => { setNewSiteData(null); setIsOnboardingOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-sm shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              Erste Site hinzufügen
            </button>
          </div>
        )}

        {/* ── Mission Control — always expanded ── */}
        <MissionControlPanel sites={sites} />

        {/* ── Updates Inbox — only when updates exist ── */}
        <UpdatesInbox sites={sites} onBulkAction={handleBulkAction} />

        {/* ── Site Fleet ── */}
        {sites.length > 0 && (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="relative flex-1 min-w-[180px] flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="Sites filtern..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-lg transition-colors
                      bg-white border border-gray-200 text-gray-900 placeholder-gray-400
                      focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                      dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-white dark:placeholder-gray-600"
                  />
                </div>
                <button
                  onClick={openCommandPalette}
                  title="Befehlspalette öffnen (⌘K)"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                    border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50
                    dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-500 dark:hover:text-white dark:hover:bg-white/[0.06]"
                >
                  <Command className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs">⌘K</span>
                </button>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {viewMode === 'table' && (
                  <ColumnConfigDropdown visibleColumns={visibleColumns} onChange={setVisibleColumns} />
                )}
                <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/[0.08]">
                  <button
                    title="Tabelle"
                    onClick={() => switchView('table')}
                    className={`px-3 py-2 transition-colors ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-900 bg-white dark:text-gray-500 dark:hover:text-gray-300 dark:bg-white/[0.03]'}`}
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                  <button
                    title="Cards"
                    onClick={() => switchView('card')}
                    className={`px-3 py-2 transition-colors border-l border-gray-200 dark:border-white/[0.08] ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-900 bg-white dark:text-gray-500 dark:hover:text-gray-300 dark:bg-white/[0.03]'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 dark:text-gray-600">
                {sortedSites.length} {sortedSites.length === 1 ? 'Site' : 'Sites'}
                {searchTerm && ` · Suche: „${searchTerm}"`}
                {selectedIds.length > 0 && ` · ${selectedIds.length} ausgewählt`}
              </p>
              {sortedSites.length > 0 && viewMode === 'table' && (
                <p className="text-[11px] text-gray-400 dark:text-gray-600 flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" /> Zeile klicken für alle Features inline
                </p>
              )}
            </div>

            {/* Site List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : sortedSites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 rounded-xl bg-white border border-gray-200 dark:bg-white/[0.02] dark:border-white/[0.06]">
                <Globe className="w-10 h-10 mb-3 text-gray-300 dark:text-gray-700" />
                <h3 className="text-sm font-semibold mb-1 text-gray-900 dark:text-gray-300">Keine Sites gefunden</h3>
                <p className="text-xs text-gray-500 dark:text-gray-600">Keine Treffer für „{searchTerm}"</p>
              </div>
            ) : viewMode === 'table' ? (
              <SiteTable
                sites={sortedSites}
                visibleColumns={visibleColumns}
                sortConfig={sortConfig}
                onSortChange={handleSortChange}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onAction={handleSiteAction}
                onInstallPlugin={handleInstallPlugin}
                onVerifyPlugin={handleVerifyPlugin}
                loadingIds={loadingIds}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {sortedSites.map(site => (
                  <SiteCard
                    key={site.id}
                    site={site}
                    isSelected={selectedIds.includes(site.id)}
                    onToggleSelect={id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                    onAction={handleSiteAction}
                    onInstallPlugin={handleInstallPlugin}
                    onVerifyPlugin={handleVerifyPlugin}
                    anySelected={selectedIds.length > 0}
                    loadingAction={loadingIds[site.id]}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Secondary Nav ── */}
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { icon: Bot,      label: 'Mission Control',  sub: 'Agent & KI',        hex: '#6366f1', action: () => router.push('/dashboard/agent') },
            { icon: FileText, label: 'Content Hub',      sub: 'KI-Content',        hex: '#ec4899', action: () => router.push('/dashboard/content') },
            { icon: BarChart2,label: 'White-Label',      sub: 'Branding & Preise', hex: '#f59e0b', action: () => router.push('/dashboard/white-label') },
            { icon: Activity, label: 'Bulk Operations',  sub: 'Alle Sites',        hex: '#3b82f6', action: () => router.push('/bulk-operations') },
            { icon: Package,  label: 'Plugins',          sub: 'Verwalten',         hex: '#8b5cf6', action: () => sites[0] && router.push(`/sites/${sites[0].id}/plugins`) },
            { icon: CreditCard,label: 'Abrechnung',     sub: 'Plan & Zahlung',    hex: '#10b981', action: () => router.push('/billing') },
          ].map(({ icon: Icon, label, sub, hex, action }) => (
            <button key={label} onClick={action}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-sm
                bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm
                dark:bg-white/[0.03] dark:border-white/[0.06] dark:hover:bg-white/[0.06] dark:hover:border-white/10">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: hex + '18' }}>
                <Icon className="w-3.5 h-3.5" style={{ color: hex }} />
              </div>
              <span className="font-medium text-gray-700 dark:text-gray-300 text-xs">{label}</span>
              <span className="text-[10px] text-gray-400 hidden sm:inline">· {sub}</span>
            </button>
          ))}
        </div>
      </div>

      <OnboardingStepper
        isOpen={isOnboardingOpen}
        onClose={() => { setIsOnboardingOpen(false); setNewSiteData(null); refetch(); }}
        onDone={() => { setIsOnboardingOpen(false); setNewSiteData(null); refetch(); }}
        initialSiteData={newSiteData}
      />
      <BulkActionBar selectedIds={selectedIds} sites={sites} onClearSelection={() => setSelectedIds([])} onBulkAction={handleBulkAction} />
      <AIAssistantOverlay />
      <CommandPalette />
    </div>
  );
}
