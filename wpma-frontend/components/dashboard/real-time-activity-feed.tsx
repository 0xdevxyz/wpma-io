'use client';
import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, HardDrive, Shield, Zap, Bot, CheckCircle, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { agentApi } from '../../lib/api';

interface ActivityItem {
  id: string;
  icon: React.FC<{ className?: string }>;
  iconColor: string;
  text: string;
  time: string;
}

function timeAgo(date: string | Date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.round(diff / 60)}min`;
  if (diff < 86400) return `vor ${Math.round(diff / 3600)}h`;
  return `vor ${Math.round(diff / 86400)}d`;
}

const ICON_MAP: Record<string, { icon: React.FC<{ className?: string }>; color: string }> = {
  backup:      { icon: HardDrive, color: 'text-green-500' },
  security:    { icon: Shield, color: 'text-red-500' },
  performance: { icon: Zap, color: 'text-yellow-500' },
  agent:       { icon: Bot, color: 'text-violet-500' },
  sync:        { icon: RefreshCw, color: 'text-blue-500' },
  done:        { icon: CheckCircle, color: 'text-emerald-500' },
  warning:     { icon: AlertTriangle, color: 'text-orange-500' },
};

export function RealTimeActivityFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-tasks', 'recent'],
    queryFn: () => agentApi.getTasks({ limit: 8 } as any),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const tasks: any[] = (data as any)?.data || [];

  const items: ActivityItem[] = tasks.map((t: any) => {
    const type = t.type || (t.title?.toLowerCase().includes('backup') ? 'backup'
      : t.title?.toLowerCase().includes('security') ? 'security'
      : t.title?.toLowerCase().includes('performance') ? 'performance'
      : 'agent');
    const { icon, color } = ICON_MAP[type] || ICON_MAP.agent;
    return {
      id: String(t.id),
      icon,
      iconColor: color,
      text: `${t.domain || t.site_name || 'Site'}: ${t.title}`,
      time: t.createdAt ? timeAgo(t.createdAt) : '—',
    };
  });

  return (
    <div className="rounded-lg border border-gray-100 dark:border-white/[0.06] p-4 h-full">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-200">Aktivitäten</span>
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-600">Keine aktuellen Aktivitäten.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className={`w-3 h-3 ${item.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{item.text}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{item.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
