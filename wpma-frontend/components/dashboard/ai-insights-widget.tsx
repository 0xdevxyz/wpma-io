'use client';

import React from 'react';
import { Brain } from 'lucide-react';

export function AIInsightsWidget() {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-purple-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">KI-Insights</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Keine Insights verfügbar
      </p>
    </div>
  );
}
