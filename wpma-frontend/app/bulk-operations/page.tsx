'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw, HardDrive, Shield, Package, CheckSquare, Square, Zap,
  Globe, ChevronDown, ChevronUp, X, CheckCircle, AlertTriangle,
  Play, XCircle, Loader2, Activity, Brain,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { sitesApi, bulkApi } from '../../lib/api';
import { toast } from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus = 'running' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';

interface JobResult {
  siteId: number;
  domain: string;
  status: 'success' | 'failed' | 'pending';
  error?: string | null;
  updates?: any;
}

interface Job {
  id: string;
  type: string;
  status: JobStatus;
  totalSites: number;
  completedSites: number;
  failedSites: number;
  results: JobResult[];
  startedAt: string;
  completedAt?: string;
  options?: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jobTypeLabel(type: string) {
  const map: Record<string, string> = {
    bulk_update: 'Updates',
    bulk_backup: 'Backups',
    bulk_security_scan: 'Security-Scan',
    bulk_plugin_install: 'Plugin-Installation',
    bulk_plugin_deactivate: 'Plugin-Deaktivierung',
  };
  return map[type] || type;
}

function statusIcon(status: JobStatus) {
  if (status === 'running') return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
  if (status === 'completed') return <CheckCircle className="w-4 h-4 text-emerald-500" />;
  if (status === 'completed_with_errors') return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  if (status === 'failed' || status === 'cancelled') return <XCircle className="w-4 h-4 text-red-500" />;
  return null;
}

function progressColor(status: JobStatus) {
  if (status === 'completed') return 'bg-emerald-500';
  if (status === 'completed_with_errors') return 'bg-yellow-500';
  if (status === 'failed') return 'bg-red-500';
  return 'bg-blue-500';
}

// ─── Job Card ────────────────────────────────────────────────────────────────

function JobCard({ job, onCancel }: { job: Job; onCancel?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(job.status === 'running');
  const pct = job.totalSites > 0
    ? Math.round(((job.completedSites + job.failedSites) / job.totalSites) * 100)
    : 0;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        {statusIcon(job.status)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {jobTypeLabel(job.type)}
            </span>
            <span className="text-xs text-gray-400">
              {job.completedSites + job.failedSites}/{job.totalSites} Sites
            </span>
            {job.failedSites > 0 && (
              <span className="text-xs text-red-500 font-medium">{job.failedSites} Fehler</span>
            )}
          </div>
          {job.status === 'running' && (
            <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressColor(job.status)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-gray-400">
            {new Date(job.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {job.status === 'running' && onCancel && (
            <button
              onClick={() => onCancel(job.id)}
              className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
              title="Abbrechen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {expanded && job.results.length > 0 && (
        <div className="border-t border-gray-100 dark:border-white/[0.05]">
          {job.results.map(r => (
            <div key={r.siteId} className="flex items-center gap-3 px-4 py-2 border-b last:border-0 border-gray-50 dark:border-white/[0.03]">
              {r.status === 'success' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
              {r.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
              {r.status === 'pending' && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />}
              <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{r.domain}</span>
              {r.error && <span className="text-[10px] text-red-400 truncate max-w-[200px]">{r.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BulkOperationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Options state
  const [updateOpts, setUpdateOpts] = useState({
    updatePlugins: true,
    updateThemes: false,
    updateCore: false,
    createBackup: true,
  });
  const [pluginSlug, setPluginSlug] = useState('');
  const [showPluginInput, setShowPluginInput] = useState<'install' | 'deactivate' | null>(null);

  // Sites
  const { data: sitesData, isLoading } = useQuery({
    queryKey: ['sites-bulk'],
    queryFn: async () => {
      const r = await sitesApi.getSites();
      return r.success ? (r.data || []) : [];
    },
  });
  const sites: any[] = sitesData || [];
  const connectedSites = sites.filter((s: any) => s.isConnected);
  const allSelected = connectedSites.length > 0 && selectedIds.length === connectedSites.length;

  // Update summary
  const { data: summaryData } = useQuery({
    queryKey: ['bulk-summary'],
    queryFn: async () => {
      const r = await bulkApi.getUpdatesSummary();
      return r.success ? r.data : null;
    },
    refetchInterval: 60000,
  });

  // Job history
  const { data: jobsData, refetch: refetchJobs } = useQuery({
    queryKey: ['bulk-jobs'],
    queryFn: async () => {
      const r = await bulkApi.getJobs(10);
      return r.success ? (r.data || []) : [];
    },
  });
  const jobs: Job[] = jobsData || [];

  // Active job polling
  const { data: activeJobData } = useQuery({
    queryKey: ['bulk-job', activeJobId],
    queryFn: async () => {
      if (!activeJobId) return null;
      const r = await bulkApi.getJobStatus(activeJobId);
      return r.success ? r.data : null;
    },
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      const data = query.state.data as Job | null;
      return data?.status === 'running' ? 2000 : false;
    },
  });

  // Stop polling when job finishes
  useEffect(() => {
    if (activeJobData && activeJobData.status !== 'running') {
      refetchJobs();
      const label = activeJobData.status === 'completed' ? 'abgeschlossen' : 'abgeschlossen (mit Fehlern)';
      toast.success(`Job ${label}: ${activeJobData.completedSites}/${activeJobData.totalSites} Sites erfolgreich`);
    }
  }, [activeJobData?.status]);

  function toggleAll() {
    setSelectedIds(allSelected ? [] : connectedSites.map((s: any) => s.id));
  }
  function toggleOne(id: number) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function startJob(label: string, fn: () => Promise<any>) {
    if (selectedIds.length === 0) { toast.error('Keine Sites ausgewählt'); return; }
    try {
      const r = await fn();
      if (r.success && r.data?.jobId) {
        setActiveJobId(r.data.jobId);
        setShowHistory(true);
        toast.success(`${label} gestartet für ${selectedIds.length} Sites`);
      } else {
        toast.error(r.error || `${label} fehlgeschlagen`);
      }
    } catch {
      toast.error(`${label} fehlgeschlagen`);
    }
  }

  async function cancelJob(jobId: string) {
    await bulkApi.cancelJob(jobId);
    setActiveJobId(null);
    refetchJobs();
    toast('Job abgebrochen');
  }

  const totalUpdates = summaryData?.totalPluginUpdates ?? 0;
  const sitesWithUpdates = summaryData?.sitesWithUpdates ?? 0;

  const currentJob: Job | null = activeJobData || null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] pt-20 pb-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Bulk-Operationen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Aktionen auf mehreren Sites gleichzeitig ausführen</p>
        </div>

        {/* Update Summary Banner */}
        {totalUpdates > 0 && (
          <div className="rounded-xl border border-orange-200 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-500/5 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
                {totalUpdates} Plugin-Updates verfügbar auf {sitesWithUpdates} Sites
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedIds(connectedSites.map((s: any) => s.id));
                setUpdateOpts(o => ({ ...o, updatePlugins: true }));
              }}
              className="text-xs font-semibold text-orange-700 dark:text-orange-400 hover:underline"
            >
              Alle auswählen
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Site Selection */}
          <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  {allSelected
                    ? <CheckSquare className="w-4 h-4 text-blue-600" />
                    : <Square className="w-4 h-4" />}
                  Alle auswählen
                </button>
              </div>
              {selectedIds.length > 0 && (
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full">
                  {selectedIds.length} ausgewählt
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 dark:border-white/[0.04] bg-gray-50/50 dark:bg-white/[0.01]">
                    <th className="w-10 px-4 py-2.5" />
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Domain</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Health</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Updates</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Uptime</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                  ) : sites.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">Keine Sites vorhanden</td></tr>
                  ) : sites.map((site: any) => {
                    const isConn = site.isConnected;
                    const updates = (site.pluginsUpdates ?? 0) + (site.themesUpdates ?? 0) + (site.coreUpdateAvailable ? 1 : 0);
                    const sel = selectedIds.includes(site.id);
                    return (
                      <tr
                        key={site.id}
                        onClick={() => isConn && toggleOne(site.id)}
                        className={`border-b last:border-0 border-gray-50 dark:border-white/[0.03] transition-colors
                          ${isConn ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}
                          ${sel ? 'bg-blue-50/50 dark:bg-blue-500/5' : isConn ? 'hover:bg-gray-50 dark:hover:bg-white/[0.02]' : ''}`}
                      >
                        <td className="px-4 py-2.5">
                          {isConn
                            ? sel ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-300" />
                            : <Globe className="w-4 h-4 text-gray-300" />}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white text-sm">{site.domain}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-semibold ${site.healthScore >= 90 ? 'text-emerald-600' : site.healthScore >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {site.healthScore}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {updates > 0
                            ? <span className="text-xs font-medium text-orange-600 dark:text-orange-400">{updates} ausstehend</span>
                            : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {site.uptimeStatus && site.uptimeStatus !== 'unknown'
                            ? <span className={`text-xs font-medium ${site.uptimeStatus === 'down' ? 'text-red-500' : site.uptimeStatus === 'slow' ? 'text-yellow-500' : 'text-emerald-500'}`}>
                                {site.uptimeStatus === 'down' ? 'Down' : `${Number(site.uptimePercent ?? 100).toFixed(1)}%`}
                              </span>
                            : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Panel */}
          <div className="space-y-4">
            {/* Updates */}
            <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Updates</h3>
              <div className="space-y-2 mb-3">
                {([
                  ['updatePlugins', 'Plugins'],
                  ['updateThemes', 'Themes'],
                  ['updateCore', 'WordPress Core'],
                  ['createBackup', 'Backup vorher'],
                ] as [keyof typeof updateOpts, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateOpts[key]}
                      onChange={e => setUpdateOpts(o => ({ ...o, [key]: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded accent-blue-600"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => startJob('Updates', () => bulkApi.runUpdates(selectedIds, updateOpts))}
                disabled={selectedIds.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Play className="w-3.5 h-3.5" /> Updates starten
              </button>
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Schnellaktionen</h3>
              <div className="space-y-2">
                <button
                  onClick={() => startJob('Backups', () => bulkApi.runBackups(selectedIds))}
                  disabled={selectedIds.length === 0}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <HardDrive className="w-3.5 h-3.5" /> Backups erstellen
                </button>
                <button
                  onClick={() => startJob('Security-Scan', () => bulkApi.securityScan(selectedIds))}
                  disabled={selectedIds.length === 0}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" /> Security-Scan
                </button>
                {selectedIds.length === 1 && (
                  <button
                    onClick={() => router.push(`/sites/${selectedIds[0]}/risk-analysis`)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                  >
                    <Brain className="w-3.5 h-3.5" /> AI Risikoanalyse
                  </button>
                )}
              </div>
            </div>

            {/* Plugin Bulk Install/Deactivate */}
            <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Plugin-Verwaltung</h3>
              <div className="space-y-2">
                {(['install', 'deactivate'] as const).map(action => (
                  <div key={action}>
                    <button
                      onClick={() => setShowPluginInput(showPluginInput === action ? null : action)}
                      disabled={selectedIds.length === 0}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Package className="w-3.5 h-3.5" />
                      {action === 'install' ? 'Plugin installieren' : 'Plugin deaktivieren'}
                    </button>
                    {showPluginInput === action && (
                      <div className="mt-2 flex gap-1.5">
                        <input
                          type="text"
                          value={pluginSlug}
                          onChange={e => setPluginSlug(e.target.value)}
                          placeholder="plugin-slug"
                          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => {
                            if (!pluginSlug) return;
                            const fn = action === 'install'
                              ? () => bulkApi.installPlugin(selectedIds, pluginSlug)
                              : () => bulkApi.deactivatePlugin(selectedIds, pluginSlug);
                            startJob(action === 'install' ? 'Plugin-Install' : 'Plugin-Deaktivierung', fn);
                            setShowPluginInput(null);
                            setPluginSlug('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors"
                        >
                          <Play className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Job History */}
        <div>
          <button
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-3"
          >
            <Activity className="w-4 h-4" />
            Job-Historie
            {jobs.length > 0 && (
              <span className="text-xs bg-gray-100 dark:bg-white/[0.08] px-1.5 py-0.5 rounded-full">{jobs.length}</span>
            )}
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showHistory && (
            <div className="space-y-2">
              {/* Active job on top */}
              {currentJob && (
                <JobCard key={currentJob.id} job={currentJob} onCancel={cancelJob} />
              )}
              {jobs
                .filter(j => j.id !== currentJob?.id)
                .map(j => <JobCard key={j.id} job={j} />)}
              {jobs.length === 0 && !currentJob && (
                <p className="text-sm text-gray-400 py-4 text-center">Noch keine Jobs ausgeführt</p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
