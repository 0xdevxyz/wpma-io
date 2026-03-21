'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, TrendingUp, TrendingDown, ShoppingCart, Euro,
  Brain, AlertTriangle, CheckCircle, Loader2, ChevronDown, ChevronUp,
  Zap, Package,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { revenueApi, sitesApi } from '../../../../lib/api';
import { toast } from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = true) {
  if (currency) return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n);
}

function corrTypeLabel(t: string) {
  const map: Record<string, string> = {
    performance_drop: 'Performance-Einbruch',
    plugin_update:    'Plugin-Update',
    downtime:         'Ausfall',
    security_issue:   'Sicherheitsproblem',
    seasonal:         'Saisonaler Effekt',
    unknown:          'Unbekannt',
  };
  return map[t] || t;
}

function corrTypeColor(t: string) {
  if (t === 'downtime' || t === 'security_issue')
    return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-100 dark:border-red-500/20';
  if (t === 'performance_drop')
    return 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-orange-100 dark:border-orange-500/20';
  if (t === 'plugin_update')
    return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 border-yellow-100 dark:border-yellow-500/20';
  return 'bg-gray-50 text-gray-700 dark:bg-white/[0.03] dark:text-gray-300 border-gray-100 dark:border-white/[0.07]';
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, trend, positive }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; trend?: number; positive?: boolean;
}) {
  const trendUp = trend !== undefined && trend > 0;
  const trendDown = trend !== undefined && trend < 0;
  const good = positive ? trendUp : trendDown;
  const bad  = positive ? trendDown : trendUp;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2 text-xs font-medium">{icon}{label}</div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-0.5 mt-1 text-xs font-medium ${good ? 'text-emerald-600 dark:text-emerald-400' : bad ? 'text-red-500' : 'text-gray-400'}`}>
          {trendUp ? <TrendingUp className="w-3 h-3" /> : trendDown ? <TrendingDown className="w-3 h-3" /> : null}
          {trend > 0 ? '+' : ''}{trend.toFixed(1)}% ggü. Vorperiode
        </div>
      )}
    </div>
  );
}

// ─── Correlation Card ─────────────────────────────────────────────────────────

