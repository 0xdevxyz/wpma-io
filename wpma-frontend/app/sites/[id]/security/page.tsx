'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Bug,
  Globe,
  Lock,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { securityApi, sslApi } from '../../../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vulnerability {
  id?: string;
  title: string;
  description: string;
  recommendation?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

interface SecurityHeaders {
  'Strict-Transport-Security'?: string | null;
  'X-Content-Type-Options'?: string | null;
  'X-Frame-Options'?: string | null;
  'X-XSS-Protection'?: string | null;
  'Content-Security-Policy'?: string | null;
  'Referrer-Policy'?: string | null;
  [key: string]: string | null | undefined;
}

interface ScanResults {
  debug_mode?: boolean;
  wp_version_status?: 'current' | 'update_available' | 'unknown';
  admin_url_default?: boolean;
  vulnerabilities?: Vulnerability[];
  security_headers?: SecurityHeaders;
}

interface SecurityScan {
  id?: string;
  status?: string;
  score?: number;
  ssl_enabled?: boolean;
  results?: ScanResults;
  created_at?: string;
}

interface HistoryEntry {
  id?: string;
  created_at: string;
  score: number;
  issues_found?: number;
  critical_count?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcScore(scan: SecurityScan | undefined): number {
  if (!scan) return 0;
  if (scan.score && scan.score > 0) return scan.score;
  const vulns = scan.results?.vulnerabilities ?? [];
  let s = 100;
  for (const v of vulns) {
    if (v.severity === 'critical') s -= 20;
    else if (v.severity === 'high') s -= 10;
    else if (v.severity === 'medium') s -= 5;
    else if (v.severity === 'low') s -= 2;
  }
  return Math.max(0, s);
}

function scoreColor(score: number): { ring: string; text: string; bg: string } {
  if (score >= 80) return { ring: '#10b981', text: 'text-emerald-500', bg: 'bg-emerald-500/10 text-emerald-400' };
  if (score >= 60) return { ring: '#f59e0b', text: 'text-amber-500', bg: 'bg-amber-500/10 text-amber-400' };
  return { ring: '#ef4444', text: 'text-red-500', bg: 'bg-red-500/10 text-red-400' };
}

function severityConfig(sev: Vulnerability['severity']) {
  switch (sev) {
    case 'critical': return { label: 'Kritisch', cls: 'bg-red-500/15 text-red-400 border-red-500/20' };
    case 'high':     return { label: 'Hoch',     cls: 'bg-orange-500/15 text-orange-400 border-orange-500/20' };
    case 'medium':   return { label: 'Mittel',   cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' };
    case 'low':      return { label: 'Niedrig',  cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' };
    default:         return { label: 'Info',     cls: 'bg-gray-500/15 text-gray-400 border-gray-500/20' };
  }
}

function severityBorderLeft(sev: Vulnerability['severity']) {
  switch (sev) {
    case 'critical': return 'border-l-red-500';
    case 'high':     return 'border-l-orange-500';
    case 'medium':   return 'border-l-amber-500';
    case 'low':      return 'border-l-blue-400';
    default:         return 'border-l-gray-500';
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Score Gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score, running }: { score: number; running: boolean }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circ;
  const { ring, text } = scoreColor(score);

  return (
    <div className="relative flex flex-col items-center justify-center gap-3">
      {running && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-gray-950/70 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="mt-2 text-sm font-medium text-blue-300 animate-pulse">Scan läuft...</p>
        </div>
      )}
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60" cy="60" r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth="10"
          />
          <circle
            cx="60" cy="60" r={r}
            fill="none"
            stroke={ring}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold tabular-nums ${text}`}>{score}</span>
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mt-0.5">/100</span>
        </div>
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sicherheits-Score</p>
    </div>
  );
}

// ─── Quick-check Card ─────────────────────────────────────────────────────────

function QuickCard({
  icon,
  label,
  status,
  ok,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
  ok: boolean | null;
}) {
  const badge =
    ok === null
      ? 'bg-gray-500/10 text-gray-400'
      : ok
      ? 'bg-emerald-500/10 text-emerald-400'
      : 'bg-red-500/10 text-red-400';

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
        {status}
      </span>
    </div>
  );
}

// ─── Vulnerability Card ───────────────────────────────────────────────────────

function VulnCard({ vuln }: { vuln: Vulnerability }) {
  const [open, setOpen] = useState(false);
  const { label, cls } = severityConfig(vuln.severity);
  const leftBorder = severityBorderLeft(vuln.severity);

  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] border-l-4 ${leftBorder} overflow-hidden`}
    >
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
              {label}
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
              {vuln.title}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{vuln.description}</p>
        </div>
        {vuln.recommendation && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Empfehlung anzeigen"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>
      {open && vuln.recommendation && (
        <div className="px-4 pb-4 pt-0">
          <div className="rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06] p-3">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Empfehlung
            </p>
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{vuln.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Security Headers Section ─────────────────────────────────────────────────

const HEADER_DEFINITIONS: { key: string; label: string }[] = [
  { key: 'Strict-Transport-Security', label: 'Strict-Transport-Security' },
  { key: 'X-Content-Type-Options',    label: 'X-Content-Type-Options' },
  { key: 'X-Frame-Options',           label: 'X-Frame-Options' },
  { key: 'X-XSS-Protection',          label: 'X-XSS-Protection' },
  { key: 'Content-Security-Policy',   label: 'Content-Security-Policy' },
  { key: 'Referrer-Policy',           label: 'Referrer-Policy' },
];

function SecurityHeadersSection({ headers }: { headers: SecurityHeaders | undefined }) {
  const headersData = headers ?? {};
  const presentCount = HEADER_DEFINITIONS.filter((h) => !!headersData[h.key]).length;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">HTTP Security Headers</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Geprüfte Sicherheits-Header</p>
        </div>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          {presentCount}/{HEADER_DEFINITIONS.length} gesetzt
        </span>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
        {HEADER_DEFINITIONS.map(({ key, label }) => {
          const value = headersData[key];
          const present = value !== undefined && value !== null && value !== '';
          return (
            <div key={key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="mt-0.5 shrink-0">
                {present ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 font-mono">{label}</p>
                {present && value ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate font-mono">{value}</p>
                ) : (
                  <p className="text-xs text-red-400/70 mt-0.5">Nicht gesetzt</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SSL Certificate Card ─────────────────────────────────────────────────────

interface SslCert {
  domain?: string;
  issuer?: string;
  subject?: string;
  valid_from?: string;
  valid_to?: string;
  days_remaining?: number;
  grade?: string;
  authorized?: boolean;
  status?: string;
  error_message?: string;
  last_checked?: string;
}

function SslCertCard({
  siteId,
}: {
  siteId: string;
}) {
  const [checking, setChecking] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['ssl-cert', siteId],
    queryFn: () => sslApi.getSiteSSL(siteId),
    enabled: !!siteId,
    staleTime: 5 * 60 * 1000,
  });

  const cert = data?.data as SslCert | undefined;

  async function handleCheck() {
    setChecking(true);
    try {
      await sslApi.checkNow(siteId);
      await refetch();
    } finally {
      setChecking(false);
    }
  }

  const gradeColor = (g?: string) => {
    if (!g) return 'bg-gray-500/10 text-gray-400';
    if (g === 'A') return 'bg-emerald-500/10 text-emerald-400';
    if (g === 'B') return 'bg-amber-500/10 text-amber-400';
    return 'bg-red-500/10 text-red-400';
  };

  const statusColor = (s?: string) => {
    if (!s || s === 'unknown') return 'text-gray-400';
    if (s === 'valid') return 'text-emerald-400';
    if (s === 'warning') return 'text-amber-400';
    return 'text-red-400';
  };

  const daysColor = (d?: number) => {
    if (d === undefined) return 'text-gray-400';
    if (d > 30) return 'text-emerald-400';
    if (d > 7) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">SSL-Zertifikat</h2>
          {cert?.last_checked && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Geprüft: {fmtDate(cert.last_checked)}
            </p>
          )}
        </div>
        <button
          onClick={handleCheck}
          disabled={checking || isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
        >
          {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Jetzt prüfen
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !cert || cert.status === 'unknown' ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-2">
          Noch nicht geprüft – klicke „Jetzt prüfen".
        </p>
      ) : cert.error_message ? (
        <div className="flex items-start gap-3 rounded-xl bg-red-500/[0.06] border border-red-500/20 p-4">
          <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">Verbindungsfehler</p>
            <p className="text-xs text-red-400/70 mt-0.5">{cert.error_message}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Grade */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Grade</p>
            <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-sm font-bold ${gradeColor(cert.grade)}`}>
              {cert.grade ?? '—'}
            </span>
          </div>

          {/* Days remaining */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Verbleibend</p>
            <p className={`text-2xl font-bold tabular-nums ${daysColor(cert.days_remaining)}`}>
              {cert.days_remaining !== undefined ? cert.days_remaining : '—'}
              <span className="text-sm font-normal ml-1 text-gray-400">Tage</span>
            </p>
          </div>

          {/* Valid until */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Gültig bis</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {cert.valid_to ? new Date(cert.valid_to).toLocaleDateString('de-DE') : '—'}
            </p>
          </div>

          {/* Issuer */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Aussteller</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{cert.issuer ?? '—'}</p>
            <span className={`text-[11px] font-semibold ${statusColor(cert.status)}`}>
              {cert.status === 'valid' ? '✓ Gültig' : cert.status === 'warning' ? '⚠ Läuft bald ab' : cert.status === 'expired' ? '✗ Abgelaufen' : cert.status === 'critical' ? '✗ Kritisch' : cert.status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scan History Table ───────────────────────────────────────────────────────

function ScanHistorySection({ history }: { history: HistoryEntry[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">Scan-Verlauf</h2>
      {history.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">Noch keine Scan-Daten vorhanden.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/[0.06]">
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  Datum
                </th>
                <th className="pb-3 text-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  Score
                </th>
                <th className="pb-3 text-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  Probleme
                </th>
                <th className="pb-3 text-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  Kritisch
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {history.slice(0, 5).map((entry, i) => {
                const { text } = scoreColor(entry.score ?? 0);
                return (
                  <tr key={entry.id ?? i}>
                    <td className="py-3 text-gray-600 dark:text-gray-400 text-xs">
                      {fmtDate(entry.created_at)}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`font-bold tabular-nums ${text}`}>{entry.score ?? '—'}</span>
                    </td>
                    <td className="py-3 text-center text-gray-600 dark:text-gray-300 tabular-nums">
                      {entry.issues_found ?? '—'}
                    </td>
                    <td className="py-3 text-center">
                      {(entry.critical_count ?? 0) > 0 ? (
                        <span className="font-semibold text-red-400 tabular-nums">{entry.critical_count}</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params?.id as string;
  const [scanning, setScanning] = useState(false);

  const { data: statusData, refetch, isLoading } = useQuery({
    queryKey: ['security-status', siteId],
    queryFn: () => securityApi.getSecurityStatus(siteId),
    enabled: !!siteId,
    refetchInterval: (query) => {
      const scan = query.state.data?.data as SecurityScan | undefined;
      if (scan?.status === 'running') return 3000;
      return false;
    },
  });

  const { data: historyData } = useQuery({
    queryKey: ['security-history', siteId],
    queryFn: () => securityApi.getHistory(siteId),
    enabled: !!siteId,
  });

  const scan = statusData?.data as SecurityScan | undefined;
  const history = (historyData?.data as HistoryEntry[]) ?? [];
  const isRunning = scan?.status === 'running' || scanning;
  const score = calcScore(scan);
  const vulns: Vulnerability[] = scan?.results?.vulnerabilities ?? [];
  const criticalCount = vulns.filter((v) => v.severity === 'critical').length;
  const highCount = vulns.filter((v) => v.severity === 'high').length;

  async function handleScan() {
    setScanning(true);
    try {
      await securityApi.runSecurityScan(siteId);
      await refetch();
    } finally {
      setScanning(false);
    }
  }

  // Quick-check values
  const sslOk = scan?.ssl_enabled ?? null;
  const debugOn = scan?.results?.debug_mode;
  const wpStatus = scan?.results?.wp_version_status;
  const adminDefault = scan?.results?.admin_url_default;

  const wpStatusLabel =
    wpStatus === 'current'
      ? 'Aktuell'
      : wpStatus === 'update_available'
      ? 'Update verfügbar'
      : 'Unbekannt';
  const wpStatusOk: boolean | null =
    wpStatus === 'current' ? true : wpStatus === 'update_available' ? false : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] text-gray-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-2 text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
              aria-label="Zurück"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Sicherheit</h1>
              {scan?.created_at && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Letzter Scan: {fmtDate(scan.created_at)}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleScan}
            disabled={isRunning || isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Scan starten
          </button>
        </div>

        {/* ── Score + Stats ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Score Gauge */}
          <div className="relative rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-6 flex items-center justify-center">
            {isLoading && !scan ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                <p className="text-sm text-gray-400">Wird geladen...</p>
              </div>
            ) : (
              <ScoreGauge score={score} running={isRunning} />
            )}
          </div>

          {/* Summary Stats */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Schwachstellen</span>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-gray-800 dark:text-white">{vulns.length}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">gefundene Probleme</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 mb-2">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-xs font-medium uppercase tracking-wide">Kritisch</span>
              </div>
              <div>
                <p className={`text-3xl font-bold tabular-nums ${criticalCount > 0 ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>
                  {criticalCount}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">kritische Probleme</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                <span className="text-xs font-medium uppercase tracking-wide">Hoch</span>
              </div>
              <div>
                <p className={`text-3xl font-bold tabular-nums ${highCount > 0 ? 'text-orange-500' : 'text-gray-800 dark:text-white'}`}>
                  {highCount}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">hohe Probleme</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 mb-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-medium uppercase tracking-wide">Status</span>
              </div>
              <div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isRunning
                    ? 'bg-blue-500/10 text-blue-400'
                    : score >= 80
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : score >= 60
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {isRunning ? 'Scan läuft' : score >= 80 ? 'Sicher' : score >= 60 ? 'Verbesserungsbedarf' : 'Kritisch'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick-check Cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickCard
            icon={<Shield className="h-4 w-4" />}
            label="SSL"
            status={sslOk === null ? 'Unbekannt' : sslOk ? 'Aktiv' : 'Inaktiv'}
            ok={sslOk}
          />
          <QuickCard
            icon={<Bug className="h-4 w-4" />}
            label="Debug-Modus"
            status={debugOn === undefined ? 'Unbekannt' : debugOn ? 'Ein' : 'Aus'}
            ok={debugOn === undefined ? null : !debugOn}
          />
          <QuickCard
            icon={<Globe className="h-4 w-4" />}
            label="WordPress"
            status={wpStatusLabel}
            ok={wpStatusOk}
          />
          <QuickCard
            icon={<Lock className="h-4 w-4" />}
            label="Admin-URL"
            status={adminDefault === undefined ? 'Unbekannt' : adminDefault ? 'Standard /wp-admin' : 'Geschützt'}
            ok={adminDefault === undefined ? null : !adminDefault}
          />
        </div>

        {/* ── SSL Certificate ──────────────────────────────────────────────── */}
        <SslCertCard siteId={siteId} />

        {/* ── Vulnerability List ───────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-6">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Sicherheitsprobleme</h2>
            {vulns.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-white/[0.08] px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                {vulns.length}
              </span>
            )}
          </div>

          {isLoading && !scan ? (
            <div className="flex items-center gap-2 py-6 justify-center text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Wird geladen...</span>
            </div>
          ) : vulns.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-500/60" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Keine Probleme gefunden</p>
              <p className="text-xs text-gray-400 dark:text-gray-600">
                {scan
                  ? 'Ihr letzter Scan hat keine Schwachstellen gefunden.'
                  : 'Starten Sie einen Scan, um Schwachstellen zu entdecken.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {vulns.map((vuln, i) => (
                <VulnCard key={vuln.id ?? i} vuln={vuln} />
              ))}
            </div>
          )}
        </div>

        {/* ── Security Headers ─────────────────────────────────────────────── */}
        <SecurityHeadersSection headers={scan?.results?.security_headers} />

        {/* ── Scan History ─────────────────────────────────────────────────── */}
        <ScanHistorySection history={history} />

      </div>
    </div>
  );
}
