'use client';
import React, { useState } from 'react';
import { ChevronUp, ChevronDown, ExternalLink, RefreshCw, HardDrive, Activity, Plug, Loader2, ChevronRight } from 'lucide-react';
import type { Site, SortConfig } from '../../lib/dashboard-config';
import { SiteInlinePanel } from './site-inline-panel';

interface SiteTableProps {
  sites: Site[];
  visibleColumns: string[];
  sortConfig: SortConfig;
  onSortChange: (key: string) => void;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onAction: (action: 'update' | 'backup' | 'healthcheck' | 'sync', siteId: number) => void;
  onInstallPlugin?: (site: Site) => void;
  onVerifyPlugin?: (site: Site) => void;
  loadingIds?: Record<number, string>;
}

const COLUMN_LABELS: Record<string, string> = {
  domain: 'Domain',
  healthScore: 'Health',
  status: 'Status',
  wordpressVersion: 'WP',
  phpVersion: 'PHP',
  pluginsUpdates: 'Plugins',
  themesUpdates: 'Themes',
  lastCheck: 'Letzter Check',
};

function HealthBadge({ score }: { score: number }) {
  const color = score >= 90 ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10'
    : score >= 70 ? 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-500/10'
    : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {score}%
    </span>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' | null }) {
  if (!active || !direction) return <span className="w-3 h-3 opacity-30"><ChevronUp className="w-3 h-3" /></span>;
  return direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
}

export function SiteTable({
  sites, visibleColumns, sortConfig, onSortChange,
  selectedIds, onSelectionChange, onAction, onInstallPlugin, onVerifyPlugin, loadingIds = {},
}: SiteTableProps) {
  const allSelected = sites.length > 0 && selectedIds.length === sites.length;
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  function toggleAll() {
    onSelectionChange(allSelected ? [] : sites.map(s => s.id));
  }

  function toggleSelect(id: number) {
    onSelectionChange(
      selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]
    );
  }

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function renderCell(site: Site, col: string) {
    switch (col) {
      case 'domain': return (
        <div className="flex flex-col gap-0.5">
          <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline"
            onClick={e => e.stopPropagation()}>
            {site.domain}
            <ExternalLink className="w-3 h-3 opacity-50" />
          </a>
          {site.isConnected === false && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-500 dark:text-orange-400">
              <Plug className="w-2.5 h-2.5" /> Plugin nicht verbunden
            </span>
          )}
        </div>
      );
      case 'healthScore': return <HealthBadge score={site.healthScore} />;
      case 'status': return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
          ${site.status === 'active' ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
            : 'bg-gray-100 text-gray-600 dark:bg-white/[0.05] dark:text-gray-400'}`}>
          {site.status}
        </span>
      );
      case 'wordpressVersion': return <span className="text-xs text-gray-600 dark:text-gray-400">{site.wordpressVersion || '—'}</span>;
      case 'phpVersion': return <span className="text-xs text-gray-600 dark:text-gray-400">{site.phpVersion || '—'}</span>;
      case 'pluginsUpdates': return (
        <span className={`text-xs font-medium ${(site.pluginsUpdates ?? 0) > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>
          {site.pluginsUpdates ?? 0}
        </span>
      );
      case 'themesUpdates': return (
        <span className={`text-xs font-medium ${(site.themesUpdates ?? 0) > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>
          {site.themesUpdates ?? 0}
        </span>
      );
      case 'lastCheck': return (
        <span className="text-xs text-gray-500 dark:text-gray-500">
          {site.lastCheck ? new Date(site.lastCheck).toLocaleDateString('de-DE') : '—'}
        </span>
      );
      default: return null;
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-white/[0.02]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
              <th className="w-8 px-3 py-3" />
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
              </th>
              {visibleColumns.map(col => (
                <th
                  key={col}
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-500 cursor-pointer hover:text-gray-900 dark:hover:text-gray-300 select-none"
                  onClick={() => onSortChange(col)}
                >
                  <span className="inline-flex items-center gap-1">
                    {COLUMN_LABELS[col] ?? col}
                    <SortIcon active={sortConfig.key === col} direction={sortConfig.direction} />
                  </span>
                </th>
              ))}
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-500">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {sites.map(site => {
              const isExpanded = expandedIds.has(site.id);
              return (
                <React.Fragment key={site.id}>
                  <tr
                    className={`border-b border-gray-50 dark:border-white/[0.04] transition-colors
                      ${selectedIds.includes(site.id) ? 'bg-blue-50/50 dark:bg-blue-500/5' : isExpanded ? 'bg-gray-50/80 dark:bg-white/[0.03]' : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]'}
                      ${isExpanded ? 'border-b-0' : ''}`}
                  >
                    {/* Expand toggle */}
                    <td className="px-2 py-3">
                      <button
                        onClick={() => toggleExpand(site.id)}
                        title={isExpanded ? 'Einklappen' : 'Alle Features anzeigen'}
                        className={`p-1 rounded-lg transition-colors
                          ${isExpanded
                            ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10'
                            : 'text-gray-300 hover:text-gray-600 dark:text-gray-700 dark:hover:text-gray-400'}`}
                      >
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                    </td>

                    {/* Checkbox */}
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(site.id)}
                        onChange={() => toggleSelect(site.id)}
                        onClick={e => e.stopPropagation()}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </td>

                    {/* Data columns */}
                    {visibleColumns.map(col => (
                      <td key={col} className="px-3 py-3 cursor-pointer" onClick={() => toggleExpand(site.id)}>
                        {renderCell(site, col)}
                      </td>
                    ))}

                    {/* Actions */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        {loadingIds[site.id] ? (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 pr-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                            {loadingIds[site.id] === 'healthcheck' ? 'Check...' : loadingIds[site.id] === 'backup' ? 'Backup...' : 'Sync...'}
                          </div>
                        ) : site.isConnected === false ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onInstallPlugin?.(site)}
                              title="Plugin herunterladen & installieren"
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 dark:text-orange-400 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 transition-colors"
                            >
                              <Plug className="w-3 h-3" /> Plugin installieren
                            </button>
                            <button
                              onClick={() => onVerifyPlugin?.(site)}
                              title="Verbindung prüfen (nach Plugin-Aktivierung)"
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" /> Verbinden
                            </button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => onAction('sync', site.id)} title="Sync" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10 transition-colors">
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => onAction('backup', site.id)} title="Backup" className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:text-green-400 dark:hover:bg-green-500/10 transition-colors">
                              <HardDrive className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => onAction('healthcheck', site.id)} title="Health Check" className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-500/10 transition-colors">
                              <Activity className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline Panel - expands below row */}
                  {isExpanded && (
                    <tr className="border-b border-gray-100 dark:border-white/[0.06]">
                      <td colSpan={visibleColumns.length + 3} className="p-0">
                        <SiteInlinePanel site={site} onAction={onAction} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