function CorrelationCard({ corr, siteId, onResolved }: { corr: any; siteId: string; onResolved: () => void; }) {
  const [expanded, setExpanded] = useState(false);
  const resolveMutation = useMutation({
    mutationFn: () => revenueApi.resolveCorrelation(siteId, corr.id, 'acknowledged'),
    onSuccess: () => { toast.success('Als gelöst markiert'); onResolved(); },
    onError: () => toast.error('Fehler'),
  });
  const isNeg = parseFloat(corr.revenue_delta_pct) < 0;
  const resolved = !!corr.resolved_at;

  return (
    <div className={`rounded-xl border overflow-hidden ${resolved ? 'opacity-60' : ''} ${corrTypeColor(corr.correlation_type)}`}>
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wide opacity-70">{corrTypeLabel(corr.correlation_type)}</span>
            <span className={`text-xs font-semibold ${isNeg ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {isNeg ? '' : '+'}{parseFloat(corr.revenue_delta_pct).toFixed(1)}%
            </span>
            {corr.revenue_loss_estimated > 0 && (
              <span className="text-xs text-red-500 font-medium">~{fmt(corr.revenue_loss_estimated)}/Monat</span>
            )}
            {resolved && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">Gelöst</span>}
          </div>
          <p className="text-xs font-medium mt-0.5 truncate">{corr.trigger_event}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 text-xs opacity-60">
          {new Date(corr.detected_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-current/10 px-4 py-3 space-y-3">
          {corr.ai_explanation && (
            <div>
              <p className="text-[10px] font-semibold uppercase opacity-60 mb-1">KI-Analyse</p>
              <p className="text-xs leading-relaxed">{corr.ai_explanation}</p>
            </div>
          )}
          {corr.ai_recommendation && (
            <div>
              <p className="text-[10px] font-semibold uppercase opacity-60 mb-1">Empfehlung</p>
              <p className="text-xs leading-relaxed">{corr.ai_recommendation}</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { l: 'Vorher', v: fmt(corr.revenue_before || 0) },
              { l: 'Nachher', v: fmt(corr.revenue_after || 0) },
              { l: 'Konfidenz', v: `${((corr.confidence || 0) * 100).toFixed(0)}%` },
            ].map(s => (
              <div key={s.l} className="rounded-lg bg-white/30 dark:bg-white/[0.03] py-2">
                <p className="text-[10px] opacity-60">{s.l}</p>
                <p className="text-xs font-bold">{s.v}</p>
              </div>
            ))}
          </div>
          {!resolved && (
            <button onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}
              className="w-full py-1.5 rounded-lg bg-white/40 dark:bg-white/[0.08] text-xs font-semibold hover:bg-white/60 dark:hover:bg-white/[0.12] transition-colors flex items-center justify-center gap-1.5">
              {resolveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Als gelöst markieren
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#111118] px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === 'revenue' || p.dataKey === 'aov'
            ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(p.value)
            : p.dataKey === 'conversion'
            ? `${(p.value * 100).toFixed(2)}%`
            : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PERIODS = [{ label: '7T', days: 7 }, { label: '30T', days: 30 }, { label: '90T', days: 90 }];

export default function RevenuePage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const siteId = params?.id as string;
  const [days, setDays] = useState(30);

  const { data: siteData } = useQuery({
    queryKey: ['site', siteId],
    queryFn: async () => { const r = await sitesApi.getSite(siteId); return r.success ? r.data : null; },
  });

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['revenue-summary', siteId, days],
    queryFn: async () => { const r = await revenueApi.getSummary(siteId, days); return r.success ? r.data : null; },
  });

  const analyzeMutation = useMutation({
    mutationFn: () => revenueApi.analyze(siteId),
    onSuccess: (r) => {
      if (r.success) { toast.success('KI-Analyse abgeschlossen'); qc.invalidateQueries({ queryKey: ['revenue-summary', siteId] }); }
      else toast.error(r.error || 'Fehler');
    },
    onError: () => toast.error('Analyse fehlgeschlagen'),
  });

  const noData = !summaryData || (summaryData.snapshots?.length ?? 0) === 0;
  const chartData = (summaryData?.snapshots || []).map((s: any) => ({
    date: new Date(s.snapshot_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    revenue: parseFloat(s.total_revenue || 0),
    orders: s.order_count || 0,
    conversion: parseFloat(s.conversion_rate || 0),
    aov: parseFloat(s.avg_order_value || 0),
  }));

  const half = Math.floor(chartData.length / 2);
  const recent = chartData.slice(half).reduce((s: number, d: any) => s + d.revenue, 0);
  const prev   = chartData.slice(0, half).reduce((s: number, d: any) => s + d.revenue, 0);
  const revTrend = prev > 0 ? ((recent - prev) / prev) * 100 : 0;
  const correlations: any[] = summaryData?.correlations || [];
  const unresolvedCorr = correlations.filter((c: any) => !c.resolved_at).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] pt-20 pb-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-500" /> WooCommerce Revenue
            </h1>
            {siteData && <p className="text-sm text-gray-500 mt-0.5">{siteData.domain}</p>}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 dark:border-white/[0.08] overflow-hidden">
              {PERIODS.map(p => (
                <button key={p.days} onClick={() => setDays(p.days)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${days === p.days ? 'bg-blue-600 text-white' : 'bg-white dark:bg-white/[0.02] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04]'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-500 disabled:opacity-60 transition-colors">
              {analyzeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              KI-Analyse
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : noData ? (
          <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-10 text-center">
            <ShoppingCart className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">Noch keine WooCommerce-Daten</h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">
              Der WPMA-Agent sendet täglich Snapshots, sobald WooCommerce auf dieser Site aktiv ist.
            </p>
            <div className="rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05] p-4 text-xs text-left max-w-sm mx-auto space-y-2">
              <p className="font-semibold text-gray-700 dark:text-gray-300">Voraussetzungen:</p>
              <div className="flex items-center gap-2 text-gray-500"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> WPMA-Plugin aktiv</div>
              <div className="flex items-center gap-2 text-gray-500"><Package className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" /> WooCommerce installiert</div>
              <div className="flex items-center gap-2 text-gray-500"><Zap className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" /> Snapshot kommt täglich automatisch</div>
            </div>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Umsatz gesamt" value={fmt(summaryData.total_revenue)} icon={<Euro className="w-3.5 h-3.5" />} trend={revTrend} positive />
              <KpiCard label="Bestellungen" value={fmt(summaryData.total_orders, false)} icon={<ShoppingCart className="w-3.5 h-3.5" />} />
              <KpiCard label="Conversion Rate" value={`${(summaryData.avg_conversion_rate * 100).toFixed(2)}%`} icon={<TrendingUp className="w-3.5 h-3.5" />} />
              <KpiCard
                label="AI-Korrelationen"
                value={unresolvedCorr > 0 ? `${unresolvedCorr} offen` : 'Alles OK'}
                sub={unresolvedCorr > 0 ? 'Anomalien erkannt' : 'Keine Anomalien'}
                icon={<Brain className="w-3.5 h-3.5" />}
              />
            </div>

            {/* Revenue Chart */}
            <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Umsatzverlauf</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `€${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} width={50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Umsatz" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Orders + Conversion */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Bestellungen/Tag</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="orders" name="Bestellungen" stroke="#3b82f6" strokeWidth={2} fill="url(#ordGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Conversion Rate</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} width={38}
                      tickFormatter={v => `${(v*100).toFixed(1)}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="conversion" name="Conversion" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI Correlations */}
            {correlations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-violet-500" /> KI-Korrelationen
                  {unresolvedCorr > 0 && (
                    <span className="text-xs bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                      {unresolvedCorr} offen
                    </span>
                  )}
                </h3>
                <div className="space-y-2">
                  {correlations.map((c: any) => (
                    <CorrelationCard key={c.id} corr={c} siteId={siteId}
                      onResolved={() => qc.invalidateQueries({ queryKey: ['revenue-summary', siteId] })} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
