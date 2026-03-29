'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HardDrive, Plus, Download, RotateCcw, Trash2, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';
import { sitesApi, backupApi } from '../../../lib/api';
import { toast } from 'react-hot-toast';

function BackupList({ site }: { site: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: backupsData, isLoading } = useQuery({
    queryKey: ['backups', site.id],
    queryFn: () => backupApi.getBackups(String(site.id)),
    staleTime: 60000,
    enabled: open,
  });
  const backups: any[] = (backupsData as any)?.data || [];

  const createMut = useMutation({
    mutationFn: () => backupApi.createBackup(String(site.id), 'full'),
    onSuccess: () => {
      toast.success('Backup gestartet');
      qc.invalidateQueries({ queryKey: ['backups', site.id] });
    },
    onError: () => toast.error('Backup fehlgeschlagen'),
  });

  const restoreMut = useMutation({
    mutationFn: ({ backupId }: { backupId: string }) => backupApi.restoreBackup(backupId, String(site.id)),
    onSuccess: () => toast.success('Wiederherstellung gestartet'),
    onError: () => toast.error('Wiederherstellung fehlgeschlagen'),
  });

  const deleteMut = useMutation({
    mutationFn: ({ backupId }: { backupId: string }) => backupApi.deleteBackup(backupId),
    onSuccess: () => {
      toast.success('Backup gelöscht');
      qc.invalidateQueries({ queryKey: ['backups', site.id] });
    },
    onError: () => toast.error('Löschen fehlgeschlagen'),
  });

  const lastBackup = site.last_backup ? new Date(site.last_backup).toLocaleDateString('de') : 'Nie';

  return (
    <div className="border-b border-gray-100 dark:border-white/[0.04] last:border-0">
      <div
        className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] cursor-pointer"
        onClick={() => setOpen(v => !v)}
      >
        <HardDrive className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{site.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Letztes Backup: {lastBackup}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); createMut.mutate(); }}
          disabled={createMut.isPending}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg
            bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createMut.isPending ? <Loader className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Backup
        </button>
      </div>
      {open && (
        <div className="px-4 pb-4">
          {isLoading ? (
            <div className="text-center py-4 text-sm text-gray-400">Lädt…</div>
          ) : backups.length === 0 ? (
            <div className="text-center py-4 text-sm text-gray-400">Keine Backups vorhanden</div>
          ) : (
            <ul className="space-y-2">
              {backups.slice(0, 10).map(b => (
                <li key={b.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/[0.03] rounded-lg">
                  {b.status === 'completed' ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    : b.status === 'failed' ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    : <Loader className="w-4 h-4 text-blue-500 flex-shrink-0 animate-spin" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white">
                      {b.backup_type || 'Full'} Backup
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(b.created_at || b.started_at).toLocaleString('de')}
                      {b.file_size ? ` · ${(b.file_size / 1024 / 1024).toFixed(1)} MB` : ''}
                    </p>
                  </div>
                  {b.status === 'completed' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => restoreMut.mutate({ backupId: String(b.id) })}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10"
                        title="Wiederherstellen"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      {b.file_path && (
                        <a
                          href={backupApi.downloadBackup(String(b.id)) as unknown as string}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10"
                          title="Herunterladen"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => { if (confirm('Backup löschen?')) deleteMut.mutate({ backupId: String(b.id) }); }}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                        title="Löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function BackupsPage() {
  const { data: sitesData, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.getSites,
  });
  const sites: any[] = (sitesData as any)?.data || (sitesData as any)?.sites || [];
  const qc = useQueryClient();

  const bulkBackupMut = useMutation({
    mutationFn: () => Promise.all(sites.map(s => backupApi.createBackup(String(s.id), 'full'))),
    onSuccess: () => {
      toast.success('Bulk-Backup für alle Sites gestartet');
      qc.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: () => toast.error('Backup-Fehler'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Backups</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Backup-Verwaltung für alle Sites</p>
        </div>
        <button
          onClick={() => bulkBackupMut.mutate()}
          disabled={bulkBackupMut.isPending || sites.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {bulkBackupMut.isPending ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Alle Sites sichern
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <HardDrive className="w-5 h-5 mb-2 text-blue-600 dark:text-blue-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{sites.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sites gesichert</div>
        </div>
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <CheckCircle className="w-5 h-5 mb-2 text-green-600 dark:text-green-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {sites.filter(s => s.last_backup).length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Mit Backup</div>
        </div>
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
          <Clock className="w-5 h-5 mb-2 text-amber-600 dark:text-amber-400" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {sites.filter(s => !s.last_backup).length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Nie gesichert</div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Backups nach Site</h2>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">Lädt…</div>
        ) : sites.length === 0 ? (
          <div className="py-12 text-center">
            <HardDrive className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Keine Sites vorhanden</p>
          </div>
        ) : (
          sites.map(site => <BackupList key={site.id} site={site} />)
        )}
      </div>
    </div>
  );
}
