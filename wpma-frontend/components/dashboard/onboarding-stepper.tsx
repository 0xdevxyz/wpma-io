'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Globe, Loader2, CheckCircle, AlertCircle, Download, Copy, Check,
  Plug, ArrowRight, Wifi, Package, Zap, RefreshCw, ShieldCheck, HardDrive,
  RefreshCcw, MonitorCheck, KeyRound, RotateCcw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'react-hot-toast';
import { sitesApi, syncApi, onboardingApi } from '../../lib/api';

interface OnboardingStepperProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
  initialSiteData?: {
    id: number;
    domain: string;
    siteName: string;
    setupToken: string;
    siteUrl: string;
    setupTokenExpiresAt?: string;
  } | null;
}

type Step = 'add-site' | 'install-plugin' | 'connected' | 'setup-flow';

interface OnboardingStep {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'needs_license';
  result?: any;
  error?: string;
}

interface OnboardingStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  steps: OnboardingStep[];
  pendingLicenses: { plugin_slug: string; plugin_name: string }[];
}

const FLOW_STEPS = [
  { key: 'malware_scan',      label: 'Sicherheits-Scan',   icon: ShieldCheck },
  { key: 'backup',            label: 'Backup',              icon: HardDrive },
  { key: 'health_and_update', label: 'Updates einspielen',  icon: RefreshCcw },
  { key: 'functional_check',  label: 'Funktionsprüfung',   icon: MonitorCheck },
];

