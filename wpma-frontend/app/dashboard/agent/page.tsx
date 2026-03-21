'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, CheckCircle, XCircle, Clock, AlertTriangle, Zap,
  Play, X, ChevronDown, ChevronRight, RefreshCw, Settings,
  Shield, Activity, Package, TrendingUp, Sparkles, Scan, Info,
  Globe, ArrowLeft,
} from 'lucide-react';
import { agentApi, sitesApi } from '../../../lib/api';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface AgentTask {
  id: number;
  site_id: number;
  domain: string;
  site_name: string;
  status: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  ai_analysis: { root_cause?: string; impact?: string; risk_if_ignored?: string; confidence?: number };
  action_plan: ActionStep[];
  actions: ActionStep[];
  execution_log: { step: number; label: string; status: string; error?: string }[];
  requires_approval: boolean;
  created_at: string;
  completed_at?: string;
}

interface ActionStep {
  step: number;
  action_type: string;
  label: string;
  details: string;
  risk: string;
  requires_approval: boolean;
}

interface AgentSettings {
  auto_approve_low: boolean;
  auto_approve_medium: boolean;
  auto_approve_high: boolean;
  auto_approve_critical: boolean;
  enabled: boolean;
}

const SEV: Record<string, { label: string; cls: string; dot: string; border: string; bg: string }> = {
  critical: { label: 'Kritisch', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',         dot: 'bg-red-500',    border: 'border-red-200 dark:border-red-500/30',   bg: 'bg-red-50/50 dark:bg-red-500/5' },
  high:     { label: 'Hoch',     cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400', dot: 'bg-orange-500', border: 'border-orange-200 dark:border-orange-500/30', bg: 'bg-orange-50/50 dark:bg-orange-500/5' },
  medium:   { label: 'Mittel',   cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400', dot: 'bg-yellow-500', border: 'border-yellow-200 dark:border-yellow-500/20', bg: 'bg-yellow-50/30 dark:bg-yellow-500/3' },
  low:      { label: 'Niedrig',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',     dot: 'bg-blue-400',   border: 'border-gray-200 dark:border-white/[0.07]',  bg: '' },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.FC<{ className?: string }>; color: string }> = {
  detected:          { label: 'Erkannt',           icon: Clock,       color: 'text-gray-400' },
  analyzing:         { label: 'KI analysiert…',    icon: Sparkles,    color: 'text-violet-500' },
  action_planned:    { label: 'Plan bereit',        icon: CheckCircle, color: 'text-indigo-500' },
  awaiting_approval: { label: 'Freigabe nötig',    icon: AlertTriangle, color: 'text-amber-500' },
  executing:         { label: 'Führt aus…',         icon: Zap,         color: 'text-blue-500' },
  done:              { label: 'Erledigt',           icon: CheckCircle, color: 'text-green-500' },
  failed:            { label: 'Fehler',             icon: XCircle,     color: 'text-red-500' },
  rejected:          { label: 'Abgelehnt',          icon: X,           color: 'text-gray-400' },
};

const CAT_ICON: Record<string, React.FC<{ className?: string }>> = {
  performance: Activity, security: Shield, plugin: Package,
  uptime: TrendingUp, woocommerce: TrendingUp, core: Zap,
};

// ─── TASK CARD ────────────────────────────────────────────────────────────────
function TaskCard({ task, onApprove, onReject, approving, highlight }: {
  task: AgentTask;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  approving: boolean;
  highlight?: boolean;
}) {
  const [expanded, setExpanded] = useState(highlight || false);
  const sev = SEV[task.severity] || SEV.medium;
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.detected;
  const StatusIcon = status.icon;
  const CatIcon = CAT_ICON[task.category] || Sparkles;
  const plan = task.action_plan || task.actions || [];
  const isPending = task.status === 'awaiting_approval';
  const isRunning = task.status === 'analyzing' || task.status === 'executing';
  const isDone = task.status === 'done';

  return (
    <div className={`rounded-xl border transition-all duration-200 overflow-hidden
      ${isPending ? `${sev.border} shadow-md` : isDone ? 'border-gray-100 dark:border-white/[0.05] opacity-80' : 'border-gray-200 dark:border-white/[0.07]'}
      bg-white dark:bg-white/[0.03]`}>

      {/* Main row */}
      <div className={`flex items-start gap-3 p-4 ${isPending ? sev.bg : ''}`}>
        {/* Status icon */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5
          ${isPending ? 'bg-amber-100 dark:bg-amber-500/15' : isDone ? 'bg-green-100 dark:bg-green-500/15' : 'bg-gray-100 dark:bg-white/[0.06]'}`}>
          <StatusIcon className={`w-4 h-4 ${status.color} ${isRunning ? 'animate-pulse' : ''}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sev.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
              {sev.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-full">
              <CatIcon className="w-2.5 h-2.5" />
              {task.category}
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Globe className="w-2.5 h-2.5" />
              {task.domain || task.site_name}
            </span>
          </div>

          {/* Title */}
          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{task.title}</p>

          {/* Root cause preview */}
          {task.ai_analysis?.root_cause && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{task.ai_analysis.root_cause}</p>
          )}

          {/* Status line */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`text-[11px] font-medium ${status.color}`}>{status.label}</span>
            {task.created_at && (
              <span className="text-[11px] text-gray-400">
                · {new Date(task.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {isDone && task.execution_log?.length > 0 && (
              <span className="text-[11px] text-green-600 dark:text-green-400">
                · {task.execution_log.filter(l => l.status === 'done').map(l => l.label).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isPending && (
            <>
              <button onClick={() => onReject(task.id)}
                className="p-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors"
                title="Ablehnen">
                <X className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onApprove(task.id)} disabled={approving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-blue-600/20">
                {approving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Ausführen
              </button>
            </>
          )}
          <button onClick={() => setExpanded(v => !v)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors text-gray-400">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? '' : '-rotate-90'}`} />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-white/[0.06] p-4 space-y-4 bg-gray-50/50 dark:bg-white/[0.01]">

          {/* KI-Analyse */}
          {task.ai_analysis && (task.ai_analysis.impact || task.ai_analysis.risk_if_ignored) && (
            <div className="rounded-xl bg-violet-50 dark:bg-violet-500/5 border border-violet-100 dark:border-violet-500/15 p-3.5">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">KI-Analyse</span>
                {task.ai_analysis.confidence != null && (
                  <span className="ml-auto text-[10px] text-violet-500 bg-violet-100 dark:bg-violet-500/15 px-2 py-0.5 rounded-full font-medium">
                    {Math.round(task.ai_analysis.confidence * 100)}% Konfidenz
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {task.ai_analysis.impact && (
                  <p className="text-xs text-violet-800 dark:text-violet-300">
                    <span className="font-semibold">Impact:</span> {task.ai_analysis.impact}
                  </p>
                )}
                {task.ai_analysis.risk_if_ignored && (
                  <p className="text-xs text-violet-700 dark:text-violet-400">
                    <span className="font-semibold">Risiko wenn ignoriert:</span> {task.ai_analysis.risk_if_ignored}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Aktionsplan als Timeline */}
          {plan.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">Aktionsplan</p>
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-white/[0.06]" />
                <div className="space-y-3">
                  {plan.map((step, i) => {
                    const execStep = task.execution_log?.find(l => l.step === step.step);
                    const isDoneStep = execStep?.status === 'done';
                    const isFailedStep = execStep?.status === 'failed';
                    const isActiveStep = task.status === 'executing' && !isDoneStep && !isFailedStep && i === (task.execution_log?.filter(l => l.status === 'done').length || 0);
                    return (
                      <div key={i} className="flex items-start gap-3 pl-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 z-10 border-2
                          ${isDoneStep ? 'bg-green-500 border-green-500 text-white'
                            : isFailedStep ? 'bg-red-500 border-red-500 text-white'
                            : isActiveStep ? 'bg-blue-500 border-blue-500 text-white animate-pulse'
                            : 'bg-white dark:bg-[#0d0d14] border-gray-200 dark:border-white/10 text-gray-500'}`}>
                          {isDoneStep ? '✓' : isFailedStep ? '✗' : step.step}
                        </div>
                        <div className="flex-1 pb-1">
                          <div className="flex items-center gap-2">
                            <p className={`text-xs font-semibold ${isDoneStep ? 'text-green-700 dark:text-green-400' : isFailedStep ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>
                              {step.label}
                            </p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                              ${step.risk === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                                : step.risk === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06]'}`}>
                              Risiko: {step.risk}
                            </span>
                          </div>
                          {step.details && <p className="text-[11px] text-gray-500 mt-0.5">{step.details}</p>}
                          {execStep?.error && (
                            <p className="text-[11px] text-red-500 mt-0.5 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> {execStep.error}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS PANEL ───────────────────────────────────────────────────────────
function SettingsPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['agent-settings'], queryFn: agentApi.getSettings });
  const settings: AgentSettings = (data as any)?.data || {};
  const [form, setForm] = useState<AgentSettings | null>(null);
  const current = form || settings;

  const save = useMutation({
    mutationFn: agentApi.saveSettings,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-settings'] }); toast.success('Einstellungen gespeichert'); onClose(); },
  });

  const toggle = (key: keyof AgentSettings) =>
    setForm(prev => ({ ...(prev || settings), [key]: !(prev || settings)[key] }));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111118] rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-white/[0.08]">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Agent-Einstellungen</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Enable/Disable */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Agent aktiviert</p>
              <p className="text-xs text-gray-500 mt-0.5">Automatisches Scannen aller verbundenen Sites</p>
            </div>
            <button type="button" onClick={() => toggle('enabled')}
              className={`relative w-11 h-6 rounded-full transition-colors ${current.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-white/20'}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${current.enabled ? 'translate-x-5' : ''}`} />
            </button>
          </label>

          <div className="border-t border-gray-100 dark:border-white/[0.06] pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Auto-Ausführung ohne Genehmigung</p>
            <p className="text-xs text-gray-400 mb-3">Der Agent führt Fixes bei diesen Schweregraden automatisch aus — ohne auf deine Freigabe zu warten.</p>
            {(['low', 'medium', 'high', 'critical'] as const).map(sev => {
              const s = SEV[sev];
              const key = `auto_approve_${sev}` as keyof AgentSettings;
              return (
                <label key={sev} className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-white/[0.04] cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                    <div>
                      <span className="text-sm text-gray-800 dark:text-gray-200">{s.label}</span>
                      {sev === 'critical' && <p className="text-[11px] text-orange-500">Vorsicht: Kritische Fixes automatisch ausführen</p>}
                    </div>
                  </div>
                  <button type="button" onClick={() => toggle(key)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${current[key] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-white/20'}`}>
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${current[key] ? 'translate-x-5' : ''}`} />
                  </button>
                </label>
              );
            })}
          </div>
        </div>

        <div className="p-5 flex gap-2 border-t border-gray-100 dark:border-white/[0.07]">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
            Abbrechen
          </button>
          <button onClick={() => save.mutate(current as AgentSettings)} disabled={save.isPending}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {save.isPending ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function AgentPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => { const r = await sitesApi.getSites(); return r.success ? (r.data || []) : []; },
    staleTime: 60000,
  });
  const sites: any[] = sitesData || [];
  const connectedSites = sites.filter(s => s.isConnected);

  const { data: statsData } = useQuery({
    queryKey: ['agent-stats'],
    queryFn: agentApi.getStats,
    refetchInterval: 10000,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['agent-settings'],
    queryFn: agentApi.getSettings,
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['agent-tasks', filter],
    queryFn: () => agentApi.getTasks(filter !== 'all' ? { status: filter } : undefined),
    refetchInterval: 8000,
  });

  const stats = (statsData as any)?.data || {};
  const agentEnabled = (settingsData as any)?.data?.enabled ?? true;
  const tasks: AgentTask[] = (tasksData as any)?.data || [];
  const pendingTasks = tasks.filter(t => t.status === 'awaiting_approval');

  async function handleScanAll() {
    if (connectedSites.length === 0) {
      toast.error('Keine verbundenen Sites');
      return;
    }
    setScanning(true);
    try {
      const r = await agentApi.scanAll();
      const d = (r as any)?.data;
      if ((r as any).success) {
        toast.success(`${d?.sites_scanned ?? 0} Sites gescannt · ${d?.total_issues ?? 0} Probleme gefunden`);
        qc.invalidateQueries({ queryKey: ['agent-tasks'] });
        qc.invalidateQueries({ queryKey: ['agent-stats'] });
      } else {
        toast.error((r as any).error || 'Scan fehlgeschlagen');
      }
    } catch { toast.error('Scan fehlgeschlagen'); }
    finally { setScanning(false); }
  }

  const approveMutation = useMutation({
    mutationFn: (id: number) => agentApi.approve(id),
    onMutate: id => setApprovingId(id),
    onSuccess: () => {
      toast.success('Aktion wird ausgeführt');
      qc.invalidateQueries({ queryKey: ['agent-tasks'] });
      qc.invalidateQueries({ queryKey: ['agent-stats'] });
    },
    onError: () => toast.error('Fehler'),
    onSettled: () => setApprovingId(null),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => agentApi.reject(id, reason),
    onSuccess: () => {
      toast.success('Abgelehnt');
      qc.invalidateQueries({ queryKey: ['agent-tasks'] });
    },
  });

  const FILTERS = [
    { value: 'all',               label: 'Alle',        count: null },
    { value: 'awaiting_approval', label: 'Freigabe',    count: stats.pending_approval || null },
    { value: 'executing',         label: 'Läuft',       count: stats.running || null },
    { value: 'done',              label: 'Erledigt',    count: stats.completed || null },
    { value: 'failed',            label: 'Fehler',      count: stats.failed || null },
  ];

  const isActive = (stats.running ?? 0) > 0 || (stats.pending_approval ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] pt-20 pb-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        {/* Back */}
        <button onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Zurück zum Dashboard
        </button>

        {/* ─── Hero Header ─── */}
        <div className="relative rounded-2xl overflow-hidden mb-6 border border-gray-200 dark:border-white/[0.07]
          bg-gradient-to-br from-blue-50 via-white to-violet-50
          dark:from-blue-500/5 dark:via-[#0d0d14] dark:to-violet-500/5">
          <div className="flex items-start justify-between p-6">
            <div className="flex items-center gap-4">
              {/* Animated Agent Avatar */}
              <div className="relative">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg
                  ${isActive
                    ? 'bg-blue-600 shadow-blue-600/30'
                    : 'bg-gradient-to-br from-blue-600 to-violet-600 shadow-violet-600/20'}`}>
                  <Bot className="w-7 h-7 text-white" />
                </div>
                <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-[#0d0d14]
                  ${agentEnabled ? 'bg-green-500' : 'bg-gray-400'}`}>
                  {agentEnabled && isActive && <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-60" />}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Autonomer KI-Agent</h1>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full
                    ${agentEnabled
                      ? isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>
                    {agentEnabled ? (isActive ? '⚡ Aktiv' : '● Bereit') : '○ Pausiert'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Überwacht <span className="font-semibold text-gray-700 dark:text-gray-300">{connectedSites.length}</span> von {sites.length} Sites
                  {' '}· scannt automatisch alle 6 Stunden
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleScanAll} disabled={scanning || connectedSites.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 shadow-sm shadow-blue-600/20">
                {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                {scanning ? 'Scannt…' : 'Jetzt scannen'}
              </button>
              <button onClick={() => setSettingsOpen(true)}
                className="p-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] hover:bg-white dark:hover:bg-white/[0.05] text-gray-500 transition-colors">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-5 divide-x divide-gray-200 dark:divide-white/[0.06] border-t border-gray-200 dark:border-white/[0.06]">
            {[
              { label: 'Freigabe nötig', value: stats.pending_approval ?? 0, color: (stats.pending_approval ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400', urgent: (stats.pending_approval ?? 0) > 0 },
              { label: 'Läuft',          value: stats.running ?? 0,           color: (stats.running ?? 0) > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400' },
              { label: 'Erledigt',       value: stats.completed ?? 0,         color: 'text-green-600 dark:text-green-400' },
              { label: 'Fehler',         value: stats.failed ?? 0,            color: (stats.failed ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400' },
              { label: 'Letzte 24h',     value: stats.last_24h ?? 0,          color: 'text-gray-600 dark:text-gray-400' },
            ].map(s => (
              <div key={s.label} className={`px-4 py-3 text-center ${s.urgent ? 'bg-amber-50/80 dark:bg-amber-500/5' : ''}`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── No connected sites warning ─── */}
        {connectedSites.length === 0 && (
          <div className="mb-5 p-4 rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/8 flex items-start gap-3">
            <Info className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Keine Sites verbunden</p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                Installiere das WPMA-Plugin auf mindestens einer WordPress-Site damit der Agent aktiv werden kann.
              </p>
            </div>
          </div>
        )}

        {/* ─── Pending Approvals — PROMINENT ─── */}
        {pendingTasks.length > 0 && filter === 'all' && (
          <div className="mb-5 rounded-xl border border-amber-300/60 dark:border-amber-500/30 overflow-hidden bg-amber-50/50 dark:bg-amber-500/5">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-amber-200/60 dark:border-amber-500/20">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  {pendingTasks.length} Aktion{pendingTasks.length !== 1 ? 'en' : ''} warten auf deine Freigabe
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500">Der Agent hat Probleme gefunden und einen Aktionsplan vorbereitet</p>
              </div>
            </div>
            <div className="p-3 space-y-2">
              {pendingTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onApprove={id => approveMutation.mutate(id)}
                  onReject={id => rejectMutation.mutate({ id, reason: 'Vom Nutzer abgelehnt' })}
                  approving={approvingId === task.id}
                  highlight
                />
              ))}
            </div>
          </div>
        )}

        {/* ─── How it works (only when idle / no tasks) ─── */}
        {tasks.length === 0 && !tasksLoading && (
          <div className="mb-5 rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">So arbeitet der Agent</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { step: '1', label: 'Erkennen',    desc: 'Scannt Health, Performance & Security aller Sites', icon: Scan,         color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-500/10' },
                { step: '2', label: 'Analysieren', desc: 'KI bewertet Ursache, Impact & Risiko',              icon: Sparkles,     color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10' },
                { step: '3', label: 'Planen',      desc: 'Erstellt konkreten Aktionsplan mit Risikocheck',    icon: CheckCircle,  color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                { step: '4', label: 'Ausführen',   desc: 'Automatisch oder nach deiner Freigabe',             icon: Zap,          color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-500/10' },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className={`rounded-xl p-3.5 ${s.bg}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${s.color}`} />
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{s.step}. {s.label}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{s.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Filter tabs ─── */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
                ${filter === f.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06]'}`}>
              {f.label}
              {f.count != null && f.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                  ${filter === f.value ? 'bg-white/20 text-white' : f.value === 'awaiting_approval' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-white/10'}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── Task List ─── */}
        {tasksLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-white/[0.03] animate-pulse" />)}
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-500/10 dark:to-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-base font-bold text-gray-800 dark:text-gray-200 mb-1">
              {filter === 'all' ? 'Alles in Ordnung' : 'Keine Tasks hier'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-600 mb-5 max-w-xs mx-auto">
              {filter === 'all' && connectedSites.length > 0
                ? 'Der Agent überwacht aktiv alle Sites. Klicke auf "Jetzt scannen" für einen sofortigen Check.'
                : filter === 'all'
                ? 'Verbinde deine erste Site damit der Agent aktiv werden kann.'
                : 'Keine Tasks in dieser Kategorie.'}
            </p>
            {filter === 'all' && connectedSites.length > 0 && (
              <button onClick={handleScanAll} disabled={scanning}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-sm shadow-blue-600/20 transition-colors disabled:opacity-50">
                {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                {scanning ? 'Scannt…' : 'Jetzt scannen'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Show non-pending tasks when filter is 'all' (pending already shown above) */}
            {tasks
              .filter(t => filter !== 'all' || t.status !== 'awaiting_approval')
              .map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onApprove={id => approveMutation.mutate(id)}
                  onReject={id => rejectMutation.mutate({ id, reason: 'Vom Nutzer abgelehnt' })}
                  approving={approvingId === task.id}
                />
              ))}
          </div>
        )}
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
