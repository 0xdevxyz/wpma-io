'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, CheckCircle, AlertTriangle, XCircle, Zap, Shield, RefreshCw,
  ChevronRight, Play, Check, X, Clock, Activity, ArrowRight,
  Sparkles, Globe, HardDrive, Package, Plus, Hand, Eye, Lightbulb,
} from 'lucide-react';
import { sitesApi, agentApi, securityApi, bulkApi, backupApi } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { CommandPalette } from '../../components/dashboard/command-palette';
import { AIAssistantOverlay } from '../../components/dashboard/ai-assistant-overlay';
import { OnboardingStepper } from '../../components/dashboard/onboarding-stepper';
import { toast } from 'react-hot-toast';

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

function statusColor(status: string) {
  if (['done', 'completed', 'success'].includes(status))  return 'bg-green-500/20 text-green-400';
  if (['failed', 'error'].includes(status))                return 'bg-red-500/20 text-red-400';
  if (['analyzing', 'executing', 'running', 'action_planned'].includes(status)) return 'bg-blue-500/20 text-blue-400';
  if (status === 'awaiting_approval')                      return 'bg-amber-500/20 text-amber-400';
  return 'bg-white/5 text-white/30';
}

function statusIcon(status: string) {
  if (['done', 'completed', 'success'].includes(status))  return <Check className="w-3 h-3" />;
  if (['failed', 'error'].includes(status))                return <X className="w-3 h-3" />;
  if (['analyzing', 'executing', 'running'].includes(status)) return <Activity className="w-3 h-3" />;
  if (status === 'awaiting_approval')                      return <Clock className="w-3 h-3" />;
  return <Zap className="w-3 h-3" />;
}

const ACTION_COPY: Record<string, string> = {
  // updates
  update_plugins:      'Plugins aktualisiert',
  update_themes:       'Themes aktualisiert',
  update_core:         'WordPress Core aktualisiert',
  auto_update:         'Auto-Update durchgeführt',
  plugin_update:       'Plugin aktualisiert',
  theme_update:        'Theme aktualisiert',
  // security
  security_scan:       'Sicherheitsscan',
  vulnerability_scan:  'Schwachstellen geprüft',
  malware_scan:        'Malware-Scan',
  firewall_update:     'Firewall aktualisiert',
  // backups
  backup_created:      'Backup erstellt',
  backup_restore:      'Backup eingespielt',
  backup:              'Backup erstellt',
  // performance
  performance_fix:     'Performance optimiert',
  cache_clear:         'Cache geleert',
  optimize_images:     'Bilder optimiert',
  // monitoring
  health_check:        'Health-Check',
  uptime_check:        'Verfügbarkeit geprüft',
  monitor:             'Site überwacht',
  site_check:          'Site geprüft',
  // issues
  issue_detected:      'Problem erkannt',
  issue_fixed:         'Problem behoben',
  alert:               'Alarm ausgelöst',
  // content
  content_publish:     'Inhalt veröffentlicht',
  content_generate:    'Inhalt generiert',
  // general
  scan:                'Scan abgeschlossen',
  analyze:             'Analyse abgeschlossen',
  fix:                 'Automatisch behoben',
  action:              'Aktion durchgeführt',
};

// ─── HERO ─────────────────────────────────────────────────────────────────────

