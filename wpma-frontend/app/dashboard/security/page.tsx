'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, AlertTriangle, CheckCircle, Scan, XCircle, ChevronDown, ExternalLink } from 'lucide-react';
import { sitesApi, securityApi } from '../../../lib/api';
import { toast } from 'react-hot-toast';

const SEV_CLS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
};
const SEV_LABEL: Record<string, string> = {
  critical: 'Kritisch', high: 'Hoch', medium: 'Mittel', low: 'Niedrig',
};

function SiteSecurityRow({ site }: { site: any }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: secData } = useQuery({
    queryKey: ['security', site.id],
    queryFn: () => securityApi.getSecurityStatus(String(site.id)),
    staleTime: 120000,
    enabled: expanded,
  });

  const scanMut = useMutation({
    mutationFn: () => securityApi.runSecurityScan(String(site.id)),
    onSuccess: () => {
      toast.success(`Scan für ${site.name} gestartet`);
      qc.invalidateQueries({ queryKey: ['security', site.id] });
    },
    onError: () => toast.error('Scan fehlgeschlagen'),
  });

  const score = site.security_score ?? 0;
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
        <div className="hidden sm:block w-20 text-right">
          {site.last_security_scan ? (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {new Date(site.last_security_scan).toLocaleDateString('de')}
            </span>
          ) : (
            <span className="text-xs text-gray-300 dark:text-gray-600">Nie</span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); scanMut.mutate(); }}
          disabled={scanMut.isPending}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg
            bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300
            hover:bg-gray-200 dark:hover:bg-white/20 disabled:opacity-50 ml-2"
        >
          <Scan className={`w-3 h-3 ${scanMut.isPending ? 'animate-spin' : ''}`} />
          Scan
        </button>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>
      {expanded && (
        <div className="px-4 pb-4">
          {(secData as any)?.data?.vulnerabilities?.length > 0 ? (
            <ul className="space-y-2 mt-2">
              {(secData as any).data.vulnerabilities.slice(0, 5).map((v: any, i: number) => (
                <li key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/[0.03] rounded-lg">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${SEV_CLS[v.severity] || SEV_CLS.low}`}>
                    {SEV_LABEL[v.severity] || v.severity}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{v.title}</p>
                    {v.component_name && <p className="text-xs text-gray-500 dark:text-gray-400">{v.component_name}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 mt-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              Keine aktiven Schwachstellen
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SecurityPage() {
  const { data: sitesData, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.getSites,
  });
  const sites: any[] = (sitesData as any)?.data || (sitesData as any)?.sites || [];

  const avgScore = sites.length
    ? Math.round(sites.reduce((a, s) => a + (s.security_score || 0), 0) / sites.length)
    : 0;
  const criticalSites = sites.filter(s => (s.security_score || 0) < 50).length;
  const safeSites = sites.filter(s => (s.security_score || 0) >= 80).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sicherheit</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sicherheitsstatus und Schwachstellen aller Sites</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <Shield className="w-5 h-5 mb-2 text-blue-600 dark:text-blue-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{avgScore}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ø Security-Score</div>
        </div>
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <CheckCircle className="w-5 h-5 mb-2 text-green-600 dark:text-green-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{safeSites}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sicher (≥80)</div>
        </div>
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <AlertTriangle className="w-5 h-5 mb-2 text-red-600 dark:text-red-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{criticalSites}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Kritisch (&lt;50)</div>
        </div>
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <XCircle className="w-5 h-5 mb-2 text-gray-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {sites.filter(s => !s.last_security_scan).length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Nie gescannt</div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Sites</h2>
          <div className="flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
            <span>Score</span>
            <span className="hidden sm:inline">Letzter Scan</span>
            <span className="w-16"></span>
            <span className="w-4"></span>
          </div>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">Lädt…</div>
        ) : sites.length === 0 ? (
          <div className="py-12 text-center">
            <Shield className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Keine Sites vorhanden</p>
          </div>
        ) : (
          sites
            .sort((a, b) => (a.security_score || 0) - (b.security_score || 0))
            .map(site => <SiteSecurityRow key={site.id} site={site} />)
        )}
      </div>
    </div>
  );
}
