'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { 
  Globe, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Download,
  RefreshCw,
  TrendingUp,
  Activity,
  Brain,
  Database,
  Eye,
  EyeOff
} from 'lucide-react';
import { sitesApi, performanceApi, securityApi, backupApi, aiApi } from '../../../lib/api';
import { useAuthStore } from '../../../lib/auth-store';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { toast } from 'react-hot-toast';

interface Site {
  id: number;
  domain: string;
  siteUrl: string;
  siteName: string;
  healthScore: number;
  status: string;
  lastCheck: string;
  wordpressVersion: string;
  phpVersion: string;
  createdAt: string;
}

interface PerformanceMetrics {
  pageLoadTime: number;
  memoryUsage: number;
  databaseSize: number;
  coreWebVitals: any;
}

interface SecurityStatus {
  sslEnabled: boolean;
  debugMode: boolean;
  adminUsername: string;
  failedLogins: number;
  vulnerabilities: any[];
}

interface Backup {
  id: number;
  backupType: string;
  status: string;
  fileSize: number;
  createdAt: string;
  s3Url: string;
}

interface AIInsight {
  id: number;
  insightType: string;
  title: string;
  description: string;
  data: any;
  createdAt: string;
}

export default function SiteDetailsPage() {
  const params = useParams();
  const siteId = params.id as string;
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [showSensitiveData, setShowSensitiveData] = useState(false);

  const { data: site, isLoading: siteLoading } = useQuery({
    queryKey: ['site', siteId],
    queryFn: async () => {
      const response = await sitesApi.getSite(siteId);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Fehler beim Laden der Site');
    },
    enabled: !!siteId
  });

  const { data: performanceData, isLoading: performanceLoading } = useQuery({
    queryKey: ['performance', siteId],
    queryFn: async () => {
      const response = await performanceApi.getMetrics(siteId);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Fehler beim Laden der Performance-Daten');
    },
    enabled: !!siteId
  });

  const { data: securityData, isLoading: securityLoading } = useQuery({
    queryKey: ['security', siteId],
    queryFn: async () => {
      const response = await securityApi.getSecurityStatus(siteId);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Fehler beim Laden der Sicherheitsdaten');
    },
    enabled: !!siteId
  });

  const { data: backupData, isLoading: backupLoading } = useQuery({
    queryKey: ['backups', siteId],
    queryFn: async () => {
      const response = await backupApi.getBackups(siteId);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Fehler beim Laden der Backups');
    },
    enabled: !!siteId
  });

  const { data: aiInsights, isLoading: aiLoading } = useQuery({
    queryKey: ['ai-insights', siteId],
    queryFn: async () => {
      const response = await aiApi.getInsights(siteId);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Fehler beim Laden der AI-Insights');
    },
    enabled: !!siteId
  });

  const handleRunHealthCheck = async () => {
    try {
      await sitesApi.runHealthCheck(siteId);
      toast.success('Health Check gestartet');
    } catch (error) {
      toast.error('Health Check fehlgeschlagen');
    }
  };

  const handleCreateBackup = async () => {
    try {
      await backupApi.createBackup(siteId, 'full');
      toast.success('Backup gestartet');
    } catch (error) {
      toast.error('Backup fehlgeschlagen');
    }
  };

  const handleRunSecurityScan = async () => {
    try {
      await securityApi.runSecurityScan(siteId);
      toast.success('Sicherheitsscan gestartet');
    } catch (error) {
      toast.error('Sicherheitsscan fehlgeschlagen');
    }
  };

  if (siteLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lade Site-Details...</p>
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Site nicht gefunden</h3>
            <p className="text-gray-600 mb-4">Die angeforderte Site konnte nicht gefunden werden.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthIcon = (score: number) => {
    if (score >= 90) return CheckCircle;
    if (score >= 70) return AlertTriangle;
    return AlertTriangle;
  };

  const HealthIcon = getHealthIcon(site.healthScore);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{site.siteName}</h1>
              <p className="text-gray-600 mt-1">
                {site.domain} • WordPress {site.wordpressVersion} • PHP {site.phpVersion}
              </p>
            </div>
            <div className="flex space-x-3">
              <Button variant="secondary" onClick={handleRunHealthCheck}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Health Check
              </Button>
              <Button onClick={() => window.open(site.siteUrl, '_blank')}>
                <Globe className="w-4 h-4 mr-2" />
                Site öffnen
              </Button>
            </div>
          </div>
        </div>

        {/* Health Score */}
        <div className="mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <HealthIcon className={`w-8 h-8 ${getHealthColor(site.healthScore)}`} />
                  <div>
                    <h3 className="text-lg font-semibold">Health Score</h3>
                    <p className="text-sm text-gray-600">
                      Letzte Überprüfung: {new Date(site.lastCheck).toLocaleString('de-DE')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${getHealthColor(site.healthScore)}`}>
                    {site.healthScore}%
                  </div>
                  <div className="w-32 bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className={`h-2 rounded-full ${
                        site.healthScore >= 90 ? 'bg-green-500' : 
                        site.healthScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${site.healthScore}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Übersicht', icon: Activity },
              { id: 'performance', label: 'Performance', icon: TrendingUp },
              { id: 'security', label: 'Sicherheit', icon: Shield },
              { id: 'backups', label: 'Backups', icon: Database },
              { id: 'ai-insights', label: 'AI Insights', icon: Brain }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5" />
                    <span>Performance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {performanceLoading ? (
                    <div className="animate-pulse">Lade...</div>
                  ) : performanceData ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Ladezeit:</span>
                        <span className="font-semibold">{performanceData.pageLoadTime}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Speicher:</span>
                        <span className="font-semibold">{Math.round(performanceData.memoryUsage / 1024 / 1024)}MB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Datenbank:</span>
                        <span className="font-semibold">{performanceData.databaseSize}MB</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Keine Daten verfügbar</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="w-5 h-5" />
                    <span>Sicherheit</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {securityLoading ? (
                    <div className="animate-pulse">Lade...</div>
                  ) : securityData ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>SSL:</span>
                        <span className={securityData.sslEnabled ? 'text-green-600' : 'text-red-600'}>
                          {securityData.sslEnabled ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Debug Mode:</span>
                        <span className={securityData.debugMode ? 'text-red-600' : 'text-green-600'}>
                          {securityData.debugMode ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fehlgeschlagene Logins:</span>
                        <span className="font-semibold">{securityData.failedLogins}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Keine Daten verfügbar</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Database className="w-5 h-5" />
                    <span>Backups</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {backupLoading ? (
                    <div className="animate-pulse">Lade...</div>
                  ) : backupData ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Anzahl:</span>
                        <span className="font-semibold">{backupData.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Letztes Backup:</span>
                        <span className="font-semibold">
                          {backupData.length > 0 
                            ? new Date(backupData[0].createdAt).toLocaleDateString('de-DE')
                            : 'Nie'
                          }
                        </span>
                      </div>
                      <Button size="sm" onClick={handleCreateBackup} className="w-full mt-2">
                        <Download className="w-4 h-4 mr-2" />
                        Backup erstellen
                      </Button>
                    </div>
                  ) : (
                    <p className="text-gray-500">Keine Daten verfügbar</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance-Metriken</CardTitle>
                </CardHeader>
                <CardContent>
                  {performanceLoading ? (
                    <div className="animate-pulse">Lade Performance-Daten...</div>
                  ) : performanceData ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">{performanceData.pageLoadTime}ms</div>
                        <div className="text-sm text-gray-600">Ladezeit</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">
                          {Math.round(performanceData.memoryUsage / 1024 / 1024)}MB
                        </div>
                        <div className="text-sm text-gray-600">Speicherverbrauch</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600">{performanceData.databaseSize}MB</div>
                        <div className="text-sm text-gray-600">Datenbankgröße</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Keine Performance-Daten verfügbar</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Sicherheitsstatus</span>
                    <Button size="sm" onClick={handleRunSecurityScan}>
                      <Shield className="w-4 h-4 mr-2" />
                      Scan starten
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {securityLoading ? (
                    <div className="animate-pulse">Lade Sicherheitsdaten...</div>
                  ) : securityData ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span>SSL-Zertifikat</span>
                          <span className={securityData.sslEnabled ? 'text-green-600' : 'text-red-600'}>
                            {securityData.sslEnabled ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span>Debug Mode</span>
                          <span className={securityData.debugMode ? 'text-red-600' : 'text-green-600'}>
                            {securityData.debugMode ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span>Admin Username</span>
                          <span className="font-mono">
                            {showSensitiveData ? securityData.adminUsername : '••••••'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span>Fehlgeschlagene Logins (24h)</span>
                          <span className="font-semibold">{securityData.failedLogins}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSensitiveData(!showSensitiveData)}
                      >
                        {showSensitiveData ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                        {showSensitiveData ? 'Sensible Daten ausblenden' : 'Sensible Daten anzeigen'}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-gray-500">Keine Sicherheitsdaten verfügbar</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'backups' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Backup-Verwaltung</span>
                    <Button onClick={handleCreateBackup}>
                      <Download className="w-4 h-4 mr-2" />
                      Backup erstellen
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {backupLoading ? (
                    <div className="animate-pulse">Lade Backups...</div>
                  ) : backupData && backupData.length > 0 ? (
                    <div className="space-y-4">
                      {backupData.map((backup: Backup) => (
                        <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="font-semibold">{backup.backupType} Backup</div>
                            <div className="text-sm text-gray-600">
                              {new Date(backup.createdAt).toLocaleString('de-DE')}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              backup.status === 'completed' ? 'bg-green-100 text-green-800' :
                              backup.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {backup.status}
                            </span>
                            {backup.fileSize && (
                              <span className="text-sm text-gray-600">
                                {Math.round(backup.fileSize / 1024 / 1024)}MB
                              </span>
                            )}
                            {backup.status === 'completed' && (
                              <Button size="sm" variant="ghost">
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Keine Backups verfügbar</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'ai-insights' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>AI-Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  {aiLoading ? (
                    <div className="animate-pulse">Lade AI-Insights...</div>
                  ) : aiInsights && aiInsights.length > 0 ? (
                    <div className="space-y-4">
                      {aiInsights.map((insight: AIInsight) => (
                        <div key={insight.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">{insight.title}</h4>
                            <span className="text-xs text-gray-500">
                              {new Date(insight.createdAt).toLocaleDateString('de-DE')}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-3">{insight.description}</p>
                          {insight.data && (
                            <div className="bg-gray-50 p-3 rounded text-sm">
                              <pre className="whitespace-pre-wrap">{JSON.stringify(insight.data, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Keine AI-Insights verfügbar</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 