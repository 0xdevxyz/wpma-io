'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Bot, Play, X, RefreshCw, CheckCircle, AlertTriangle, ChevronRight,
  Sparkles, Scan, Shield, Activity, Package, Zap, TrendingUp, Clock,
} from 'lucide-react';
import { agentApi, sitesApi } from '../../lib/api';
import { toast } from 'react-hot-toast';

const SEV_STYLE: Record<string, { cls: string; dot: string; glow: string }> = {
  critical: { cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',       dot: 'bg-red-500',    glow: 'shadow-red-500/20' },
  high:     { cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400', dot: 'bg-orange-500', glow: 'shadow-orange-500/20' },
  medium:   { cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400', dot: 'bg-yellow-500', glow: 'shadow-yellow-500/10' },
  low:      { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',   dot: 'bg-blue-400',   glow: '' },
};

const STATUS_LABEL: Record<string, string> = {
  detected: 'Erkannt', analyzing: 'Analysiert…', action_planned: 'Plan bereit',
  awaiting_approval: 'Wartet auf Freigabe', executing: 'Führt aus…',
  done: 'Erledigt', failed: 'Fehler', rejected: 'Abgelehnt',
};

const CAT_ICON: Record<string, React.FC<{ className?: string }>> = {
  security: Shield, performance: Activity, plugin: Package,
  uptime: TrendingUp, core: Zap, woocommerce: TrendingUp,
};

export function AgentLivePanel() {
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

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const r = await sitesApi.getSites();
      return r.success ? r.data || [] : [];
    },
    staleTime: 60000,
  });

  const stats = (statsData as any)?.data || {};
  const allTasks: any[] = (tasksData as any)?.data || [];
  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || (sitesData as any)?.sites || [];
  const connectedSites = sites.filter(s => s.isConnected);

  const pendingTasks = allTasks.filter(t => t.status === 'awaiting_approval');
  const activeTasks = allTasks.filter(t => ['analyzing', 'executing', 'action_planned'].includes(t.status));
  const recentDone = allTasks.filter(t => t.status === 'done').slice(0, 3);

  const pendingCount = stats.pending_approval ?? pendingTasks.length;
  const runningCount = stats.running ?? activeTasks.length;
  const isActive = runningCount > 0 || pendingCount > 0;
  const hasApprovals = pendingCount > 0;

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-tasks'] });
      qc.invalidateQueries({ queryKey: ['agent-stats'] });
    },
  });

  return (
    <div className={`mb-4 rounded-xl overflow-hidden border transition-all duration-300
      ${hasApprovals
        ? 'border-amber-300/60 dark:border-amber-500/30 shadow-lg shadow-amber-500/5'
        : isActive
        ? 'border-blue-300/50 dark:border-blue-500/20'
        : 'border-gray-200 dark:border-white/[0.07]'}
      bg-white dark:bg-white/[0.03]`}>

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b
        ${hasApprovals
          ? 'border-amber-100 dark:border-amber-500/15 bg-amber-50/50 dark:bg-amber-500/5'
          : 'border-gray-100 dark:border-white/[0.06]'}`}>
        <div className="flex items-center gap-3">
          {/* Animated Bot Icon */}
          <div className={`relative w-8 h-8 rounded-xl flex items-center justify-center
            ${hasApprovals ? 'bg-amber-100 dark:bg-amber-500/15' : isActive ? 'bg-blue-100 dark:bg-blue-500/15' : 'bg-gray-100 dark:bg-white/[0.06]'}`}>
            <Bot className={`w-4 h-4 ${hasApprovals ? 'text-amber-600 dark:text-amber-400' : isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-[#0d0d14]">
                <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Autonomer Agent</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                ${isActive
                  ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {runningCount > 0 ? `${runningCount} laufen` : isActive ? 'Aktiv' : 'Bereit'}
              </span>
              {hasApprovals && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {pendingCount} braucht Freigabe
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-0.5">
              Überwacht {connectedSites.length} Site{connectedSites.length !== 1 ? 's' : ''} · alle 6h automatisch
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push('/dashboard/agent')}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Mission Control <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pending Approvals — prominent */}
      {pendingTasks.length > 0 && (
        <div className="divide-y divide-amber-50 dark:divide-amber-500/10">
          {pendingTasks.slice(0, 3).map(task => {
            const sev = SEV_STYLE[task.severity] || SEV_STYLE.medium;
            const CatIcon = CAT_ICON[task.category] || Sparkles;
            return (
              <div key={task.id}
                className="flex items-center gap-3 px-4 py-3 bg-amber-50/60 dark:bg-amber-500/5 hover:bg-amber-50 dark:hover:bg-amber-500/8 transition-colors">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${sev.cls}`}>
                      {task.severity}
                    </span>
                    <CatIcon className="w-3 h-3 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">{task.title}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate">
                    {task.domain || task.site_name}
                    {task.ai_analysis?.root_cause && ` · ${task.ai_analysis.root_cause}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => rejectMutation.mutate(task.id)}
                    title="Ablehnen"
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(task.id)}
                    disabled={approvingId === task.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-blue-600/20"
                  >
                    {approvingId === task.id
                      ? <RefreshCw className="w-3 h-3 animate-spin" />
                      : <Play className="w-3 h-3" />}
                    Ausführen
                  </button>
                </div>
              </div>
            );
          })}
          {pendingTasks.length > 3 && (
            <button
              onClick={() => router.push('/dashboard/agent')}
              className="w-full px-4 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-500/5 hover:bg-amber-100 dark:hover:bg-amber-500/10 transition-colors text-center"
            >
              +{pendingTasks.length - 3} weitere Freigaben erforderlich →
            </button>
          )}
        </div>
      )}

      {/* Active tasks */}
      {activeTasks.length > 0 && pendingTasks.length === 0 && (
        <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
          {activeTasks.slice(0, 2).map(task => {
            const CatIcon = CAT_ICON[task.category] || Sparkles;
            return (
              <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <CatIcon className="w-3 h-3 text-gray-400" />
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{task.title}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{task.domain || task.site_name} · {STATUS_LABEL[task.status]}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Idle / No activity */}
      {!hasApprovals && activeTasks.length === 0 && (
        <div className="px-4 py-3">
          {recentDone.length > 0 ? (
            <div className="space-y-1.5">
              {recentDone.map(task => (
                <div key={task.id} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {task.domain || task.site_name}: {task.title}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">erledigt</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-violet-500/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-500" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Der Agent überwacht alle Sites im Hintergrund. Probleme werden automatisch erkannt und gemeldet.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
