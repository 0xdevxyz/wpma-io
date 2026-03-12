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
  Sparkles,
  Zap as ZapIcon,
  Crown,
  Database,
  Eye,
  EyeOff,
  Package,
  FileText,
  Palette,
  MessageSquare,
  Users,
  ArrowUpCircle,
  HardDrive,
  Zap,
  Lock,
  Server,
  Trash2,
  RotateCcw,
  Cloud,
  Wrench,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  History
} from 'lucide-react';
import { sitesApi, performanceApi, securityApi, backupApi, aiApi, pluginsApi, themesApi, syncApi, selfHealingApi } from '../../../lib/api';
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
  pluginsTotal?: number;
  pluginsActive?: number;
  pluginsUpdates?: number;
  themesTotal?: number;
  themesActive?: number;
  themesUpdates?: number;
  createdAt: string;
}

interface Plugin {
  name: string;
  slug: string;
  version: string;
  active: boolean;
  update_available: boolean;
  new_version?: string;
  is_premium?: boolean;
}

interface Theme {
  name: string;
  slug: string;
  version: string;
  active: boolean;
  update_available: boolean;
  new_version?: string;
  is_premium?: boolean;
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

export default function SiteDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [backupTypeModal, setBackupTypeModal] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [backupActionLoading, setBackupActionLoading] = useState<number | null>(null);
  const [initialSyncing, setInitialSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [healingInput, setHealingInput] = useState('');
  const [healingLoading, setHealingLoading] = useState(false);
  const [healingResult, setHealingResult] = useState<any>(null);
  const [applyingFix, setApplyingFix] = useState(false);
  const [expandedHealing, setExpandedHealing] = useState(false);

  const { data: site, isLoading: siteLoading, refetch: refetchSite } = useQuery({
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

  const isEmptySite = site && !site.wordpressVersion && !site.lastSync;

  React.useEffect(() => {
    if (!site || syncDone || initialSyncing) return;
    if (isEmptySite) {
      setInitialSyncing(true);
      syncApi.syncSite(siteId).then(async () => {
        await new Promise(r => setTimeout(r, 2000));
        await refetchSite();
        setSyncDone(true);
        setInitialSyncing(false);
      }).catch(() => {
        setInitialSyncing(false);
        setSyncDone(true);
      });
    }
  }, [site, siteId, syncDone, initialSyncing, isEmptySite, refetchSite]);

  const { data: plugins, isLoading: pluginsLoading } = useQuery({
    queryKey: ['plugins', siteId],
    queryFn: async () => {
      const response = await pluginsApi.getPlugins(siteId);
      if (response.success) {
        return response.data;
      }
      return [];
    },
    enabled: !!siteId
  });

  const { data: themes, isLoading: themesLoading } = useQuery({
    queryKey: ['themes', siteId],
    queryFn: async () => {
      const response = await themesApi.getThemes(siteId);
      if (response.success) {
        return response.data;
      }
      return [];
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
      return null;
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
      return null;
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
      return [];
    },
    enabled: !!siteId

  });

  const { data: screenshotData } = useQuery({
    queryKey: ['screenshot', siteId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/sites/${siteId}/screenshot`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.data?.screenshotUrl || null;
    },
    enabled: !!siteId,
    staleTime: 1000 * 60 * 60,
  });

  const handleAnalyzeProblem = async () => {
    if (!healingInput.trim()) return;
    setHealingLoading(true);
    setHealingResult(null);
    try {
      const response = await selfHealingApi.analyzeProblem(siteId, {
        error: healingInput,
        context: { domain: site?.domain, wordpressVersion: site?.wordpressVersion }
      });
      if (response.success || response.fix || response.fixType) {
        setHealingResult(response);
        setExpandedHealing(true);
      } else {
        toast.error('Analyse fehlgeschlagen');
      }
    } catch {
      toast.error('Verbindungsfehler bei der Analyse');
    } finally {
      setHealingLoading(false);
    }
  };

  const handleApplyFix = async (fixId: string) => {
    setApplyingFix(true);
    try {
      const response = await selfHealingApi.applyFix(siteId, fixId, { createSnapshot: true });
      if (response.success) {
        toast.success('Fix wurde erfolgreich angewendet!');
        setHealingResult(null);
        setHealingInput('');
      } else {
        toast.error(response.error || 'Fix konnte nicht angewendet werden');
      }
    } catch {
      toast.error('Fehler beim Anwenden des Fix');
    } finally {
      setApplyingFix(false);
    }
  };

  const handleRunAIAnalysis = async () => {
    setAiLoading(true);
    try {
      const [summaryResult, recsResult] = await Promise.all([
        aiApi.getHealthSummary(siteId),
        aiApi.generateRecommendations(siteId),
      ]);
      setAiAnalysis({
        summary: summaryResult.success ? summaryResult.data : null,
        ...(recsResult.success ? recsResult.data : {}),
      });
    } catch {
      toast.error('KI-Analyse fehlgeschlagen');
    } finally {
      setAiLoading(false);
    }
  };

  const handleRunHealthCheck = async () => {
    try {
      const result = await sitesApi.runHealthCheck(siteId);
      if (result.success) {
        toast.success('Health Check gestartet');
        setTimeout(() => refetchSite(), 2000);
      } else {
        toast.error(result.error || 'Health Check fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Health Check fehlgeschlagen');
    }
  };

  const handleCreateBackup = async (type: string = 'full') => {
    setBackupTypeModal(false);
    try {
      const result = await backupApi.createBackup(siteId, type);
      if (result.success) {
        toast.success(`${type === 'full' ? 'Vollständiges' : type === 'db' ? 'Datenbank-' : 'Datei-'}Backup gestartet`);
        refetchSite();
      } else {
        toast.error(result.error || 'Backup fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Backup fehlgeschlagen');
    }
  };

  const handleRestoreBackup = async (backupId: number) => {
    setBackupActionLoading(backupId);
    setConfirmRestore(null);
    try {
      const result = await backupApi.restoreBackup(String(backupId), siteId);
      if (result.success) {
        toast.success('Wiederherstellung gestartet');
      } else {
        toast.error(result.error || 'Wiederherstellung fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Wiederherstellung fehlgeschlagen');
    } finally {
      setBackupActionLoading(null);
    }
  };

  const handleDeleteBackup = async (backupId: number) => {
    setBackupActionLoading(backupId);
    setConfirmDelete(null);
    try {
      const result = await backupApi.deleteBackup(String(backupId));
      if (result.success) {
        toast.success('Backup gelöscht');
        refetchSite();
      } else {
        toast.error(result.error || 'Löschen fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Löschen fehlgeschlagen');
    } finally {
      setBackupActionLoading(null);
    }
  };

  const handleDownloadBackup = async (backupId: number) => {
    try {
      const result = await backupApi.downloadBackup(String(backupId));
      if (result.success && result.data?.downloadUrl) {
        window.open(result.data.downloadUrl, '_blank');
      } else {
        toast.error(result.error || 'Download nicht verfügbar');
      }
    } catch (error) {
      toast.error('Download fehlgeschlagen');
    }
  };

  const handleRunSecurityScan = async () => {
    try {
      const result = await securityApi.runSecurityScan(siteId);
      if (result.success) {
        toast.success('Sicherheitsscan gestartet');
      } else {
        toast.error(result.error || 'Sicherheitsscan fehlgeschlagen');
      }
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

  if (initialSyncing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="relative inline-flex mb-6">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
              <RefreshCw className="w-9 h-9 text-blue-600 animate-spin" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Site wird verbunden</h2>
          <p className="text-gray-500 text-sm mb-6">
            Wir synchronisieren alle Daten von <span className="font-medium text-gray-700">{site?.domain}</span> — Plugins, Themes, Sicherheit und mehr.
          </p>
          <div className="space-y-2 text-left bg-white rounded-xl border border-gray-200 p-4">
            {[
              { label: 'WordPress-Version', done: true },
              { label: 'Plugins & Themes', done: true },
              { label: 'Sicherheitsstatus', done: false },
              { label: 'Performance-Daten', done: false },
            ].map(({ label, done }, i) => (
              <div key={i} className="flex items-center gap-3">
                {done ? (
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
                )}
                <span className={`text-sm ${done ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>
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

  const pluginsTotal = plugins?.length || site.pluginsTotal || 0;
  const pluginsActive = plugins?.filter((p: Plugin) => p.active).length || site.pluginsActive || 0;
  const pluginsUpdates = plugins?.filter((p: Plugin) => p.update_available).length || site.pluginsUpdates || 0;
  
  const themesTotal = themes?.length || site.themesTotal || 0;
  const activeTheme = themes?.find((t: Theme) => t.active);
  const themesUpdates = themes?.filter((t: Theme) => t.update_available).length || site.themesUpdates || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4 gap-6">
            <div className="flex items-start gap-5 flex-1">
              {/* Screenshot Preview */}
              <div className="shrink-0 w-36 h-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shadow-sm">
                {screenshotData ? (
                  <img
                    src={screenshotData}
                    alt={site.siteName}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Globe className="w-8 h-8 text-gray-300" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{site.siteName}</h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    <a href={site.siteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                      {site.domain}
                    </a>
                  </div>
                  <div className="flex items-center gap-1">
                    <Server className="w-4 h-4" />
                    WordPress {site.wordpressVersion}
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    PHP {site.phpVersion}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleRunHealthCheck} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Health Check
              </Button>
              <Button onClick={() => window.open(site.siteUrl, '_blank')} variant="outline" size="sm">
                <Globe className="w-4 h-4 mr-2" />
                Site öffnen
              </Button>
            </div>
          </div>
        </div>

        {/* Health Score Banner */}
        <Card className="mb-6 bg-gradient-to-r from-white to-gray-50 border-2">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-20 h-20 rounded-full ${site.healthScore >= 90 ? 'bg-green-100' : site.healthScore >= 70 ? 'bg-yellow-100' : 'bg-red-100'}`}>
                  <HealthIcon className={`w-10 h-10 ${getHealthColor(site.healthScore)}`} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Health Score</h2>
                  <p className={`text-4xl font-bold ${getHealthColor(site.healthScore)}`}>{site.healthScore}%</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Letzte Überprüfung: {new Date(site.lastCheck).toLocaleString('de-DE')}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button onClick={() => { setActiveTab('backups'); setBackupTypeModal(true); }} variant="default" size="lg">
                  <Database className="w-5 h-5 mr-2" />
                  Backup erstellen
                </Button>
                <Button onClick={handleRunSecurityScan} variant="default" size="lg">
                  <Shield className="w-5 h-5 mr-2" />
                  Security Scan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schnellübersicht - Wichtigste Informationen */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Plugins */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab('plugins')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Plugins</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {pluginsActive} / {pluginsTotal}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {pluginsUpdates > 0 ? (
                      <span className="text-orange-600 font-medium">{pluginsUpdates} Updates</span>
                    ) : (
                      <span className="text-green-600">Aktuell</span>
                    )}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${pluginsUpdates > 0 ? 'bg-orange-100' : 'bg-blue-100'}`}>
                  <Package className={`w-6 h-6 ${pluginsUpdates > 0 ? 'text-orange-600' : 'text-blue-600'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Themes */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab('themes')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Themes</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{themesTotal}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {activeTheme ? (
                      <span className="truncate max-w-[120px] inline-block">{activeTheme.name}</span>
                    ) : (
                      <span>-</span>
                    )}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${themesUpdates > 0 ? 'bg-orange-100' : 'bg-purple-100'}`}>
                  <Palette className={`w-6 h-6 ${themesUpdates > 0 ? 'text-orange-600' : 'text-purple-600'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Backups */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab('backups')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Backups</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{backupData?.length || 0}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {backupData?.[0] ? (
                      <span>Letztes: {new Date(backupData[0].createdAt).toLocaleDateString('de-DE')}</span>
                    ) : (
                      <span>Kein Backup</span>
                    )}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-green-100">
                  <Database className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sicherheit */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab('security')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sicherheit</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {securityData?.vulnerabilities?.length || 0}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {securityData?.vulnerabilities?.length === 0 ? (
                      <span className="text-green-600">Keine Probleme</span>
                    ) : (
                      <span className="text-red-600">Probleme</span>
                    )}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${securityData?.vulnerabilities?.length > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                  <Shield className={`w-6 h-6 ${securityData?.vulnerabilities?.length > 0 ? 'text-red-600' : 'text-green-600'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', label: 'Übersicht', icon: Activity },
                { id: 'plugins', label: 'Plugins', icon: Package },
                { id: 'themes', label: 'Themes', icon: Palette },
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
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {performanceLoading ? (
                    <p className="text-gray-500">Lädt...</p>
                  ) : performanceData ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Ladezeit</span>
                        <span className="font-semibold">{performanceData.pageLoadTime}ms</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Speicher</span>
                        <span className="font-semibold">{Math.round(performanceData.memoryUsage)}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Datenbank</span>
                        <span className="font-semibold">{(performanceData.databaseSize / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Keine Daten verfügbar</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Sicherheit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {securityLoading ? (
                    <p className="text-gray-500">Lädt...</p>
                  ) : securityData ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">SSL</span>
                        <span className={`font-semibold ${securityData.sslEnabled ? 'text-green-600' : 'text-red-600'}`}>
                          {securityData.sslEnabled ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Debug Mode</span>
                        <span className={`font-semibold ${securityData.debugMode ? 'text-red-600' : 'text-green-600'}`}>
                          {securityData.debugMode ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Schwachstellen</span>
                        <span className={`font-semibold ${securityData.vulnerabilities?.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {securityData.vulnerabilities?.length || 0}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Keine Daten verfügbar</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    AI Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {aiAnalysis ? (
                    <div className="space-y-2">
                      {(aiAnalysis.recommendations || []).slice(0, 3).map((rec: any, i: number) => (
                        <div key={i} className="p-2 bg-purple-50 rounded text-sm">
                          <p className="font-medium text-purple-900">{rec.title}</p>
                          <p className="text-purple-700 text-xs mt-0.5 line-clamp-2">{rec.description}</p>
                        </div>
                      ))}
                      {(aiAnalysis.recommendations || []).length === 0 && (
                        <p className="text-gray-500 text-sm">Keine Probleme gefunden.</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Brain className="w-8 h-8 text-purple-200 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm mb-3">Noch keine Analyse durchgeführt.</p>
                      <Button size="sm" onClick={() => { setActiveTab('ai-insights'); handleRunAIAnalysis(); }} className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Analyse starten
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Plugins Tab */}
          {activeTab === 'plugins' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Installierte Plugins ({pluginsTotal})
                  </span>
                  <Button variant="outline" size="sm">
                    <Package className="w-4 h-4 mr-2" />
                    Plugin hinzufügen
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pluginsLoading ? (
                  <p className="text-gray-500">Lädt Plugins...</p>
                ) : plugins && plugins.length > 0 ? (
                  <div className="space-y-2">
                    {plugins.map((plugin: Plugin) => (
                      <div key={plugin.slug} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${plugin.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900">{plugin.name}</p>
                                {plugin.is_premium && (
                                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">PRO</span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">Version {plugin.version}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {plugin.update_available && (
                            <div className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                              <ArrowUpCircle className="w-4 h-4" />
                              Update zu {plugin.new_version}
                            </div>
                          )}
                          <Button variant="outline" size="sm">
                            {plugin.active ? 'Deaktivieren' : 'Aktivieren'}
                          </Button>
                          {plugin.update_available && (
                            <Button variant="default" size="sm">
                              Aktualisieren
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">Keine Plugins gefunden</p>
                    <p className="text-sm text-gray-500 mt-1">Installiere das WPMA Plugin auf deiner WordPress-Site</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Themes Tab */}
          {activeTab === 'themes' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Installierte Themes ({themesTotal})
                  </span>
                  <Button variant="outline" size="sm">
                    <Palette className="w-4 h-4 mr-2" />
                    Theme hinzufügen
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {themesLoading ? (
                  <p className="text-gray-500">Lädt Themes...</p>
                ) : themes && themes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {themes.map((theme: Theme) => (
                      <div 
                        key={theme.slug} 
                        className={`p-4 rounded-lg border-2 transition-all ${
                          theme.active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-900">{theme.name}</p>
                              {theme.is_premium && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">PRO</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">Version {theme.version}</p>
                          </div>
                          {theme.active && (
                            <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                              Aktiv
                            </span>
                          )}
                        </div>
                        {theme.update_available && (
                          <div className="mt-2 p-2 bg-orange-50 rounded text-sm">
                            <p className="text-orange-700 font-medium">Update verfügbar: {theme.new_version}</p>
                          </div>
                        )}
                        <div className="mt-3 flex gap-2">
                          {!theme.active && (
                            <Button variant="outline" size="sm" className="flex-1">
                              Aktivieren
                            </Button>
                          )}
                          {theme.update_available && (
                            <Button variant="default" size="sm" className="flex-1">
                              Aktualisieren
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Palette className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">Keine Themes gefunden</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Performance Metriken
                </CardTitle>
              </CardHeader>
              <CardContent>
                {performanceLoading ? (
                  <p className="text-gray-500">Lädt Performance-Daten...</p>
                ) : performanceData ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-blue-900">Ladezeit</p>
                        <Activity className="w-5 h-5 text-blue-600" />
                      </div>
                      <p className="text-3xl font-bold text-blue-900">{performanceData.pageLoadTime}ms</p>
                      <p className="text-sm text-blue-700 mt-1">
                        {performanceData.pageLoadTime < 1000 ? 'Sehr gut' : performanceData.pageLoadTime < 2000 ? 'Gut' : 'Verbesserungswürdig'}
                      </p>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-purple-900">Speichernutzung</p>
                        <HardDrive className="w-5 h-5 text-purple-600" />
                      </div>
                      <p className="text-3xl font-bold text-purple-900">{Math.round(performanceData.memoryUsage)}%</p>
                      <p className="text-sm text-purple-700 mt-1">
                        {performanceData.memoryUsage < 70 ? 'Normal' : 'Hoch'}
                      </p>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-green-900">Datenbankgröße</p>
                        <Database className="w-5 h-5 text-green-600" />
                      </div>
                      <p className="text-3xl font-bold text-green-900">
                        {(performanceData.databaseSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <p className="text-sm text-green-700 mt-1">Aktuell</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">Keine Performance-Daten verfügbar</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Sicherheitsstatus
                </CardTitle>
              </CardHeader>
              <CardContent>
                {securityLoading ? (
                  <p className="text-gray-500">Lädt Sicherheitsdaten...</p>
                ) : securityData ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className={`p-4 rounded-lg ${securityData.sslEnabled ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border-2`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Lock className={`w-5 h-5 ${securityData.sslEnabled ? 'text-green-600' : 'text-red-600'}`} />
                          <p className="font-semibold">SSL/HTTPS</p>
                        </div>
                        <p className={`text-sm ${securityData.sslEnabled ? 'text-green-700' : 'text-red-700'}`}>
                          {securityData.sslEnabled ? 'Aktiv und geschützt' : 'Nicht aktiv - Risiko!'}
                        </p>
                      </div>

                      <div className={`p-4 rounded-lg ${!securityData.debugMode ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border-2`}>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className={`w-5 h-5 ${!securityData.debugMode ? 'text-green-600' : 'text-red-600'}`} />
                          <p className="font-semibold">Debug Mode</p>
                        </div>
                        <p className={`text-sm ${!securityData.debugMode ? 'text-green-700' : 'text-red-700'}`}>
                          {securityData.debugMode ? 'Aktiv - Sicherheitsrisiko!' : 'Deaktiviert'}
                        </p>
                      </div>

                      <div className={`p-4 rounded-lg ${securityData.vulnerabilities?.length === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border-2`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className={`w-5 h-5 ${securityData.vulnerabilities?.length === 0 ? 'text-green-600' : 'text-red-600'}`} />
                          <p className="font-semibold">Schwachstellen</p>
                        </div>
                        <p className={`text-sm ${securityData.vulnerabilities?.length === 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {securityData.vulnerabilities?.length || 0} gefunden
                        </p>
                      </div>
                    </div>

                    {securityData.vulnerabilities && securityData.vulnerabilities.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Gefundene Schwachstellen</h3>
                        <div className="space-y-2">
                          {securityData.vulnerabilities.map((vuln: any, index: number) => (
                            <div key={index} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                              <p className="font-medium text-red-900">{vuln.title || vuln.type}</p>
                              <p className="text-sm text-red-700 mt-1">{vuln.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">Keine Sicherheitsdaten verfügbar</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Backups Tab */}
          {activeTab === 'backups' && (
            <div className="space-y-4">
              {/* Speicherort-Info */}
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <Cloud className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Speicherort: iDrive E2 (Frankfurt)</p>
                      <p className="text-xs text-blue-700">Bucket: wpma.io-backups &bull; Verschlüsselt &bull; Geo-redundant</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      Backup-Verlauf
                    </span>
                    <Button onClick={() => setBackupTypeModal(true)} variant="default">
                      <Database className="w-4 h-4 mr-2" />
                      Neues Backup
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {backupLoading ? (
                    <p className="text-gray-500">Lädt Backups...</p>
                  ) : backupData && backupData.length > 0 ? (
                    <div className="space-y-3">
                      {backupData.map((backup: Backup) => (
                        <div key={backup.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${
                              backup.status === 'completed' ? 'bg-green-100' :
                              backup.status === 'failed' ? 'bg-red-100' : 'bg-yellow-100'
                            }`}>
                              <Database className={`w-5 h-5 ${
                                backup.status === 'completed' ? 'text-green-600' :
                                backup.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                              }`} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 capitalize">
                                {backup.backupType === 'full' ? 'Vollständig' : backup.backupType === 'db' ? 'Datenbank' : backup.backupType === 'files' ? 'Dateien' : backup.backupType} Backup
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(backup.createdAt).toLocaleString('de-DE')}
                                {backup.fileSize > 0 && ` · ${(backup.fileSize / 1024 / 1024).toFixed(1)} MB`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              backup.status === 'completed' ? 'bg-green-100 text-green-700' :
                              backup.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {backup.status === 'completed' ? 'Abgeschlossen' :
                               backup.status === 'failed' ? 'Fehlgeschlagen' : 'In Bearbeitung'}
                            </span>
                            {backup.status === 'completed' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadBackup(backup.id)}
                                  disabled={backupActionLoading === backup.id}
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  Download
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setConfirmRestore(backup.id)}
                                  disabled={backupActionLoading === backup.id}
                                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                >
                                  <RotateCcw className="w-4 h-4 mr-1" />
                                  Wiederherstellen
                                </Button>
                              </>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmDelete(backup.id)}
                              disabled={backupActionLoading === backup.id}
                              className="border-red-200 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Database className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-3">Noch keine Backups vorhanden</p>
                      <Button onClick={() => setBackupTypeModal(true)} variant="default">
                        <Database className="w-4 h-4 mr-2" />
                        Erstes Backup erstellen
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Backup-Typ Modal */}
              {backupTypeModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
                    <h3 className="text-lg font-bold mb-4">Backup-Typ wählen</h3>
                    <div className="space-y-3 mb-5">
                      {[
                        { type: 'full', label: 'Vollständig', desc: 'Datenbank + alle Dateien' },
                        { type: 'db', label: 'Nur Datenbank', desc: 'Schnell, nur DB-Inhalte' },
                        { type: 'files', label: 'Nur Dateien', desc: 'Themes, Plugins, Uploads' },
                      ].map(({ type, label, desc }) => (
                        <button
                          key={type}
                          onClick={() => handleCreateBackup(type)}
                          className="w-full text-left px-4 py-3 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                          <p className="font-semibold text-gray-900">{label}</p>
                          <p className="text-xs text-gray-500">{desc}</p>
                        </button>
                      ))}
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => setBackupTypeModal(false)}>Abbrechen</Button>
                  </div>
                </div>
              )}

              {/* Restore Bestätigung */}
              {confirmRestore !== null && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
                    <h3 className="text-lg font-bold mb-2">Backup wiederherstellen?</h3>
                    <p className="text-sm text-gray-600 mb-5">Die aktuelle Website wird mit dem Backup überschrieben. Dieser Vorgang kann nicht rückgängig gemacht werden.</p>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setConfirmRestore(null)}>Abbrechen</Button>
                      <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleRestoreBackup(confirmRestore)}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Wiederherstellen
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Löschen Bestätigung */}
              {confirmDelete !== null && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
                    <h3 className="text-lg font-bold mb-2">Backup löschen?</h3>
                    <p className="text-sm text-gray-600 mb-5">Das Backup wird dauerhaft aus dem Speicher gelöscht und kann nicht wiederhergestellt werden.</p>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Abbrechen</Button>
                      <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDeleteBackup(confirmDelete)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Löschen
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Insights Tab */}
          {activeTab === 'ai-insights' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-600" />
                      KI-Analyse
                    </span>
                    <Button
                      onClick={handleRunAIAnalysis}
                      disabled={aiLoading}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {aiLoading ? (
                        <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Analysiere...</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" />{aiAnalysis ? 'Neu analysieren' : 'Analyse starten'}</>
                      )}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!aiAnalysis && !aiLoading && (
                    <div className="text-center py-12">
                      <Brain className="w-16 h-16 text-purple-200 mx-auto mb-4" />
                      <p className="text-gray-700 font-medium mb-1">KI-gestützte Site-Analyse</p>
                      <p className="text-sm text-gray-500 mb-6">Die KI analysiert alle Site-Daten und erstellt eine priorisierte Zusammenfassung mit konkreten Handlungsempfehlungen.</p>
                      <Button onClick={handleRunAIAnalysis} className="bg-purple-600 hover:bg-purple-700 text-white">
                        <Sparkles className="w-4 h-4 mr-2" />Jetzt analysieren
                      </Button>
                    </div>
                  )}
                  {aiLoading && (
                    <div className="text-center py-12 space-y-3">
                      <div className="inline-flex items-center gap-3 text-purple-600">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        <span className="font-medium">KI analysiert deine Site...</span>
                      </div>
                      <p className="text-xs text-gray-400">Sicherheit, Updates, Performance und Inhalt werden geprüft</p>
                    </div>
                  )}
                  {aiAnalysis && !aiLoading && (
                    <div className="space-y-5">
                      {aiAnalysis.summary?.raw && (
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                            <span className="text-sm font-semibold text-purple-900">KI-Zusammenfassung</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiAnalysis.summary.raw}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-center">
                          <p className="text-2xl font-bold text-red-600">{aiAnalysis.critical || 0}</p>
                          <p className="text-xs text-red-600 font-medium mt-0.5">Kritisch</p>
                        </div>
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-center">
                          <p className="text-2xl font-bold text-amber-600">{aiAnalysis.warning || 0}</p>
                          <p className="text-xs text-amber-600 font-medium mt-0.5">Warnung</p>
                        </div>
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-center">
                          <p className="text-2xl font-bold text-blue-600">{aiAnalysis.info || 0}</p>
                          <p className="text-xs text-blue-600 font-medium mt-0.5">Hinweis</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {(aiAnalysis.recommendations || []).map((rec: any, i: number) => {
                          const colors: Record<string, string> = { critical: 'border-red-200 bg-red-50', warning: 'border-amber-200 bg-amber-50', info: 'border-blue-200 bg-blue-50' };
                          const badgeColors: Record<string, string> = { critical: 'bg-red-100 text-red-700', warning: 'bg-amber-100 text-amber-700', info: 'bg-blue-100 text-blue-700' };
                          const toolLink = rec.type === 'security'
                            ? { href: 'https://complyo.de', label: 'Compliance & Datenschutz mit Complyo prüfen', color: 'text-indigo-600 hover:text-indigo-800' }
                            : rec.type === 'content'
                            ? { href: 'https://spamify.io', label: 'Content automatisieren mit Spamify', color: 'text-emerald-600 hover:text-emerald-800' }
                            : null;
                          const taskAction =
                            rec.type === 'updates' ? () => setActiveTab('updates') :
                            rec.type === 'security' ? () => setActiveTab('security') :
                            rec.type === 'performance' ? () => setActiveTab('performance') :
                            rec.type === 'maintenance' ? () => setActiveTab('plugins') :
                            rec.actionEndpoint?.includes('backup') ? () => { setActiveTab('backups'); setBackupTypeModal(true); } :
                            null;
                          return (
                            <div key={i} className={`p-4 rounded-lg border-2 ${colors[rec.severity] || 'border-gray-200 bg-gray-50'}`}>
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${badgeColors[rec.severity] || 'bg-gray-100 text-gray-700'}`}>
                                      {rec.severity === 'critical' ? 'Kritisch' : rec.severity === 'warning' ? 'Warnung' : 'Hinweis'}
                                    </span>
                                    <span className="text-xs text-gray-500 capitalize">{rec.type}</span>
                                    {rec.estimatedTime && <span className="text-xs text-gray-400 ml-auto">{rec.estimatedTime}</span>}
                                  </div>
                                  <p className="font-semibold text-gray-900">{rec.title}</p>
                                  <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                                  {rec.impact && <p className="text-xs text-gray-500 mt-1"><span className="font-medium">Auswirkung:</span> {rec.impact}</p>}
                                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                                    {taskAction && (
                                      <button onClick={taskAction} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-white border border-gray-300 hover:bg-gray-50 transition-colors">
                                        <ArrowUpCircle className="w-3 h-3" />{rec.action || 'Jetzt beheben'}
                                      </button>
                                    )}
                                    {toolLink && (
                                      <a href={toolLink.href} target="_blank" rel="noopener noreferrer" className={`text-xs font-medium ${toolLink.color}`}>
                                        {toolLink.label} →
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-400 text-right">Analysiert: {aiAnalysis.generatedAt ? new Date(aiAnalysis.generatedAt).toLocaleString('de-DE') : 'Gerade eben'}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Self-Healing Section */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="p-1.5 bg-green-100 rounded-lg">
                        <Wrench className="w-4 h-4 text-green-600" />
                      </div>
                      Self-Healing
                      <span className="text-xs font-normal text-gray-400 ml-1">KI-gestützte Fehlerbehebung</span>
                    </CardTitle>
                    <button onClick={() => setExpandedHealing(!expandedHealing)} className="text-gray-400 hover:text-gray-600">
                      {expandedHealing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </CardHeader>
                {expandedHealing && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <button onClick={() => setHealingInput('White Screen of Death - Seite zeigt leere weiße Seite')} className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition-colors">
                        <Cpu className="w-4 h-4 text-gray-500 mb-1" />
                        <p className="font-medium text-gray-700">White Screen</p>
                        <p className="text-xs text-gray-500">Leere weiße Seite</p>
                      </button>
                      <button onClick={() => setHealingInput('Plugin-Konflikt - Seite funktioniert nach Plugin-Update nicht mehr')} className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition-colors">
                        <AlertCircle className="w-4 h-4 text-amber-500 mb-1" />
                        <p className="font-medium text-gray-700">Plugin-Konflikt</p>
                        <p className="text-xs text-gray-500">Nach Update gebrochen</p>
                      </button>
                      <button onClick={() => setHealingInput('Database connection error - Datenbankverbindung fehlgeschlagen')} className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition-colors">
                        <Database className="w-4 h-4 text-red-500 mb-1" />
                        <p className="font-medium text-gray-700">Datenbankfehler</p>
                        <p className="text-xs text-gray-500">Verbindung unterbrochen</p>
                      </button>
                      <button onClick={() => setHealingInput('404 Fehler - Permalinks sind kaputt, alle Seiten zeigen 404')} className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition-colors">
                        <Globe className="w-4 h-4 text-blue-500 mb-1" />
                        <p className="font-medium text-gray-700">404 / Permalinks</p>
                        <p className="text-xs text-gray-500">Seiten nicht erreichbar</p>
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        value={healingInput}
                        onChange={e => setHealingInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAnalyzeProblem()}
                        placeholder="Problem beschreiben oder oben auswählen..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <Button
                        onClick={handleAnalyzeProblem}
                        disabled={healingLoading || !healingInput.trim()}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 shrink-0"
                      >
                        {healingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Cpu className="w-4 h-4 mr-1" />Analysieren</>}
                      </Button>
                    </div>

                    {healingResult && (
                      <div className="space-y-3">
                        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            <p className="text-sm font-semibold text-green-800">
                              {healingResult.fixType === 'known' ? 'Bekanntes Problem erkannt' : 'KI-Analyse abgeschlossen'}
                            </p>
                            {healingResult.confidence && (
                              <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                {Math.round(healingResult.confidence * 100)}% Konfidenz
                              </span>
                            )}
                          </div>
                          {healingResult.fix?.description && (
                            <p className="text-sm text-green-700 mb-2">{healingResult.fix.description}</p>
                          )}
                          {healingResult.fix?.recommendation && (
                            <p className="text-xs text-green-600 bg-green-100 rounded p-2">{healingResult.fix.recommendation}</p>
                          )}
                          {healingResult.explanation && (
                            <p className="text-sm text-green-700 mt-2">{healingResult.explanation}</p>
                          )}
                        </div>

                        {healingResult.fix?.code && (
                          <div className="p-3 rounded-lg bg-gray-900 text-green-400 font-mono text-xs overflow-x-auto">
                            <p className="text-gray-500 mb-1 font-sans text-xs">Fix-Code ({healingResult.fix.type}):</p>
                            <pre className="whitespace-pre-wrap">{healingResult.fix.code}</pre>
                          </div>
                        )}

                        <div className="flex gap-2">
                          {healingResult.fix && (
                            <Button
                              onClick={() => handleApplyFix(healingResult.fixId || 'auto')}
                              disabled={applyingFix}
                              className="bg-green-600 hover:bg-green-700 text-white text-sm"
                            >
                              {applyingFix ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                              Fix anwenden
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            onClick={() => { setHealingResult(null); setHealingInput(''); }}
                            className="text-sm"
                          >
                            Neu
                          </Button>
                        </div>
                        <p className="text-xs text-gray-400">Vor dem Anwenden wird automatisch ein Snapshot erstellt.</p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* Healing History */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="p-1.5 bg-gray-100 rounded-lg">
                      <History className="w-4 h-4 text-gray-600" />
                    </div>
                    Healing-Verlauf
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500 text-center py-4">Noch keine automatischen Reparaturen durchgeführt.</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

