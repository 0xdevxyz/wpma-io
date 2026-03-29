'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Download, Trash2, Loader, CheckCircle, XCircle, Clock } from 'lucide-react';
import { sitesApi, reportsApi } from '../../../lib/api';
import { toast } from 'react-hot-toast';

export default function ReportsPage() {
  const qc = useQueryClient();
  const [selectedSite, setSelectedSite] = useState('');
  const [format, setFormat] = useState('pdf');
  const [period, setPeriod] = useState('monthly');

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.getSites,
  });
  const sites: any[] = (sitesData as any)?.data || (sitesData as any)?.sites || [];

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['reports', selectedSite],
    queryFn: () => selectedSite ? reportsApi.getReports(selectedSite) : Promise.resolve({ data: [] }),
    enabled: !!selectedSite,
    staleTime: 30000,
  });
  const reports: any[] = (reportsData as any)?.data || [];

  const { data: scheduledData } = useQuery({
    queryKey: ['scheduled-reports'],
    queryFn: reportsApi.getScheduledReports,
    staleTime: 60000,
  });
  const scheduled: any[] = (scheduledData as any)?.data || [];

  const generateMut = useMutation({
    mutationFn: () => reportsApi.generateReport(selectedSite, { format, period }),
    onSuccess: () => {
      toast.success('Bericht wird generiert…');
      qc.invalidateQueries({ queryKey: ['reports', selectedSite] });
    },
    onError: () => toast.error('Generierung fehlgeschlagen'),
  });

  const scheduleMut = useMutation({
    mutationFn: () => reportsApi.scheduleReport(selectedSite, { frequency: period, format }),
    onSuccess: () => {
      toast.success('Bericht geplant');
      qc.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
    onError: () => toast.error('Planung fehlgeschlagen'),
  });

  const deleteScheduleMut = useMutation({
    mutationFn: (id: string) => reportsApi.deleteScheduledReport(id),
    onSuccess: () => { toast.success('Geplanter Bericht gelöscht'); qc.invalidateQueries({ queryKey: ['scheduled-reports'] }); },
    onError: () => toast.error('Löschen fehlgeschlagen'),
  });

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'failed') return <XCircle className="w-4 h-4 text-red-500" />;
    return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Berichte</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Wartungsberichte generieren und herunterladen</p>
      </div>

      {/* Generate form */}
      <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Neuen Bericht erstellen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Site</label>
            <select
              value={selectedSite}
              onChange={e => setSelectedSite(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white"
            >
              <option value="">Site wählen…</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Format</label>
            <select
              value={format}
              onChange={e => setFormat(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white"
            >
              <option value="pdf">PDF</option>
              <option value="html">HTML</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Zeitraum</label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white"
            >
              <option value="weekly">Wöchentlich</option>
              <option value="monthly">Monatlich</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => generateMut.mutate()}
            disabled={!selectedSite || generateMut.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {generateMut.isPending ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Jetzt generieren
          </button>
          <button
            onClick={() => scheduleMut.mutate()}
            disabled={!selectedSite || scheduleMut.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 disabled:opacity-50 border border-gray-200 dark:border-white/10"
          >
            <Clock className="w-4 h-4" />
            Planen
          </button>
        </div>
      </div>

      {/* Report list */}
      {selectedSite && (
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Generierte Berichte</h2>
          </div>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">Lädt…</div>
          ) : reports.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">Keine Berichte vorhanden</div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {reports.map(r => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3.5">
                  {statusIcon(r.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {r.report_type || 'Wartungsbericht'} · {r.format?.toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(r.created_at).toLocaleString('de')}
                    </p>
                  </div>
                  {r.status === 'completed' && r.file_path && (
                    <a
                      href={reportsApi.downloadReport(r.file_path.split('/').pop())}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Scheduled reports */}
      {scheduled.length > 0 && (
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Geplante Berichte</h2>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {scheduled.map(s => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3.5">
                <Clock className="w-4 h-4 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white">{s.frequency} · {s.format?.toUpperCase()}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Nächste Ausführung: {s.next_run_at ? new Date(s.next_run_at).toLocaleDateString('de') : '—'}
                  </p>
                </div>
                <button
                  onClick={() => deleteScheduleMut.mutate(String(s.id))}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
