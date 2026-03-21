'use client';
import React from 'react';
import { X, Trash2, RefreshCw, HardDrive, Activity } from 'lucide-react';
import type { Site, BulkAction } from '../../lib/dashboard-config';

interface BulkActionBarProps {
  selectedIds: number[];
  sites: Site[];
  onClearSelection: () => void;
  onBulkAction: (action: BulkAction, ids: number[]) => void;
}

export function BulkActionBar({ selectedIds, onClearSelection, onBulkAction }: BulkActionBarProps) {
  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl bg-gray-900 border border-gray-700 whitespace-nowrap">
      <span className="text-sm text-gray-300 font-medium pr-2 border-r border-gray-700">
        {selectedIds.length} ausgewählt
      </span>
      <button onClick={() => onBulkAction('healthcheck', selectedIds)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
        <Activity className="w-3.5 h-3.5" /> Health Check
      </button>
      <button onClick={() => onBulkAction('backup', selectedIds)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
        <HardDrive className="w-3.5 h-3.5" /> Backup
      </button>
      <button onClick={() => onBulkAction('plugin-update', selectedIds)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
        <RefreshCw className="w-3.5 h-3.5" /> Updates
      </button>
      <div className="w-px h-4 bg-gray-700" />
      <button onClick={() => onBulkAction('delete', selectedIds)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors">
        <Trash2 className="w-3.5 h-3.5" /> Löschen
      </button>
      <button onClick={onClearSelection} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