function FlowStepRow({ stepKey, label, Icon, data }: {
  stepKey: string;
  label: string;
  Icon: React.ElementType;
  data?: OnboardingStep;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = data?.status ?? 'pending';

  const statusColor = {
    pending:       'text-gray-400 dark:text-gray-600',
    running:       'text-blue-500',
    completed:     'text-green-500',
    failed:        'text-red-500',
    skipped:       'text-gray-400',
    needs_license: 'text-orange-500',
  }[status] || 'text-gray-400';

  const StatusIcon = () => {
    if (status === 'running')  return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'failed')   return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (status === 'skipped')  return <CheckCircle className="w-4 h-4 text-gray-400" />;
    return <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
  };

  const r = data?.result as Record<string, any> | undefined;

  // Lesbares Summary je Step-Typ
  const summary = (() => {
    if (!r) return null;
    if (stepKey === 'malware_scan') {
      const score  = r.score ?? r.raw?.score ?? r.raw?.security_score;
      const crit   = r.hasCritical;
      const ssl    = r.raw?.ssl_enabled;
      const debug  = r.raw?.wordpress_debug;
      const lines: string[] = [];
      if (score  != null)  lines.push(`🛡️ Score: ${score}/100`);
      if (ssl    != null)  lines.push(ssl    ? '🔒 SSL aktiv' : '⚠️ Kein SSL');
      if (debug  != null)  lines.push(debug  ? '⚠️ Debug-Modus an' : '✅ Debug-Modus aus');
      if (crit   != null)  lines.push(crit   ? '🚨 Kritische Probleme gefunden' : '✅ Keine kritischen Probleme');
      return lines;
    }
    if (stepKey === 'backup') {
      const lines: string[] = [];
      if (r.status === 'running_in_background' || r.status === 'running') {
        lines.push('⏳ Läuft im Hintergrund');
        if (r.estimatedMin) lines.push(`⏱️ Geschätzte Dauer: ~${r.estimatedMin} Min.`);
        if (r.sizeMb)       lines.push(`📦 Größe: ${r.sizeMb} MB`);
        if (!r.estimatedMin) lines.push('💡 Plugin-Update für Echtzeit-Schätzung empfohlen');
      } else if (r.status === 'completed') {
        lines.push('✅ Backup erfolgreich');
        if (r.backupId) lines.push(`🗂️ ID: ${r.backupId}`);
      }
      return lines;
    }
    if (stepKey === 'health_and_update') {
      const lines: string[] = [];
      const score   = r.health_score;
      const total   = r.total_updates;
      const applied = r.free_updates_applied;
      const premium = r.premium_pending;
      if (score   != null) lines.push(`❤️ Health-Score: ${score}/100`);
      if (total   != null) lines.push(`🔄 Updates verfügbar: ${total}`);
      if (applied != null) lines.push(applied > 0 ? `✅ ${applied} Update(s) eingespielt` : '✅ Alle Plugins aktuell');
      if (premium > 0)     lines.push(`🔑 ${premium} Premium-Plugin(s) benötigen Lizenz`);
      return lines;
    }
    if (stepKey === 'functional_check') {
      return [`✅ Site antwortet (HTTP ${r.httpStatus})`];
    }
    return null;
  })();

  // Backup-Zeit inline in der Headerzeile anzeigen
  const inlineHint = stepKey === 'backup' && r && (r.status === 'running_in_background' || r.status === 'running') && r.estimatedMin
    ? `~${r.estimatedMin} Min.`
    : null;

  const hasDetail = !!(data?.error || summary);

  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/[0.07] overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors text-left"
        onClick={() => hasDetail && setExpanded(e => !e)}
        disabled={!hasDetail}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${statusColor}`} />
        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
        {inlineHint && (
          <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">{inlineHint}</span>
        )}
        <StatusIcon />
        {hasDetail && (
          expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 ml-1" />
            : <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
        )}
      </button>

      {expanded && hasDetail && (
        <div className="px-4 pb-3 pt-2 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/[0.06] space-y-1">
          {data?.error && <p className="text-xs text-red-500">{data.error}</p>}
          {summary?.map((line, i) => (
            <p key={i} className="text-xs text-gray-600 dark:text-gray-400">{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export const OnboardingStepper: React.FC<OnboardingStepperProps> = ({
  isOpen, onClose, onDone, initialSiteData,
}) => {
  const [step, setStep] = useState<Step>(initialSiteData ? 'install-plugin' : 'add-site');
  const [siteData, setSiteData] = useState(initialSiteData ?? null);

  const [urlInput, setUrlInput] = useState('');
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [meta, setMeta] = useState<{ domain: string; siteName: string; siteUrl: string } | null>(null);
  const [metaError, setMetaError] = useState('');
  const [creating, setCreating] = useState(false);

  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [renewingToken, setRenewingToken] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Setup-Flow state
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [licenseInputs, setLicenseInputs] = useState<Record<string, string>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (initialSiteData) {
      setSiteData(initialSiteData);
      setStep('install-plugin');
    }
  }, [initialSiteData]);

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      setIsConnected(false);
      setOnboardingStatus(null);
      if (!initialSiteData) {
        setStep('add-site');
        setSiteData(null);
        setMeta(null);
        setMetaError('');
        setUrlInput('');
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (step !== 'setup-flow') stopPolling();
    else if (siteData) startPolling(String(siteData.id));
  }, [step]);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function startPolling(siteId: string) {
    fetchOnboardingStatus(siteId);
    pollRef.current = setInterval(() => fetchOnboardingStatus(siteId), 4000);
  }

  async function fetchOnboardingStatus(siteId: string) {
    const r = await onboardingApi.getStatus(siteId);
    if (r.success && r.data) {
      setOnboardingStatus(r.data as OnboardingStatus);
      if (r.data.status === 'completed' || r.data.status === 'failed') {
        stopPolling();
      }
    }
  }

  const handleVerify = async () => {
    if (!siteData) return;
    setIsVerifying(true);
    try {
      const r = await syncApi.verifyPlugin(String(siteData.id));
      const status = r?.data?.pluginStatus;
      if (status === 'connected') {
        setIsConnected(true);
        setStep('connected');
        // Nach 2s direkt zum Flow-Screen wechseln
        setTimeout(() => setStep('setup-flow'), 2000);
      } else if (status === 'installed_not_configured') {
        toast.error('Plugin aktiv, API-Key fehlt — neue ZIP herunterladen & Plugin neu installieren.');
      } else {
        toast.error('Plugin nicht gefunden. Bitte in WordPress installieren & aktivieren.');
      }
    } catch {
      toast.error('Verbindungsprüfung fehlgeschlagen');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  const normalizeUrl = (u: string) => {
    let s = u.trim().replace(/^\/+|\/+$/g, '');
    if (!s.match(/^https?:\/\//i)) s = 'https://' + s;
    return s;
  };

  const handleFetchMeta = async () => {
    if (!urlInput) return;
    setFetchingMeta(true);
    setMetaError('');
    setMeta(null);
    try {
      const r = await sitesApi.fetchSiteMetadata(normalizeUrl(urlInput));
      if (r.success) setMeta(r.data);
      else { setMetaError(r.error || 'Fehler'); }
    } catch (e: any) { setMetaError(e?.message || 'Fehler'); }
    finally { setFetchingMeta(false); }
  };

  const handleCreateSite = async () => {
    if (!meta) return;
    setCreating(true);
    try {
      const r = await sitesApi.createSite({
        domain: meta.domain,
        site_name: meta.siteName,
        site_url: meta.siteUrl,
      });
      if (r.success) {
        setSiteData(r.data);
        setStep('install-plugin');
      } else {
        toast.error(r.error || 'Fehler beim Erstellen');
      }
    } catch { toast.error('Fehler beim Erstellen'); }
    finally { setCreating(false); }
  };

  const handleRenewToken = async () => {
    if (!siteData) return;
    setRenewingToken(true);
    try {
      const r = await sitesApi.regenerateSetupToken(String(siteData.id));
      if (r.success && r.data?.setupToken) {
        setSiteData(prev => prev ? { ...prev, setupToken: r.data.setupToken, setupTokenExpiresAt: r.data.setupTokenExpiresAt } : prev);
        setTokenExpired(false);
        toast.success('Neuer Token generiert');
      } else {
        toast.error(r.error || 'Fehler beim Erneuern');
      }
    } catch { toast.error('Fehler beim Erneuern'); }
    finally { setRenewingToken(false); }
  };

  const handleCopyToken = () => {
    if (!siteData?.setupToken) return;
    navigator.clipboard.writeText(siteData.setupToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitLicense = async (pluginSlug: string) => {
    if (!siteData || !licenseInputs[pluginSlug]) return;
    const r = await onboardingApi.submitLicense(String(siteData.id), pluginSlug, licenseInputs[pluginSlug]);
    if (r.success) {
      toast.success('Lizenz gespeichert');
      setLicenseInputs(prev => ({ ...prev, [pluginSlug]: '' }));
    } else {
      toast.error(r.error || 'Fehler');
    }
  };

  const handleSkipLicense = async (pluginSlug: string) => {
    if (!siteData) return;
    await onboardingApi.skipLicense(String(siteData.id), pluginSlug);
    toast.success('Übersprungen');
    fetchOnboardingStatus(String(siteData.id));
  };

  const handleRetry = async () => {
    if (!siteData) return;
    const r = await onboardingApi.retry(String(siteData.id));
    if (r.success) {
      setOnboardingStatus(null);
      startPolling(String(siteData.id));
      toast.success('Flow neu gestartet');
    }
  };

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'add-site',       label: 'Site anlegen',       icon: <Globe className="w-4 h-4" /> },
    { key: 'install-plugin', label: 'Plugin installieren', icon: <Package className="w-4 h-4" /> },
    { key: 'connected',      label: 'Einrichten',          icon: <Zap className="w-4 h-4" /> },
  ];
  const displayStep = step === 'setup-flow' ? 'connected' : step;
  const stepIdx = steps.findIndex(s => s.key === displayStep);

  const flowDone = onboardingStatus?.status === 'completed';
  const flowFailed = onboardingStatus?.status === 'failed';
  const flowRunning = !flowDone && !flowFailed;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 24 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-[#13131a] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-white/[0.08]">

              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-6 pt-6 pb-4">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-xl font-bold text-white">Site verbinden</h2>
                    <p className="text-blue-100 text-sm mt-0.5">In 3 Schritten startklar</p>
                  </div>
                  <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-0">
                  {steps.map((s, i) => (
                    <React.Fragment key={s.key}>
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all font-semibold text-sm
                          ${i < stepIdx ? 'bg-white text-blue-600' : i === stepIdx ? 'bg-white/30 text-white ring-2 ring-white/60' : 'bg-white/10 text-white/40'}`}>
                          {i < stepIdx ? <Check className="w-4 h-4" /> : i + 1}
                        </div>
                        <span className={`text-[10px] mt-1 font-medium ${i === stepIdx ? 'text-white' : 'text-white/50'}`}>
                          {s.label}
                        </span>
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`flex-1 h-px mx-2 mb-3 transition-colors ${i < stepIdx ? 'bg-white/60' : 'bg-white/20'}`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-6">

                {/* Step 1: Site anlegen */}
                {step === 'add-site' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Gib die URL deiner WordPress-Site ein. Wir lesen den Namen automatisch aus.
                    </p>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="example.com"
                        value={urlInput}
                        onChange={e => { setUrlInput(e.target.value); setMeta(null); setMetaError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleFetchMeta()}
                        className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-white/[0.12] bg-white dark:bg-white/[0.05] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition"
                        disabled={fetchingMeta || creating}
                      />
                      <Button onClick={handleFetchMeta} disabled={!urlInput || fetchingMeta || creating}>
                        {fetchingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Prüfen'}
                      </Button>
                    </div>

                    {metaError && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 dark:text-red-400">{metaError}</p>
                      </div>
                    )}

                    {meta && (
                      <div className="p-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-semibold text-green-800 dark:text-green-300">Gefunden</span>
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{meta.siteName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">{meta.domain}</p>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button variant="secondary" onClick={onClose} className="flex-1">Abbrechen</Button>
                      <Button onClick={handleCreateSite} disabled={!meta || creating} className="flex-1">
                        {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Erstelle...</> : <>Weiter <ArrowRight className="w-4 h-4 ml-1" /></>}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 2: Plugin installieren */}
                {step === 'install-plugin' && siteData && (
                  <div className="space-y-4">
                    {tokenExpired ? (
                      <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <p className="text-sm text-orange-800 dark:text-orange-300">Token abgelaufen — bitte erneuern</p>
                        </div>
                        <button
                          onClick={handleRenewToken}
                          disabled={renewingToken}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-colors disabled:opacity-50"
                        >
                          {renewingToken ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Erneuern
                        </button>
                      </div>
                    ) : null}

                    <ol className="space-y-3">
                      <li className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Plugin herunterladen</p>
                          <button
                            onClick={() => { window.open(sitesApi.getPluginDownloadUrl(siteData.setupToken), '_blank'); }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> wpma-agent.zip herunterladen
                          </button>
                        </div>
                      </li>

                      <li className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">In WordPress installieren & aktivieren</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">WordPress Admin → Plugins → Neu hinzufügen → Plugin hochladen → Aktivieren</p>
                        </div>
                      </li>

                      <li className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Verbindung herstellen</p>
                          <button
                            onClick={handleVerify}
                            disabled={isVerifying}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white transition-colors w-full justify-center"
                          >
                            {isVerifying
                              ? <><Loader2 className="w-4 h-4 animate-spin" /> Prüfe Verbindung…</>
                              : <><Wifi className="w-4 h-4" /> Jetzt verbinden</>
                            }
                          </button>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 text-center">
                            Nach Aktivierung des Plugins hier klicken
                          </p>
                        </div>
                      </li>
                    </ol>
                  </div>
                )}

                {/* Step 3: Verbunden – kurzer Übergangs-Screen */}
                {step === 'connected' && siteData && (
                  <div className="space-y-4 text-center py-4">
                    <div className="flex justify-center">
                      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="w-9 h-9 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Plugin verbunden!</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Automatische Einrichtung wird gestartet…
                      </p>
                    </div>
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto" />
                  </div>
                )}

                {/* Step 4: Setup-Flow – Live-Fortschritt */}
                {step === 'setup-flow' && siteData && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Automatische Einrichtung</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {flowRunning && 'Läuft…'}
                          {flowDone && 'Abgeschlossen!'}
                          {flowFailed && 'Fehler aufgetreten'}
                        </p>
                      </div>
                      {flowFailed && (
                        <button
                          onClick={handleRetry}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-white/[0.08] hover:bg-gray-200 dark:hover:bg-white/[0.12] text-gray-700 dark:text-gray-300 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Neu starten
                        </button>
                      )}
                    </div>

                    {/* Schritt-Liste */}
                    <div className="space-y-2">
                      {FLOW_STEPS.map(({ key, label, icon: Icon }) => {
                        const stepData = onboardingStatus?.steps.find(s => s.step === key);
                        return (
                          <FlowStepRow key={key} stepKey={key} label={label} Icon={Icon} data={stepData} />
                        );
                      })}
                    </div>

                    {/* Ausstehende Lizenz-Anfragen */}
                    {(onboardingStatus?.pendingLicenses?.length ?? 0) > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5" /> Premium-Plugin Lizenzschlüssel erforderlich
                        </p>
                        {onboardingStatus!.pendingLicenses.map(pl => (
                          <div key={pl.plugin_slug} className="rounded-xl border border-orange-200 dark:border-orange-500/30 p-3 bg-orange-50 dark:bg-orange-500/10 space-y-2">
                            <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{pl.plugin_name}</p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Lizenzschlüssel eingeben…"
                                value={licenseInputs[pl.plugin_slug] || ''}
                                onChange={e => setLicenseInputs(prev => ({ ...prev, [pl.plugin_slug]: e.target.value }))}
                                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-orange-300 dark:border-orange-500/40 bg-white dark:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                              <button
                                onClick={() => handleSubmitLicense(pl.plugin_slug)}
                                disabled={!licenseInputs[pl.plugin_slug]}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50 transition-colors"
                              >
                                Speichern
                              </button>
                              <button
                                onClick={() => handleSkipLicense(pl.plugin_slug)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-200 dark:bg-white/[0.08] hover:bg-gray-300 text-gray-600 dark:text-gray-400 transition-colors"
                              >
                                Überspringen
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Abschluss */}
                    {flowDone && (
                      <div className="pt-2">
                        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 mb-3 text-center">
                          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                            Einrichtung erfolgreich abgeschlossen!
                          </p>
                          <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-0.5">
                            Alle Features sind jetzt für {siteData.siteName} verfügbar.
                          </p>
                        </div>
                        <Button onClick={onDone} className="w-full">
                          Zum Dashboard <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    )}

                    {flowFailed && !flowDone && (
                      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-center">
                        <p className="text-sm text-red-700 dark:text-red-400">
                          Ein Schritt ist fehlgeschlagen. Die Site wurde ggf. zurückgesetzt.
                        </p>
                        <p className="text-xs text-red-500/80 mt-0.5">
                          Du hast eine Benachrichtigung mit Details erhalten.
                        </p>
                        <button
                          onClick={onDone}
                          className="mt-2 text-xs text-gray-500 underline hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Trotzdem zum Dashboard
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
