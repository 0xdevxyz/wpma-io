// Dashboard configuration types and constants

export interface Site {
  id: number;
  domain: string;
  siteName: string;
  healthScore: number;
  pluginsUpdates?: number;
  themesUpdates?: number;
  coreUpdateAvailable?: boolean;
  lastSync?: string;
  status?: string;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc' | null;
}

export type BulkAction = 'core-update' | 'plugin-update' | 'theme-update' | 'backup' | 'healthcheck';

export type ViewMode = 'table' | 'card';

export const DEFAULT_COLUMNS = [
  'domain',
  'siteName',
  'healthScore',
  'status',
  'lastSync',
  'updates',
];

export const LOCAL_STORAGE_KEYS = {
  viewMode: 'wpma_viewMode',
  sortConfig: 'wpma_sortConfig',
  visibleColumns: 'wpma_visibleColumns',
  insightsOpen: 'wpma_insightsOpen',
};
