'use client';
import React from 'react';
import {
  Globe, AlertTriangle, CheckCircle, Clock,
  ExternalLink, RefreshCw, HardDrive, Activity, Check,
} from 'lucide-react';
import type { Site } from '../../lib/dashboard-config';

interface SiteCardProps {
  site: Site;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onAction: (action: 'update' | 'backup' | 'healthcheck' | 'sync', siteId: number) => void;
  anySelected: boolean;
}

export function SiteCard({ site, isSelected, onToggleSelect, onAction }: SiteCardProps) {
  const healthColor = site.healthScore >= 90 ? 'text-emerald-600 dark:text-emerald-400'
    : site.healthScore >= 70 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400';
  const healthBg = site.healthScore >= 90 ? 'bg-emerald-50 dark:bg-emerald-500/10'
    : site.healthScore >= 70 ? 'bg-yellow-50 dark:bg-yellow-500/10'
    : 'bg-red-50 dark:bg-red-500/10';
  const HealthIcon = site.healthScore >= 90 ? CheckCircle : AlertTriangle;

  const updates = (site.pluginsUpdates ?? 0) + (site.themesUpdates ?? 0) + (site.coreUpdateAvailable ? 1 : 0);

  return (
    <div
      onClick={() => onToggleSelect(site.id)}
      className={`relative rounded-xl border transition-all cursor-pointer select-none
        ${isSelected
          ? 'border-blue-400 ring-2 ring-blue-400/30 bg-blue-50/30 dark:border-blue-500 dark:ring-blue-500/20 dark:bg-blue-500/5'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]'
        }`}
    >
      {/* Selection indicator */}
      <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
        ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
        {isSelected && <Check className="w-3 h-3 text-white" />}
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pr-7">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{site.siteName}</p>
            <a
              href={`https://${site.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-0.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {site.domain}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>

        {/* Health */}
        <div className={`flex items-center justify-between rounded-lg px-3 py-2 mb-3 ${healthBg}`}>
          <div className="flex items-center gap-1.5">
            <HealthIcon className={`w-3.5 h-3.5 ${healthColor}`} />
            <span className={`text-xs font-medium ${healthColor}`}>Health Score</span>
          </div>
          <span className={`text-base font-bold ${healthColor}`}>{site.healthScore}%</span>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mb-0.5">WordPress</p>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{site.wordpressVersion || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mb-0.5">PHP</p>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{site.phpVersion || '—'}</p>
          </div>
        </div>

        {updates > 0 && (
          <div className="mb-3 px-2 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20">
            <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">
              {updates} Update{updates !== 1 ? 's' : ''} verfügbar
            </p>
          </div>
        )}

        {site.lastCheck && (
          <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-600 mb-3">
            <Clock className="w-3 h-3" />
            <span>{new Date(site.lastCheck).toLocaleDateString('de-DE')}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-white/[0.05]" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onAction('sync', site.id)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors
              bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
          >
            <RefreshCw className="w-3 h-3" /> Sync
          </button>
          <button
            onClick={() => onAction('backup', site.id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:text-green-400 dark:hover:bg-green-500/10 transition-colors"
            title="Backup"
          >
            <HardDrive className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onAction('healthcheck', site.id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-500/10 transition-colors"
            title="Health Check"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
