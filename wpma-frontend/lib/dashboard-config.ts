export interface Site {
  id: number;
  domain: string;
  siteUrl: string;
  siteName: string;
  healthScore: number;
  status: string;
  lastCheck: string;
  wordpressVersion: string;
  phpVersion: string;
  createdAt: string;
  pluginsUpdates?: number;
  themesUpdates?: number;
  coreUpdateAvailable?: boolean;
  isConnected?: boolean;
  setupToken?: string;
  uptimeStatus?: string;
  uptimePercent?: number | null;
  avgResponseMs?: number | null;
  lastUptimeCheck?: string | null;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc' | null;
}

export type BulkAction = 'core-update' | 'plugin-update' | 'theme-update' | 'backup' | 'healthcheck' | 'delete';

export type ViewMode = 'table' | 'card';

export const DEFAULT_COLUMNS = ['domain', 'healthScore', 'status', 'wordpressVersion', 'pluginsUpdates', 'lastCheck'];

export const LOCAL_STORAGE_KEYS = {
  viewMode: 'wpma_view_mode',
  sortConfig: 'wpma_sort_config',
  visibleColumns: 'wpma_visible_columns',
  insightsOpen: 'wpma_insights_open',
};
