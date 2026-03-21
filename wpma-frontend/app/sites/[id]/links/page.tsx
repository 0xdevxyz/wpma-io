'use client';
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Search,
  XCircle,
  CheckCircle,
  Link,
  ExternalLink,
  Loader2,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../../../lib/api';

interface LinkResult {
  url: string;
  status_code: number;
  is_broken: boolean;
  redirect_url?: string;
  response_time_ms: number;
  error?: string;
}

interface LinkScan {
  id: number;
  status: 'running' | 'completed' | 'failed';
  total_links: number;
  broken_links: number;
  redirect_links: number;
  results: LinkResult[];
  started_at: string;
  completed_at?: string;
}

interface ScanSummary {
  id: number;
  status: string;
  total_links: number;
  broken_links: number;
  redirect_links: number;
  started_at: string;
  completed_at?: string;
}

type Tab = 'broken' | 'redirects' | 'all';

function getStatusBadge(statusCode: number) {
  if (statusCode === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
        Timeout
      </span>
    );
  }
  if (statusCode >= 200 && statusCode < 300) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
        {statusCode}
      </span>
    );
  }
  if (statusCode >= 300 && statusCode < 400) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
        {statusCode}
      </span>
    );
  }
  if (statusCode >= 400 && statusCode < 500) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
        {statusCode}
      </span>
    );
  }
  if (statusCode >= 500) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
        {statusCode}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
      {statusCode}
    </span>
  );
}

