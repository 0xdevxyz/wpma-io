'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Globe, CheckCircle, AlertTriangle, Activity, LogOut,
  Shield, RefreshCw, ExternalLink, Loader2,
} from 'lucide-react';
import { clientPortalApi } from '../../../lib/api';

// ─── Auth Helper ──────────────────────────────────────────────────────────────

function useClientAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('client_token');
    setToken(t);
    setReady(true);
  }, []);

  return { token, ready };
}

// ─── Site Card ────────────────────────────────────────────────────────────────

function SiteCard({ site, primaryColor }: { site: any; primaryColor: string }) {
  const healthColor = site.healthScore >= 90 ? 'text-emerald-600' : site.healthScore >= 70 ? 'text-yellow-600' : 'text-red-600';
  const healthBg = site.healthScore >= 90 ? 'bg-emerald-50 dark:bg-emerald-500/10' : site.healthScore >= 70 ? 'bg-yellow-50 dark:bg-yellow-500/10' : 'bg-red-50 dark:bg-red-500/10';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primaryColor}20` }}>
          <Globe className="w-4 h-4" style={{ color: primaryColor }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{site.siteName}</p>
          <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-xs hover:underline truncate"
            style={{ color: primaryColor }}>
            {site.domain}<ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
          </a>
        </div>
      </div>

      {/* Health */}
      <div className={`flex items-center justify-between rounded-lg px-3 py-2 mb-3 ${healthBg}`}>
        <span className={`text-xs font-medium ${healthColor}`}>Health Score</span>
        <span className={`text-base font-bold ${healthColor}`}>{site.healthScore}%</span>
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <p className="text-gray-400 mb-0.5">WordPress</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">{site.wordpressVersion || '—'}</p>
        </div>
        <div>
          <p className="text-gray-400 mb-0.5">PHP</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">{site.phpVersion || '—'}</p>
        </div>
      </div>

      {/* Uptime */}
      {site.uptimeStatus && site.uptimeStatus !== 'unknown' && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`w-1.5 h-1.5 rounded-full ${site.uptimeStatus === 'down' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className={site.uptimeStatus === 'down' ? 'text-red-500 font-medium' : 'text-emerald-600 dark:text-emerald-400'}>
            {site.uptimeStatus === 'down' ? 'Nicht erreichbar' : `Uptime ${Number(site.uptimePercent ?? 100).toFixed(1)}%`}
          </span>
          {site.avgResponseMs && (
            <span className="text-gray-400 ml-1">{site.avgResponseMs}ms</span>
          )}
        </div>
      )}

      {/* Last check */}
      {site.lastCheck && (
        <p className="text-[10px] text-gray-400 mt-2">
          Letzter Check: {new Date(site.lastCheck).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function ClientPortalDashboard() {
  const router = useRouter();
  const { token, ready } = useClientAuth();
  const [branding, setBranding] = useState<any>({ brandName: 'WPMA', primaryColor: '#3B82F6' });
  const [clientInfo, setClientInfo] = useState<any>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token) { router.replace('/client-portal'); return; }
    const b = localStorage.getItem('client_branding');
    const c = localStorage.getItem('client_info');
    if (b) setBranding(JSON.parse(b));
    if (c) setClientInfo(JSON.parse(c));
  }, [ready, token]);

  const { data: sitesData, isLoading, refetch } = useQuery({
    queryKey: ['client-portal-sites'],
    queryFn: async () => {
      // Use client token via override
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wpma.io';
      const r = await fetch(`${API_BASE_URL}/api/v1/client-portal/sites`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      return r.success ? (r.data || []) : [];
    },
    enabled: !!token && ready,
  });

  function logout() {
    localStorage.removeItem('client_token');
    localStorage.removeItem('client_info');
    localStorage.removeItem('client_branding');
    router.replace('/client-portal');
  }

  const sites: any[] = sitesData || [];
  const stats = {
    total: sites.length,
    healthy: sites.filter(s => s.healthScore >= 90).length,
    warning: sites.filter(s => s.healthScore >= 70 && s.healthScore < 90).length,
    critical: sites.filter(s => s.healthScore < 70).length,
    down: sites.filter(s => s.uptimeStatus === 'down').length,
  };

  if (!ready || (!token && ready)) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-white/[0.07] bg-white dark:bg-[#0d0d14]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.brandName} className="h-7 object-contain" />
            ) : (
              <span className="text-base font-bold" style={{ color: branding.primaryColor }}>{branding.brandName}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => refetch()} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            {clientInfo && (
              <span className="text-xs text-gray-500 hidden sm:block">{clientInfo.name}</span>
            )}
            <button onClick={logout}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="Abmelden">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Gesamt', value: stats.total, color: 'text-gray-700 dark:text-gray-300', icon: <Globe className="w-4 h-4" /> },
            { label: 'Gesund', value: stats.healthy, color: 'text-emerald-600 dark:text-emerald-400', icon: <CheckCircle className="w-4 h-4" /> },
            { label: 'Warnung', value: stats.warning, color: 'text-yellow-600 dark:text-yellow-400', icon: <AlertTriangle className="w-4 h-4" /> },
            { label: 'Down', value: stats.down, color: 'text-red-600 dark:text-red-400', icon: <Activity className="w-4 h-4" /> },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-4">
              <div className={`flex items-center gap-1.5 ${s.color} mb-1`}>{s.icon}<span className="text-xs font-medium">{s.label}</span></div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Sites Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : sites.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Noch keine Sites freigegeben</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map(s => (
              <SiteCard key={s.id} site={s} primaryColor={branding.primaryColor} />
            ))}
          </div>
        )}

        {/* Footer */}
        {branding.footerText && (
          <p className="text-center text-xs text-gray-400 pt-4">{branding.footerText}</p>
        )}
        {!branding.hideWpmaBranding && (
          <p className="text-center text-[10px] text-gray-300 dark:text-gray-700">Powered by WPMA.io</p>
        )}
      </main>
    </div>
  );
}
