'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Palette, Globe, Mail, Eye, EyeOff, Save, Loader2, CheckCircle } from 'lucide-react';
import { whiteLabelApi } from '../../../lib/api';
import { toast } from 'react-hot-toast';

const DEFAULT = {
  brandName: '',
  primaryColor: '#3B82F6',
  secondaryColor: '#1E40AF',
  logoUrl: '',
  faviconUrl: '',
  customDomain: '',
  supportEmail: '',
  supportUrl: '',
  hideWpmaBranding: false,
  emailFromName: '',
  emailFromAddress: '',
  footerText: '',
};

export default function WhiteLabelPage() {
  const [form, setForm] = useState(DEFAULT);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['white-label-config'],
    queryFn: async () => {
      const r = await whiteLabelApi.getConfig();
      return r.success ? r.data : null;
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        brandName: data.brandName || data.brand_name || '',
        primaryColor: data.primaryColor || data.primary_color || '#3B82F6',
        secondaryColor: data.secondaryColor || data.secondary_color || '#1E40AF',
        logoUrl: data.logoUrl || data.logo_url || '',
        faviconUrl: data.faviconUrl || data.favicon_url || '',
        customDomain: data.customDomain || data.custom_domain || '',
        supportEmail: data.supportEmail || data.support_email || '',
        supportUrl: data.supportUrl || data.support_url || '',
        hideWpmaBranding: data.hideWpmaBranding || data.hide_wpma_branding || false,
        emailFromName: data.emailFromName || data.email_from_name || '',
        emailFromAddress: data.emailFromAddress || data.email_from_address || '',
        footerText: data.footerText || data.footer_text || '',
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => whiteLabelApi.saveConfig(form),
    onSuccess: (r) => {
      if (r.success) {
        setSaved(true);
        toast.success('Einstellungen gespeichert');
        setTimeout(() => setSaved(false), 3000);
      } else {
        toast.error(r.error || 'Fehler beim Speichern');
      }
    },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  function set(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }));
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] pt-20 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] pt-20 pb-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6">

        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">White-Label</h1>
          <p className="text-sm text-gray-500 mt-0.5">Eigenes Branding für das Client-Portal konfigurieren</p>
        </div>

        {/* Branding */}
        <Section icon={<Palette className="w-4 h-4" />} title="Branding">
          <Field label="Markenname" hint="Wird im Client-Portal angezeigt">
            <input
              value={form.brandName}
              onChange={e => set('brandName', e.target.value)}
              placeholder="Meine Agentur"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Primärfarbe">
              <div className="flex gap-2">
                <input type="color" value={form.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                  className="w-10 h-9 rounded-lg border border-gray-200 dark:border-white/[0.1] cursor-pointer p-0.5 bg-white dark:bg-white/[0.05]" />
                <input value={form.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                  placeholder="#3B82F6" className={`${inputCls} flex-1`} />
              </div>
            </Field>
            <Field label="Sekundärfarbe">
              <div className="flex gap-2">
                <input type="color" value={form.secondaryColor} onChange={e => set('secondaryColor', e.target.value)}
                  className="w-10 h-9 rounded-lg border border-gray-200 dark:border-white/[0.1] cursor-pointer p-0.5 bg-white dark:bg-white/[0.05]" />
                <input value={form.secondaryColor} onChange={e => set('secondaryColor', e.target.value)}
                  placeholder="#1E40AF" className={`${inputCls} flex-1`} />
              </div>
            </Field>
          </div>
          <Field label="Logo URL" hint="HTTPS-Link zu Ihrem Logo (empfohlen: 200×50px SVG/PNG)">
            <input value={form.logoUrl} onChange={e => set('logoUrl', e.target.value)}
              placeholder="https://example.com/logo.png" className={inputCls} />
          </Field>
          <Field label="Favicon URL">
            <input value={form.faviconUrl} onChange={e => set('faviconUrl', e.target.value)}
              placeholder="https://example.com/favicon.ico" className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.hideWpmaBranding}
              onChange={e => set('hideWpmaBranding', e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-sm text-gray-700 dark:text-gray-300">WPMA-Branding im Client-Portal ausblenden</span>
          </label>
        </Section>

        {/* Domain */}
        <Section icon={<Globe className="w-4 h-4" />} title="Custom Domain">
          <Field label="Domain" hint="Eigene Domain für das Client-Portal (z.B. portal.meine-agentur.de)">
            <input value={form.customDomain} onChange={e => set('customDomain', e.target.value)}
              placeholder="portal.meine-agentur.de" className={inputCls} />
          </Field>
          {form.customDomain && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-400">
              <p className="font-semibold mb-1">DNS-Konfiguration erforderlich:</p>
              <p className="font-mono">CNAME {form.customDomain} → portal.wpma.io</p>
            </div>
          )}
          <Field label="Support-E-Mail" hint="Wird im Client-Portal angezeigt">
            <input value={form.supportEmail} onChange={e => set('supportEmail', e.target.value)}
              placeholder="support@meine-agentur.de" className={inputCls} type="email" />
          </Field>
          <Field label="Support-URL">
            <input value={form.supportUrl} onChange={e => set('supportUrl', e.target.value)}
              placeholder="https://meine-agentur.de/support" className={inputCls} />
          </Field>
          <Field label="Footer-Text">
            <input value={form.footerText} onChange={e => set('footerText', e.target.value)}
              placeholder="© 2026 Meine Agentur GmbH" className={inputCls} />
          </Field>
        </Section>

        {/* E-Mail */}
        <Section icon={<Mail className="w-4 h-4" />} title="E-Mail-Versand">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Absender-Name">
              <input value={form.emailFromName} onChange={e => set('emailFromName', e.target.value)}
                placeholder="Meine Agentur" className={inputCls} />
            </Field>
            <Field label="Absender-E-Mail">
              <input value={form.emailFromAddress} onChange={e => set('emailFromAddress', e.target.value)}
                placeholder="noreply@meine-agentur.de" className={inputCls} type="email" />
            </Field>
          </div>
        </Section>

        {/* Preview */}
        {(form.brandName || form.primaryColor !== '#3B82F6') && (
          <Section icon={<Eye className="w-4 h-4" />} title="Vorschau Client-Portal">
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.1]">
              <div className="px-4 py-3 flex items-center gap-3"
                style={{ backgroundColor: form.primaryColor }}>
                {form.logoUrl
                  ? <img src={form.logoUrl} alt="Logo" className="h-6 object-contain" />
                  : <span className="text-white font-bold text-sm">{form.brandName || 'Meine Agentur'}</span>}
              </div>
              <div className="p-4 bg-gray-50 dark:bg-white/[0.02]">
                <div className="h-2 rounded bg-gray-200 dark:bg-white/[0.1] w-2/3 mb-2" />
                <div className="h-2 rounded bg-gray-200 dark:bg-white/[0.1] w-1/2" />
              </div>
              {form.footerText && (
                <div className="px-4 py-2 text-center text-[10px] text-gray-400 border-t border-gray-100 dark:border-white/[0.05]">
                  {form.footerText}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-60 transition-colors"
          >
            {saveMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saveMutation.isPending ? 'Speichern...' : saved ? 'Gespeichert' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-gray-500 dark:text-gray-400">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label}
        {hint && <span className="ml-1 text-gray-400 font-normal">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}
