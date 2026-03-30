'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, CheckCircle, X, RefreshCw, Settings, Shield,
  Zap, Sparkles, ArrowLeft, Clock, Globe, Hand,
  ToggleLeft, ToggleRight, ChevronRight, Plus,
} from 'lucide-react';
import { agentApi, sitesApi } from '../../../lib/api';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface AgentSettings {
  auto_approve_low: boolean;
  auto_approve_medium: boolean;
  auto_approve_high: boolean;
  auto_approve_critical: boolean;
  enabled: boolean;
  manual_mode: boolean;
  scan_frequency_hours: number;
}

const SEV_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-400',
};

const SEV_LABELS: Record<string, string> = {
  critical: 'Kritisch',
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
};

const FREQUENCY_OPTIONS = [
  { value: 1,  label: 'Stündlich',     desc: 'Maximale Reaktionszeit' },
  { value: 3,  label: 'Alle 3 Stunden', desc: 'Empfohlen für aktive Shops' },
  { value: 6,  label: 'Alle 6 Stunden', desc: 'Standard – gute Balance' },
  { value: 12, label: 'Alle 12 Stunden', desc: 'Für ruhigere Sites' },
  { value: 24, label: 'Täglich',       desc: 'Minimale Überwachungsfrequenz' },
];

// ─── TOGGLE ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-white/20'}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

