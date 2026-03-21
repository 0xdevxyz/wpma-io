'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../lib/auth-store';
import { authApi } from '../../lib/api';
import { toast } from 'react-hot-toast';
import { User, Lock, Save, ArrowLeft, Bell } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loadUser } = useAuthStore();

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState({ discord_webhook: '', telegram_chat_id: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    if (user) setForm({ firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '' });
  }, [user]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await authApi.updateProfile({ firstName: form.firstName, lastName: form.lastName });
      if (r.success) {
        await loadUser();
        toast.success('Profil gespeichert');
      } else {
        toast.error(r.error || 'Fehler beim Speichern');
      }
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) { toast.error('Passwörter stimmen nicht überein'); return; }
    if (pw.next.length < 8) { toast.error('Mindestens 8 Zeichen'); return; }
    setSavingPw(true);
    try {
      const r = await authApi.changePassword({ currentPassword: pw.current, newPassword: pw.next });
      if (r.success) {
        toast.success('Passwort geändert');
        setPw({ current: '', next: '', confirm: '' });
      } else {
        toast.error(r.error || 'Fehler');
      }
    } catch {
      toast.error('Fehler beim Ändern');
    } finally {
      setSavingPw(false);
    }
  }


  async function handleSaveNotifications(e: React.FormEvent) {
    e.preventDefault();
    setSavingNotif(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.wpma.io';
      const res = await fetch(apiUrl + '/api/v1/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ discord_webhook: notif.discord_webhook || null, telegram_chat_id: notif.telegram_chat_id || null }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Benachrichtigungseinstellungen gespeichert');
      } else {
        toast.error(data.error || 'Fehler beim Speichern');
      }
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSavingNotif(false);
    }
  }
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] pt-20 pb-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Profil-Einstellungen</h1>
        </div>

        {/* Profile info */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Persönliche Daten</h2>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Vorname</label>
                <input
                  value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10
                    bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Nachname</label>
                <input
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10
                    bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">E-Mail</label>
              <input
                value={form.email}
                disabled
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10
                  bg-gray-50 dark:bg-white/[0.02] text-gray-400 dark:text-gray-500 cursor-not-allowed"
              />
              <p className="text-[11px] text-gray-400 mt-1">E-Mail kann nicht geändert werden</p>
            </div>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500
                text-white text-sm font-medium transition-colors disabled:opacity-50">
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </form>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <Bell className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Benachrichtigungen</h2>
          </div>
          <form onSubmit={handleSaveNotifications} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Discord Webhook URL</label>
              <input type="url" placeholder="https://discord.com/api/webhooks/..." value={notif.discord_webhook} onChange={e => setNotif(n => ({ ...n, discord_webhook: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Telegram Chat ID</label>
              <input type="text" placeholder="-1001234567890" value={notif.telegram_chat_id} onChange={e => setNotif(n => ({ ...n, telegram_chat_id: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <button type="submit" disabled={savingNotif} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
              <Save className="w-3.5 h-3.5" />
              {savingNotif ? 'Speichern...' : 'Benachrichtigungen speichern'}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Passwort ändern</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Aktuelles Passwort</label>
              <input type="password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10
                  bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Neues Passwort</label>
                <input type="password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10
                    bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Bestätigen</label>
                <input type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10
                    bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
              </div>
            </div>
            <button type="submit" disabled={savingPw}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500
                text-white text-sm font-medium transition-colors disabled:opacity-50">
              <Lock className="w-3.5 h-3.5" />
              {savingPw ? 'Ändern...' : 'Passwort ändern'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
