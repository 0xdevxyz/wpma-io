'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { pluginsApi } from '../../../../lib/api';
import { Package, RefreshCw, Power, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function PluginsPage() {
  const { id: siteId } = useParams() as { id: string };
  const [updating, setUpdating] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['plugins', siteId],
    queryFn: async () => {
      const r = await pluginsApi.getPlugins(siteId);
      return r.success ? (r.data || []) : [];
    },
    enabled: !!siteId,
  });

  const plugins: any[] = data || [];
  const updatable = plugins.filter(p => p.updateAvailable);

  async function handleUpdate(slug: string, name: string) {
    setUpdating(slug);
    try {
      const r = await pluginsApi.updatePlugin(siteId, slug);
      if (r.success) { toast.success(`${name} aktualisiert`); refetch(); }
      else toast.error(r.error || 'Update fehlgeschlagen');
    } catch { toast.error('Update fehlgeschlagen'); }
    finally { setUpdating(null); }
  }

  async function handleToggle(slug: string, name: string, active: boolean) {
    try {
      const r = await pluginsApi.togglePlugin(siteId, slug, !active);
      if (r.success) { toast.success(`${name} ${!active ? 'aktiviert' : 'deaktiviert'}`); refetch(); }
      else toast.error(r.error || 'Fehler');
    } catch { toast.error('Fehler'); }
  }

  async function handleDelete(slug: string, name: string) {
    if (!confirm(`${name} wirklich löschen?`)) return;
    try {
      const r = await pluginsApi.deletePlugin(siteId, slug);
      if (r.success) { toast.success(`${name} gelöscht`); refetch(); }
      else toast.error(r.error || 'Fehler');
    } catch { toast.error('Fehler'); }
  }

  async function handleUpdateAll() {
    for (const p of updatable) {
      await handleUpdate(p.slug, p.name);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] pt-20 pb-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Plugins</h1>
            <p className="text-sm text-gray-500 mt-0.5">{plugins.length} installiert{updatable.length > 0 ? `, ${updatable.length} Updates verfügbar` : ''}</p>
          </div>
          {updatable.length > 0 && (
            <button
              onClick={handleUpdateAll}
              disabled={updating !== null}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
              Alle updaten
            </button>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-gray-400">Lade Plugins...</div>
          ) : plugins.length === 0 ? (
            <div className="p-10 text-center">
              <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Keine Plugins gefunden. Stelle sicher, dass das WPMA-Plugin verbunden ist.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Plugin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {plugins.map((plugin: any) => (
                  <tr key={plugin.slug} className="border-b last:border-0 border-gray-50 dark:border-white/[0.04]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{plugin.name}</p>
                      {plugin.updateAvailable && (
                        <span className="text-[11px] text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-0.5">
                          <ChevronUp className="w-3 h-3" /> {plugin.newVersion} verfügbar
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{plugin.version}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${plugin.active ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.05]'}`}>
                        {plugin.active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {plugin.updateAvailable && (
                          <button
                            onClick={() => handleUpdate(plugin.slug, plugin.name)}
                            disabled={updating === plugin.slug}
                            title="Updaten"
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${updating === plugin.slug ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggle(plugin.slug, plugin.name, plugin.active)}
                          title={plugin.active ? 'Deaktivieren' : 'Aktivieren'}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(plugin.slug, plugin.name)}
                          title="Löschen"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
