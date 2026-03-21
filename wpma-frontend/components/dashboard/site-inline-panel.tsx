'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Shield, Zap, Package, HardDrive, Bot, Activity, TrendingUp, Link2,
  AlertTriangle, CheckCircle, RefreshCw, Plus, ExternalLink, ChevronRight,
  Download, Play, Pause, Trash2, ArrowUpCircle, Clock, Loader2,
  Globe, Server, Database, Lock, Eye, BarChart2, Layers, FlaskConical,
  ToggleLeft, ToggleRight, Info,
} from 'lucide-react';
import {
  securityApi, performanceApi, pluginsApi, backupApi, stagingApi,
  aiApi, linksApi, revenueApi, sitesApi,
} from '../../lib/api';
import { toast } from 'react-hot-toast';
import type { Site } from '../../lib/dashboard-config';

type Tab = 'overview' | 'plugins' | 'security' | 'performance' | 'backups' | 'staging' | 'ai' | 'links' | 'revenue';

const TABS: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'overview',     label: 'Übersicht',    icon: Globe },
  { id: 'plugins',      label: 'Plugins',      icon: Package },
  { id: 'security',     label: 'Security',     icon: Shield },
  { id: 'performance',  label: 'Performance',  icon: Zap },
  { id: 'backups',      label: 'Backups',      icon: HardDrive },
  { id: 'staging',      label: 'Staging',      icon: FlaskConical },
  { id: 'ai',           label: 'KI Insights',  icon: Bot },
  { id: 'links',        label: 'Links',        icon: Link2 },
  { id: 'revenue',      label: 'Revenue',      icon: TrendingUp },
];

