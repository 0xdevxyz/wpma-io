'use client';

import React from 'react';

interface ColumnConfigDropdownProps {
  visibleColumns: string[];
  onChange: (columns: string[]) => void;
}

export function ColumnConfigDropdown({ visibleColumns }: ColumnConfigDropdownProps) {
  return (
    <button className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/[0.08]">
      Spalten
    </button>
  );
}
