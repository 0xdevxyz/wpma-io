'use client';
import React, { useState } from 'react';
import { Settings2, Check } from 'lucide-react';
import { DEFAULT_COLUMNS } from '../../lib/dashboard-config';

const ALL_COLUMNS: { key: string; label: string }[] = [
  { key: 'domain', label: 'Domain' },
  { key: 'healthScore', label: 'Health Score' },
  { key: 'status', label: 'Status' },
  { key: 'wordpressVersion', label: 'WP-Version' },
  { key: 'phpVersion', label: 'PHP-Version' },
  { key: 'pluginsUpdates', label: 'Plugin-Updates' },
  { key: 'themesUpdates', label: 'Theme-Updates' },
  { key: 'lastCheck', label: 'Letzter Check' },
];

interface ColumnConfigDropdownProps {
  visibleColumns: string[];
  onChange: (cols: string[]) => void;
}

export function ColumnConfigDropdown({ visibleColumns, onChange }: ColumnConfigDropdownProps) {
  const [open, setOpen] = useState(false);

  function toggle(key: string) {
    if (visibleColumns.includes(key)) {
      if (visibleColumns.length > 1) onChange(visibleColumns.filter(c => c !== key));
    } else {
      onChange([...visibleColumns, key]);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors
          border-gray-200 bg-white text-gray-600 hover:bg-gray-50
          dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-400 dark:hover:bg-white/[0.08]"
        title="Spalten konfigurieren"
      >
        <Settings2 className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">Spalten</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl shadow-lg border bg-white dark:bg-gray-900 border-gray-200 dark:border-white/[0.08] overflow-hidden">
            {ALL_COLUMNS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => toggle(key)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors text-gray-700 dark:text-gray-300"
              >
                <span>{label}</span>
                {visibleColumns.includes(key) && <Check className="w-3.5 h-3.5 text-blue-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
