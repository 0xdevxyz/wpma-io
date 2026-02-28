'use client';

import React from 'react';
import type { Site, BulkAction } from '../../lib/dashboard-config';

interface BulkActionBarProps {
  selectedIds: number[];
  sites: Site[];
  onClearSelection: () => void;
  onBulkAction: (action: BulkAction, ids: number[]) => void;
}

export function BulkActionBar({ selectedIds }: BulkActionBarProps) {
  if (selectedIds.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">
      {selectedIds.length} ausgewählt
    </div>
  );
}
