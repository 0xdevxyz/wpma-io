'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gauge, Zap, Clock, TrendingUp, ChevronDown, Play } from 'lucide-react';
import { sitesApi, performanceApi, lighthouseApi } from '../../../lib/api';
import { toast } from 'react-hot-toast';

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-300 dark:text-gray-600 text-sm">—</span>;
  const color = score >= 90 ? 'text-green-600 dark:text-green-400' : score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  return <span className={`text-sm font-bold ${color}`}>{score}</span>;
}

function SitePerformanceRow({ site }: { site: any }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: metricsData } = useQuery({
    queryKey: ['performance', site.id],
    queryFn: () => performanceApi.getMetrics(String(site.id)),
    staleTime: 120000,
    enabled: expanded,
  });
  const metrics = (metricsData as any)?.data;

  const analyzeMut = useMutation({
    mutationFn: () => performanceApi.analyze(String(site.id)),
    onSuccess: () => {
      toast.success(`Analyse für ${site.name} gestartet`);
      qc.invalidateQueries({ queryKey: ['performance', site.id] });
    },
    onError: () => toast.error('Analyse fehlgeschlagen'),
  });

  const lighthouseMut = useMutation({
    mutationFn: () => lighthouseApi.run(String(site.id)),
    onSuccess: () => {
      toast.success('Lighthouse-Analyse gestartet');
      qc.invalidateQueries({ queryKey: ['performance', site.id] });
    },
    onError: () => toast.error('Lighthouse fehlgeschlagen'),
  });

  const score = site.performance_score ?? 0;
  const scoreColor = score >= 80 ? 'text-green-600 dark:text-green-400' : score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="border-b border-gray-100 dark:border-white/[0.04] last:border-0">
      <div
        className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{site.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{site.url}</p>
        </div>
        <div className={`text-lg font-bold ${scoreColor} w-12 text-right`}>{score}</div>
        <div className="flex gap-2 ml-2">
          <button
            onClick={e => { e.stopPropagation(); analyzeMut.mutate(); }}
            disabled={analyzeMut.isPending}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg
              bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300
              hover:bg-gray-200 dark:hover:bg-white/20 disabled:opacity-50"
          >
            <Zap className={`w-3 h-3 ${analyzeMut.isPending ? 'animate-spin' : ''}`} />
            Analyse
          </button>
          <button
            onClick={e => { e.stopPropagation(); lighthouseMut.mutate(); }}
            disabled={lighthouseMut.isPending}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg
              bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400
              hover:bg-blue-100 dark:hover:bg-blue-500/20 disabled:opacity-50"
          >
            <Play className={`w-3 h-3 ${lighthouseMut.isPending ? 'animate-spin' : ''}`} />
            Lighthouse
          </button>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>
      {expanded && metrics && (
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Ladezeit', value: metrics.pageLoadTime ? `${metrics.pageLoadTime}s` : '—' },
            { label: 'LCP', value: metrics.coreWebVitals?.lcp ? `${metrics.coreWebVitals.lcp}ms` : '—' },
            { label: 'CLS', value: metrics.coreWebVitals?.cls ?? '—' },
            { label: 'FCP', value: metrics.coreWebVitals?.fcp ? `${metrics.coreWebVitals.fcp}ms` : '—' },
          ].map(m => (
            <div key={m.label} className="bg-gray-50 dark:bg-white/[0.03] rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">{m.label}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PerformancePage() {
  const { data: sitesData, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.getSites,
  });
  const sites: any[] = (sitesData as any)?.data || (sitesData as any)?.sites || [];

  const avgScore = sites.length
    ? Math.round(sites.reduce((a, s) => a + (s.performance_score || 0), 0) / sites.length)
    : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ladezeiten, Core Web Vitals und Lighthouse-Analysen</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <Gauge className="w-5 h-5 mb-2 text-blue-600 dark:text-blue-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{avgScore}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ø Performance-Score</div>
        </div>
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <TrendingUp className="w-5 h-5 mb-2 text-green-600 dark:text-green-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {sites.filter(s => (s.performance_score || 0) >= 80).length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Gut (≥80)</div>
        </div>
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <Clock className="w-5 h-5 mb-2 text-amber-600 dark:text-amber-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {sites.filter(s => (s.performance_score || 0) > 0 && (s.performance_score || 0) < 80).length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Verbesserungsbedarf</div>
        </div>
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <Zap className="w-5 h-5 mb-2 text-violet-600 dark:text-violet-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{sites.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sites total</div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Performance-Übersicht</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">Score</span>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">Lädt…</div>
        ) : sites.length === 0 ? (
          <div className="py-12 text-center">
            <Gauge className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Keine Sites vorhanden</p>
          </div>
        ) : (
          sites
            .sort((a, b) => (a.performance_score || 0) - (b.performance_score || 0))
            .map(site => <SitePerformanceRow key={site.id} site={site} />)
        )}
      </div>
    </div>
  );
}
