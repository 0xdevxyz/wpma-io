'use client';

import React from 'react';
import type { Site, SortConfig } from '../../lib/dashboard-config';

interface SiteTableProps {
  sites: Site[];
  visibleColumns: string[];
  sortConfig: SortConfig;
  onSortChange: (key: string) => void;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onAction: (action: string, siteId: number) => void;
}

export function SiteTable({ sites }: SiteTableProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {sites.length} Sites
      </p>
    </div>
  );
}
