'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PerformanceMetric {
  id: string;
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

interface PerformanceChartProps {
  metrics: PerformanceMetric[];
}

export default function PerformanceChart({ metrics }: PerformanceChartProps) {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        Keine Performance-Daten verfügbar
      </div>
    );
  }

  // Sort metrics by timestamp (oldest first for chart)
  const sortedMetrics = [...metrics].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const labels = sortedMetrics.map(m => {
    const date = new Date(m.timestamp);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  });

  const data = {
    labels,
    datasets: [
      {
        label: 'Ladezeit (ms)',
        data: sortedMetrics.map(m => m.pageLoadTime),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y',
      },
      {
        label: 'LCP (ms)',
        data: sortedMetrics.map(m => m.coreWebVitals?.lcp || 0),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y',
      },
      {
        label: 'DB-Abfragen',
        data: sortedMetrics.map(m => m.databaseQueries),
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y1',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 13,
        },
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Zeit (ms)',
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Anzahl Abfragen',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
    },
  };

  return (
    <div className="h-96">
      <Line data={data} options={options} />
    </div>
  );
}

