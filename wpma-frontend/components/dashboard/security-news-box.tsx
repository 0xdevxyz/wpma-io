'use client';
import React from 'react';
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { sitesApi } from '../../lib/api';

export function SecurityNewsBox() {
  const { data, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const r = await sitesApi.getSites();
      return r.success ? r.data || [] : [];
    },
    staleTime: 60000,
  });

  const sites: any[] = data || [];
  const criticalCount = sites.filter((s: any) => s.healthScore < 70).length;
  const highCount = sites.filter((s: any) => s.healthScore >= 70 && s.healthScore < 85).length;
  const scannedCount = sites.length;
  const cleanCount = sites.filter((s: any) => s.healthScore >= 85).length;
  const hasThreat = criticalCount > 0 || highCount > 0;

  const items = [
    ...(criticalCount > 0 ? [{
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-500/10',
      icon: AlertTriangle,
      text: `${criticalCount} kritische Schwachstelle${criticalCount !== 1 ? 'n' : ''}`,
    }] : []),
    ...(highCount > 0 ? [{
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-500/10',
      icon: AlertTriangle,
      text: `${highCount} hohe Schwachstelle${highCount !== 1 ? 'n' : ''}`,
    }] : []),
    ...(cleanCount > 0 ? [{
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      icon: CheckCircle,
      text: `${cleanCount} saubere Site${cleanCount !== 1 ? 's' : ''}`,
    }] : []),
  ];

  return (
    <div className="rounded-lg border border-gray-100 dark:border-white/[0.06] p-4 h-full">
      <div className="flex items-center gap-2 mb-3">
        <Shield className={`w-4 h-4 ${hasThreat ? 'text-red-500' : 'text-green-500'}`} />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-200">Security Status</span>
        {hasThreat && (
          <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400">
            {criticalCount + highCount} Probleme
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] animate-pulse" />)}
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${item.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${item.color} flex-shrink-0`} />
                <span className={`text-xs font-medium ${item.color}`}>{item.text}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-4 h-4" />
          Alle Sites sauber
        </div>
      )}

      {scannedCount > 0 && (
        <p className="text-[10px] text-gray-400 mt-2">{scannedCount} Sites zuletzt gescannt</p>
      )}
    </div>
  );
}
