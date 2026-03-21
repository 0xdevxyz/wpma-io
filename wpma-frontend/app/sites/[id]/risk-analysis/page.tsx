'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Brain, AlertTriangle, CheckCircle, XCircle, Shield, ArrowLeft,
  Play, Loader2, Package, ChevronDown, ChevronUp, RefreshCw, Zap,
} from 'lucide-react';
import { sitesApi, aiApi, bulkApi } from '../../../../lib/api';
import { toast } from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type Recommendation = 'safe' | 'caution' | 'skip' | 'manual_review';

interface PluginRisk {
  name: string;
  slug: string;
  currentVersion: string;
  newVersion: string;
  riskLevel: RiskLevel;
  riskScore: number;
  recommendation: Recommendation;
  reasons: string[];
  warnings: string[];
}

interface RiskAnalysis {
  overallRisk: 'low' | 'medium' | 'high';
  summary: string;
  plugins: PluginRisk[];
  analyzedAt: string;
  siteInfo: { wpVersion: string; phpVersion: string; domain: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const riskColors: Record<RiskLevel, string> = {
  low:      'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20',
  medium:   'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 border-yellow-100 dark:border-yellow-500/20',
  high:     'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-orange-100 dark:border-orange-500/20',
  critical: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-100 dark:border-red-500/20',
};

const riskLabel: Record<RiskLevel, string> = {
  low: 'Niedrig', medium: 'Mittel', high: 'Hoch', critical: 'Kritisch',
};

const recColors: Record<Recommendation, string> = {
  safe:          'bg-emerald-500',
  caution:       'bg-yellow-500',
  skip:          'bg-red-500',
  manual_review: 'bg-orange-500',
};

const recLabel: Record<Recommendation, string> = {
  safe:          'Sicher updaten',
  caution:       'Mit Vorsicht',
  skip:          'Überspringen',
  manual_review: 'Manuell prüfen',
};

const recIcon: Record<Recommendation, React.ReactNode> = {
  safe:          <CheckCircle className="w-3.5 h-3.5" />,
  caution:       <AlertTriangle className="w-3.5 h-3.5" />,
  skip:          <XCircle className="w-3.5 h-3.5" />,
  manual_review: <Shield className="w-3.5 h-3.5" />,
};

function OverallRiskBadge({ risk }: { risk: string }) {
  const map = {
    low:    { label: 'Geringes Risiko',   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', icon: <CheckCircle className="w-5 h-5" /> },
    medium: { label: 'Mittleres Risiko',  color: 'text-yellow-600 dark:text-yellow-400',  bg: 'bg-yellow-50 dark:bg-yellow-500/10',  icon: <AlertTriangle className="w-5 h-5" /> },
    high:   { label: 'Hohes Risiko',      color: 'text-red-600 dark:text-red-400',        bg: 'bg-red-50 dark:bg-red-500/10',        icon: <XCircle className="w-5 h-5" /> },
  };
  const m = map[risk as keyof typeof map] || map.medium;
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${m.bg} ${m.color} font-semibold`}>
      {m.icon}
      {m.label}
    </div>
  );
}

function PluginCard({ plugin }: { plugin: PluginRisk }) {
  const [open, setOpen] = useState(plugin.riskLevel !== 'low');
  return (
    <div className={`rounded-xl border overflow-hidden ${riskColors[plugin.riskLevel]}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <Package className="w-4 h-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{plugin.name}</span>
            <span className="text-[10px] opacity-70">{plugin.currentVersion} → {plugin.newVersion}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${recColors[plugin.recommendation]}`}>
              {recIcon[plugin.recommendation]}
              {recLabel[plugin.recommendation]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold">Risiko: {plugin.riskScore}/10</span>
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-current/10 px-4 py-3 space-y-2">
          {plugin.reasons.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase opacity-60 mb-1">Begründung</p>
              <ul className="space-y-0.5">
                {plugin.reasons.map((r, i) => (
                  <li key={i} className="text-xs flex items-start gap-1.5">
                    <span className="mt-0.5 opacity-60">•</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plugin.warnings.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase opacity-60 mb-1">Warnungen</p>
              <ul className="space-y-0.5">
                {plugin.warnings.map((w, i) => (
                  <li key={i} className="text-xs flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />{w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RiskAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params?.id as string;
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);

  const { data: siteData } = useQuery({
    queryKey: ['site', siteId],
    queryFn: async () => {
      const r = await sitesApi.getSite(siteId);
      return r.success ? r.data : null;
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const r = await (window as any).fetch
        ? fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.wpma.io'}/api/v1/ai/${siteId}/risk-analysis`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          }).then(r => r.json())
        : null;
      return r;
    },
    onSuccess: (data) => {
      if (data?.success) {
        setAnalysis(data.data);
      } else {
        toast.error(data?.error || 'Analyse fehlgeschlagen');
      }
    },
    onError: () => toast.error('Analyse fehlgeschlagen'),
  });

  const safePlugins = analysis?.plugins.filter(p => p.recommendation === 'safe') || [];
  const cautionPlugins = analysis?.plugins.filter(p => p.recommendation === 'caution' || p.recommendation === 'manual_review') || [];
  const skipPlugins = analysis?.plugins.filter(p => p.recommendation === 'skip') || [];

  const startSafeUpdates = async () => {
    if (safePlugins.length === 0) return;
    try {
      await bulkApi.runUpdates([parseInt(siteId)], { updatePlugins: true, createBackup: true });
      toast.success(`Updates für ${safePlugins.length} sichere Plugin(s) gestartet`);
      router.push('/bulk-operations');
    } catch {
      toast.error('Update fehlgeschlagen');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] pt-20 pb-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-violet-500" /> AI Risikoanalyse
            </h1>
            {siteData && (
              <p className="text-sm text-gray-500 mt-0.5">{siteData.domain}</p>
            )}
          </div>
        </div>

        {/* Analyse starten */}
        {!analysis && (
          <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
              <Brain className="w-7 h-7 text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              Update-Risiken analysieren
            </h2>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Claude analysiert alle ausstehenden Plugin-Updates und bewertet das Risiko jedes einzelnen Updates vor der Ausführung.
            </p>
            <button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {analyzeMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysiere...</>
                : <><Play className="w-4 h-4" /> Analyse starten</>}
            </button>
            {siteData && !siteData.isConnected && (
              <p className="mt-4 text-xs text-orange-500">
                Plugin nicht verbunden — Live-Daten nicht verfügbar
              </p>
            )}
          </div>
        )}

        {/* Ergebnis */}
        {analysis && (
          <div className="space-y-5">
            {/* Summary Banner */}
            <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <OverallRiskBadge risk={analysis.overallRisk} />
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{analysis.summary}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    <span>WP {analysis.siteInfo.wpVersion}</span>
                    <span>PHP {analysis.siteInfo.phpVersion}</span>
                    <span>{new Date(analysis.analyzedAt).toLocaleString('de-DE')}</span>
                  </div>
                </div>
                <button
                  onClick={() => { setAnalysis(null); analyzeMutation.reset(); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors flex-shrink-0"
                  title="Neu analysieren"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: 'Sicher', count: safePlugins.length, color: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Vorsicht', count: cautionPlugins.length, color: 'text-yellow-600 dark:text-yellow-400' },
                  { label: 'Überspringen', count: skipPlugins.length, color: 'text-red-600 dark:text-red-400' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg bg-gray-50 dark:bg-white/[0.03] p-3 text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            {analysis.plugins.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {safePlugins.length > 0 && (
                  <button
                    onClick={startSafeUpdates}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
                  >
                    <Zap className="w-4 h-4" />
                    {safePlugins.length} sichere Update{safePlugins.length !== 1 ? 's' : ''} starten
                  </button>
                )}
                <button
                  onClick={() => router.push('/bulk-operations')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  Bulk-Operationen öffnen
                </button>
              </div>
            )}

            {/* Plugin Cards */}
            {analysis.plugins.length === 0 ? (
              <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-8 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Keine ausstehenden Updates</p>
                <p className="text-xs text-gray-400 mt-1">Alle Plugins sind auf dem neuesten Stand.</p>
              </div>
            ) : (
              <div>
                {cautionPlugins.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Aufmerksamkeit erforderlich</p>
                    <div className="space-y-2">
                      {cautionPlugins.map(p => <PluginCard key={p.slug || p.name} plugin={p} />)}
                    </div>
                  </div>
                )}
                {safePlugins.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sicher zu updaten</p>
                    <div className="space-y-2">
                      {safePlugins.map(p => <PluginCard key={p.slug || p.name} plugin={p} />)}
                    </div>
                  </div>
                )}
                {skipPlugins.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Überspringen empfohlen</p>
                    <div className="space-y-2">
                      {skipPlugins.map(p => <PluginCard key={p.slug || p.name} plugin={p} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
