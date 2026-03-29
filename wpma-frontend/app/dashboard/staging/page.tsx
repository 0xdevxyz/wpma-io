'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, ArrowUpFromLine, ArrowDownToLine, Trash2, ExternalLink, Loader, CheckCircle } from 'lucide-react';
import { sitesApi, stagingApi } from '../../../lib/api';
import { toast } from 'react-hot-toast';

export default function StagingPage() {
  const qc = useQueryClient();
  const [creatingSiteId, setCreatingSiteId] = useState<number | null>(null);

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.getSites,
  });
  const sites: any[] = (sitesData as any)?.data || (sitesData as any)?.sites || [];

  const { data: stagingData, isLoading } = useQuery({
    queryKey: ['staging'],
    queryFn: () => stagingApi.list(),
    refetchInterval: 30000,
  });
  const stagingEnvs: any[] = (stagingData as any)?.data || [];

  const createMut = useMutation({
    mutationFn: (siteId: number) => stagingApi.create(String(siteId)),
    onSuccess: () => {
      toast.success('Staging-Umgebung wird erstellt…');
      qc.invalidateQueries({ queryKey: ['staging'] });
      setCreatingSiteId(null);
    },
    onError: () => { toast.error('Erstellen fehlgeschlagen'); setCreatingSiteId(null); },
  });

  const pushMut = useMutation({
    mutationFn: (id: number) => stagingApi.push(id, { createBackupFirst: true }),
    onSuccess: () => { toast.success('Push nach Live gestartet'); qc.invalidateQueries({ queryKey: ['staging'] }); },
    onError: () => toast.error('Push fehlgeschlagen'),
  });

  const pullMut = useMutation({
    mutationFn: (id: number) => stagingApi.pull(id),
    onSuccess: () => { toast.success('Pull von Live gestartet'); qc.invalidateQueries({ queryKey: ['staging'] }); },
    onError: () => toast.error('Pull fehlgeschlagen'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => stagingApi.remove(id),
    onSuccess: () => { toast.success('Staging-Umgebung gelöscht'); qc.invalidateQueries({ queryKey: ['staging'] }); },
    onError: () => toast.error('Löschen fehlgeschlagen'),
  });

  const sitesWithoutStaging = sites.filter(
    s => !stagingEnvs.some(se => se.site_id === s.id || se.siteId === s.id)
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staging</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Test- und Staging-Umgebungen verwalten</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <Layers className="w-5 h-5 mb-2 text-blue-600 dark:text-blue-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stagingEnvs.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Aktive Stagings</div>
        </div>
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <CheckCircle className="w-5 h-5 mb-2 text-green-600 dark:text-green-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stagingEnvs.filter(se => se.status === 'active' || se.status === 'ready').length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Bereit</div>
        </div>
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <Layers className="w-5 h-5 mb-2 text-gray-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{sitesWithoutStaging.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ohne Staging</div>
        </div>
      </div>

      {/* Active stagings */}
      {stagingEnvs.length > 0 && (
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Aktive Staging-Umgebungen</h2>
          </div>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">Lädt…</div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {stagingEnvs.map(env => (
                <li key={env.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    env.status === 'active' || env.status === 'ready' ? 'bg-green-500' : 'bg-amber-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {env.name || env.stagingUrl || 'Staging'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {env.status} · Erstellt: {new Date(env.created_at || env.createdAt).toLocaleDateString('de')}
                    </p>
                  </div>
                  {env.stagingUrl && (
                    <a href={env.stagingUrl} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => pushMut.mutate(env.id)}
                    disabled={pushMut.isPending}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg
                      bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400
                      hover:bg-blue-100 dark:hover:bg-blue-500/20 disabled:opacity-50"
                    title="Zu Live pushen"
                  >
                    <ArrowUpFromLine className="w-3 h-3" />
                    Live
                  </button>
                  <button
                    onClick={() => pullMut.mutate(env.id)}
                    disabled={pullMut.isPending}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg
                      bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300
                      hover:bg-gray-200 dark:hover:bg-white/20 disabled:opacity-50"
                    title="Von Live pullen"
                  >
                    <ArrowDownToLine className="w-3 h-3" />
                    Pull
                  </button>
                  <button
                    onClick={() => { if (confirm('Staging löschen?')) deleteMut.mutate(env.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Sites without staging */}
      {sitesWithoutStaging.length > 0 && (
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Sites ohne Staging</h2>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {sitesWithoutStaging.map(site => (
              <li key={site.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{site.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{site.url}</p>
                </div>
                <button
                  onClick={() => { setCreatingSiteId(site.id); createMut.mutate(site.id); }}
                  disabled={createMut.isPending && creatingSiteId === site.id}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg
                    bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMut.isPending && creatingSiteId === site.id
                    ? <Loader className="w-3 h-3 animate-spin" />
                    : <Plus className="w-3 h-3" />}
                  Staging erstellen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
