'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Mail, MessageSquare, Webhook, Save, TestTube, CheckCircle } from 'lucide-react';
import { notificationsApi } from '../../../lib/api';
import { toast } from 'react-hot-toast';

const CHANNELS = [
  { id: 'email', label: 'E-Mail', icon: Mail, color: 'text-blue-600 dark:text-blue-400' },
  { id: 'slack', label: 'Slack', icon: MessageSquare, color: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'discord', label: 'Discord', icon: MessageSquare, color: 'text-violet-600 dark:text-violet-400' },
  { id: 'webhook', label: 'Webhook', icon: Webhook, color: 'text-amber-600 dark:text-amber-400' },
];

const EVENTS = [
  { id: 'downtime', label: 'Downtime', desc: 'Site nicht erreichbar' },
  { id: 'security', label: 'Sicherheits-Scan', desc: 'Neue Schwachstellen gefunden' },
  { id: 'updates', label: 'Updates verfügbar', desc: 'Plugin/Theme/Core-Updates' },
  { id: 'backup_complete', label: 'Backup abgeschlossen', desc: 'Backup erfolgreich' },
  { id: 'backup_failed', label: 'Backup fehlgeschlagen', desc: 'Backup konnte nicht erstellt werden' },
  { id: 'agent_scan', label: 'KI Agent Scan', desc: 'Agent hat Issues gefunden' },
];

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [activeChannel, setActiveChannel] = useState('email');
  const [config, setConfig] = useState<Record<string, any>>({});
  const [enabledEvents, setEnabledEvents] = useState<string[]>(['downtime', 'security', 'updates']);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: notificationsApi.getSettings,
    staleTime: 60000,
  });

  useEffect(() => {
    const data = (settingsData as any)?.data;
    if (data) {
      setConfig(data.channels || {});
      setEnabledEvents(data.enabledEvents || ['downtime', 'security', 'updates']);
    }
  }, [settingsData]);

  const saveMut = useMutation({
    mutationFn: () => notificationsApi.saveSettings({ channels: config, enabledEvents }),
    onSuccess: () => {
      toast.success('Einstellungen gespeichert');
      qc.invalidateQueries({ queryKey: ['notification-settings'] });
    },
    onError: () => toast.error('Speichern fehlgeschlagen'),
  });

  const testMut = useMutation({
    mutationFn: () => notificationsApi.test(activeChannel),
    onSuccess: () => toast.success('Test-Benachrichtigung gesendet'),
    onError: () => toast.error('Test fehlgeschlagen'),
  });

  function toggleEvent(eventId: string) {
    setEnabledEvents(prev =>
      prev.includes(eventId) ? prev.filter(e => e !== eventId) : [...prev, eventId]
    );
  }

  function updateChannelConfig(key: string, value: string) {
    setConfig(prev => ({
      ...prev,
      [activeChannel]: { ...(prev[activeChannel] || {}), [key]: value },
    }));
  }

  const channelConfig = config[activeChannel] || {};

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Benachrichtigungen</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kanäle und Ereignisse konfigurieren</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: channel tabs */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 mb-2">Kanäle</p>
            {CHANNELS.map(ch => {
              const Icon = ch.icon;
              const configured = !!(config[ch.id]?.webhook_url || config[ch.id]?.email || config[ch.id]?.url);
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors mb-0.5
                    ${activeChannel === ch.id
                      ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06]'}`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${ch.color}`} />
                  <span className="font-medium">{ch.label}</span>
                  {configured && <CheckCircle className="w-3.5 h-3.5 text-green-500 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: config */}
        <div className="lg:col-span-2 space-y-4">
          {/* Channel config */}
          <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              {CHANNELS.find(c => c.id === activeChannel)?.label} konfigurieren
            </h2>
            {activeChannel === 'email' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">E-Mail-Adresse</label>
                  <input
                    type="email"
                    value={channelConfig.email || ''}
                    onChange={e => updateChannelConfig('email', e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                  />
                </div>
              </div>
            )}
            {(activeChannel === 'slack' || activeChannel === 'discord') && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Webhook URL</label>
                <input
                  type="url"
                  value={channelConfig.webhook_url || ''}
                  onChange={e => updateChannelConfig('webhook_url', e.target.value)}
                  placeholder={`https://hooks.${activeChannel}.com/...`}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                />
              </div>
            )}
            {activeChannel === 'webhook' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Webhook URL</label>
                  <input
                    type="url"
                    value={channelConfig.url || ''}
                    onChange={e => updateChannelConfig('url', e.target.value)}
                    placeholder="https://your-server.com/webhook"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Secret (optional)</label>
                  <input
                    type="password"
                    value={channelConfig.secret || ''}
                    onChange={e => updateChannelConfig('secret', e.target.value)}
                    placeholder="Webhook secret"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Events */}
          <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Ereignisse</h2>
            <div className="space-y-2">
              {EVENTS.map(ev => (
                <label key={ev.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabledEvents.includes(ev.id)}
                    onChange={() => toggleEvent(ev.id)}
                    className="w-4 h-4 rounded text-blue-600 bg-gray-100 dark:bg-white/10 border-gray-300 dark:border-white/20"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{ev.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{ev.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveMut.isPending ? 'Speichert…' : 'Speichern'}
            </button>
            <button
              onClick={() => testMut.mutate()}
              disabled={testMut.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 disabled:opacity-50 border border-gray-200 dark:border-white/10"
            >
              <TestTube className="w-4 h-4" />
              Test senden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
