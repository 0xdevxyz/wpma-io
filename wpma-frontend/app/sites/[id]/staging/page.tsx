'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Copy, GitBranch, ArrowUpFromLine, ArrowDownToLine,
  Trash2, ExternalLink, CheckCircle, XCircle,
  Loader2, AlertTriangle, Package, MoveRight, X,
  ChevronDown, ChevronUp, Terminal,
} from 'lucide-react';
import { stagingApi, sitesApi } from '../../../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StagingEnv {
  id: number;
  source_site_id: number;
  staging_domain: string;
  staging_url: string;
  status: string;
  progress_message?: string;
  created_at: string;
  activated_at?: string;
  last_synced_at?: string;
  source_domain: string;
}

interface SyncJob {
  id: number;
  direction: 'push' | 'pull';
  status: string;
  progress_message?: string;
  completed_at?: string;
}

interface CloneJob {
  id: number;
  target_domain: string;
  status: string;
  progress_message?: string;
  completed_at?: string;
}

interface MigrationJob {
  id: number;
  target_url: string;
  status: string;
  search_replace_sql?: string;
  wp_config_changes?: string;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    active:            { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', label: 'Aktiv' },
    creating:          { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', label: 'Wird erstellt…' },
    creating_backup:   { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', label: 'Backup läuft…' },
    copying_files:     { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', label: 'Kopiere Dateien…' },
    updating_urls:     { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', label: 'URLs ersetzen…' },
    finalizing:        { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', label: 'Finalisieren…' },
    running:           { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', label: 'Läuft…' },
    pending:           { cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400', label: 'Ausstehend' },
    completed:         { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', label: 'Abgeschlossen' },
    ready:             { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', label: 'Bereit' },
    failed:            { cls: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400', label: 'Fehlgeschlagen' },
    deleted:           { cls: 'bg-gray-100 text-gray-500 dark:bg-gray-500/10 dark:text-gray-400', label: 'Gelöscht' },
  };
  const s = map[status] || { cls: 'bg-gray-100 text-gray-500', label: status };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

// ─── Live Job Poller ──────────────────────────────────────────────────────────

function useSyncJobPoll(jobId: number | null, onDone: () => void) {
  const [job, setJob] = useState<SyncJob | null>(null);
  useEffect(() => {
    if (!jobId) return;
    const id = setInterval(async () => {
      const r = await stagingApi.getSyncJob(jobId);
      if (r.success && r.data) {
        setJob(r.data);
        if (r.data.status === 'completed' || r.data.status === 'failed') {
          clearInterval(id);
          onDone();
        }
      }
    }, 2000);
    return () => clearInterval(id);
  }, [jobId]);
  return job;
}

function useCloneJobPoll(jobId: number | null, onDone: () => void) {
  const [job, setJob] = useState<CloneJob | null>(null);
  useEffect(() => {
    if (!jobId) return;
    const id = setInterval(async () => {
      const r = await stagingApi.getCloneJob(jobId);
      if (r.success && r.data) {
        setJob(r.data);
        if (r.data.status === 'completed' || r.data.status === 'failed') {
          clearInterval(id);
          onDone();
        }
      }
    }, 2000);
    return () => clearInterval(id);
  }, [jobId]);
  return job;
}

// ─── Push/Pull Modal ──────────────────────────────────────────────────────────

function SyncModal({
  direction,
  stagingId,
  stagingDomain,
  liveDomain,
  onClose,
  onDone,
}: {
  direction: 'push' | 'pull';
  stagingId: number;
  stagingDomain: string;
  liveDomain: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [includeUploads, setIncludeUploads] = useState(false);
  const [createBackup, setCreateBackup] = useState(true);
  const [jobId, setJobId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const job = useSyncJobPoll(jobId, onDone);

  async function run() {
    setLoading(true);
    setError('');
    const opts = direction === 'push'
      ? { includeUploads, createBackupFirst: createBackup }
      : { includeUploads };
    const r = direction === 'push'
      ? await stagingApi.push(stagingId, opts)
      : await stagingApi.pull(stagingId, opts);
    setLoading(false);
    if (r.success && r.data?.jobId) {
      setJobId(r.data.jobId);
    } else {
      setError(r.error || 'Fehler');
    }
  }

  const isPush = direction === 'push';
  const isRunning = jobId && job && (job.status === 'pending' || job.status === 'running');
  const isDone = job?.status === 'completed' || job?.status === 'failed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0d0d14] rounded-2xl border border-gray-200 dark:border-white/[0.08] w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            {isPush
              ? <ArrowUpFromLine className="w-4 h-4 text-blue-500" />
              : <ArrowDownToLine className="w-4 h-4 text-purple-500" />}
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              {isPush ? 'Staging → Live pushen' : 'Live → Staging pullen'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Direction visual */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] text-sm">
            <span className={`font-mono text-xs px-2 py-1 rounded-md ${isPush ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'}`}>
              {isPush ? stagingDomain : liveDomain}
            </span>
            <MoveRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className={`font-mono text-xs px-2 py-1 rounded-md ${isPush ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'}`}>
              {isPush ? liveDomain : stagingDomain}
            </span>
          </div>

          {!jobId && (
            <>
              {isPush && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={createBackup} onChange={e => setCreateBackup(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Sicherheitsbackup der Live-Site erstellen</span>
                </label>
              )}
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={includeUploads} onChange={e => setIncludeUploads(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Uploads / Medien einbeziehen</span>
              </label>
            </>
          )}

          {/* Job progress */}
          {jobId && job && (
            <div className={`p-3 rounded-xl border ${job.status === 'failed' ? 'border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/5' : job.status === 'completed' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/5' : 'border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/5'}`}>
              <div className="flex items-center gap-2 mb-1">
                {job.status === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
                 job.status === 'failed' ? <XCircle className="w-4 h-4 text-red-500" /> :
                 <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                <StatusBadge status={job.status} />
              </div>
              {job.progress_message && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{job.progress_message}</p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 p-5 border-t border-gray-100 dark:border-white/[0.06]">
          {!jobId ? (
            <>
              <button onClick={onClose}
                className="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                Abbrechen
              </button>
              <button onClick={run} disabled={loading}
                className={`flex-1 px-4 py-2 text-sm rounded-xl font-semibold text-white transition-colors flex items-center justify-center gap-2 ${isPush ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isPush ? 'Push starten' : 'Pull starten'}
              </button>
            </>
          ) : isDone ? (
            <button onClick={() => { onClose(); onDone(); }}
              className="flex-1 px-4 py-2 text-sm rounded-xl font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 transition-opacity">
              Schließen
            </button>
          ) : (
            <p className="flex-1 text-center text-sm text-gray-400 py-2">Läuft…</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Clone Modal ──────────────────────────────────────────────────────────────

function CloneModal({ siteId, sourceDomain, onClose, onDone }: { siteId: string; sourceDomain: string; onClose: () => void; onDone: () => void }) {
  const [targetDomain, setTargetDomain] = useState('');
  const [includeUploads, setIncludeUploads] = useState(true);
  const [jobId, setJobId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const job = useCloneJobPoll(jobId, onDone);

  async function run() {
    if (!targetDomain.trim()) { setError('Ziel-Domain erforderlich'); return; }
    setLoading(true);
    setError('');
    const r = await stagingApi.clone(siteId, targetDomain.trim(), { includeUploads });
    setLoading(false);
    if (r.success && r.data?.jobId) {
      setJobId(r.data.jobId);
    } else {
      setError(r.error || 'Fehler');
    }
  }

  const isDone = job?.status === 'completed' || job?.status === 'failed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0d0d14] rounded-2xl border border-gray-200 dark:border-white/[0.08] w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Copy className="w-4 h-4 text-orange-500" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Site klonen</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {!jobId ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Quelle</label>
                <div className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] text-sm font-mono text-gray-600 dark:text-gray-300">{sourceDomain}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Ziel-Domain</label>
                <input
                  value={targetDomain}
                  onChange={e => setTargetDomain(e.target.value)}
                  placeholder="neue-domain.de"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={includeUploads} onChange={e => setIncludeUploads(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-orange-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Uploads / Medien einbeziehen</span>
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          ) : (
            <div className={`p-3 rounded-xl border ${job?.status === 'failed' ? 'border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/5' : job?.status === 'completed' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/5' : 'border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/5'}`}>
              <div className="flex items-center gap-2 mb-1">
                {job?.status === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
                 job?.status === 'failed' ? <XCircle className="w-4 h-4 text-red-500" /> :
                 <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                {job && <StatusBadge status={job.status} />}
              </div>
              {job?.progress_message && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{job.progress_message}</p>}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-5 border-t border-gray-100 dark:border-white/[0.06]">
          {!jobId ? (
            <>
              <button onClick={onClose}
                className="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                Abbrechen
              </button>
              <button onClick={run} disabled={loading}
                className="flex-1 px-4 py-2 text-sm rounded-xl font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Clone starten
              </button>
            </>
          ) : isDone ? (
            <button onClick={() => { onClose(); onDone(); }}
              className="flex-1 px-4 py-2 text-sm rounded-xl font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 transition-opacity">
              Schließen
            </button>
          ) : (
            <p className="flex-1 text-center text-sm text-gray-400 py-2">Clone läuft…</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Migration Modal ──────────────────────────────────────────────────────────

function MigrationModal({ siteId, sourceDomain, onClose }: { siteId: string; sourceDomain: string; onClose: () => void }) {
  const [targetUrl, setTargetUrl] = useState('');
  const [hosting, setHosting] = useState('manual');
  const [result, setResult] = useState<MigrationJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sqlExpanded, setSqlExpanded] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);

  async function run() {
    if (!targetUrl.trim()) { setError('Ziel-URL erforderlich'); return; }
    setLoading(true);
    setError('');
    const r = await stagingApi.migrate(siteId, { targetUrl: targetUrl.trim(), newHosting: hosting });
    setLoading(false);
    if (r.success && r.data) {
      setResult(r.data as any);
    } else {
      setError(r.error || 'Fehler');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0d0d14] rounded-2xl border border-gray-200 dark:border-white/[0.08] w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Package className="w-4 h-4 text-green-500" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Migration Package erstellen</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Neue Ziel-URL</label>
                <input
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value)}
                  placeholder="https://neue-domain.de"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Ziel-Hosting</label>
                <select value={hosting} onChange={e => setHosting(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500/40">
                  <option value="manual">Manuell (universell)</option>
                  <option value="all_inkl">All-Inkl.com (KAS)</option>
                  <option value="siteground">SiteGround</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300">Migration Package bereit! Backup erstellt.</p>
              </div>

              {/* Instructions */}
              {(result as any).instructions && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Migrations-Schritte</p>
                  <ol className="space-y-1.5">
                    {(result as any).instructions.map((step: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0 mt-0.5">{i + 1}</span>
                        {step.replace(/^\d+\.\s*/, '')}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* SQL */}
              {result.search_replace_sql && (
                <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
                  <button onClick={() => setSqlExpanded(x => !x)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-white/[0.03] text-sm font-medium text-gray-700 dark:text-gray-200">
                    <div className="flex items-center gap-2"><Terminal className="w-3.5 h-3.5 text-gray-400" />Search & Replace SQL</div>
                    {sqlExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {sqlExpanded && (
                    <pre className="p-3 text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-950/5 dark:bg-black/20 overflow-x-auto whitespace-pre-wrap break-all">
                      {result.search_replace_sql}
                    </pre>
                  )}
                </div>
              )}

              {/* wp-config */}
              {result.wp_config_changes && (
                <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
                  <button onClick={() => setConfigExpanded(x => !x)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-white/[0.03] text-sm font-medium text-gray-700 dark:text-gray-200">
                    <div className="flex items-center gap-2"><Terminal className="w-3.5 h-3.5 text-gray-400" />wp-config.php Anpassungen</div>
                    {configExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {configExpanded && (
                    <pre className="p-3 text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-950/5 dark:bg-black/20 overflow-x-auto whitespace-pre-wrap break-all">
                      {result.wp_config_changes}
                    </pre>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 p-5 border-t border-gray-100 dark:border-white/[0.06]">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
            {result ? 'Schließen' : 'Abbrechen'}
          </button>
          {!result && (
            <button onClick={run} disabled={loading}
              className="flex-1 px-4 py-2 text-sm rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Package erstellen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StagingPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;
  const qc = useQueryClient();

  const [syncModal, setSyncModal] = useState<'push' | 'pull' | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [creatingStaging, setCreatingStaging] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [createError, setCreateError] = useState('');

  // Site info
  const { data: siteData } = useQuery({
    queryKey: ['site', siteId],
    queryFn: () => sitesApi.getSite(siteId),
  });
  const site = siteData?.data;

  // Staging environments
  const { data: stagingData, refetch } = useQuery({
    queryKey: ['staging', siteId],
    queryFn: () => stagingApi.list(siteId),
    refetchInterval: (data) => {
      const envs: StagingEnv[] = data?.data?.data || [];
      const hasRunning = envs.some(e =>
        e.status !== 'active' && e.status !== 'failed' && e.status !== 'deleted'
      );
      return hasRunning ? 3000 : false;
    },
  });

  const envs: StagingEnv[] = stagingData?.data?.data || stagingData?.data || [];
  const activeStaging = envs.find(e => e.status !== 'deleted') || null;
  const isCreating = activeStaging && activeStaging.status !== 'active' && activeStaging.status !== 'failed';

  async function createStaging() {
    setCreatingStaging(true);
    setCreateError('');
    const r = await stagingApi.create(siteId);
    setCreatingStaging(false);
    if (r.success) {
      refetch();
    } else {
      setCreateError(r.error || 'Fehler beim Erstellen');
    }
  }

  async function deleteStaging(stagingId: number) {
    await stagingApi.remove(stagingId);
    setDeleteConfirm(null);
    refetch();
  }

  const domain = site?.domain || site?.siteName || siteId;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-400 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Staging</h1>
            <p className="text-sm text-gray-400">{domain}</p>
          </div>
        </div>

        {/* Staging Environment Card */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <GitBranch className="w-4 h-4 text-blue-500" />
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Staging-Umgebung</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1">Teste Änderungen sicher, bevor sie live gehen.</p>
          </div>

          {!activeStaging ? (
            <div className="p-8 text-center">
              <GitBranch className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Noch keine Staging-Umgebung vorhanden</p>
              <button onClick={createStaging} disabled={creatingStaging}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors">
                {creatingStaging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
                Staging erstellen
              </button>
              {createError && <p className="text-sm text-red-600 mt-2">{createError}</p>}
            </div>
          ) : (
            <div className="p-5">
              {/* Status row */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={activeStaging.status} />
                    {isCreating && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                  </div>
                  <a href={activeStaging.staging_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm font-mono text-blue-500 hover:underline mt-1">
                    {activeStaging.staging_domain}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {activeStaging.progress_message && (
                    <p className="text-xs text-gray-400 mt-1">{activeStaging.progress_message}</p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-400 space-y-0.5">
                  <p>Erstellt: {new Date(activeStaging.created_at).toLocaleDateString('de-DE')}</p>
                  {activeStaging.last_synced_at && (
                    <p>Letzter Sync: {new Date(activeStaging.last_synced_at).toLocaleDateString('de-DE')}</p>
                  )}
                </div>
              </div>

              {/* Push / Pull buttons */}
              {activeStaging.status === 'active' && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button onClick={() => setSyncModal('push')}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                    <ArrowUpFromLine className="w-3.5 h-3.5" />
                    Staging → Live
                  </button>
                  <button onClick={() => setSyncModal('pull')}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors">
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    Live → Staging
                  </button>
                </div>
              )}

              {/* Delete */}
              <div className="flex justify-end">
                {deleteConfirm === activeStaging.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Wirklich löschen?</span>
                    <button onClick={() => deleteStaging(activeStaging.id)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700">
                      Löschen
                    </button>
                    <button onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06]">
                      Abbrechen
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(activeStaging.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3 h-3" />
                    Staging löschen
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Clone & Migration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Clone */}
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                <Copy className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Site klonen</p>
                <p className="text-xs text-gray-400">Auf neue Domain kopieren</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
              Erstellt eine vollständige Kopie dieser Site auf einer anderen Domain — inklusive Datenbank und Dateien.
            </p>
            <button onClick={() => setCloneOpen(true)}
              className="w-full px-4 py-2 rounded-xl text-sm font-semibold border border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/5 transition-colors">
              Klonen…
            </button>
          </div>

          {/* Migration */}
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-500/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Migration Package</p>
                <p className="text-xs text-gray-400">Zu neuem Hosting umziehen</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
              Erstellt ein vollständiges Backup + SQL Search-Replace-Queries + wp-config Anpassungen für den Umzug.
            </p>
            <button onClick={() => setMigrateOpen(true)}
              className="w-full px-4 py-2 rounded-xl text-sm font-semibold border border-green-200 dark:border-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/5 transition-colors">
              Migration starten…
            </button>
          </div>
        </div>

        {/* Info box */}
        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <p className="font-semibold">Hinweis zur Staging-Umgebung</p>
              <p>Die Staging-Funktion erstellt eine Kopie deiner Site und simuliert den Prozess. Die tatsächliche Bereitstellung auf einem Server erfordert eine separate Hosting-Infrastruktur (z. B. Subdomain auf deinem Server).</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {syncModal && activeStaging && (
        <SyncModal
          direction={syncModal}
          stagingId={activeStaging.id}
          stagingDomain={activeStaging.staging_domain}
          liveDomain={activeStaging.source_domain}
          onClose={() => setSyncModal(null)}
          onDone={() => { setSyncModal(null); refetch(); }}
        />
      )}
      {cloneOpen && (
        <CloneModal
          siteId={siteId}
          sourceDomain={domain}
          onClose={() => setCloneOpen(false)}
          onDone={() => setCloneOpen(false)}
        />
      )}
      {migrateOpen && (
        <MigrationModal
          siteId={siteId}
          sourceDomain={domain}
          onClose={() => setMigrateOpen(false)}
        />
      )}
    </div>
  );
}
