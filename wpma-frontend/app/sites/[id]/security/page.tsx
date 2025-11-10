'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface SecurityScan {
  id: string;
  siteId: string;
  scanType: string;
  vulnerabilities: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    description: string;
    recommendation: string;
  }>;
  securityScore: number;
  sslEnabled: boolean;
  debugMode: boolean;
  fileEditDisabled: boolean;
  outdatedPlugins: Array<{
    name: string;
    currentVersion: string;
    latestVersion: string;
  }>;
  outdatedThemes: Array<{
    name: string;
    currentVersion: string;
  }>;
  timestamp: string;
}

export default function SecurityPage() {
  const params = useParams();
  const siteId = params.id as string;

  const { data: scans, isLoading, error } = useQuery<SecurityScan[]>({
    queryKey: ['security', siteId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/security/${siteId}/scans`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch security scans');
      const data = await response.json();
      return data.data || [];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const triggerScan = async () => {
    const token = localStorage.getItem('token');
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/security/${siteId}/scan`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });
  };

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

  const latestScan = scans?.[0];
  const criticalCount = latestScan?.vulnerabilities?.filter(v => v.severity === 'critical').length || 0;
  const highCount = latestScan?.vulnerabilities?.filter(v => v.severity === 'high').length || 0;
  const mediumCount = latestScan?.vulnerabilities?.filter(v => v.severity === 'medium').length || 0;

  const securityScore = latestScan?.securityScore || 0;
  const scoreColor = securityScore >= 80 ? 'text-green-600' : 
                     securityScore >= 60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Sicherheits-Überwachung</h1>
          <p className="text-gray-600">Aktuelle Sicherheitsstatus und Schwachstellen</p>
        </div>
        <button
          onClick={triggerScan}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Neuen Scan starten
        </button>
      </div>

      {/* Sicherheits-Score */}
      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Shield className="w-12 h-12 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold">Sicherheits-Score</h2>
              <p className="text-gray-600">Letzter Scan: {latestScan ? new Date(latestScan.timestamp).toLocaleString('de-DE') : 'Nie'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-5xl font-bold ${scoreColor}`}>{securityScore}/100</p>
            <p className="text-sm text-gray-500">
              {securityScore >= 80 ? 'Hervorragend' : 
               securityScore >= 60 ? 'Verbesserungswürdig' : 'Kritisch'}
            </p>
          </div>
        </div>
      </Card>

      {/* Schwachstellen-Übersicht */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-red-800 mb-1">Kritische Schwachstellen</h3>
              <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
            </div>
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
        </Card>

        <Card className="p-6 border-orange-200 bg-orange-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-orange-800 mb-1">Hohe Priorität</h3>
              <p className="text-3xl font-bold text-orange-600">{highCount}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-orange-400" />
          </div>
        </Card>

        <Card className="p-6 border-yellow-200 bg-yellow-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-yellow-800 mb-1">Mittlere Priorität</h3>
              <p className="text-3xl font-bold text-yellow-600">{mediumCount}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-yellow-400" />
          </div>
        </Card>
      </div>

      {/* Sicherheits-Checks */}
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Sicherheits-Checks</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="font-medium">SSL/HTTPS aktiviert</span>
            {latestScan?.sslEnabled ? (
              <CheckCircle className="text-green-600 w-5 h-5" />
            ) : (
              <XCircle className="text-red-600 w-5 h-5" />
            )}
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="font-medium">Debug-Modus deaktiviert</span>
            {!latestScan?.debugMode ? (
              <CheckCircle className="text-green-600 w-5 h-5" />
            ) : (
              <XCircle className="text-red-600 w-5 h-5" />
            )}
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="font-medium">Dateibearbeitung deaktiviert</span>
            {latestScan?.fileEditDisabled ? (
              <CheckCircle className="text-green-600 w-5 h-5" />
            ) : (
              <XCircle className="text-red-600 w-5 h-5" />
            )}
          </div>
        </div>
      </Card>

      {/* Veraltete Plugins */}
      {latestScan?.outdatedPlugins && latestScan.outdatedPlugins.length > 0 && (
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Veraltete Plugins ({latestScan.outdatedPlugins.length})</h2>
          <div className="space-y-2">
            {latestScan.outdatedPlugins.map((plugin, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 px-4 bg-yellow-50 rounded">
                <div>
                  <p className="font-medium">{plugin.name}</p>
                  <p className="text-sm text-gray-600">
                    Version {plugin.currentVersion} → {plugin.latestVersion}
                  </p>
                </div>
                <AlertTriangle className="text-yellow-600 w-5 h-5" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Schwachstellen-Details */}
      {latestScan?.vulnerabilities && latestScan.vulnerabilities.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Gefundene Schwachstellen</h2>
          <div className="space-y-4">
            {latestScan.vulnerabilities.map((vuln, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-lg border ${
                  vuln.severity === 'critical' ? 'bg-red-50 border-red-200' :
                  vuln.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                  vuln.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{vuln.type}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    vuln.severity === 'critical' ? 'bg-red-200 text-red-800' :
                    vuln.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                    vuln.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {vuln.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{vuln.description}</p>
                <p className="text-sm text-gray-600">
                  <strong>Empfehlung:</strong> {vuln.recommendation}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Keine Schwachstellen */}
      {(!latestScan?.vulnerabilities || latestScan.vulnerabilities.length === 0) && (
        <Card className="p-6 bg-green-50 border-green-200">
          <div className="flex items-center space-x-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-green-800">Keine Schwachstellen gefunden</h3>
              <p className="text-green-700">Ihre Website ist sicher geschützt!</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

