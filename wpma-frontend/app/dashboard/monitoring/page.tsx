'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw, Clock, TrendingUp } from 'lucide-react';
import { sitesApi, uptimeApi } from '../../../lib/api';
import { toast } from 'react-hot-toast';

function UptimeRow({ site }: { site: any }) {
  const qc = useQueryClient();
  const { data: uptimeData } = useQuery({
    queryKey: ['uptime', site.id],
    queryFn: () => uptimeApi.getStats(String(site.id), 24),
    staleTime: 60000,
  });
  const uptime = (uptimeData as any)?.data;

  const checkMut = useMutation({
    mutationFn: () => uptimeApi.checkNow(String(site.id)),
    onSuccess: () => {
      toast.success(`Check für ${site.name} gestartet`);
      qc.invalidateQueries({ queryKey: ['uptime', site.id] });
      qc.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: () => toast.error('Check fehlgeschlagen'),
  });

  const pct = uptime?.uptimePercentage ?? site.uptime_percentage ?? 100;
  const isUp = site.last_status !== 'down';
  const responseTime = uptime?.avgResponseTime ?? null;

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] border-b border-gray-100 dark:border-white/[0.04] last:border-0">
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isUp ? 'bg-green-500' : 'bg-red-500'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{site.name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{site.url}</p>
      </div>
      <div className="hidden sm:flex items-center gap-6 text-sm">
        <div className="text-center w-20">
          <span className={`font-semibold ${pct >= 99 ? 'text-green-600 dark:text-green-400' : pct >= 95 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
            {Number(pct).toFixed(2)}%
          </span>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Uptime</p>
        </div>
        <div className="text-center w-20">
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            {responseTime ? `${responseTime}ms` : '—'}
          </span>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Antwort</p>
        </div>
      </div>
      <button
        onClick={() => checkMut.mutate()}
        disabled={checkMut.isPending}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg
          bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300
          hover:bg-gray-200 dark:hover:bg-white/20 disabled:opacity-50 ml-2"
      >
        <RefreshCw className={`w-3 h-3 ${checkMut.isPending ? 'animate-spin' : ''}`} />
        Check
      </button>
    </div>
  );
}

export default function MonitoringPage() {
  const { data: sitesData, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.getSites,
    refetchInterval: 30000,
  });
  const sites: any[] = (sitesData as any)?.data || (sitesData as any)?.sites || [];

  const upCount = sites.filter(s => s.last_status !== 'down').length;
  const downCount = sites.filter(s => s.last_status === 'down').length;
  const avgUptime = sites.length
    ? (sites.reduce((a, s) => a + Number(s.uptime_percentage || 100), 0) / sites.length).toFixed(2)
    : '100.00';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monitoring</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Echtzeit-Uptime und Verfügbarkeit</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <Activity className="w-5 h-5 mb-2 text-blue-600 dark:text-blue-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{sites.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sites überwacht</div>
        </div>
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <CheckCircle className="w-5 h-5 mb-2 text-green-600 dark:text-green-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{upCount}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Online</div>
        </div>
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <XCircle className="w-5 h-5 mb-2 text-red-600 dark:text-red-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{downCount}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Offline</div>
        </div>
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <TrendingUp className="w-5 h-5 mb-2 text-emerald-600 dark:text-emerald-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{avgUptime}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ø Uptime</div>
        </div>
      </div>

      {/* Site table */}
      <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Status aller Sites</h2>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="hidden sm:inline">Uptime (24h)</span>
            <span className="hidden sm:inline">Antwortzeit</span>
            <span className="w-16"></span>
          </div>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">Lädt…</div>
        ) : sites.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Keine Sites vorhanden</p>
          </div>
        ) : (
          sites.map(site => <UptimeRow key={site.id} site={site} />)
        )}
      </div>
    </div>
  );
}