export function SiteInlinePanel({ site, onAction }: {
  site: Site;
  onAction: (action: 'update' | 'backup' | 'healthcheck' | 'sync', siteId: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const router = useRouter();

  return (
    <div className="border-t border-gray-100 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.01]">
      {/* Tab Bar */}
      <div className="flex items-center gap-0.5 px-4 pt-3 pb-0 overflow-x-auto scrollbar-hide">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-medium whitespace-nowrap transition-colors
                ${activeTab === tab.id
                  ? 'bg-white dark:bg-[#0d0d14] text-blue-600 dark:text-blue-400 border border-b-transparent border-gray-200 dark:border-white/[0.08]'
                  : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.04]'
                }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {tab.label}
            </button>
          );
        })}
        <div className="ml-auto flex-shrink-0 pb-1.5">
          <button
            onClick={() => router.push(`/sites/${site.id}`)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors px-2 py-1"
          >
            Vollansicht <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-[#0d0d14] border-t-0 border border-gray-200 dark:border-white/[0.08] mx-0 rounded-b-xl p-4">
        {activeTab === 'overview'    && <OverviewTab    site={site} onAction={onAction} router={router} />}
        {activeTab === 'plugins'     && <PluginsTab     siteId={site.id} siteDomain={site.domain} />}
        {activeTab === 'security'    && <SecurityTab    siteId={site.id} siteDomain={site.domain} router={router} />}
        {activeTab === 'performance' && <PerformanceTab siteId={site.id} siteDomain={site.domain} router={router} />}
        {activeTab === 'backups'     && <BackupsTab     siteId={site.id} />}
        {activeTab === 'staging'     && <StagingTab     siteId={site.id} router={router} />}
        {activeTab === 'ai'          && <AITab          siteId={site.id} />}
        {activeTab === 'links'       && <LinksTab       siteId={site.id} router={router} />}
        {activeTab === 'revenue'     && <RevenueTab     siteId={site.id} router={router} />}
      </div>
    </div>
  );
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
function OverviewTab({ site, onAction, router }: { site: Site; onAction: (a: any, id: number) => void; router: any }) {
  const healthColor = site.healthScore >= 90 ? 'text-emerald-600 dark:text-emerald-400'
    : site.healthScore >= 70 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400';
  const updates = (site.pluginsUpdates ?? 0) + (site.themesUpdates ?? 0) + (site.coreUpdateAvailable ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCard icon={<Activity className="w-4 h-4 text-blue-500" />} label="Health Score">
          <span className={`text-xl font-bold ${healthColor}`}>{site.healthScore}%</span>
        </InfoCard>
        <InfoCard icon={<Server className="w-4 h-4 text-violet-500" />} label="WordPress">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{site.wordpressVersion || '—'}</span>
          <span className="text-xs text-gray-500 ml-1">/ PHP {site.phpVersion || '—'}</span>
        </InfoCard>
        <InfoCard icon={<ArrowUpCircle className={`w-4 h-4 ${updates > 0 ? 'text-orange-500' : 'text-gray-400'}`} />} label="Updates">
          <span className={`text-xl font-bold ${updates > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>{updates}</span>
          {updates > 0 && <span className="text-xs text-gray-500 ml-1">ausstehend</span>}
        </InfoCard>
        <InfoCard icon={<Clock className="w-4 h-4 text-gray-400" />} label="Letzter Check">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {site.lastCheck ? new Date(site.lastCheck).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        </InfoCard>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ActionBtn color="blue" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => onAction('sync', site.id)}>Sync</ActionBtn>
        <ActionBtn color="violet" icon={<Activity className="w-3.5 h-3.5" />} onClick={() => onAction('healthcheck', site.id)}>Health Check</ActionBtn>
        <ActionBtn color="green" icon={<HardDrive className="w-3.5 h-3.5" />} onClick={() => onAction('backup', site.id)}>Backup</ActionBtn>
        <ActionBtn color="orange" icon={<ExternalLink className="w-3.5 h-3.5" />} onClick={() => window.open(`https://${site.domain}`, '_blank')}>Site öffnen</ActionBtn>
      </div>

      {site.coreUpdateAvailable && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20">
          <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">WordPress Core Update verfügbar</span>
          <button onClick={() => router.push(`/sites/${site.id}`)} className="ml-auto text-xs text-orange-600 dark:text-orange-400 hover:underline">Details</button>
        </div>
      )}
    </div>
  );
}

// ─── PLUGINS ──────────────────────────────────────────────────────────────────
function PluginsTab({ siteId, siteDomain }: { siteId: number; siteDomain: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['plugins', siteId],
    queryFn: () => pluginsApi.getPlugins(String(siteId)),
    staleTime: 60000,
  });

  const plugins: any[] = (data as any)?.data || [];
  const updatable = plugins.filter(p => p.update_available);

  const toggleMutation = useMutation({
    mutationFn: ({ name, active }: { name: string; active: boolean }) =>
      pluginsApi.togglePlugin(String(siteId), name, !active),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plugins', siteId] }); toast.success('Plugin-Status aktualisiert'); },
    onError: () => toast.error('Fehler beim Ändern des Plugin-Status'),
  });

  const updateMutation = useMutation({
    mutationFn: (name: string) => pluginsApi.updatePlugin(String(siteId), name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plugins', siteId] }); toast.success('Plugin aktualisiert'); },
    onError: () => toast.error('Update fehlgeschlagen'),
  });

  if (isLoading) return <TabLoader />;

  return (
    <div className="space-y-3">
      {updatable.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-orange-700 dark:text-orange-300">{updatable.length} Plugin{updatable.length !== 1 ? 's' : ''} können aktualisiert werden</span>
          </div>
          <button
            onClick={() => updatable.forEach(p => updateMutation.mutate(p.plugin || p.name))}
            className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
          >
            <ArrowUpCircle className="w-3 h-3" /> Alle updaten
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-50 dark:divide-white/[0.04] max-h-64 overflow-y-auto rounded-lg border border-gray-100 dark:border-white/[0.06]">
        {plugins.length === 0 ? (
          <p className="text-xs text-gray-400 px-4 py-6 text-center">Keine Plugins gefunden</p>
        ) : plugins.slice(0, 20).map((plugin: any, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
              <Package className="w-3.5 h-3.5 text-violet-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{plugin.name || plugin.plugin}</p>
              <p className="text-[10px] text-gray-400">v{plugin.version || '?'} {plugin.update_available && <span className="text-orange-500 font-semibold">→ v{plugin.new_version} verfügbar</span>}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {plugin.update_available && (
                <button
                  onClick={() => updateMutation.mutate(plugin.plugin || plugin.name)}
                  disabled={updateMutation.isPending}
                  title="Aktualisieren"
                  className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => toggleMutation.mutate({ name: plugin.plugin || plugin.name, active: plugin.active })}
                disabled={toggleMutation.isPending}
                title={plugin.active ? 'Deaktivieren' : 'Aktivieren'}
                className={`p-1.5 rounded-lg transition-colors ${plugin.active ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06]'}`}
              >
                {plugin.active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
      {plugins.length > 20 && (
        <p className="text-xs text-gray-400 text-center">+{plugins.length - 20} weitere Plugins</p>
      )}
    </div>
  );
}

// ─── SECURITY ─────────────────────────────────────────────────────────────────
function SecurityTab({ siteId, siteDomain, router }: { siteId: number; siteDomain: string; router: any }) {
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['security', siteId],
    queryFn: () => securityApi.getSecurityStatus(String(siteId)),
    staleTime: 120000,
  });

  const status: any = (data as any)?.data || {};
  const vulns = status.vulnerabilities || [];
  const score = status.securityScore ?? status.score ?? null;

  async function runScan() {
    setScanning(true);
    try {
      await securityApi.runSecurityScan(String(siteId));
      toast.success('Scan gestartet');
      setTimeout(() => { qc.invalidateQueries({ queryKey: ['security', siteId] }); setScanning(false); }, 3000);
    } catch { toast.error('Scan fehlgeschlagen'); setScanning(false); }
  }

  if (isLoading) return <TabLoader />;

  const critical = vulns.filter((v: any) => v.severity === 'critical').length;
  const high = vulns.filter((v: any) => v.severity === 'high').length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <InfoCard icon={<Lock className={`w-4 h-4 ${score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-yellow-500' : 'text-red-500'}`} />} label="Security Score">
          <span className={`text-xl font-bold ${score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
            {score !== null ? `${score}%` : '—'}
          </span>
        </InfoCard>
        <InfoCard icon={<AlertTriangle className={`w-4 h-4 ${critical > 0 ? 'text-red-500' : 'text-gray-400'}`} />} label="Kritisch">
          <span className={`text-xl font-bold ${critical > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>{critical}</span>
        </InfoCard>
        <InfoCard icon={<Shield className={`w-4 h-4 ${high > 0 ? 'text-orange-500' : 'text-gray-400'}`} />} label="Hoch">
          <span className={`text-xl font-bold ${high > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>{high}</span>
        </InfoCard>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
          {scanning ? 'Scannt...' : 'Scan starten'}
        </button>
        <button
          onClick={() => router.push(`/sites/${siteId}/security`)}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Vollständiger Report <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {vulns.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {vulns.slice(0, 5).map((v: any, i: number) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.03]">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5
                ${v.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                  : v.severity === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400'}`}>
                {v.severity}
              </span>
              <p className="text-xs text-gray-700 dark:text-gray-300">{v.title || v.name || v.description}</p>
            </div>
          ))}
        </div>
      )}

      {vulns.length === 0 && !isLoading && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-4 h-4" />
          Keine bekannten Schwachstellen gefunden
        </div>
      )}
    </div>
  );
}

