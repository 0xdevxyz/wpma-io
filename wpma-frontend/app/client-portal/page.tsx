'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { clientPortalApi } from '../../lib/api';
import { toast } from 'react-hot-toast';

export default function ClientPortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<{
    brandName: string;
    logoUrl?: string;
    primaryColor: string;
  }>({ brandName: 'WPMA', primaryColor: '#3B82F6' });

  useEffect(() => {
    // Already logged in?
    const token = localStorage.getItem('client_token');
    if (token) router.replace('/client-portal/dashboard');
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const r = await clientPortalApi.login(email, password);
      if (r.success && r.data) {
        localStorage.setItem('client_token', r.data.token);
        localStorage.setItem('client_info', JSON.stringify(r.data.client));
        localStorage.setItem('client_branding', JSON.stringify(r.data.branding));
        router.replace('/client-portal/dashboard');
      } else {
        toast.error(r.error || 'Ungültige Anmeldedaten');
      }
    } catch {
      toast.error('Anmeldung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0f] px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.brandName} className="h-10 mx-auto object-contain mb-3" />
          ) : (
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: branding.primaryColor }}>
              <Shield className="w-6 h-6 text-white" />
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{branding.brandName}</h1>
          <p className="text-sm text-gray-500 mt-1">Kunden-Portal</p>
        </div>

        <form onSubmit={handleLogin}
          className="rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ihre@email.de"
              autoComplete="email"
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Passwort</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full px-3 py-2 pr-9 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: branding.primaryColor }}
            className="w-full py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Anmelden
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Zugangsdaten erhalten Sie von Ihrer Agentur.
        </p>
      </div>
    </div>
  );
}
