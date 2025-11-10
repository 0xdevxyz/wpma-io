'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import PerformanceChart from '@/components/dashboard/performance-chart';

interface PerformanceMetric {
  id: string;
  siteId: string;
  pageLoadTime: number;
  memoryUsage: number;
  databaseQueries: number;
  coreWebVitals: {
    lcp: number;
    fid: number;
    cls: number;
  };
  timestamp: string;
}

export default function PerformancePage() {
  const params = useParams();
  const siteId = params.id as string;

  const { data: metrics, isLoading, error } = useQuery<PerformanceMetric[]>({
    queryKey: ['performance', siteId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/performance/${siteId}/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch performance metrics');
      const data = await response.json();
      return data.data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: analysis } = useQuery({
    queryKey: ['performance-analysis', siteId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/performance/${siteId}/analysis`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch analysis');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="p-6 bg-red-50 border-red-200">
          <h2 className="text-red-800 font-semibold mb-2">Fehler beim Laden der Daten</h2>
          <p className="text-red-600">{(error as Error).message}</p>
        </Card>
      </div>
    );
  }

  const latestMetric = metrics?.[0];
  const avgLoadTime = metrics?.length ? 
    metrics.reduce((sum, m) => sum + m.pageLoadTime, 0) / metrics.length : 0;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Performance-Überwachung</h1>
        <p className="text-gray-600">Echtzeit-Metriken und Analyse Ihrer Website-Performance</p>
      </div>

      {/* Aktuelle Metriken */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Ladezeit</h3>
          <p className="text-3xl font-bold">{latestMetric?.pageLoadTime || 0}ms</p>
          <p className="text-xs text-gray-500 mt-1">
            ⌀ {Math.round(avgLoadTime)}ms
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">LCP (Largest Contentful Paint)</h3>
          <p className={`text-3xl font-bold ${
            (latestMetric?.coreWebVitals?.lcp || 0) < 2500 ? 'text-green-600' : 
            (latestMetric?.coreWebVitals?.lcp || 0) < 4000 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {Math.round(latestMetric?.coreWebVitals?.lcp || 0)}ms
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {(latestMetric?.coreWebVitals?.lcp || 0) < 2500 ? '✓ Gut' : 
             (latestMetric?.coreWebVitals?.lcp || 0) < 4000 ? '⚠ Verbesserungswürdig' : '✗ Schlecht'}
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">FID (First Input Delay)</h3>
          <p className={`text-3xl font-bold ${
            (latestMetric?.coreWebVitals?.fid || 0) < 100 ? 'text-green-600' : 
            (latestMetric?.coreWebVitals?.fid || 0) < 300 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {Math.round(latestMetric?.coreWebVitals?.fid || 0)}ms
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {(latestMetric?.coreWebVitals?.fid || 0) < 100 ? '✓ Gut' : 
             (latestMetric?.coreWebVitals?.fid || 0) < 300 ? '⚠ Verbesserungswürdig' : '✗ Schlecht'}
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">CLS (Cumulative Layout Shift)</h3>
          <p className={`text-3xl font-bold ${
            (latestMetric?.coreWebVitals?.cls || 0) < 0.1 ? 'text-green-600' : 
            (latestMetric?.coreWebVitals?.cls || 0) < 0.25 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {(latestMetric?.coreWebVitals?.cls || 0).toFixed(3)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {(latestMetric?.coreWebVitals?.cls || 0) < 0.1 ? '✓ Gut' : 
             (latestMetric?.coreWebVitals?.cls || 0) < 0.25 ? '⚠ Verbesserungswürdig' : '✗ Schlecht'}
          </p>
        </Card>
      </div>

      {/* Performance-Chart */}
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Performance-Verlauf (24h)</h2>
        <PerformanceChart metrics={metrics || []} />
      </Card>

      {/* Weitere Metriken */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Ressourcen-Nutzung</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Speichernutzung:</span>
              <span className="font-semibold">
                {((latestMetric?.memoryUsage || 0) / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">DB-Abfragen:</span>
              <span className="font-semibold">{latestMetric?.databaseQueries || 0}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">AI-Empfehlungen</h3>
          {analysis?.data?.recommendations?.length > 0 ? (
            <ul className="space-y-2">
              {analysis.data.recommendations.slice(0, 3).map((rec: string, idx: number) => (
                <li key={idx} className="text-sm text-gray-700 flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">
              Keine Empfehlungen verfügbar. Die Performance ist optimal!
            </p>
          )}
        </Card>
      </div>

      {/* Metriken-Historie */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Metriken-Historie</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4">Zeitstempel</th>
                <th className="text-left py-2 px-4">Ladezeit</th>
                <th className="text-left py-2 px-4">LCP</th>
                <th className="text-left py-2 px-4">FID</th>
                <th className="text-left py-2 px-4">CLS</th>
                <th className="text-left py-2 px-4">DB-Abfragen</th>
              </tr>
            </thead>
            <tbody>
              {metrics?.slice(0, 10).map((metric) => (
                <tr key={metric.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4">
                    {new Date(metric.timestamp).toLocaleString('de-DE')}
                  </td>
                  <td className="py-2 px-4">{metric.pageLoadTime}ms</td>
                  <td className="py-2 px-4">{Math.round(metric.coreWebVitals?.lcp || 0)}ms</td>
                  <td className="py-2 px-4">{Math.round(metric.coreWebVitals?.fid || 0)}ms</td>
                  <td className="py-2 px-4">{(metric.coreWebVitals?.cls || 0).toFixed(3)}</td>
                  <td className="py-2 px-4">{metric.databaseQueries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

