'use client';
import React from 'react';
import { Brain } from 'lucide-react';

export function AIInsightsWidget() {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-white/[0.06] p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-500/5 dark:to-indigo-500/5">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-200">KI-Insights</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-500">KI-Analyse wird vorbereitet...</p>
    </div>
  );
}
