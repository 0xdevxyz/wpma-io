'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Check, X, AlertTriangle, Loader2, Zap, Globe, Shield } from 'lucide-react';
import { paymentApi } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { toast } from 'react-hot-toast';

interface SubscriptionStatus {
  status: string;
  plan: string;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
}

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: '9',
    period: '/Monat',
    description: 'Für Einzelpersonen und kleine Projekte',
    features: [
      '1 WordPress-Website',
      '5 Backups / Monat',
      'Security-Scans',
      'Plugin-Updates',
    ],
    missing: ['AI Insights', 'Priority Support'],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '29',
    period: '/Monat',
    description: 'Für Agenturen und Profis',
    features: [
      'Bis zu 25 Websites',
      '100 Backups / Monat',
      'Security-Scans',
      'Plugin-Updates',
      'AI Insights',
      'Prioritäts-Support',
    ],
    missing: [],
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '99',
    period: '/Monat',
    description: 'Für große Teams ohne Limits',
    features: [
      'Unbegrenzte Websites',
      'Unbegrenzte Backups',
      'Security-Scans',
      'Plugin-Updates',
      'AI Insights',
      'Dedizierter Support',
      '365 Tage Aufbewahrung',
    ],
    missing: [],
    highlight: false,
  },
];

export default function BillingPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    fetchStatus();
  }, [isAuthenticated]);

  async function fetchStatus() {
    try {
      const res = await paymentApi.getStatus();
      if (res.data?.success) {
        setStatus(res.data);
      }
    } catch {
      toast.error('Abonnement-Status konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(planId: string) {
    setActionLoading(planId);
    try {
      const res = await paymentApi.subscribe(planId);
      if (res.data?.success && res.data?.clientSecret) {
        // Redirect to Stripe payment confirmation with client secret
        // In a full implementation this would use @stripe/stripe-js loadStripe + confirmPayment
        toast.success('Zahlung wird vorbereitet…');
        // Placeholder: store clientSecret and redirect to /billing/checkout
        sessionStorage.setItem('stripe_client_secret', res.data.clientSecret);
        router.push('/billing/checkout');
      } else {
        toast.error(res.data?.error || 'Fehler beim Erstellen des Abonnements.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Fehler bei der Anfrage.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    if (!confirm('Abonnement wirklich kündigen? Du behältst den Zugang bis zum Periodenende.')) return;
    setActionLoading('cancel');
    try {
      const res = await paymentApi.cancel();
      if (res.data?.success) {
        toast.success('Abonnement wird zum Periodenende gekündigt.');
        await fetchStatus();
      } else {
        toast.error(res.data?.error || 'Kündigung fehlgeschlagen.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Fehler bei der Anfrage.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUpgrade(planId: string) {
    setActionLoading(planId);
    try {
      const res = await paymentApi.update(planId);
      if (res.data?.success) {
        toast.success('Plan erfolgreich gewechselt!');
        await fetchStatus();
      } else {
        toast.error(res.data?.error || 'Plan-Wechsel fehlgeschlagen.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Fehler bei der Anfrage.');
    } finally {
      setActionLoading(null);
    }
  }

  const currentPlan = status?.plan || user?.planType || 'basic';
  const isActive = status?.status === 'active' || status?.status === 'trialing';
  const isCanceling = status?.cancelAtPeriodEnd === true;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-3 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            <CreditCard className="w-4 h-4" />
            Abonnement & Abrechnung
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Dein Plan</h1>
          <p className="mt-2 text-gray-500">Verwalte dein Abonnement und wechsle jederzeit den Plan.</p>
        </div>

        {/* Current Status Banner */}
        {status && status.status !== 'no_subscription' && (
          <div className={`mb-8 p-4 rounded-xl border flex items-center gap-3 ${
            isActive && !isCanceling
              ? 'bg-green-50 border-green-200 text-green-800'
              : isCanceling
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {isActive && !isCanceling ? (
              <Check className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
            <div>
              {isCanceling ? (
                <span>
                  Dein Abonnement wird zum{' '}
                  <strong>
                    {status.currentPeriodEnd
                      ? new Date(status.currentPeriodEnd * 1000).toLocaleDateString('de-DE')
                      : 'Periodenende'}
                  </strong>{' '}
                  gekündigt. Bis dahin hast du vollen Zugriff.
                </span>
              ) : isActive ? (
                <span>
                  Aktiver <strong>{currentPlan}</strong>-Plan
                  {status.currentPeriodEnd && (
                    <> · nächste Abrechnung {new Date(status.currentPeriodEnd * 1000).toLocaleDateString('de-DE')}</>
                  )}
                </span>
              ) : (
                <span>Deine Zahlung ist überfällig. Bitte aktualisiere deine Zahlungsmethode.</span>
              )}
            </div>
            {isActive && !isCanceling && (
              <button
                onClick={handleCancel}
                disabled={actionLoading === 'cancel'}
                className="ml-auto text-sm underline hover:no-underline flex items-center gap-1 disabled:opacity-50"
              >
                {actionLoading === 'cancel' ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                Kündigen
              </button>
            )}
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isHigher = ['basic', 'pro', 'enterprise'].indexOf(plan.id) >
              ['basic', 'pro', 'enterprise'].indexOf(currentPlan);

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 flex flex-col ${
                  plan.highlight
                    ? 'bg-gray-900 text-white shadow-xl ring-2 ring-gray-900'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Beliebt
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 right-4 bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Aktuell
                  </div>
                )}

                <div className="mb-4">
                  <h2 className="text-lg font-bold">{plan.name}</h2>
                  <p className={`text-sm mt-1 ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-extrabold">€{plan.price}</span>
                  <span className={`text-sm ml-1 ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                    {plan.period}
                  </span>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className={`w-4 h-4 shrink-0 ${plan.highlight ? 'text-green-400' : 'text-green-500'}`} />
                      {f}
                    </li>
                  ))}
                  {plan.missing.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-sm ${plan.highlight ? 'text-gray-600' : 'text-gray-400'}`}>
                      <X className="w-4 h-4 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className={`w-full py-2.5 rounded-xl text-sm font-medium ${
                      plan.highlight
                        ? 'bg-gray-700 text-gray-400 cursor-default'
                        : 'bg-gray-100 text-gray-400 cursor-default'
                    }`}
                  >
                    Aktueller Plan
                  </button>
                ) : status?.status === 'no_subscription' ? (
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={!!actionLoading}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 ${
                      plan.highlight
                        ? 'bg-blue-500 hover:bg-blue-400 text-white'
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                    }`}
                  >
                    {actionLoading === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Abonnieren'
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={!!actionLoading || isCanceling}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 ${
                      plan.highlight
                        ? 'bg-blue-500 hover:bg-blue-400 text-white'
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                    }`}
                  >
                    {actionLoading === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isHigher ? (
                      'Upgraden'
                    ) : (
                      'Downgraden'
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-8">
          Alle Preise zzgl. MwSt. · Kündigung jederzeit möglich · Zahlung via Stripe
        </p>
      </div>
    </div>
  );
}