function Hero({ sites, tasks, stats, onScanAll, isManualMode, onReactivate }: {
  sites: any[];
  tasks: any[];
  stats: any;
  onScanAll: () => void;
  isManualMode: boolean;
  onReactivate: () => void;
}) {
  const criticalSites = sites.filter(s => s.healthScore > 0 && s.healthScore < 50);
  const pendingApprovals = tasks.filter(t => t.status === 'awaiting_approval');
  const activeTasks = tasks.filter(t => ['analyzing', 'executing', 'running', 'action_planned'].includes(t.status));
  const todayFixed = tasks.filter(t => {
    if (t.status !== 'done') return false;
    const d = new Date(t.updated_at || t.created_at);
    return d.toDateString() === new Date().toDateString();
  });

  const isAllGood = criticalSites.length === 0 && pendingApprovals.length === 0;
  const isRunning = activeTasks.length > 0;

  if (isManualMode) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-[#0a0a12] border border-amber-500/20 p-8 mb-6">
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_top,_#f59e0b_0%,_transparent_60%)]" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 bg-amber-500/20 ring-2 ring-amber-500/40">
            <Hand className="w-8 h-8 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1">Manueller Modus aktiv</p>
            <h1 className="text-3xl font-bold text-white leading-tight">Agent pausiert – nur Monitoring</h1>
            <p className="text-sm text-gray-400 mt-1">
              Du hast die manuelle Administration übernommen. Der Agent überwacht deine Sites und gibt Empfehlungen,
              führt aber keine Aktionen durch.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-4">
              {[
                { label: 'Sites', value: sites.length, icon: Globe },
                { label: 'Überwacht', value: sites.length, icon: Eye },
                { label: 'Empfehlungen', value: criticalSites.length + (pendingApprovals.length), icon: Lightbulb },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5 text-sm">
                  <s.icon className="w-3.5 h-3.5 text-gray-500" />
                  <span className="font-semibold text-white">{s.value}</span>
                  <span className="text-gray-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onReactivate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0 transition-all
              bg-white text-black hover:bg-white/90 shadow-lg shadow-white/10"
          >
            <Zap className="w-4 h-4" />
            Agent reaktivieren
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0a0a12] border border-white/[0.06] p-8 mb-6">
      {/* Background glow */}
      <div className={`absolute inset-0 opacity-20 pointer-events-none transition-all duration-1000
        ${isAllGood ? 'bg-[radial-gradient(ellipse_at_top,_#22c55e_0%,_transparent_60%)]'
        : criticalSites.length > 0 ? 'bg-[radial-gradient(ellipse_at_top,_#ef4444_0%,_transparent_60%)]'
        : 'bg-[radial-gradient(ellipse_at_top,_#f59e0b_0%,_transparent_60%)]'}`}
      />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-start gap-6">
        {/* Agent avatar */}
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0
          ${isRunning ? 'bg-blue-500/20 ring-2 ring-blue-500/50' : isAllGood ? 'bg-green-500/20 ring-2 ring-green-500/30' : 'bg-amber-500/20 ring-2 ring-amber-500/40'}`}>
          <Bot className={`w-8 h-8 ${isRunning ? 'text-blue-400 animate-pulse' : isAllGood ? 'text-green-400' : 'text-amber-400'}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Main headline */}
          {isRunning ? (
            <>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-1">KI Agent aktiv</p>
              <h1 className="text-3xl font-bold text-white leading-tight">
                Analysiere {activeTasks.length} {activeTasks.length === 1 ? 'Site' : 'Sites'}…
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                {activeTasks[0]?.site_name || activeTasks[0]?.description || 'Scanne und behebe Probleme'}
              </p>
            </>
          ) : pendingApprovals.length > 0 ? (
            <>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1">Entscheidung erforderlich</p>
              <h1 className="text-3xl font-bold text-white leading-tight">
                {pendingApprovals.length} {pendingApprovals.length === 1 ? 'Aktion wartet' : 'Aktionen warten'} auf dich
              </h1>
              <p className="text-sm text-gray-400 mt-1">Dein Agent hat Maßnahmen identifiziert und wartet auf Freigabe</p>
            </>
          ) : isAllGood ? (
            <>
              <p className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-1">Alles in Ordnung</p>
              <h1 className="text-3xl font-bold text-white leading-tight">
                {todayFixed.length > 0
                  ? `${todayFixed.length} ${todayFixed.length === 1 ? 'Problem' : 'Probleme'} heute behoben`
                  : `Alle ${sites.length} Sites sind gesund`}
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                {todayFixed.length > 0
                  ? `${sites.length} ${sites.length === 1 ? 'Site' : 'Sites'} überwacht · Keine weiteren Maßnahmen nötig`
                  : 'Agent hat nichts zu tun gefunden — alles läuft perfekt'}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-1">Handlungsbedarf</p>
              <h1 className="text-3xl font-bold text-white leading-tight">
                {criticalSites.length} {criticalSites.length === 1 ? 'Site braucht' : 'Sites brauchen'} Aufmerksamkeit
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Kritische Probleme erkannt — Agent bereit zur Behebung
              </p>
            </>
          )}

          {/* Quick stats */}
          <div className="flex flex-wrap items-center gap-4 mt-4">
            {[
              { label: 'Sites', value: sites.length, icon: Globe },
              { label: 'Heute behoben', value: todayFixed.length, icon: Check },
              { label: 'Ausstehend', value: pendingApprovals.length, icon: Clock },
              { label: 'Updates', value: sites.reduce((a, s) => a + (s.pluginsUpdates || 0) + (s.themesUpdates || 0), 0), icon: Package },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5 text-sm">
                <s.icon className="w-3.5 h-3.5 text-gray-500" />
                <span className="font-semibold text-white">{s.value}</span>
                <span className="text-gray-500">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onScanAll}
          disabled={isRunning}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0 transition-all
            ${isRunning
              ? 'bg-white/5 text-gray-500 cursor-not-allowed'
              : 'bg-white text-black hover:bg-white/90 shadow-lg shadow-white/10'}`}
        >
          {isRunning ? <Activity className="w-4 h-4 animate-pulse" /> : <Zap className="w-4 h-4" />}
          {isRunning ? 'Läuft…' : 'Agent starten'}
        </button>
      </div>
    </div>
  );
}

// ─── RECOMMENDATIONS (Manual Mode) ───────────────────────────────────────────

function AgentRecommendations({ tasks, sites }: { tasks: any[]; sites: any[] }) {
  const recommendations: { title: string; desc: string; severity: string; siteName: string }[] = [];

  // Build recommendations from current task state
  tasks
    .filter(t => !['done', 'rejected'].includes(t.status))
    .slice(0, 8)
    .forEach(t => {
      const site = sites.find(s => s.id === t.site_id);
      recommendations.push({
        title: t.title,
        desc: t.ai_analysis?.root_cause || t.ai_analysis?.impact || 'Agent empfiehlt Überprüfung',
        severity: t.severity,
        siteName: t.site_name || site?.siteName || site?.domain || 'Site',
      });
    });

  // Add site-based recommendations if no tasks
  if (recommendations.length === 0) {
    sites.filter(s => {
      const h = s.healthScore ?? null;
      return h !== null && h > 0 && h < 70;
    }).slice(0, 4).forEach(s => {
      recommendations.push({
        title: `Health Score bei ${s.healthScore}% – Überprüfung empfohlen`,
        desc: 'Manueller Check der Site-Konfiguration, Plugin-Konflikte und Performance-Parameter empfohlen.',
        severity: s.healthScore < 50 ? 'high' : 'medium',
        siteName: s.siteName || s.domain,
      });
    });
  }

  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <Eye className="w-8 h-8 text-gray-700 mx-auto mb-2" />
        <p className="text-sm text-gray-600">Keine Empfehlungen – alle Sites sehen gut aus</p>
      </div>
    );
  }

  const severityColor: Record<string, string> = {
    critical: 'text-red-400 bg-red-500/10',
    high: 'text-orange-400 bg-orange-500/10',
    medium: 'text-amber-400 bg-amber-500/10',
    low: 'text-blue-400 bg-blue-500/10',
  };

  return (
    <ul className="space-y-2">
      {recommendations.map((r, i) => (
        <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
            ${severityColor[r.severity] || 'text-white/30 bg-white/5'}`}>
            <Lightbulb className="w-3 h-3" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/80 truncate">{r.siteName}</p>
            <p className="text-sm text-white/60 leading-snug">{r.title}</p>
            {r.desc && r.desc !== r.title && (
              <p className="text-xs text-white/30 mt-0.5 line-clamp-2">{r.desc}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── APPROVAL CARD ────────────────────────────────────────────────────────────

function ApprovalCard({ task, onApprove, onReject }: { task: any; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/[0.08] border border-amber-500/20">
      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Clock className="w-4 h-4 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{task.site_name || 'Site'}</p>
        <p className="text-xs text-gray-400 mt-0.5">{task.description || task.action_type}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={onApprove}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-semibold hover:bg-green-500/30 transition-colors">
          <Check className="w-3 h-3" /> Freigeben
        </button>
        <button onClick={onReject}
          className="flex items-center gap-1 px-3 py-1.5 bg-white/5 text-gray-400 rounded-lg text-xs font-semibold hover:bg-white/10 transition-colors">
          <X className="w-3 h-3" /> Ablehnen
        </button>
      </div>
    </div>
  );
}

// ─── TIMELINE ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  done:              { label: 'Erfolgreich',  cls: 'text-green-400 bg-green-500/10' },
  failed:            { label: 'Fehlgeschlagen', cls: 'text-red-400 bg-red-500/10' },
  analyzing:         { label: 'Analysiert',   cls: 'text-blue-400 bg-blue-500/10' },
  executing:         { label: 'Wird ausgeführt', cls: 'text-blue-400 bg-blue-500/10' },
  action_planned:    { label: 'Geplant',      cls: 'text-blue-400 bg-blue-500/10' },
  awaiting_approval: { label: 'Wartet',       cls: 'text-amber-400 bg-amber-500/10' },
  rejected:          { label: 'Abgelehnt',    cls: 'text-white/30 bg-white/5' },
  detected:          { label: 'Erkannt',      cls: 'text-white/30 bg-white/5' },
};

function Timeline({ tasks }: { tasks: any[] }) {
  const recent = [...tasks]
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 20);

  if (recent.length === 0) return null;

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-white/[0.06]" />

      <ul className="space-y-1">
        {recent.map((task, i) => {
          const st = STATUS_LABEL[task.status];
          const doneActions = Array.isArray(task.actions)
            ? task.actions.filter((a: any) => a.status === 'done').map((a: any) => a.action_label).join(', ')
            : null;
          return (
            <li key={task.id || i} className="flex items-start gap-3 group">
              {/* Dot */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 mt-0.5
                ${statusColor(task.status)}`}>
                {statusIcon(task.status)}
              </div>

              <div className="flex-1 min-w-0 flex items-start justify-between gap-2 py-0.5">
                <div className="min-w-0">
                  <p className="text-sm leading-snug">
                    <span className="font-medium text-white/90">
                      {task.site_name || task.site?.domain || task.site?.site_name || 'Agent'}
                    </span>
                    <span className="text-white/40"> · </span>
                    <span className="text-white/70">
                      {task.title || ACTION_COPY[task.action_type] || task.action_type?.replace(/_/g, ' ') || 'Aktion'}
                    </span>
                  </p>
                  {doneActions && (
                    <p className="text-xs text-white/30 mt-0.5 truncate">{doneActions}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                  {st && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${st.cls}`}>
                      {st.label}
                    </span>
                  )}
                  <span className="text-[11px] text-white/20 whitespace-nowrap">
                    {timeAgo(task.updated_at || task.created_at)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── ATTENTION SITES ──────────────────────────────────────────────────────────

function AttentionSite({ site, onScan, agentWorking, onSelect, selected }: { site: any; onScan: () => void; agentWorking?: boolean; onSelect?: () => void; selected?: boolean }) {
  const router = useRouter();
  const totalUpdates = (site.pluginsUpdates || 0) + (site.themesUpdates || 0) + (site.coreUpdateAvailable ? 1 : 0);
  const health = site.healthScore ?? null;
  const isDown = site.uptimeStatus === 'down' || site.last_status === 'down';
  const notChecked = health === null || health === 0;

  const issues: { label: string; cls: string }[] = [];
  if (isDown) issues.push({ label: 'Offline', cls: 'bg-red-500/15 text-red-400' });
  else if (notChecked) issues.push({ label: 'Nicht geprüft', cls: 'bg-white/5 text-white/30' });
  else if (health < 50) issues.push({ label: `Score ${health}`, cls: 'bg-red-500/15 text-red-400' });
  else if (health < 70) issues.push({ label: `Score ${health}`, cls: 'bg-amber-500/15 text-amber-400' });
  if (totalUpdates > 0) issues.push({ label: `${totalUpdates} Updates`, cls: 'bg-blue-500/15 text-blue-400' });
  const sec = site.securityScore ?? null;
  if (sec !== null && sec > 0 && sec < 60) issues.push({ label: 'Sicherheit', cls: 'bg-orange-500/15 text-orange-400' });
  if (!isDown && !notChecked && health >= 70 && totalUpdates === 0 && (sec === null || sec === 0 || sec >= 60)) {
    issues.push({ label: 'Aktuell', cls: 'bg-green-500/15 text-green-400' });
  }

  const dotColor = isDown ? 'bg-red-500' : notChecked ? 'bg-white/20' : health < 50 ? 'bg-red-500' : health < 70 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 p-4 rounded-xl border transition-all group cursor-pointer
      ${selected
        ? 'bg-blue-500/[0.08] border-blue-500/30'
        : agentWorking
        ? 'bg-blue-500/[0.04] border-blue-500/20'
        : 'bg-white/[0.03] border-white/[0.06] hover:border-white/10 hover:bg-white/[0.05]'
      }`}>
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor} ${agentWorking ? 'animate-pulse' : ''}`} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{site.siteName || site.domain}</p>
        <p className="text-xs text-white/30 truncate">{site.domain || site.siteUrl}</p>
      </div>

      {/* Issue badges */}
      <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
        {issues.slice(0, 3).map((issue, i) => (
          <span key={i} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${issue.cls}`}>
            {issue.label}
          </span>
        ))}
      </div>

      {agentWorking ? (
        <span className="flex-shrink-0 flex items-center gap-1.5 text-[11px] text-blue-400/70 font-medium">
          <Activity className="w-3 h-3 animate-pulse" /> Agent prüft…
        </span>
      ) : (
        <button
          onClick={onScan}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold
            bg-white/5 text-white/30 hover:bg-white/10 hover:text-white transition-all opacity-0 group-hover:opacity-100"
        >
          <Zap className="w-3 h-3" /> Scan
        </button>
      )}

      <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-white/30 transition-colors flex-shrink-0" />
    </div>
  );
}

// ─── ALL OK ───────────────────────────────────────────────────────────────────

function AllOkState({ sites }: { sites: any[] }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-green-500/10 ring-1 ring-green-500/20 flex items-center justify-center">
          <CheckCircle className="w-9 h-9 text-green-400" />
        </div>
        {/* Ping */}
        <span className="absolute inset-0 rounded-full bg-green-500/5 animate-ping" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Keine Probleme gefunden</h2>
      <p className="text-sm text-gray-400 max-w-sm">
        Alle {sites.length} Sites laufen stabil. Dein Agent überwacht kontinuierlich und meldet sich,
        sobald Handlungsbedarf besteht.
      </p>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [showAI, setShowAI] = useState(false);
  const [showAddSite, setShowAddSite] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.getSites,
    refetchInterval: 30000,
  });
  const sites: any[] = (sitesData as any)?.data || (sitesData as any)?.sites || [];

  const { data: tasksData } = useQuery({
    queryKey: ['agent-tasks'],
    queryFn: () => agentApi.getTasks(),
    refetchInterval: 6000,
  });
  const tasks: any[] = (tasksData as any)?.data || [];

  const { data: statsData } = useQuery({
    queryKey: ['agent-stats'],
    queryFn: agentApi.getStats,
    refetchInterval: 15000,
  });
  const stats = (statsData as any)?.data || {};

  const { data: settingsData } = useQuery({
    queryKey: ['agent-settings'],
    queryFn: agentApi.getSettings,
    refetchInterval: 20000,
  });
  const isManualMode: boolean = (settingsData as any)?.data?.manual_mode ?? false;

  const reactivateMut = useMutation({
    mutationFn: () => agentApi.setManualMode(false),
    onSuccess: () => {
      toast.success('Agent reaktiviert – übernimmt wieder alle Aufgaben');
      qc.invalidateQueries({ queryKey: ['agent-settings'] });
    },
    onError: () => toast.error('Reaktivierung fehlgeschlagen'),
  });

  const scanAllMut = useMutation({
    mutationFn: agentApi.scanAll,
    onSuccess: () => {
      toast.success('Agent scannt alle Sites…');
      setTimeout(() => qc.invalidateQueries({ queryKey: ['agent-tasks'] }), 2000);
    },
    onError: (err: any) => {
      if (err?.response?.data?.manual_mode) {
        toast.error('Agent ist pausiert. Bitte erst reaktivieren.');
      } else {
        toast.error('Scan konnte nicht gestartet werden');
      }
    },
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => agentApi.approve(id),
    onSuccess: () => { toast.success('Freigegeben'); qc.invalidateQueries({ queryKey: ['agent-tasks'] }); },
  });

  const rejectMut = useMutation({
    mutationFn: (id: number) => agentApi.reject(id, 'Vom Nutzer abgelehnt'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-tasks'] }); },
  });

  const scanSiteMut = useMutation({
    mutationFn: (siteId: string) => agentApi.scanSite(siteId),
    onSuccess: (_, siteId) => {
      toast.success('Scan gestartet');
      qc.invalidateQueries({ queryKey: ['agent-tasks'] });
    },
  });

  // Derived state
  const pendingApprovals = tasks.filter(t => t.status === 'awaiting_approval');
  const doneTasks = tasks.filter(t => ['done', 'completed'].includes(t.status));

  const attentionSites = sites.filter(s => {
    const health = s.healthScore ?? null;
    const updates = (s.pluginsUpdates || 0) + (s.themesUpdates || 0) + (s.coreUpdateAvailable ? 1 : 0);
    const security = s.securityScore ?? null;
    const healthBad = health !== null && health > 0 && health < 70;
    const secBad = security !== null && security > 0 && security < 60;
    const isDown = s.uptimeStatus === 'down' || s.last_status === 'down';
    return isDown || healthBad || updates > 0 || secBad;
  });

  const isAllGood = attentionSites.length === 0 && pendingApprovals.length === 0;

  const activeTasks = tasks.filter(t => ['analyzing', 'executing', 'running', 'action_planned'].includes(t.status));
  const agentSiteIds = new Set(activeTasks.map(t => t.site_id).filter(Boolean));

  return (
    <>
      <CommandPalette />
      {showAI && <AIAssistantOverlay onClose={() => setShowAI(false)} />}

      <div className="min-h-screen">
        {/* Onboarding (only for new users) */}
        {(sites.length === 0 || showAddSite) && (
          <OnboardingStepper
            isOpen={true}
            onClose={() => setShowAddSite(false)}
            onDone={() => setShowAddSite(false)}
          />
        )}

        {/* Hero */}
        <Hero
          sites={sites}
          tasks={tasks}
          stats={stats}
          onScanAll={() => scanAllMut.mutate()}
          isManualMode={isManualMode}
          onReactivate={() => reactivateMut.mutate()}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ─── LEFT COLUMN (main) ─── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Pending approvals (hidden in manual mode – agent doesn't act) */}
            {!isManualMode && pendingApprovals.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Freigabe erforderlich ({pendingApprovals.length})
                </h2>
                <div className="space-y-2">
                  {pendingApprovals.map(t => (
                    <ApprovalCard
                      key={t.id}
                      task={t}
                      onApprove={() => approveMut.mutate(t.id)}
                      onReject={() => rejectMut.mutate(t.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Sites needing attention */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                {attentionSites.length > 0
                  ? <><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Handlungsbedarf ({attentionSites.length})</>
                  : <><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Site-Status</>}
              </h2>

              <div className="space-y-2">
                {(isAllGood ? sites : attentionSites).map(site => (
                  <AttentionSite
                    key={site.id}
                    site={site}
                    agentWorking={!isManualMode && agentSiteIds.has(site.id)}
                    onScan={() => scanSiteMut.mutate(String(site.id))}
                    onSelect={() => setSelectedSiteId(selectedSiteId === site.id ? null : site.id)}
                    selected={selectedSiteId === site.id}
                  />
                ))}
                {isAllGood && sites.length === 0 && <AllOkState sites={sites} />}
              </div>
            </section>
          </div>

          {/* ─── RIGHT COLUMN (timeline + AI) ─── */}
          <div className="space-y-6">

            {/* AI Button */}
            <button
              onClick={() => setShowAI(true)}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-blue-600/10 border border-blue-500/20
                hover:bg-blue-600/20 hover:border-blue-500/40 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">KI-Assistent fragen</p>
                <p className="text-xs text-gray-500">Frag alles über deine Sites</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 ml-auto transition-colors" />
            </button>

            {/* Manual mode: Recommendations feed instead of activity */}
            {isManualMode ? (
              <section>
                <h2 className="text-xs font-semibold text-amber-500/70 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Agent-Empfehlungen
                </h2>
                <AgentRecommendations tasks={tasks} sites={sites} />
              </section>
            ) : (
              <section>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" />
                  Agent-Aktivität
                  {selectedSiteId && (
                    <>
                      <span className="text-white/30">·</span>
                      <span className="text-blue-400 normal-case font-medium">
                        {sites.find(s => s.id === selectedSiteId)?.siteName || sites.find(s => s.id === selectedSiteId)?.domain}
                      </span>
                      <button
                        onClick={() => setSelectedSiteId(null)}
                        className="ml-auto text-[10px] text-white/30 hover:text-white/60 transition-colors"
                      >
                        Alle anzeigen
                      </button>
                    </>
                  )}
                </h2>

                {tasks.length === 0 ? (
                  <div className="text-center py-8">
                    <Bot className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Noch keine Aktivität</p>
                    <p className="text-xs text-gray-700 mt-0.5">Starte einen Scan um den Agenten zu aktivieren</p>
                  </div>
                ) : (
                  <Timeline tasks={selectedSiteId ? tasks.filter(t => t.site_id === selectedSiteId) : tasks} />
                )}
              </section>
            )}

            {/* Quick nav */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Schnellzugriff</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Updates', icon: RefreshCw, href: '/dashboard/updates', color: 'text-blue-400',
                    badge: sites.reduce((a, s) => a + (s.pluginsUpdates || 0) + (s.themesUpdates || 0), 0) },
                  { label: 'Sicherheit', icon: Shield, href: '/dashboard/security', color: 'text-orange-400',
                    badge: sites.filter(s => s.securityScore > 0 && s.securityScore < 70).length },
                  { label: 'Backups', icon: HardDrive, href: '/dashboard/backups', color: 'text-emerald-400',
                    badge: sites.filter(s => !s.lastBackup).length },
                  { label: 'Monitoring', icon: Activity, href: '/dashboard/monitoring', color: 'text-violet-400',
                    badge: sites.filter(s => s.uptimeStatus === 'down').length },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      onClick={() => router.push(item.href)}
                      className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]
                        hover:bg-white/[0.07] hover:border-white/10 transition-all text-left"
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${item.color}`} />
                      <span className="text-sm text-gray-300">{item.label}</span>
                      {item.badge > 0 && (
                        <span className="ml-auto text-[10px] font-bold bg-white/10 text-gray-300 px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowAddSite(true)}
        className="fixed bottom-8 right-8 z-[60] w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        aria-label="Site hinzufügen"
      >
        <Plus className="w-7 h-7" />
      </button>
    </>
  );
}
