'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../../../lib/api';
import { FileText, Download, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ReportsPage() {
  const { id: siteId } = useParams() as { id: string };
  const [generating, setGenerating] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reports', siteId],
    queryFn: async () => {
      const r = await reportsApi.getReports(siteId);
      return r.success ? (r.data || []) : [];
    },
    enabled: !!siteId,
  });

  const reports: any[] = data || [];

  async function handleGenerate() {
    setGenerating(true);
    try {
      const r = await reportsApi.generateReport(siteId, { format: 'pdf', period: 'monthly' });
      if (r.success) { toast.success('Report wird generiert'); refetch(); }
      else toast.error(r.error || 'Fehler beim Generieren');
    } catch { toast.error('Fehler beim Generieren'); }
    finally { setGenerating(false); }
  }

  async function handleDelete(scheduleId: string) {
    try {
      const r = await reportsApi.deleteScheduledReport(scheduleId);
      if (r.success) { toast.success('Gelöscht'); refetch(); }
      else toast.error(r.error || 'Fehler');
    } catch { toast.error('Fehler'); }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] pt-20 pb-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">Wartungsberichte generieren und herunterladen</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {generating
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Plus className="w-4 h-4" />}
            Report erstellen
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-gray-400">Lade Reports...</div>
          ) : reports.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400 mb-4">Noch keine Reports vorhanden</p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Ersten Report erstellen
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Report</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Zeitraum</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Erstellt</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report: any) => (
                  <tr key={report.id} className="border-b last:border-0 border-gray-50 dark:border-white/[0.04]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white">{report.filename || `Report #${report.id}`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{report.period || 'Monatlich'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {report.createdAt ? new Date(report.createdAt).toLocaleDateString('de-DE') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${report.status === 'completed' ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                          : report.status === 'pending' ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400'
                          : 'bg-gray-100 text-gray-500'}`}>
                        {report.status === 'completed' ? 'Fertig' : report.status === 'pending' ? 'In Bearbeitung' : report.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {report.status === 'completed' && report.filename && (
                          <a
                            href={reportsApi.downloadReport(report.filename)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                            title="Herunterladen"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(String(report.id))}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          title="Löschen"
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
