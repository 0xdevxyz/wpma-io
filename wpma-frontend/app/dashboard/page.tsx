'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Globe, Shield, AlertTriangle, CheckCircle, Plus, Search,
  Activity, Package, FileText, ChevronDown, LayoutList, LayoutGrid,
  TrendingUp, RefreshCw, RotateCw, Brain, Zap, Lock, BarChart2,
} from 'lucide-react';
import { sitesApi, backupApi, syncApi, bulkApi } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { CreateSiteModal } from '../../components/dashboard/create-site-modal';
import { PluginSetupModal } from '../../components/dashboard/plugin-setup-modal';
import { AIInsightsWidget } from '../../components/dashboard/ai-insights-widget';
import { AIAssistantOverlay } from '../../components/dashboard/ai-assistant-overlay';
import { CommandPalette } from '../../components/dashboard/command-palette';
import { RealTimeActivityFeed } from '../../components/dashboard/real-time-activity-feed';
import { SecurityNewsBox } from '../../components/dashboard/security-news-box';
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

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPluginSetupModalOpen, setIsPluginSetupModalOpen] = useState(false);
  const [newSiteData, setNewSiteData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => getLS<ViewMode>(LOCAL_STORAGE_KEYS.viewMode, 'table'));
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => getLS<SortConfig>(LOCAL_STORAGE_KEYS.sortConfig, { key: '', direction: null }));
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => getLS<string[]>(LOCAL_STORAGE_KEYS.visibleColumns, DEFAULT_COLUMNS));
  const [insightsOpen, setInsightsOpen] = useState<boolean>(() => getLS<boolean>(LOCAL_STORAGE_KEYS.insightsOpen, false));

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
    healthy: sites.filter(s => s.healthScore >= 90).length,
    warning: sites.filter(s => s.healthScore >= 70 && s.healthScore < 90).length,
    critical: sites.filter(s => s.healthScore < 70).length,
    avg: sites.length > 0 ? Math.round(sites.reduce((s, x) => s + x.healthScore, 0) / sites.length) : 0,
    updates: sites.reduce((s, x) => s + (x.pluginsUpdates ?? 0) + (x.themesUpdates ?? 0) + (x.coreUpdateAvailable ? 1 : 0), 0),
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

  function toggleInsights() {
    setInsightsOpen(v => {
      localStorage.setItem(LOCAL_STORAGE_KEYS.insightsOpen, JSON.stringify(!v));
      return !v;
    });
  }

  const handleSiteAction = useCallback(async (action: 'update' | 'backup' | 'healthcheck' | 'sync', siteId: number) => {
    if (action === 'backup') {
      toast.promise(backupApi.createBackup(String(siteId)), { loading: 'Backup...', success: 'Backup gestartet', error: 'Fehlgeschlagen' });
    } else if (action === 'healthcheck') {
      toast.promise(sitesApi.runHealthCheck(String(siteId)), { loading: 'Health Check...', success: 'Abgeschlossen', error: 'Fehlgeschlagen' });
    } else if (action === 'sync') {
      toast.promise(
        syncApi.syncSite(String(siteId)).then(async r => { await refetch(); return r; }),
        { loading: 'Synchronisiere...', success: 'Site synchronisiert', error: 'Sync fehlgeschlagen' }
      );
    } else {
      toast('Updates über Bulk-Aktionen', { icon: 'ℹ️' });
    }
  }, [refetch]);

  const handleSyncAll = useCallback(async () => {
    setSyncing(true);
    const toastId = toast.loading(`Verbinde mit ${sites.length} Sites...`);
    try {
      const results = await Promise.allSettled(
        sites.map(s => syncApi.syncSite(String(s.id)))
      );
      const ok = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.success).length;
      const fail = results.length - ok;
      toast.dismiss(toastId);
      if (fail === 0) {
        toast.success(`Alle ${ok} Sites synchronisiert`);
      } else if (ok === 0) {
        toast.error(`Sync fehlgeschlagen – Plugin auf den Sites nicht verbunden?\nAPI-Key prüfen oder Plugin neu installieren.`, { duration: 6000 });
      } else {
        toast(`${ok} synchronisiert, ${fail} nicht erreichbar`, { icon: '⚠️', duration: 5000 });
      }
      await refetch();
    } catch {
      toast.error('Sync fehlgeschlagen', { id: String(toastId) });
    } finally {
      setSyncing(false);
    }
  }, [sites, refetch]);

  const handleBulkAction = useCallback(async (action: BulkAction, ids: number[]) => {    const label = { 'core-update': 'Core-Updates', 'plugin-update': 'Plugin-Updates', 'theme-update': 'Theme-Updates', backup: 'Backups', healthcheck: 'Health Checks' }[action];
    toast.loading(`${label} für ${ids.length} Sites...`, { id: action });
    try {
      if (action === 'core-update') {
        await bulkApi.runUpdates(ids, { updatePlugins: false, updateThemes: false, updateCore: true });
      } else if (action === 'plugin-update') {
        await bulkApi.runUpdates(ids, { updatePlugins: true, updateThemes: false, updateCore: false });
      } else if (action === 'theme-update') {
        await bulkApi.runUpdates(ids, { updatePlugins: false, updateThemes: true, updateCore: false });
      } else {
        await Promise.allSettled(ids.map(id =>
          action === 'backup' ? backupApi.createBackup(String(id)) :
          action === 'healthcheck' ? sitesApi.runHealthCheck(String(id)) :
          Promise.resolve()
        ));
      }
      toast.success(`${label} gestartet`, { id: action });
      await refetch();
      setSelectedIds([]);
    } catch {
      toast.error(`Fehler bei ${label}`, { id: action });
    }
  }, [refetch]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] transition-colors duration-200">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10">

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Guten Tag, <span className="text-blue-600 dark:text-blue-400">{user?.firstName || user?.email?.split('@')[0]}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{sites.length} Sites unter Verwaltung</p>
          </div>
          <button
            onClick={handleSyncAll}
            disabled={syncing || sites.length === 0}
            title="Alle Sites synchronisieren"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300
              dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08]
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sync...' : 'Alle syncen'}
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-sm shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            Site hinzufügen
          </button>
        </div>

        {/* USP-Feature-Leiste */}
        {sites.length === 0 ? (
          <div className="mb-6 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-violet-50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900">WordPress-Management leicht gemacht</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Brain, title: 'KI-Analyse', desc: 'Automatische Erkennung von Problemen & priorisierte Handlungsempfehlungen' },
                { icon: Shield, title: 'Sicherheits-Monitoring', desc: 'Echtzeit-Überwachung von Schwachstellen, SSL und Login-Schutz' },
                { icon: BarChart2, title: 'Performance-Tracking', desc: 'Ladezeiten, PHP-Version, Datenbankgröße — alles auf einen Blick' },
                { icon: Lock, title: 'Automatische Backups', desc: 'Tägliche Backups in der Cloud, jederzeit wiederherstellbar' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white rounded-lg p-4 border border-blue-100">
                  <Icon className="w-5 h-5 text-blue-600 mb-2" />
                  <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-6 px-1 overflow-x-auto">
            {[
              { icon: Brain, label: 'KI-Analyse', color: 'text-purple-600' },
              { icon: Shield, label: 'Sicherheits-Monitoring', color: 'text-blue-600' },
              { icon: Lock, label: 'Cloud-Backups', color: 'text-green-600' },
              { icon: BarChart2, label: 'Performance-Tracking', color: 'text-amber-600' },
              { icon: Zap, label: 'Auto-Updates', color: 'text-indigo-600' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${color}`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
            ))}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
          <StatCard icon={<Globe className="w-4 h-4" />} label="Gesamt" value={stats.total} color="blue" />
          <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Gesund" value={stats.healthy} color="green" />
          <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Warnungen" value={stats.warning} color="yellow" />
          <StatCard icon={<Shield className="w-4 h-4" />} label="Kritisch" value={stats.critical} color="red" />
          <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Ø Health" value={`${stats.avg}%`} color="violet" />
          <StatCard icon={<RefreshCw className="w-4 h-4" />} label="Updates" value={stats.updates} color={stats.updates > 0 ? 'orange' : 'neutral'} />
        </div>

        {/* Insights Accordion */}
        <div className="mb-4 rounded-xl overflow-hidden
          bg-white border border-gray-200
          dark:bg-white/[0.03] dark:border-white/[0.06]
          transition-colors">
          <button
            onClick={toggleInsights}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors
              text-gray-600 hover:text-gray-900 hover:bg-gray-50
              dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/[0.03]"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span>Insights & Aktivitäten</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform text-gray-400 ${insightsOpen ? 'rotate-180' : ''}`} />
          </button>
          {insightsOpen && (
            <div className="border-t p-4 grid grid-cols-1 lg:grid-cols-3 gap-4
              border-gray-100 dark:border-white/[0.06]">
              <AIInsightsWidget />
              <SecurityNewsBox />
              <RealTimeActivityFeed />
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Suchen..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg transition-colors
                bg-white border border-gray-200 text-gray-900 placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-white dark:placeholder-gray-600
                dark:focus:ring-blue-500/20 dark:focus:border-blue-500/50"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {viewMode === 'table' && (
              <ColumnConfigDropdown visibleColumns={visibleColumns} onChange={setVisibleColumns} />
            )}
            <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/[0.08]">
              <button
                title="Tabelle"
                onClick={() => switchView('table')}
                className={`px-3 py-2 transition-colors ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-900 bg-white dark:text-gray-500 dark:hover:text-gray-300 dark:bg-white/[0.03]'
                }`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                title="Cards"
                onClick={() => switchView('card')}
                className={`px-3 py-2 transition-colors border-l border-gray-200 dark:border-white/[0.08] ${
                  viewMode === 'card'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-900 bg-white dark:text-gray-500 dark:hover:text-gray-300 dark:bg-white/[0.03]'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-600 mb-2">
          {sortedSites.length} {sortedSites.length === 1 ? 'Site' : 'Sites'}
          {searchTerm && ` · Suche: „${searchTerm}"`}
          {selectedIds.length > 0 && ` · ${selectedIds.length} ausgewählt`}
        </p>

        {/* Site List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : sortedSites.length === 0 ? (
          <EmptyState searchTerm={searchTerm} onAdd={() => setIsCreateModalOpen(true)} />
        ) : viewMode === 'table' ? (
          <SiteTable
            sites={sortedSites}
            visibleColumns={visibleColumns}
            sortConfig={sortConfig}
            onSortChange={handleSortChange}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onAction={handleSiteAction}
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
                anySelected={selectedIds.length > 0}
              />
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Bulk Operations', sub: 'Alle Sites', color: '#3b82f6', icon: <Activity className="w-4 h-4" />, onClick: () => router.push('/bulk-operations') },
            { label: 'Plugins', sub: 'Verwalten', color: '#8b5cf6', icon: <Package className="w-4 h-4" />, onClick: () => sites[0] && router.push(`/sites/${sites[0].id}/plugins`) },
            { label: 'Reports', sub: 'Erstellen', color: '#10b981', icon: <FileText className="w-4 h-4" />, onClick: () => sites[0] && router.push(`/sites/${sites[0].id}/reports`) },
            { label: 'Security', sub: 'Prüfen', color: '#f59e0b', icon: <Shield className="w-4 h-4" />, onClick: () => toast('Coming Soon', { icon: 'ℹ️' }) },
          ].map(a => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="flex items-center gap-3 p-3 rounded-xl transition-all
                bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm
                dark:bg-white/[0.03] dark:border-white/[0.06] dark:hover:bg-white/[0.06] dark:hover:border-white/10"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: a.color + '18' }}>
                <span style={{ color: a.color }}>{a.icon}</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{a.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-600">{a.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <CreateSiteModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSuccess={d => { setNewSiteData(d); setIsCreateModalOpen(false); setIsPluginSetupModalOpen(true); }} />
      <PluginSetupModal isOpen={isPluginSetupModalOpen} onClose={() => { setIsPluginSetupModalOpen(false); setNewSiteData(null); refetch(); }} siteData={newSiteData} />
      <BulkActionBar selectedIds={selectedIds} sites={sites} onClearSelection={() => setSelectedIds([])} onBulkAction={handleBulkAction} />
      <AIAssistantOverlay />
      <CommandPalette />
    </div>
  );
}

const colorMap: Record<string, { light: string; dark: string; icon: string }> = {
  blue:    { light: 'bg-blue-50 border-blue-100 text-blue-600',     dark: 'dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400',     icon: 'text-blue-500' },
  green:   { light: 'bg-emerald-50 border-emerald-100 text-emerald-600', dark: 'dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400', icon: 'text-emerald-500' },
  yellow:  { light: 'bg-yellow-50 border-yellow-100 text-yellow-600', dark: 'dark:bg-yellow-500/10 dark:border-yellow-500/20 dark:text-yellow-400', icon: 'text-yellow-500' },
  red:     { light: 'bg-red-50 border-red-100 text-red-600',         dark: 'dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400',         icon: 'text-red-500' },
  violet:  { light: 'bg-violet-50 border-violet-100 text-violet-600', dark: 'dark:bg-violet-500/10 dark:border-violet-500/20 dark:text-violet-400', icon: 'text-violet-500' },
  orange:  { light: 'bg-orange-50 border-orange-100 text-orange-600', dark: 'dark:bg-orange-500/10 dark:border-orange-500/20 dark:text-orange-400', icon: 'text-orange-500' },
  neutral: { light: 'bg-gray-50 border-gray-200 text-gray-500',       dark: 'dark:bg-white/[0.04] dark:border-white/[0.06] dark:text-gray-500',     icon: 'text-gray-400' },
};

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const c = colorMap[color] ?? colorMap.neutral;
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${c.light} ${c.dark}`}>
      <span className={c.icon}>{icon}</span>
      <div>
        <p className="text-[11px] leading-none text-current opacity-60">{label}</p>
        <p className="text-base font-bold leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ searchTerm, onAdd }: { searchTerm: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 rounded-xl
      bg-white border border-gray-200
      dark:bg-white/[0.02] dark:border-white/[0.06]">
      <Globe className="w-10 h-10 mb-3 text-gray-300 dark:text-gray-700" />
      <h3 className="text-sm font-semibold mb-1 text-gray-900 dark:text-gray-300">
        {searchTerm ? 'Keine Sites gefunden' : 'Noch keine Sites'}
      </h3>
      <p className="text-xs mb-4 text-center text-gray-500 dark:text-gray-600">
        {searchTerm ? `Keine Treffer für „${searchTerm}"` : 'Füge deine erste WordPress-Site hinzu.'}
      </p>
      {!searchTerm && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Site hinzufügen
        </button>
      )}
    </div>
  );
}