function truncateUrl(url: string, maxLen = 60): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen) + '…';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LinksPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params?.id as string;

  const [activeTab, setActiveTab] = useState<Tab>('broken');
  const [scanning, setScanning] = useState(false);

  // Fetch latest scan
  const { data: latestData, refetch: refetchLatest } = useQuery({
    queryKey: ['links-latest', siteId],
    queryFn: () => api.get(`/api/v1/links/${siteId}/latest`),
    enabled: !!siteId,
    refetchInterval: (query) => {
      const scan = (query.state.data as { data: LinkScan | null } | undefined)
        ?.data;
      return scan?.status === 'running' ? 2000 : false;
    },
  });

  // Fetch scan history
  const { data: historyData } = useQuery({
    queryKey: ['links-history', siteId],
    queryFn: () => api.get(`/api/v1/links/${siteId}/history`),
    enabled: !!siteId,
  });

  const scan: LinkScan | null = (latestData as { data: LinkScan | null } | undefined)?.data ?? null;
  const history: ScanSummary[] = (historyData as { data: ScanSummary[] } | undefined)?.data ?? [];

  // Derive site domain from history or scan (fallback to siteId)
  const siteDomain = `Site #${siteId}`;

  async function handleStartScan() {
    setScanning(true);
    try {
      await api.post(`/api/v1/links/${siteId}/scan`, {});
      await refetchLatest();
    } catch (_) {
      // ignore, polling will show error state
    } finally {
      setScanning(false);
    }
  }

  // Filter results for tabs
  const results: LinkResult[] = scan?.results ?? [];
  const brokenResults = results.filter((r) => r.is_broken);
  const redirectResults = results.filter((r) => r.redirect_url !== undefined && !r.is_broken);
  const allResults = results;

  function tabResults(): LinkResult[] {
    if (activeTab === 'broken') return brokenResults;
    if (activeTab === 'redirects') return redirectResults;
    return allResults;
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'broken', label: 'Kaputte Links', count: brokenResults.length },
    { key: 'redirects', label: 'Weiterleitungen', count: redirectResults.length },
    { key: 'all', label: 'Alle Links', count: allResults.length },
  ];

  const currentResults = tabResults();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Link-Checker
              </h1>
              <p className="text-sm text-gray-400">{siteDomain}</p>
            </div>
          </div>
          <button
            onClick={handleStartScan}
            disabled={scanning || scan?.status === 'running'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {scanning || scan?.status === 'running' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Scan starten
          </button>
        </div>

        {/* Running banner */}
        {scan?.status === 'running' && (
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="text-sm font-medium">
              Link-Scan läuft. Bitte warten…
            </span>
            <span className="ml-auto text-xs text-blue-500 dark:text-blue-500 animate-pulse">
              ●
            </span>
          </div>
        )}

        {/* Failed banner */}
        {scan?.status === 'failed' && (
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium">
              Scan fehlgeschlagen. Bitte erneut versuchen.
            </span>
          </div>
        )}

        {/* Stats row */}
        {scan && scan.status === 'completed' && (
          <div className="grid grid-cols-3 gap-4">
            {/* Total */}
            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/[0.06]">
                <Link className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Links gescannt</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {scan.total_links}
                </p>
              </div>
            </div>

            {/* Broken */}
            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-500/10">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Kaputte Links</p>
                <p
                  className={`text-2xl font-semibold ${
                    scan.broken_links > 0
                      ? 'text-red-500'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {scan.broken_links}
                </p>
              </div>
            </div>

            {/* Redirects */}
            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-500/10">
                <ArrowRight className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Weiterleitungen</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {scan.redirect_links}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No scan empty state */}
        {!scan && (
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/[0.06]">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <p className="text-base font-medium text-gray-700 dark:text-gray-200">
                Noch kein Scan durchgeführt
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Starte einen Scan, um alle Links dieser Website zu prüfen.
              </p>
            </div>
            <button
              onClick={handleStartScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
            >
              {scanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Scan starten
            </button>
          </div>
        )}

        {/* Tabs + results table */}
        {scan && scan.status === 'completed' && (
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-gray-200 dark:border-white/[0.07] px-5 pt-4 gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
                    activeTab === t.key
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-px'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {t.label}
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                      activeTab === t.key
                        ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Table or empty state */}
            {currentResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Alle Links funktionieren einwandfrei
                </p>
                <p className="text-xs text-gray-400">
                  Keine Einträge in dieser Kategorie.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-white/[0.05]">
                      <th className="px-5 py-3 text-left font-medium">URL</th>
                      <th className="px-5 py-3 text-left font-medium">Status</th>
                      <th className="px-5 py-3 text-left font-medium">Antwortzeit</th>
                      <th className="px-5 py-3 text-left font-medium">Aktion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                    {currentResults.map((result, idx) => (
                      <tr
                        key={idx}
                        onClick={() => window.open(result.url, '_blank')}
                        className="hover:bg-gray-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3 max-w-xs">
                          <div>
                            <span
                              className="text-gray-700 dark:text-gray-200 font-mono text-xs block truncate"
                              title={result.url}
                            >
                              {truncateUrl(result.url)}
                            </span>
                            {result.redirect_url && (
                              <span className="flex items-center gap-1 text-xs text-amber-500 dark:text-amber-400 mt-0.5">
                                <ArrowRight className="w-3 h-3 shrink-0" />
                                <span
                                  className="truncate font-mono"
                                  title={result.redirect_url}
                                >
                                  {truncateUrl(result.redirect_url, 50)}
                                </span>
                              </span>
                            )}
                            {result.error && (
                              <span className="text-xs text-red-400 mt-0.5 block truncate">
                                {result.error}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {getStatusBadge(result.status_code)}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-gray-400">
                          {result.response_time_ms > 0
                            ? `${result.response_time_ms} ms`
                            : '—'}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Öffnen
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Scan history */}
        {history.length > 0 && (
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
              Scan-Verlauf
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-white/[0.05]">
                    <th className="pb-2 text-left font-medium">Datum</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Links</th>
                    <th className="pb-2 text-right font-medium">Kaputt</th>
                    <th className="pb-2 text-right font-medium">Weiterleitungen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                  {history.slice(0, 5).map((h) => (
                    <tr key={h.id}>
                      <td className="py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                        {formatDate(h.started_at)}
                      </td>
                      <td className="py-2.5">
                        {h.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            Abgeschlossen
                          </span>
                        ) : h.status === 'running' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-500">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Läuft
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-500">
                            <XCircle className="w-3 h-3" />
                            Fehlgeschlagen
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-gray-500 dark:text-gray-400 text-xs">
                        {h.total_links}
                      </td>
                      <td className="py-2.5 text-right text-xs">
                        <span
                          className={
                            h.broken_links > 0
                              ? 'text-red-500 font-medium'
                              : 'text-gray-400'
                          }
                        >
                          {h.broken_links}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-amber-500 dark:text-amber-400 text-xs">
                        {h.redirect_links}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
