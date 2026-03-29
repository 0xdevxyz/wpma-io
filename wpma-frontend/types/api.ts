// API response shape types inferred from wpma-frontend/lib/api.ts

// ---------------------------------------------------------------------------
// Generic wrapper
// ---------------------------------------------------------------------------
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Auth / User
// ---------------------------------------------------------------------------
export interface UserProfile {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthTokenResponse {
  user: UserProfile;
  token: string;
}

// ---------------------------------------------------------------------------
// Site
// ---------------------------------------------------------------------------
export interface Site {
  id: number;
  name?: string;
  url?: string;
  // Alternative field names used in some pages
  siteName?: string;
  domain?: string;
  siteUrl?: string;
  status?: string;
  wpVersion?: string;
  wordpressVersion?: string;
  phpVersion?: string;
  adminEmail?: string;
  adminUrl?: string;
  healthScore?: number;
  lastChecked?: string;
  lastCheck?: string;
  createdAt?: string;
  updatedAt?: string;
  setupToken?: string;
  pluginInstalled?: boolean;
  health?: SiteHealth;
}

export interface SiteHealth {
  score?: number;
  status?: string;
  issues?: string[];
}

export interface SiteMetadata {
  name?: string;
  url?: string;
  wpVersion?: string;
  phpVersion?: string;
  adminEmail?: string;
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------
export type BackupType = 'full' | 'database' | 'files';
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Backup {
  id: number;
  siteId?: number;
  type?: BackupType;
  // Alternative field name used in some pages
  backupType?: string;
  status: BackupStatus | string;
  size?: number;
  fileSize?: number;
  filename?: string;
  s3Url?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface BackupSchedule {
  // API response fields (snake_case)
  schedule_type?: string;
  backup_type?: BackupType;
  hour?: number;
  day_of_week?: number;
  day_of_month?: number;
  next_run_at?: string;
  enabled?: boolean;
  // Request payload fields (camelCase)
  scheduleType?: string;
  backupType?: BackupType;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

export interface BackupQuota {
  used?: number;
  total?: number;
  unit?: string;
  // Extended fields used in site detail page
  usedBytes?: number;
  quotaBytes?: number;
  tierLabel?: string;
  maxBackupsPerSite?: number;
  nextTier?: { label: string; [key: string]: unknown };
}

export interface BackupDownloadUrl {
  url: string;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------
export interface Plugin {
  slug: string;
  name: string;
  version?: string;
  latestVersion?: string;
  active: boolean;
  updateAvailable?: boolean;
  author?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
export interface Theme {
  slug: string;
  name: string;
  version?: string;
  latestVersion?: string;
  active: boolean;
  updateAvailable?: boolean;
  author?: string;
  screenshot?: string;
}

// ---------------------------------------------------------------------------
// Notification settings
// ---------------------------------------------------------------------------
export interface NotificationChannel {
  enabled: boolean;
  value?: string;
}

export interface NotificationSettings {
  email?: NotificationChannel;
  slack?: NotificationChannel;
  discord?: NotificationChannel;
  webhook?: NotificationChannel;
  [key: string]: NotificationChannel | undefined;
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
export interface TeamMember {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  joinedAt?: string;
}

export interface TeamInvite {
  id: number;
  email: string;
  role: string;
  expiresAt?: string;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------
export type StagingStatus = 'pending' | 'creating' | 'ready' | 'syncing' | 'error';

export interface StagingEnvironment {
  id: number;
  siteId: number;
  url?: string;
  status: StagingStatus;
  createdAt?: string;
}

export interface StagingSyncJob {
  id: number;
  status: string;
  progress?: number;
  createdAt?: string;
  completedAt?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Bulk jobs
// ---------------------------------------------------------------------------
export type BulkJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BulkJob {
  id: string;
  type: string;
  status: BulkJobStatus;
  total?: number;
  completed?: number;
  failed?: number;
  createdAt?: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// SSL
// ---------------------------------------------------------------------------
export type SSLStatus = 'valid' | 'expiring_soon' | 'expired' | 'invalid' | 'unknown';

export interface SSLInfo {
  siteId: number;
  status: SSLStatus;
  issuer?: string;
  expiresAt?: string;
  daysRemaining?: number;
}

// ---------------------------------------------------------------------------
// Content Hub
// ---------------------------------------------------------------------------
export interface ContentProject {
  id: number;
  name: string;
  type: string;
  url?: string;
  siteId?: number;
  active?: boolean;
  config?: Record<string, unknown>;
  ipWhitelist?: string[];
  createdAt?: string;
}

export interface ContentPost {
  id: number;
  projectId: number;
  title: string;
  content: string;
  excerpt?: string;
  keywords?: string[];
  language?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContentStats {
  totalProjects?: number;
  totalPosts?: number;
  publishedPosts?: number;
  draftPosts?: number;
}

// ---------------------------------------------------------------------------
// Uptime / Monitoring
// ---------------------------------------------------------------------------
export type UptimeStatus = 'up' | 'down' | 'degraded';

export interface UptimeStats {
  siteId: string;
  uptimePercent?: number;
  avgResponseMs?: number;
  status?: UptimeStatus;
  lastChecked?: string;
}

export interface UptimeIncident {
  id: number;
  siteId: string;
  startedAt: string;
  resolvedAt?: string;
  durationMs?: number;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Payment / Subscription
// ---------------------------------------------------------------------------
export type PlanType = 'free' | 'starter' | 'pro' | 'agency';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'inactive';

export interface PaymentStatus {
  plan: PlanType;
  status: SubscriptionStatus;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

// ---------------------------------------------------------------------------
// Client portal
// ---------------------------------------------------------------------------
export interface Client {
  id: number;
  name: string;
  email: string;
  notes?: string;
  createdAt?: string;
}
