'use client';
import React from 'react';
import { X } from 'lucide-react';
import type { Site, BulkAction } from '../../lib/dashboard-config';

interface BulkActionBarProps {
  selectedIds: number[];
  sites: Site[];
  onClearSelection: () => void;
  onBulkAction: (action: BulkAction, ids: number[]) => void;
}

const ACTIONS: { label: string; action: BulkAction }[] = [
  { label: 'Core-Update', action: 'core-update' },
  { label: 'Plugin-Updates', action: 'plugin-update' },
  { label: 'Theme-Updates', action: 'theme-update' },
  { label: 'Backup', action: 'backup' },
  { label: 'Health Check', action: 'healthcheck' },
];

export function BulkActionBar({ selectedIds, onClearSelection, onBulkAction }: BulkActionBarProps) {
  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg bg-gray-900 dark:bg-white/[0.08] border border-gray-700 dark:border-white/10">
      <span className="text-sm text-gray-300 font-medium shrink-0">
        {selectedIds.length} ausgewählt
      </span>
      <div className="flex items-center gap-2">
        {ACTIONS.map(({ label, action }) => (
          <button
            key={action}
            onClick={() => onBulkAction(action, selectedIds)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
      <button
        onClick={onClearSelection}
        className="ml-1 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        title="Auswahl aufheben"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
