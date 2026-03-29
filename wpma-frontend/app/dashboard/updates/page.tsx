'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Package, Palette, Zap, CheckSquare, Square, Play, Clock, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import { sitesApi, bulkApi, updatesApi } from '../../../lib/api';
import { toast } from 'react-hot-toast';

export default function UpdatesPage() {
  const qc = useQueryClient();
  const [selectedSites, setSelectedSites] = useState<number[]>([]);
  const [expandedSite, setExpandedSite] = useState<number | null>(null);

  const { data: sitesData, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.getSites,
    refetchInterval: 60000,
  });
  const sites: any[] = (sitesData as any)?.data || (sitesData as any)?.sites || [];

  const bulkUpdateMut = useMutation({
    mutationFn: (opts: any) => bulkApi.runUpdates(selectedSites, opts),
    onSuccess: () => {
      toast.success('Bulk-Update gestartet');
      qc.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: () => toast.error('Update fehlgeschlagen'),
  });

  const sitesWithUpdates = sites.filter(
    s => (s.plugins_updates || 0) + (s.themes_updates || 0) + (s.core_update_available ? 1 : 0) > 0
  );

  const totalUpdates = sitesWithUpdates.reduce(
    (acc, s) => acc + (s.plugins_updates || 0) + (s.themes_updates || 0) + (s.core_update_available ? 1 : 0),
    0
  );

  function toggleSite(id: number) {
    setSelectedSites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function selectAll() {
    if (selectedSites.length === sitesWithUpdates.length) {
      setSelectedSites([]);
    } else {
      setSelectedSites(sitesWithUpdates.map(s => s.id));
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Updates</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {totalUpdates} ausstehende Updates auf {sitesWithUpdates.length} Sites
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Sites mit Updates', value: sitesWithUpdates.length, icon: RefreshCw, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Plugin-Updates', value: sites.reduce((a, s) => a + (s.plugins_updates || 0), 0), icon: Package, color: 'text-violet-600 dark:text-violet-400' },
          { label: 'Theme-Updates', value: sites.reduce((a, s) => a + (s.themes_updates || 0), 0), icon: Palette, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Core-Updates', value: sites.filter(s => s.core_update_available).length, icon: Zap, color: 'text-amber-600 dark:text-amber-400' },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
            <card.icon className={`w-5 h-5 mb-2 ${card.color}`} />
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{isLoading ? '…' : card.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      {selectedSites.length > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
            {selectedSites.length} Sites ausgewählt
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => bulkUpdateMut.mutate({ updatePlugins: true, updateThemes: true, updateCore: true, createBackup: true })}
              disabled={bulkUpdateMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              Alle Updates starten
            </button>
            <button
              onClick={() => bulkUpdateMut.mutate({ updatePlugins: true, createBackup: true })}
              disabled={bulkUpdateMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10"
            >
              Nur Plugins
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
          <button onClick={selectAll} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            {selectedSites.length === sitesWithUpdates.length && sitesWithUpdates.length > 0
              ? <CheckSquare className="w-4 h-4" />
              : <Square className="w-4 h-4" />}
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Site</span>
          <div className="ml-auto flex items-center gap-6 text-xs font-medium text-gray-500 dark:text-gray-400">
            <span>Plugins</span>
            <span>Themes</span>
            <span>Core</span>
            <span className="w-16"></span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">Lädt…</div>
        ) : sitesWithUpdates.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Alle Sites sind aktuell</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Keine ausstehenden Updates</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {sitesWithUpdates.map(site => (
              <li key={site.id}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                  <button onClick={() => toggleSite(site.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0">
                    {selectedSites.includes(site.id) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{site.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{site.url}</p>
                  </div>
                  <div className="flex items-center gap-6 ml-auto">
                    <span className={`text-sm font-semibold w-8 text-center ${(site.plugins_updates || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}>
                      {site.plugins_updates || 0}
                    </span>
                    <span className={`text-sm font-semibold w-8 text-center ${(site.themes_updates || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}>
                      {site.themes_updates || 0}
                    </span>
                    <span className={`text-sm font-semibold w-8 text-center ${site.core_update_available ? 'text-amber-600 dark:text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}>
                      {site.core_update_available ? '1' : '0'}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedSites([site.id]);
                        bulkUpdateMut.mutate({ updatePlugins: true, updateThemes: true, updateCore: true, createBackup: true });
                      }}
                      className="w-16 flex items-center justify-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                    >
                      <Play className="w-3 h-3" />
                      Update
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sites without updates */}
      {sites.filter(s => (s.plugins_updates || 0) + (s.themes_updates || 0) === 0 && !s.core_update_available).length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpandedSite(expandedSite === -1 ? null : -1)}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expandedSite === -1 ? 'rotate-180' : ''}`} />
            {sites.filter(s => (s.plugins_updates || 0) + (s.themes_updates || 0) === 0 && !s.core_update_available).length} Sites ohne Updates
          </button>
          {expandedSite === -1 && (
            <div className="mt-2 bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
              {sites.filter(s => (s.plugins_updates || 0) + (s.themes_updates || 0) === 0 && !s.core_update_available).map(site => (
                <div key={site.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-white/[0.04] last:border-0">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{site.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">Aktuell</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
