'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Zap, Monitor, Smartphone, Play, Loader2,
  AlertTriangle, ExternalLink,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { lighthouseApi, sitesApi, uptimeApi } from '../../../../lib/api';
import { toast } from 'react-hot-toast';

// ─── Score Gauge ──────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 90) return { text: 'text-emerald-600 dark:text-emerald-400', ring: '#10b981' };
  if (s >= 50) return { text: 'text-orange-500', ring: '#f97316' };
  return { text: 'text-red-500', ring: '#ef4444' };
}

function ScoreGauge({ score, label, icon }: { score: number; label: string; icon: React.ReactNode }) {
  const { text, ring } = scoreColor(score);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
          <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth="8" />
          <circle cx="44" cy="44" r={r} fill="none" stroke={ring} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${text}`}>{score}</span>
        </div>
      </div>
      <div className={`flex items-center gap-1.5 text-xs font-medium ${text}`}>{icon}{label}</div>
    </div>
  );
}

// ─── CWV Metric ───────────────────────────────────────────────────────────────

function CwvMetric({ label, value, unit, good, needs, desc }: {
  label: string; value: number | null; unit: string; good: number; needs: number; desc: string;
}) {
  if (!value) return (
    <div className="rounded-lg border border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] p-3">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-300 dark:text-gray-600 mt-1">—</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
    </div>
  );

  const isGood = value <= good;
  const isNeeds = value <= needs;
  const c = isGood ? { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500' }
    : isNeeds ? { text: 'text-orange-500', bg: 'bg-orange-500' }
    : { text: 'text-red-500', bg: 'bg-red-500' };
  const displayVal = value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}${unit}`;

  return (
    <div className="rounded-lg border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{label}</p>
        <span className={`w-2 h-2 rounded-full ${c.bg}`} />
      </div>
      <p className={`text-xl font-bold ${c.text}`}>{displayVal}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
      <div className="mt-2 h-1 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full ${c.bg}`}
          style={{ width: `${Math.min(100, (value / (needs * 1.5)) * 100)}%` }} />
      </div>
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#111118] px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const siteId = params?.id as string;
  const [tab, setTab] = useState<'mobile' | 'desktop'>('mobile');

  const { data: siteData } = useQuery({
    queryKey: ['site', siteId],
    queryFn: async () => { const r = await sitesApi.getSite(siteId); return r.success ? r.data : null; },
  });

  const { data: perfData, isLoading } = useQuery({
    queryKey: ['lighthouse', siteId],
    queryFn: async () => { const r = await lighthouseApi.get(siteId); return r.success ? r.data : null; },
  });

  const runMutation = useMutation({
    mutationFn: () => lighthouseApi.run(siteId),
    onSuccess: (r) => {
      if (r.success) {
        toast.success('Lighthouse-Test abgeschlossen');
        qc.invalidateQueries({ queryKey: ['lighthouse', siteId] });
      } else {
        toast.error(r.error || 'Test fehlgeschlagen');
      }
    },
    onError: (e: any) => toast.error(e?.message || 'Test fehlgeschlagen'),
  });

  const latest = perfData?.latest;
  const raw = latest?.raw_data
    ? (typeof latest.raw_data === 'string' ? JSON.parse(latest.raw_data) : latest.raw_data)
    : null;

  const mobileScore  = latest?.mobile_score  ?? raw?.mobile?.score  ?? null;
  const desktopScore = latest?.desktop_score ?? raw?.desktop?.score ?? null;
  const cwv = {
    lcp:  parseFloat(latest?.lcp  ?? raw?.mobile?.lcp  ?? 0) || null,
    cls:  parseFloat(latest?.cls  ?? raw?.mobile?.cls  ?? 0) || null,
    fid:  parseFloat(latest?.fid  ?? raw?.mobile?.fid  ?? 0) || null,
    fcp:  parseFloat(latest?.fcp  ?? raw?.mobile?.fcp  ?? 0) || null,
    ttfb: parseFloat(latest?.ttfb ?? raw?.mobile?.ttfb ?? 0) || null,
  };
  const opportunities: any[] = (tab === 'mobile' ? raw?.mobile?.opportunities : raw?.desktop?.opportunities) || [];

  const chartData = (perfData?.history || []).map((h: any) => ({
    date: new Date(h.measured_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    Mobile: h.mobile_score,
    Desktop: h.desktop_score,
  }));

  const { data: uptimeHistData } = useQuery({
    queryKey: ['uptime-history', siteId],
    queryFn: () => uptimeApi.getHistory(siteId, 200),
    enabled: !!siteId,
  });
  const responseData = ((uptimeHistData?.data || []) as any[])
    .filter((u: any) => u.response_time_ms && u.status === 'up')
    .slice(-60)
    .map((u: any) => ({
      time: new Date(u.checked_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      ms: u.response_time_ms,
    }));
  const avgResponse = responseData.length
    ? Math.round(responseData.reduce((s: number, r: any) => s + r.ms, 0) / responseData.length)
    : null;
  const maxResponse = responseData.length ? Math.max(...responseData.map((r: any) => r.ms)) : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] pt-20 pb-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" /> Performance · Lighthouse
            </h1>
            {siteData && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-sm text-gray-500">{siteData.domain}</p>
                <a href={siteData.siteUrl || `https://${siteData.domain}`} target="_blank" rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
          <button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-400 disabled:opacity-60 transition-colors">
            {runMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Läuft...</>
              : <><Play className="w-4 h-4" /> Lighthouse</>}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : !latest ? (
          <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-10 text-center">
            <Zap className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">Noch kein Test</h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">
              Starte deinen ersten Lighthouse-Test für Performance-Score, Core Web Vitals und Optimierungsvorschläge.
            </p>
            <button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-400 disabled:opacity-60 transition-colors">
              {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {runMutation.isPending ? 'Analysiere (~30s)...' : 'Test starten'}
            </button>
          </div>
        ) : (
          <>
            {/* Scores */}
            <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Lighthouse Score</h3>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-gray-400">
                    {new Date(latest.measured_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-emerald-500 font-medium">● ≥90</span>
                  <span className="text-orange-500 font-medium">● 50–89</span>
                  <span className="text-red-500 font-medium">● &lt;50</span>
                </div>
              </div>
              <div className="flex justify-center gap-16">
                {mobileScore !== null && <ScoreGauge score={mobileScore} label="Mobile" icon={<Smartphone className="w-3.5 h-3.5" />} />}
                {desktopScore !== null && <ScoreGauge score={desktopScore} label="Desktop" icon={<Monitor className="w-3.5 h-3.5" />} />}
              </div>
            </div>

            {/* Core Web Vitals */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Core Web Vitals</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <CwvMetric label="LCP" value={cwv.lcp} unit="ms" good={2500} needs={4000} desc="Largest Contentful Paint" />
                <CwvMetric label="CLS" value={cwv.cls !== null ? cwv.cls * 1000 : null} unit="" good={100} needs={250} desc="Cumulative Layout Shift" />
                <CwvMetric label="TBT" value={cwv.fid} unit="ms" good={200} needs={600} desc="Total Blocking Time" />
                <CwvMetric label="FCP" value={cwv.fcp} unit="ms" good={1800} needs={3000} desc="First Contentful Paint" />
                <CwvMetric label="TTFB" value={cwv.ttfb} unit="ms" good={800} needs={1800} desc="Time To First Byte" />
              </div>
            </div>

            {/* Opportunities */}
            {opportunities.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Optimierungspotenzial</h3>
                  <div className="flex rounded-lg border border-gray-200 dark:border-white/[0.08] overflow-hidden ml-2">
                    {(['mobile', 'desktop'] as const).map(t => (
                      <button key={t} onClick={() => setTab(t)}
                        className={`p-1.5 transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-white dark:bg-white/[0.02] text-gray-500 hover:bg-gray-50 dark:hover:bg-white/[0.04]'}`}>
                        {t === 'mobile' ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {opportunities.map((o: any, i: number) => (
                    <div key={i} className="rounded-xl border border-orange-100 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-500/5 px-4 py-3 flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <p className="text-sm text-orange-800 dark:text-orange-300 flex-1">{o.title}</p>
                      {o.savings > 0 && (
                        <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 flex-shrink-0">
                          -{(o.savings / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            {chartData.length > 1 && (
              <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Score-Verlauf (30 Tage)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Mobile" stroke="#f97316" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Desktop" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* Response Time Tracking */}
        {responseData.length > 1 && (
          <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Response-Zeit-Verlauf</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {avgResponse !== null && (
                  <span>Ø <span className="font-semibold text-blue-500">{avgResponse}ms</span></span>
                )}
                {maxResponse !== null && (
                  <span>Max <span className="font-semibold text-orange-500">{maxResponse}ms</span></span>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={responseData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rtGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }} axisLine={false} tickLine={false} width={36} tickFormatter={(v: number) => `${v}ms`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="ms" name="Response (ms)" stroke="#3b82f6" strokeWidth={2} fill="url(#rtGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
