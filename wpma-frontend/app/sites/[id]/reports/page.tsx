'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Calendar, ArrowLeft, Loader2, CheckCircle, Clock } from 'lucide-react';
import { reportsApi } from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { toast } from 'react-hot-toast';

export default function ReportsPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;
  const [generating, setGenerating] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [selectedPeriod, setSelectedPeriod] = useState('30d');

  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const response = await reportsApi.getReports(20);
      if (response.success) {
        return response.data;
      }
      return [];
    }
  });

  const handleGenerateReport = async () => {
    setGenerating(true);
    const loadingToast = toast.loading('Generiere Wartungsbericht...');

    try {
      const response = await reportsApi.generateReport(siteId, {
        format: selectedFormat,
        period: selectedPeriod
      });

      toast.dismiss(loadingToast);

      if (response.success) {
        toast.success('Wartungsbericht erfolgreich erstellt!', { duration: 5000 });
        refetch();
        
        // Auto-Download
        const downloadUrl = reportsApi.downloadReport(response.data.reportId);
        window.open(downloadUrl, '_blank');
      } else {
        toast.error(response.error || 'Fehler beim Generieren');
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error(error?.message || 'Fehler beim Generieren');
    } finally {
      setGenerating(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Wartungsberichte</h1>
            <p className="text-gray-600 mt-1">
              Erstelle professionelle Berichte für deine Kunden
            </p>
          </div>
        </div>

        {/* Generate Report Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Neuen Bericht erstellen</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format
                </label>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={generating}
                >
                  <option value="pdf">PDF</option>
                  <option value="html">HTML</option>
                </select>
              </div>

              {/* Period Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zeitraum
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={generating}
                >
                  <option value="7d">Letzte 7 Tage</option>
                  <option value="30d">Letzte 30 Tage</option>
                  <option value="90d">Letzte 90 Tage</option>
                </select>
              </div>

              {/* Generate Button */}
              <div className="flex items-end">
                <Button
                  onClick={handleGenerateReport}
                  disabled={generating}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Wird erstellt...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Bericht erstellen
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">Der Bericht enthält:</p>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Alle durchgeführten Updates</li>
                    <li>• Sicherheits-Scans und Ergebnisse</li>
                    <li>• Performance-Metriken</li>
                    <li>• Backup-Status</li>
                    <li>• Self-Healing Aktionen</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reports History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Verlauf</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-600 mt-2">Lade Berichte...</p>
              </div>
            ) : reports && reports.length > 0 ? (
              <div className="space-y-3">
                {reports.map((report: any) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold">
                          Wartungsbericht - {report.period_days} Tage
                        </h4>
                        <div className="flex items-center space-x-3 text-sm text-gray-600 mt-1">
                          <span>{new Date(report.generated_at).toLocaleDateString('de-DE')}</span>
                          <span>•</span>
                          <span className="uppercase">{report.file_format}</span>
                          {report.file_size && (
                            <>
                              <span>•</span>
                              <span>{formatFileSize(report.file_size)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => window.open(reportsApi.downloadReport(report.id), '_blank')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Noch keine Berichte
                </h3>
                <p className="text-gray-600">
                  Erstelle deinen ersten Wartungsbericht
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scheduled Reports */}
        <Card className="mt-8 bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Automatischer Versand</h3>
                <p className="text-gray-700 mb-3">
                  Plane automatische monatliche Berichte für deine Kunden. Die Berichte werden
                  automatisch generiert und per E-Mail verschickt.
                </p>
                <Button variant="outline" className="bg-white">
                  <Calendar className="w-4 h-4 mr-2" />
                  Automatik einrichten (Coming Soon)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
