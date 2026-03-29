'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Trash2, Mail, Crown, Shield, Code, Headphones, UserPlus, X, Clock } from 'lucide-react';
import { teamApi } from '../../../lib/api';
import { toast } from 'react-hot-toast';

const ROLE_LABELS: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  owner:     { label: 'Owner',     icon: Crown,      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  admin:     { label: 'Admin',     icon: Shield,     cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' },
  developer: { label: 'Developer', icon: Code,       cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400' },
  support:   { label: 'Support',   icon: Headphones, cls: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-400' },
  client:    { label: 'Kunde',     icon: Users,      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
};

export default function TeamPage() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('support');

  const { data: membersData, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: teamApi.getMembers,
    staleTime: 60000,
  });
  const members: any[] = (membersData as any)?.data || [];

  const { data: invitesData } = useQuery({
    queryKey: ['team-invites'],
    queryFn: teamApi.getInvites,
    staleTime: 60000,
  });
  const invites: any[] = (invitesData as any)?.data || [];

  const inviteMut = useMutation({
    mutationFn: () => teamApi.inviteMember({ email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      toast.success(`Einladung an ${inviteEmail} gesendet`);
      setInviteEmail('');
      setShowInvite(false);
      qc.invalidateQueries({ queryKey: ['team-invites'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Einladung fehlgeschlagen'),
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => teamApi.removeMember(id),
    onSuccess: () => { toast.success('Mitglied entfernt'); qc.invalidateQueries({ queryKey: ['team-members'] }); },
    onError: () => toast.error('Entfernen fehlgeschlagen'),
  });

  const cancelInviteMut = useMutation({
    mutationFn: (id: number) => teamApi.cancelInvite(id),
    onSuccess: () => { toast.success('Einladung storniert'); qc.invalidateQueries({ queryKey: ['team-invites'] }); },
    onError: () => toast.error('Stornieren fehlgeschlagen'),
  });

  function RoleBadge({ role }: { role: string }) {
    const r = ROLE_LABELS[role] || ROLE_LABELS.support;
    const Icon = r.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.cls}`}>
        <Icon className="w-3 h-3" />
        {r.label}
      </span>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Teammitglieder und Zugriffsrechte verwalten</p>
        </div>
        <button
          onClick={() => setShowInvite(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
        >
          <UserPlus className="w-4 h-4" />
          Einladen
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Mitglied einladen</h2>
            <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">E-Mail</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="mitglied@example.com"
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Rolle</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white"
              >
                {Object.entries(ROLE_LABELS).filter(([r]) => r !== 'owner').map(([r, v]) => (
                  <option key={r} value={r}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => inviteMut.mutate()}
              disabled={!inviteEmail || inviteMut.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              {inviteMut.isPending ? 'Wird gesendet…' : 'Einladung senden'}
            </button>
          </div>
        </div>
      )}

      {/* Members */}
      <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Teammitglieder ({members.length})
          </h2>
        </div>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">Lädt…</div>
        ) : members.length === 0 ? (
          <div className="py-10 text-center">
            <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Noch keine Teammitglieder</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {members.map(m => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(m.firstName?.[0] || m.email?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{m.email}</p>
                </div>
                <RoleBadge role={m.role} />
                {m.role !== 'owner' && (
                  <button
                    onClick={() => { if (confirm('Mitglied entfernen?')) removeMut.mutate(m.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pending invites */}
      {invites.filter(i => !i.accepted_at).length > 0 && (
        <div className="bg-white dark:bg-[#141420] rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Ausstehende Einladungen</h2>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {invites.filter(i => !i.accepted_at).map(inv => (
              <li key={inv.id} className="flex items-center gap-3 px-4 py-3.5">
                <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">{inv.email}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Läuft ab: {new Date(inv.expires_at).toLocaleDateString('de')}
                  </p>
                </div>
                <RoleBadge role={inv.role} />
                <button
                  onClick={() => cancelInviteMut.mutate(inv.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
