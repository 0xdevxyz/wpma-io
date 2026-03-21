'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  EyeOff,
  Trash2,
  Plug,
  AlertOctagon,
  Clock,
  HardDrive,
  Zap,
  Save,
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
  const router = useRouter();
  const siteId = params.id as string;
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'deregister' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Backup schedule form state
  const [scheduleType, setScheduleType] = useState('off');
  const [scheduleBackupType, setScheduleBackupType] = useState('full');
  const [scheduleHour, setScheduleHour] = useState(2);
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [quotaUpgrading, setQuotaUpgrading] = useState(false);

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

  const { data: backupData, isLoading: backupLoading, refetch: refetchBackups } = useQuery({
    queryKey: ['backups', siteId],
    queryFn: async () => {
      const response = await backupApi.getBackups(siteId);
      if (response.success) return response.data;
      throw new Error(response.error || 'Fehler beim Laden der Backups');
    },
    enabled: !!siteId
  });

  const { data: scheduleData, refetch: refetchSchedule } = useQuery({
    queryKey: ['backup-schedule', siteId],
    queryFn: async () => {
      const response = await backupApi.getSchedule(siteId);
      return response.data || null;
    },
    enabled: !!siteId,
    // Sync form state when data arrives
    select: (data) => {
      if (data) {
        setScheduleType(data.schedule_type || 'off');
        setScheduleBackupType(data.backup_type || 'full');
        setScheduleHour(data.hour ?? 2);
        setScheduleDayOfWeek(data.day_of_week ?? 1);
        setScheduleDayOfMonth(data.day_of_month ?? 1);
      }
      return data;
    }
  });

  const { data: quotaData, refetch: refetchQuota } = useQuery({
    queryKey: ['backup-quota'],
    queryFn: async () => {
      const response = await backupApi.getQuota();
      return response.data || null;
    },
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

  const handleSaveSchedule = async () => {
    setScheduleSaving(true);
    try {
      await backupApi.setSchedule(siteId, {
        scheduleType,
        backupType: scheduleBackupType,
        hour: scheduleHour,
        dayOfWeek: scheduleDayOfWeek,
        dayOfMonth: scheduleDayOfMonth,
      });
      toast.success('Backup-Zeitplan gespeichert');
      refetchSchedule();
    } catch {
      toast.error('Zeitplan konnte nicht gespeichert werden');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleUpgradeQuota = async () => {
    setQuotaUpgrading(true);
    try {
      const res = await backupApi.upgradeQuota();
      if (res.success) {
        toast.success(`Speicher auf ${res.data.label} erweitert`);
        refetchQuota();
      } else {
        toast.error(res.error || 'Upgrade fehlgeschlagen');
      }
    } catch {
      toast.error('Upgrade fehlgeschlagen');
    } finally {
      setQuotaUpgrading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      await backupApi.createBackup(siteId, 'full');
      toast.success('Backup gestartet');
      setTimeout(() => refetchBackups(), 2000);
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

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const r = await sitesApi.deleteSite(siteId);
      if (r.success) {
        toast.success('Site gelöscht');
        router.push('/dashboard');
      } else {
        toast.error(r.error || 'Löschen fehlgeschlagen');
      }
    } catch {
      toast.error('Löschen fehlgeschlagen');
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const handleDeregister = async () => {
    setActionLoading(true);
    try {
      const r = await sitesApi.regenerateSetupToken(siteId);
      if (r.success) {
        toast.success('Plugin-Verbindung getrennt. Ein neuer Setup-Token wurde generiert.');
        setConfirmAction(null);
      } else {
        toast.error(r.error || 'Trennen fehlgeschlagen');
      }
    } catch {
      toast.error('Trennen fehlgeschlagen');
    } finally {
      setActionLoading(false);
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
              <Button variant="secondary" onClick={() => setConfirmAction('deregister')} className="text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300 hover:bg-orange-50">
                <Plug className="w-4 h-4 mr-2" />
                Deregistrieren
              </Button>
              <Button variant="secondary" onClick={() => setConfirmAction('delete')} className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50">
                <Trash2 className="w-4 h-4 mr-2" />
                Löschen
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

        {/* Quick Links */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: 'Lighthouse', href: `/sites/${siteId}/performance`, color: 'text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-500/20 dark:hover:bg-blue-500/5' },
            { label: 'Staging', href: `/sites/${siteId}/staging`, color: 'text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-500/20 dark:hover:bg-purple-500/5' },
            { label: 'Risiko-Analyse', href: `/sites/${siteId}/risk-analysis`, color: 'text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-500/20 dark:hover:bg-orange-500/5' },
            { label: 'Revenue', href: `/sites/${siteId}/revenue`, color: 'text-green-600 border-green-200 hover:bg-green-50 dark:border-green-500/20 dark:hover:bg-green-500/5' },
            { label: 'Link-Checker', href: `/sites/${siteId}/links`, color: 'text-cyan-600 border-cyan-200 hover:bg-cyan-50 dark:border-cyan-500/20 dark:hover:bg-cyan-500/5' },
            { label: 'Berichte', href: `/sites/${siteId}/reports`, color: 'text-gray-600 border-gray-200 hover:bg-gray-50 dark:border-gray-500/20 dark:hover:bg-gray-500/5' },
          ].map(l => (
            <a key={l.href} href={l.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${l.color}`}>
              {l.label}
            </a>
          ))}
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

              {/* Storage Quota */}
              {quotaData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <HardDrive className="w-4 h-4" />
                      Backup-Speicher
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {(quotaData.usedBytes / 1024 / 1024 / 1024).toFixed(2)} GB von {quotaData.tierLabel} verwendet
                      </span>
                      <span className="text-gray-500">Max. {quotaData.maxBackupsPerSite} Backups/Site</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          quotaData.usedBytes / quotaData.quotaBytes > 0.9
                            ? 'bg-red-500'
                            : quotaData.usedBytes / quotaData.quotaBytes > 0.7
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, (quotaData.usedBytes / quotaData.quotaBytes) * 100).toFixed(1)}%` }}
                      />
                    </div>
                    {quotaData.nextTier && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUpgradeQuota}
                        disabled={quotaUpgrading}
                        className="flex items-center gap-2"
                      >
                        <Zap className="w-3 h-3" />
                        {quotaUpgrading ? 'Upgrading…' : `Kostenlos auf ${quotaData.nextTier.label} erweitern`}
                      </Button>
                    )}
                    {!quotaData.nextTier && (
                      <p className="text-xs text-gray-500">Maximaler Speicher erreicht (10 GB)</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Auto-Backup Schedule */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="w-4 h-4" />
                    Automatische Backups
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Frequenz</label>
                      <select
                        value={scheduleType}
                        onChange={(e) => setScheduleType(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                      >
                        <option value="off">Deaktiviert</option>
                        <option value="daily">Täglich</option>
                        <option value="weekly">Wöchentlich</option>
                        <option value="monthly">Monatlich</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Backup-Typ</label>
                      <select
                        value={scheduleBackupType}
                        onChange={(e) => setScheduleBackupType(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                        disabled={scheduleType === 'off'}
                      >
                        <option value="full">Vollständig</option>
                        <option value="database">Nur Datenbank</option>
                        <option value="files">Nur Dateien</option>
                      </select>
                    </div>
                  </div>

                  {scheduleType !== 'off' && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Uhrzeit (UTC)</label>
                        <select
                          value={scheduleHour}
                          onChange={(e) => setScheduleHour(Number(e.target.value))}
                          className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>{String(i).padStart(2, '0')}:00 Uhr</option>
                          ))}
                        </select>
                      </div>

                      {scheduleType === 'weekly' && (
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Wochentag</label>
                          <select
                            value={scheduleDayOfWeek}
                            onChange={(e) => setScheduleDayOfWeek(Number(e.target.value))}
                            className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                          >
                            {['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'].map((d, i) => (
                              <option key={i} value={i}>{d}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {scheduleType === 'monthly' && (
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Tag des Monats</label>
                          <select
                            value={scheduleDayOfMonth}
                            onChange={(e) => setScheduleDayOfMonth(Number(e.target.value))}
                            className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                          >
                            {Array.from({ length: 28 }, (_, i) => (
                              <option key={i+1} value={i+1}>{i+1}.</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {scheduleType !== 'off' && scheduleData?.next_run_at && (
                    <p className="text-xs text-gray-500">
                      Nächstes Backup: {new Date(scheduleData.next_run_at).toLocaleString('de-DE')}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <Button onClick={handleSaveSchedule} disabled={scheduleSaving} size="sm" className="flex items-center gap-2">
                      <Save className="w-3 h-3" />
                      {scheduleSaving ? 'Speichern…' : 'Zeitplan speichern'}
                    </Button>
                    {scheduleType !== 'off' && (
                      <p className="text-xs text-gray-500">
                        Max. {quotaData?.maxBackupsPerSite ?? 5} Backups gespeichert — älteste werden automatisch überschrieben.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Backup List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Backup-Verwaltung</span>
                    <Button onClick={handleCreateBackup}>
                      <Download className="w-4 h-4 mr-2" />
                      Jetzt sichern
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {backupLoading ? (
                    <div className="animate-pulse">Lade Backups...</div>
                  ) : backupData && backupData.length > 0 ? (
                    <div className="space-y-3">
                      {backupData.map((backup: Backup) => (
                        <div key={backup.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-white/10 rounded-lg">
                          <div>
                            <div className="font-medium capitalize">{backup.backupType} Backup</div>
                            <div className="text-sm text-gray-500">
                              {new Date(backup.createdAt).toLocaleString('de-DE')}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {backup.fileSize > 0 && (
                              <span className="text-xs text-gray-500">
                                {backup.fileSize >= 1024 * 1024 * 1024
                                  ? `${(backup.fileSize / 1024 / 1024 / 1024).toFixed(2)} GB`
                                  : `${Math.round(backup.fileSize / 1024 / 1024)} MB`}
                              </span>
                            )}
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              backup.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400' :
                              backup.status === 'pending' || backup.status === 'waiting_for_plugin' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400' :
                              'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'
                            }`}>
                              {backup.status === 'waiting_for_plugin' ? 'Ausstehend' :
                               backup.status === 'completed' ? 'Abgeschlossen' :
                               backup.status === 'pending' ? 'Läuft' :
                               backup.status === 'failed' ? 'Fehlgeschlagen' :
                               backup.status}
                            </span>
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

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#13131a] rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-200 dark:border-white/[0.08]">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirmAction === 'delete' ? 'bg-red-100 dark:bg-red-500/20' : 'bg-orange-100 dark:bg-orange-500/20'}`}>
                {confirmAction === 'delete'
                  ? <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                  : <AlertOctagon className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {confirmAction === 'delete' ? 'Site löschen?' : 'Plugin deregistrieren?'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{site.domain}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {confirmAction === 'delete'
                ? 'Die Site wird dauerhaft aus WPMA entfernt. Das WordPress-Plugin auf der Site bleibt installiert, ist aber nicht mehr verbunden.'
                : 'Die Plugin-Verbindung wird getrennt. Die Site bleibt in WPMA, kann aber erst nach erneuter Plugin-Einrichtung überwacht werden.'}
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setConfirmAction(null)} disabled={actionLoading} className="flex-1">
                Abbrechen
              </Button>
              <Button
                onClick={confirmAction === 'delete' ? handleDelete : handleDeregister}
                disabled={actionLoading}
                className={`flex-1 ${confirmAction === 'delete' ? 'bg-red-600 hover:bg-red-500' : 'bg-orange-600 hover:bg-orange-500'} text-white`}
              >
                {actionLoading
                  ? 'Bitte warten...'
                  : confirmAction === 'delete' ? 'Ja, löschen' : 'Ja, trennen'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 