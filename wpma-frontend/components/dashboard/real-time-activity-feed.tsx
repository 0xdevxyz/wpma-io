'use client';
import React from 'react';
import { Activity } from 'lucide-react';

export function RealTimeActivityFeed() {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-white/[0.06] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-200">Aktivitäten</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-500">Keine aktuellen Aktivitäten.</p>
    </div>
  );
}