// ─── PERFORMANCE ──────────────────────────────────────────────────────────────
function PerformanceTab({ siteId, siteDomain, router }: { siteId: number; siteDomain: string; router: any }) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['performance', siteId],
    queryFn: () => performanceApi.getMetrics(String(siteId)),
    staleTime: 60000,
  });

  const metrics: any = (data as any)?.data || {};

  async function runLighthouse() {
    setRunning(true);
    try {
      await performanceApi.analyze(String(siteId));
      toast.success('Lighthouse-Analyse gestartet');
      setTimeout(() => { qc.invalidateQueries({ queryKey: ['performance', siteId] }); setRunning(false); }, 5000);
    } catch { toast.error('Analyse fehlgeschlagen'); setRunning(false); }
  }

  if (isLoading) return <TabLoader />;

  const scores = [
    { label: 'Performance', value: metrics.performanceScore ?? metrics.performance_score, color: 'blue' },
    { label: 'Accessibility', value: metrics.accessibilityScore ?? metrics.accessibility_score, color: 'violet' },
    { label: 'SEO', value: metrics.seoScore ?? metrics.seo_score, color: 'emerald' },
    { label: 'Best Practices', value: metrics.bestPracticesScore ?? metrics.best_practices_score, color: 'orange' },
  ].filter(s => s.value != null);

  return (
    <div className="space-y-3">
      {scores.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {scores.map(s => (
            <ScoreCircle key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-4">Noch keine Lighthouse-Daten. Analyse starten.</p>
      )}

      <div className="grid grid-cols-3 gap-2 text-xs">
        {metrics.loadTime && (
          <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.03]">
            <p className="text-gray-500">Ladezeit</p>
            <p className="font-bold text-gray-900 dark:text-white">{(metrics.loadTime / 1000).toFixed(2)}s</p>
          </div>
        )}
        {metrics.memoryUsage && (
          <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.03]">
            <p className="text-gray-500">Memory</p>
            <p className="font-bold text-gray-900 dark:text-white">{Math.round(metrics.memoryUsage / 1024 / 1024)}MB</p>
          </div>
        )}
        {metrics.dbSize && (
          <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.03]">
            <p className="text-gray-500">DB-Größe</p>
            <p className="font-bold text-gray-900 dark:text-white">{Math.round(metrics.dbSize / 1024 / 1024)}MB</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={runLighthouse}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {running ? 'Analysiert...' : 'Lighthouse starten'}
        </button>
        <button
          onClick={() => router.push(`/sites/${siteId}/performance`)}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Vollständige Analyse <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── BACKUPS ──────────────────────────────────────────────────────────────────
function BackupsTab({ siteId }: { siteId: number }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['backups', siteId],
    queryFn: () => backupApi.getBackups(String(siteId)),
    staleTime: 60000,
  });

  const createMutation = useMutation({
    mutationFn: () => backupApi.createBackup(String(siteId)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backups', siteId] }); toast.success('Backup gestartet'); },
    onError: () => toast.error('Backup fehlgeschlagen'),
  });

  const backups: any[] = (data as any)?.data || [];

  if (isLoading) return <TabLoader />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{backups.length} Backup{backups.length !== 1 ? 's' : ''} vorhanden</span>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Backup erstellen
        </button>
      </div>

      {backups.length > 0 ? (
        <div className="divide-y divide-gray-50 dark:divide-white/[0.04] max-h-48 overflow-y-auto rounded-lg border border-gray-100 dark:border-white/[0.06]">
          {backups.slice(0, 8).map((b: any, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
              <HardDrive className="w-4 h-4 text-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{b.filename || b.name || 'Backup'}</p>
                <p className="text-[10px] text-gray-400">
                  {b.createdAt ? new Date(b.createdAt).toLocaleString('de-DE') : '—'}
                  {b.size ? ` · ${Math.round(b.size / 1024 / 1024)}MB` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {b.downloadUrl && (
                  <a href={b.downloadUrl} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-6">Noch keine Backups erstellt</p>
      )}
    </div>
  );
}

// ─── STAGING ──────────────────────────────────────────────────────────────────
function StagingTab({ siteId, router }: { siteId: number; router: any }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['staging', siteId],
    queryFn: () => stagingApi.list(String(siteId)),
    staleTime: 60000,
  });

  const environments: any[] = (data as any)?.data || [];

  if (isLoading) return <TabLoader />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{environments.length} Umgebung{environments.length !== 1 ? 'en' : ''}</span>
        <button
          onClick={() => router.push(`/sites/${siteId}/staging`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          Staging verwalten
        </button>
      </div>

      {environments.length > 0 ? (
        <div className="divide-y divide-gray-50 dark:divide-white/[0.04] rounded-lg border border-gray-100 dark:border-white/[0.06]">
          {environments.map((env: any, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <FlaskConical className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{env.name || env.domain || 'Staging'}</p>
                <p className="text-[10px] text-gray-400">{env.status || 'aktiv'}</p>
              </div>
              <a href={`https://${env.domain || env.url}`} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <FlaskConical className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Noch keine Staging-Umgebung</p>
          <button
            onClick={() => router.push(`/sites/${siteId}/staging`)}
            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Staging-Umgebung erstellen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── AI INSIGHTS ──────────────────────────────────────────────────────────────
function AITab({ siteId }: { siteId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-insights', siteId],
    queryFn: () => aiApi.getSiteRecommendations(String(siteId)),
    staleTime: 120000,
  });

  const recommendations: any[] = (data as any)?.data?.recommendations || (data as any)?.data || [];

  if (isLoading) return <TabLoader />;

  return (
    <div className="space-y-2">
      {recommendations.length === 0 ? (
        <div className="text-center py-6">
          <Bot className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Keine Empfehlungen verfügbar</p>
        </div>
      ) : recommendations.slice(0, 5).map((r: any, i) => (
        <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors">
          <Bot className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 dark:text-white">{r.title || r.recommendation}</p>
            {r.description && <p className="text-[11px] text-gray-500 mt-0.5">{r.description}</p>}
          </div>
          {r.priority && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0
              ${r.priority === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                : r.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'}`}>
              {r.priority}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── LINKS ────────────────────────────────────────────────────────────────────
function LinksTab({ siteId, router }: { siteId: number; router: any }) {
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['links', siteId],
    queryFn: () => linksApi.getLatest(String(siteId)),
    staleTime: 120000,
  });

  const result: any = (data as any)?.data || {};
  const brokenLinks: any[] = result.broken_links || result.brokenLinks || [];

  async function runScan() {
    setScanning(true);
    try {
      await linksApi.scan(String(siteId));
      toast.success('Link-Scan gestartet');
      setTimeout(() => { qc.invalidateQueries({ queryKey: ['links', siteId] }); setScanning(false); }, 4000);
    } catch { toast.error('Scan fehlgeschlagen'); setScanning(false); }
  }

  if (isLoading) return <TabLoader />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className={`w-4 h-4 ${brokenLinks.length > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
          <span className="text-xs font-medium text-gray-900 dark:text-white">
            {brokenLinks.length > 0
              ? <span className="text-red-600 dark:text-red-400">{brokenLinks.length} defekte Links</span>
              : 'Keine defekten Links'}
          </span>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
          {scanning ? 'Scannt...' : 'Scan starten'}
        </button>
      </div>

      {brokenLinks.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {brokenLinks.slice(0, 5).map((link: any, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/5">
              <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/15 px-1.5 py-0.5 rounded flex-shrink-0">
                {link.status_code || link.statusCode || '404'}
              </span>
              <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{link.url}</p>
            </div>
          ))}
          {brokenLinks.length > 5 && (
            <button
              onClick={() => router.push(`/sites/${siteId}/links`)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline w-full text-center pt-1"
            >
              +{brokenLinks.length - 5} weitere anzeigen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── REVENUE ──────────────────────────────────────────────────────────────────
function RevenueTab({ siteId, router }: { siteId: number; router: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ['revenue', siteId],
    queryFn: () => revenueApi.getSummary(String(siteId)),
    staleTime: 120000,
  });

  const summary: any = (data as any)?.data || {};

  if (isLoading) return <TabLoader />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <InfoCard icon={<TrendingUp className="w-4 h-4 text-emerald-500" />} label="Revenue/Monat">
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {summary.monthlyRevenue != null ? `€${summary.monthlyRevenue.toLocaleString('de-DE')}` : '—'}
          </span>
        </InfoCard>
        <InfoCard icon={<BarChart2 className="w-4 h-4 text-blue-500" />} label="Korrelationen">
          <span className="text-lg font-bold text-gray-900 dark:text-white">{summary.correlationCount ?? '—'}</span>
        </InfoCard>
        <InfoCard icon={<AlertTriangle className={`w-4 h-4 ${summary.issueCount > 0 ? 'text-orange-500' : 'text-gray-400'}`} />} label="Probleme">
          <span className={`text-lg font-bold ${summary.issueCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>
            {summary.issueCount ?? 0}
          </span>
        </InfoCard>
      </div>

      <button
        onClick={() => router.push(`/sites/${siteId}/revenue`)}
        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        Revenue-Analyse öffnen <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────
function InfoCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 rounded-xl border border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-gray-500">{label}</span>
      </div>
      {children}
    </div>
  );
}

function ActionBtn({ children, onClick, color, icon }: { children: React.ReactNode; onClick: () => void; color: string; icon: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10',
    violet: 'border-violet-200 dark:border-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10',
    green: 'border-green-200 dark:border-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10',
    orange: 'border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10',
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors
        bg-white dark:bg-white/[0.02] ${colorMap[color] || colorMap.blue}`}
    >
      {icon}{children}
    </button>
  );
}

function ScoreCircle({ label, value }: { label: string; value: number }) {
  const color = value >= 90 ? 'text-emerald-600 dark:text-emerald-400'
    : value >= 70 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400';
  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-gray-50 dark:bg-white/[0.03]">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-[10px] text-gray-500 text-center leading-tight mt-0.5">{label}</span>
    </div>
  );
}

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
    </div>
  );
}