// ─── ONBOARDING STEPS ─────────────────────────────────────────────────────────
function OnboardingChecklist({ sites }: { sites: any[] }) {
  const connectedSites = sites.filter(s => s.isConnected || s.last_plugin_connection);
  const steps = [
    {
      done: sites.length > 0,
      label: 'Erste Site hinzugefügt',
      desc: 'Mindestens eine WordPress-Site verbunden',
    },
    {
      done: connectedSites.length > 0,
      label: 'Plugin installiert & verbunden',
      desc: 'WPMA-Plugin auf der Site aktiv und verbunden',
    },
    {
      done: connectedSites.length > 0,
      label: 'Erster automatischer Scan',
      desc: 'Agent hat einen ersten Health-Check durchgeführt',
    },
    {
      done: false,
      label: 'Scan-Frequenz eingestellt',
      desc: 'Wie oft soll der Agent prüfen?',
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="rounded-2xl bg-[#0a0a12] border border-white/[0.07] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Onboarding</h3>
            <p className="text-xs text-white/40">{doneCount} von {steps.length} Schritten</p>
          </div>
        </div>
        <span className="text-sm font-bold text-white/60">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/[0.06] rounded-full mb-5">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
              ${step.done ? 'bg-green-500/20' : 'bg-white/[0.06]'}`}>
              {step.done
                ? <CheckCircle className="w-3 h-3 text-green-400" />
                : <span className="w-1.5 h-1.5 rounded-full bg-white/20" />}
            </div>
            <div>
              <p className={`text-sm font-medium ${step.done ? 'text-white/40 line-through' : 'text-white/80'}`}>
                {step.label}
              </p>
              <p className="text-xs text-white/25 mt-0.5">{step.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function AgentSettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => { const r = await sitesApi.getSites(); return r.success ? (r.data || []) : []; },
    staleTime: 60000,
  });
  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];
  const connectedSites = sites.filter(s => s.isConnected || s.last_plugin_connection);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['agent-settings'],
    queryFn: agentApi.getSettings,
  });

  const rawSettings: AgentSettings = (settingsData as any)?.data || {};
  const [form, setForm] = useState<AgentSettings | null>(null);
  const current: AgentSettings = form || {
    auto_approve_low: rawSettings.auto_approve_low ?? true,
    auto_approve_medium: rawSettings.auto_approve_medium ?? true,
    auto_approve_high: rawSettings.auto_approve_high ?? false,
    auto_approve_critical: rawSettings.auto_approve_critical ?? false,
    enabled: rawSettings.enabled ?? true,
    manual_mode: rawSettings.manual_mode ?? false,
    scan_frequency_hours: rawSettings.scan_frequency_hours ?? 6,
  };

  const toggle = (key: keyof AgentSettings) =>
    setForm(prev => ({ ...(prev || current), [key]: !(prev || current)[key] }));

  const setFrequency = (val: number) =>
    setForm(prev => ({ ...(prev || current), scan_frequency_hours: val }));

  const saveMut = useMutation({
    mutationFn: () => agentApi.saveSettings(current),
    onMutate: () => setSaving(true),
    onSuccess: () => {
      toast.success('Einstellungen gespeichert');
      qc.invalidateQueries({ queryKey: ['agent-settings'] });
      setForm(null);
    },
    onError: () => toast.error('Fehler beim Speichern'),
    onSettled: () => setSaving(false),
  });

  const reactivateMut = useMutation({
    mutationFn: () => agentApi.setManualMode(false),
    onSuccess: () => {
      toast.success('Agent reaktiviert');
      qc.invalidateQueries({ queryKey: ['agent-settings'] });
    },
  });

  const isManualMode = rawSettings.manual_mode ?? false;
  const hasChanges = form !== null;

  return (
    <div className="min-h-screen pb-10">
      <div className="max-w-2xl mx-auto">

        {/* Back */}
        <button onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 mb-5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Zurück zum Dashboard
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Agent-Einstellungen</h1>
            <p className="text-sm text-white/40">Onboarding, Frequenz & Verhalten des KI-Agenten</p>
          </div>
        </div>

        <div className="space-y-4">

          {/* Manual Mode Banner */}
          {isManualMode && (
            <div className="rounded-2xl bg-amber-500/[0.08] border border-amber-500/25 p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Hand className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-300">Manueller Modus aktiv</p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  Der Agent ist pausiert. Er überwacht deine Sites und zeigt Empfehlungen,
                  führt aber keine automatischen Aktionen durch. Nur du oder ein Agentur-Nutzer kann ihn reaktivieren.
                </p>
              </div>
              <button
                onClick={() => reactivateMut.mutate()}
                disabled={reactivateMut.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-semibold
                  hover:bg-amber-500/30 transition-colors flex-shrink-0"
              >
                <Zap className="w-3.5 h-3.5" />
                {reactivateMut.isPending ? 'Aktiviert…' : 'Reaktivieren'}
              </button>
            </div>
          )}

          {/* Onboarding */}
          <OnboardingChecklist sites={sites} />

          {/* Site overview */}
          <div className="rounded-2xl bg-[#0a0a12] border border-white/[0.07] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-white/40" />
                <h3 className="text-sm font-semibold text-white">Verbundene Sites</h3>
              </div>
              <span className="text-xs text-white/30">{connectedSites.length} / {sites.length}</span>
            </div>

            {sites.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-white/30 mb-3">Noch keine Sites hinzugefügt</p>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Site hinzufügen
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {sites.slice(0, 5).map((site: any) => {
                  const connected = site.isConnected || site.last_plugin_connection;
                  return (
                    <li key={site.id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-500' : 'bg-white/20'}`} />
                      <span className="text-sm text-white/70 flex-1 truncate">{site.siteName || site.domain}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full
                        ${connected ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/25'}`}>
                        {connected ? 'Verbunden' : 'Nicht verbunden'}
                      </span>
                    </li>
                  );
                })}
                {sites.length > 5 && (
                  <li className="text-xs text-white/25 pt-1">+{sites.length - 5} weitere Sites</li>
                )}
              </ul>
            )}
          </div>

          {/* Scan Frequency */}
          <div className="rounded-2xl bg-[#0a0a12] border border-white/[0.07] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-white/40" />
              <h3 className="text-sm font-semibold text-white">Scan-Frequenz</h3>
            </div>
            <p className="text-xs text-white/35 mb-4">Wie oft soll der Agent deine Sites automatisch prüfen?</p>
            <div className="space-y-2">
              {FREQUENCY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all
                    ${current.scan_frequency_hours === opt.value
                      ? 'bg-blue-500/[0.08] border-blue-500/30 text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/[0.04] hover:text-white/70'}`}
                >
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-white/30 mt-0.5">{opt.desc}</p>
                  </div>
                  {current.scan_frequency_hours === opt.value && (
                    <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Agent Enable */}
          <div className="rounded-2xl bg-[#0a0a12] border border-white/[0.07] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="w-4 h-4 text-white/40" />
              <h3 className="text-sm font-semibold text-white">Agent-Modus</h3>
            </div>

            <label className="flex items-center justify-between cursor-pointer py-3 border-b border-white/[0.04]">
              <div>
                <p className="text-sm text-white/80">Agent aktiviert</p>
                <p className="text-xs text-white/30 mt-0.5">Automatisches Scannen aller verbundenen Sites</p>
              </div>
              <Toggle checked={current.enabled} onChange={() => toggle('enabled')} />
            </label>
          </div>

          {/* Auto-Execution */}
          <div className="rounded-2xl bg-[#0a0a12] border border-white/[0.07] p-5">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-white/40" />
              <h3 className="text-sm font-semibold text-white">Auto-Ausführung</h3>
            </div>
            <p className="text-xs text-white/30 mb-4">
              Der Agent führt Fixes automatisch aus – ohne auf deine Freigabe zu warten.
              Wähle, bei welchen Schweregraden das erlaubt ist.
            </p>

            {(['low', 'medium', 'high', 'critical'] as const).map(sev => {
              const key = `auto_approve_${sev}` as keyof AgentSettings;
              return (
                <label key={sev} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SEV_COLORS[sev]}`} />
                    <div>
                      <p className="text-sm text-white/70">{SEV_LABELS[sev]}</p>
                      {sev === 'critical' && (
                        <p className="text-[11px] text-orange-400/70">Vorsicht: Kritische Fixes automatisch ausführen</p>
                      )}
                    </div>
                  </div>
                  <Toggle checked={!!current[key]} onChange={() => toggle(key)} />
                </label>
              );
            })}
          </div>

          {/* Save */}
          {hasChanges && (
            <div className="flex gap-2">
              <button
                onClick={() => setForm(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:bg-white/[0.04] transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => saveMut.mutate()}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? 'Speichert…' : 'Einstellungen speichern'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
