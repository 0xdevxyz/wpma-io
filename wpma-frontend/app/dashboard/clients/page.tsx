'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Plus, Trash2, Edit2, Globe, CheckSquare, Square,
  Loader2, X, Eye, EyeOff, ExternalLink, CheckCircle,
} from 'lucide-react';
import { clientsApi, sitesApi } from '../../../lib/api';
import { toast } from 'react-hot-toast';

interface Client {
  id: number;
  name: string;
  email: string;
  active: boolean;
  notes: string | null;
  site_count: number;
  created_at: string;
  last_login: string | null;
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

function ClientModal({
  client,
  onClose,
  onSaved,
}: {
  client?: Client;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!client;
  const [form, setForm] = useState({
    name: client?.name || '',
    email: client?.email || '',
    password: '',
    notes: client?.notes || '',
  });
  const [showPw, setShowPw] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const data: any = { name: form.name, notes: form.notes };
        if (form.password) data.password = form.password;
        return clientsApi.update(client!.id, data);
      }
      return clientsApi.create(form as any);
    },
    onSuccess: (r) => {
      if (r.success) {
        toast.success(isEdit ? 'Client aktualisiert' : 'Client erstellt');
        qc.invalidateQueries({ queryKey: ['clients'] });
        onSaved();
      } else {
        toast.error(r.error || 'Fehler');
      }
    },
    onError: () => toast.error('Fehler'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#111118] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Client bearbeiten' : 'Neuer Client'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Name">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Max Mustermann" className={inputCls} />
          </Field>
          {!isEdit && (
            <Field label="E-Mail">
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="max@example.com" className={inputCls} type="email" />
            </Field>
          )}
          <Field label={isEdit ? 'Neues Passwort (leer lassen = unverändert)' : 'Passwort'}>
            <div className="relative">
              <input
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                type={showPw ? 'text' : 'password'}
                placeholder={isEdit ? '••••••••' : 'Min. 8 Zeichen'}
                className={`${inputCls} pr-9`}
              />
              <button onClick={() => setShowPw(p => !p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <Field label="Notizen">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Interne Notizen..." rows={2}
              className={`${inputCls} resize-none`} />
          </Field>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
            Abbrechen
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name || (!isEdit && (!form.email || !form.password))}
            className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Speichern' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sites Assignment Modal ───────────────────────────────────────────────────

function SitesModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);

  const { data: sitesData, isLoading } = useQuery({
    queryKey: ['client-sites', client.id],
    queryFn: async () => {
      const r = await clientsApi.getSites(client.id);
      return r.success ? r.data : [];
    },
  });

  React.useEffect(() => {
    if (sitesData && !initialized) {
      setSelected(sitesData.filter((s: any) => s.assigned).map((s: any) => s.id));
      setInitialized(true);
    }
  }, [sitesData]);

  const saveMutation = useMutation({
    mutationFn: () => clientsApi.setSites(client.id, selected),
    onSuccess: (r) => {
      if (r.success) {
        toast.success('Sites aktualisiert');
        qc.invalidateQueries({ queryKey: ['clients'] });
        onClose();
      } else {
        toast.error(r.error || 'Fehler');
      }
    },
  });

  function toggle(id: number) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const sites: any[] = sitesData || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#111118] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Sites zuweisen</h2>
            <p className="text-xs text-gray-500 mt-0.5">{client.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1 mb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : sites.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Keine Sites vorhanden</p>
          ) : sites.map((s: any) => (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left
                ${selected.includes(s.id) ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'}`}
            >
              {selected.includes(s.id)
                ? <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{s.site_name || s.domain}</p>
                <p className="text-xs text-gray-400 truncate">{s.domain}</p>
              </div>
              <span className={`text-xs font-semibold ${(s.health_score || 0) >= 90 ? 'text-emerald-500' : (s.health_score || 0) >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>
                {s.health_score || 0}%
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
            Abbrechen
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {selected.length} Sites speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [sitesClient, setSitesClient] = useState<Client | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const r = await clientsApi.list();
      return r.success ? (r.data || []) : [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => clientsApi.remove(id),
    onSuccess: () => { toast.success('Client gelöscht'); refetch(); },
  });

  const clients: Client[] = data || [];
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.wpma.io'}/client-portal`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] pt-20 pb-10">
      {(createOpen || editClient) && (
        <ClientModal
          client={editClient || undefined}
          onClose={() => { setCreateOpen(false); setEditClient(null); }}
          onSaved={() => { setCreateOpen(false); setEditClient(null); refetch(); }}
        />
      )}
      {sitesClient && (
        <SitesModal client={sitesClient} onClose={() => setSitesClient(null)} />
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Kunden</h1>
            <p className="text-sm text-gray-500 mt-0.5">Client-Portal-Zugänge verwalten</p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors"
          >
            <Plus className="w-4 h-4" /> Neuer Kunde
          </button>
        </div>

        {/* Portal Link Info */}
        <div className="rounded-xl border border-blue-100 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Client-Portal URL</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-mono">{portalUrl}</p>
          </div>
          <a href={portalUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline flex-shrink-0">
            Öffnen <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Client List */}
        <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Noch keine Kunden</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Erstelle Kunden-Accounts für dein Client-Portal</p>
              <button onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors">
                <Plus className="w-4 h-4" /> Ersten Kunden erstellen
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 dark:border-white/[0.04] bg-gray-50/50 dark:bg-white/[0.01]">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">E-Mail</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Sites</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Letzter Login</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="w-28 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 border-gray-50 dark:border-white/[0.03]">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.email}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSitesClient(c)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Globe className="w-3 h-3" /> {c.site_count} Site{c.site_count !== 1 ? 's' : ''}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {c.last_login
                        ? new Date(c.last_login).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.05]'}`}>
                        {c.active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setEditClient(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                          title="Bearbeiten"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`${c.name} wirklich löschen?`)) deleteMutation.mutate(c.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
