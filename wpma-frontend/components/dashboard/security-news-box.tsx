'use client';
import React from 'react';
import { Shield } from 'lucide-react';

export function SecurityNewsBox() {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-white/[0.06] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-green-500" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-200">Security News</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-500">Keine aktuellen Security-Meldungen.</p>
    </div>
  );
}
