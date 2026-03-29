import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type {
  BackupDownloadUrl,
  BackupSchedule,
} from '../types/api';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    // KORRIGIERT: API_BASE_URL richtig definiert
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wpma.io';
    
    this.instance = axios.create({
      baseURL: API_BASE_URL, // KORRIGIERT: baseURL verwenden
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config) => {
        // Check if we're in the browser before accessing localStorage
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (typeof window !== 'undefined') {
          if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/auth/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string, config?: object): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.get(url, config);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  async post<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.post(url, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  async put<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.put(url, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  async delete<T = any>(url: string, config?: object): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.delete(url, config);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }
}

export const api = new ApiClient();

// Specific API functions
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/v1/auth/login', { email, password }),
  
  register: (userData: Record<string, unknown>) =>
    api.post('/api/v1/auth/register', userData),
  
  me: () =>
    api.get('/api/v1/auth/me'),
  
  refreshToken: () =>
    api.post('/api/v1/auth/refresh'),

  updateProfile: (data: { firstName?: string; lastName?: string }) =>
    api.put('/api/v1/auth/profile', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/api/v1/auth/change-password', data),
};

export const sitesApi = {
  getSites: () =>
    api.get('/api/v1/sites'),
  
  getSite: (siteId: string) =>
    api.get(`/api/v1/sites/${siteId}`),
  
  createSite: (siteData: Record<string, unknown>) =>
    api.post('/api/v1/sites', siteData),
  
  updateSite: (siteId: string, siteData: Record<string, unknown>) =>
    api.put(`/api/v1/sites/${siteId}`, siteData),
  
  deleteSite: (siteId: string) =>
    api.delete(`/api/v1/sites/${siteId}`),
  
  runHealthCheck: (siteId: string) =>
    api.post(`/api/v1/sites/${siteId}/health-check`),
  
  exchangeSetupToken: (token: string) =>
    api.post('/api/v1/sites/setup-token/exchange', { token }),
  
  regenerateSetupToken: (siteId: string) =>
    api.post(`/api/v1/sites/${siteId}/setup-token/regenerate`),
  
  getPluginDownloadUrl: (token: string) => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wpma.io';
    return `${API_BASE_URL}/api/v1/sites/plugin/download/${token}`;
  },
  
  fetchSiteMetadata: (url: string) =>
    api.post('/api/v1/sites/fetch-metadata', { url }),
};

export const securityApi = {
  getSecurityStatus: (siteId: string) =>
    api.get(`/api/v1/security/${siteId}/status`),

  runSecurityScan: (siteId: string) =>
    api.post(`/api/v1/security/${siteId}/scan`),

  getVulnerabilities: (siteId: string) =>
    api.get(`/api/v1/security/${siteId}/vulnerabilities`),

  getHistory: (siteId: string) =>
    api.get(`/api/v1/security/${siteId}/history`),

  getStatistics: (siteId: string) =>
    api.get(`/api/v1/security/${siteId}/statistics`),
};

export const backupApi = {
  getBackups: (siteId: string) =>
    api.get(`/api/v1/backup/${siteId}`),

  createBackup: (siteId: string, backupType: string = 'full') =>
    api.post(`/api/v1/backup/${siteId}`, { backupType }),

  restoreBackup: (backupId: string, targetSiteId: string) =>
    api.post(`/api/v1/backup/${backupId}/restore`, { targetSiteId }),

  deleteBackup: (backupId: string) =>
    api.delete(`/api/v1/backup/${backupId}`),

  downloadBackup: (backupId: string) =>
    api.get<BackupDownloadUrl>(`/api/v1/backup/${backupId}/download`),

  // Schedule
  getSchedule: (siteId: string) =>
    api.get<BackupSchedule>(`/api/v1/backup/${siteId}/schedule`),

  setSchedule: (siteId: string, payload: {
    scheduleType: string;
    backupType?: string;
    hour?: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
  }) => api.post<BackupSchedule>(`/api/v1/backup/${siteId}/schedule`, payload),

  // Quota
  getQuota: () =>
    api.get(`/api/v1/backup/quota`),

  upgradeQuota: () =>
    api.post(`/api/v1/backup/quota/upgrade`, {}),
};

export const performanceApi = {
  getMetrics: (siteId: string) =>
    api.get(`/api/v1/performance/${siteId}/metrics`),

  getHistory: (siteId: string) =>
    api.get(`/api/v1/performance/${siteId}/history`),

  analyze: (siteId: string) =>
    api.post(`/api/v1/performance/${siteId}/analyze`),

  getRecommendations: (siteId: string) =>
    api.get(`/api/v1/performance/${siteId}/recommendations`),

  getStatistics: (siteId: string) =>
    api.get(`/api/v1/performance/${siteId}/statistics`),
};

export const aiApi = {
  getInsights: (siteId: string) =>
    api.get(`/api/v1/ai/${siteId}/insights`),
  
  generateRecommendations: (siteId: string) =>
    api.post(`/api/v1/ai/${siteId}/recommendations`),
  
  getSiteRecommendations: (siteId: string) =>
    api.get(`/api/v1/ai/recommendations/site/${siteId}`),
  
  getDashboardInsights: () =>
    api.get('/api/v1/ai/recommendations/dashboard'),
  
  predictPluginConflicts: (siteId: string) =>
    api.get(`/api/v1/ai/predictive/conflicts/${siteId}`),
  
  predictUpdateRisk: (siteId: string, pluginSlug: string) =>
    api.get(`/api/v1/ai/predictive/update-risk/${siteId}/${pluginSlug}`),
  
  getUpdatePatterns: () =>
    api.get('/api/v1/ai/predictive/update-patterns'),

  getHealthSummary: (siteId: string) =>
    api.get(`/api/v1/chat/${siteId}/health-summary`),

  autoFix: (siteId: string, problem: string) =>
    api.post(`/api/v1/chat/${siteId}/auto-fix`, { problem }),
};

export const agentApi = {
  getTasks: (params?: Record<string, string>) =>
    api.get('/api/v1/agent/tasks', { params }),
  getStats: () =>
    api.get('/api/v1/agent/stats'),
  approve: (id: number) =>
    api.post(`/api/v1/agent/tasks/${id}/approve`),
  reject: (id: number, reason: string) =>
    api.post(`/api/v1/agent/tasks/${id}/reject`, { reason }),
  getSettings: () =>
    api.get('/api/v1/agent/settings'),
  saveSettings: (s: any) =>
    api.put('/api/v1/agent/settings', s),
  scanSite: (siteId: string) =>
    api.post(`/api/v1/agent/scan/${siteId}`),
  scanAll: () =>
    api.post('/api/v1/agent/scan-all'),
};

export const selfHealingApi = {
  analyzeProblem: (siteId: string, problemData: { error: string; context?: any; logs?: any }) =>
    api.post('/api/v1/selfhealing/analyze', { siteId, ...problemData }),
  
  applyFix: (siteId: string, fixId: string, options?: { autoApply?: boolean; createSnapshot?: boolean }) =>
    api.post('/api/v1/selfhealing/apply', { siteId, fixId, ...options }),
  
  autoHeal: (siteId: string, problemData: { error: string; context?: any; logs?: any }) =>
    api.post('/api/v1/selfhealing/auto', { siteId, ...problemData }),
  
  getHistory: (siteId: string) =>
    api.get(`/api/v1/selfhealing/history/${siteId}`),
};

export const pluginsApi = {
  getPlugins: (siteId: string) =>
    api.get(`/api/v1/plugins/${siteId}`),
  
  installPlugin: (siteId: string, slug: string, activate: boolean = false) =>
    api.post(`/api/v1/plugins/${siteId}/install`, { slug, activate }),
  
  updatePlugin: (siteId: string, pluginSlug: string) =>
    api.put(`/api/v1/plugins/${siteId}/${pluginSlug}`),
  
  togglePlugin: (siteId: string, pluginSlug: string, active: boolean) =>
    api.post(`/api/v1/plugins/${siteId}/${pluginSlug}/toggle`, { active }),
  
  deletePlugin: (siteId: string, pluginSlug: string) =>
    api.delete(`/api/v1/plugins/${siteId}/${pluginSlug}`),
};

export const themesApi = {
  getThemes: (siteId: string) =>
    api.get(`/api/v1/themes/${siteId}`),
  
  installTheme: (siteId: string, slug: string, activate: boolean = false) =>
    api.post(`/api/v1/themes/${siteId}/install`, { slug, activate }),
  
  activateTheme: (siteId: string, themeSlug: string) =>
    api.post(`/api/v1/themes/${siteId}/${themeSlug}/activate`),
  
  updateTheme: (siteId: string, themeSlug: string) =>
    api.put(`/api/v1/themes/${siteId}/${themeSlug}`),
  
  deleteTheme: (siteId: string, themeSlug: string) =>
    api.delete(`/api/v1/themes/${siteId}/${themeSlug}`),
};

export const wpUsersApi = {
  getUsers: (siteId: string) =>
    api.get(`/api/v1/wp-users/${siteId}`),
  
  createUser: (siteId: string, userData: { username: string; email: string; password: string; role?: string; displayName?: string }) =>
    api.post(`/api/v1/wp-users/${siteId}`, userData),
  
  updateUser: (siteId: string, userId: string, userData: { email?: string; displayName?: string; role?: string; password?: string }) =>
    api.put(`/api/v1/wp-users/${siteId}/${userId}`, userData),
  
  deleteUser: (siteId: string, userId: string, reassignTo?: number) =>
    api.delete(`/api/v1/wp-users/${siteId}/${userId}`, { data: { reassignTo } }),
};

export const reportsApi = {
  generateReport: (siteId: string, options?: { format?: string; period?: string }) =>
    api.post('/api/v1/reports/maintenance/generate', { siteId, ...options }),

  getReports: (siteId: string) =>
    api.get(`/api/v1/reports/maintenance/${siteId}`),

  downloadReport: (filename: string) => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wpma.io';
    return `${API_BASE_URL}/api/v1/reports/download/${filename}`;
  },

  scheduleReport: (siteId: string, options: { frequency: string; format: string; recipients?: string[] }) =>
    api.post('/api/v1/reports/schedule', { siteId, ...options }),

  getScheduledReports: () =>
    api.get('/api/v1/reports/scheduled'),

  deleteScheduledReport: (scheduleId: string) =>
    api.delete(`/api/v1/reports/scheduled/${scheduleId}`),
};

export const bulkApi = {
  runUpdates: (siteIds: number[], options: {
    updatePlugins?: boolean;
    updateThemes?: boolean;
    updateCore?: boolean;
    createBackup?: boolean;
    forceUpdate?: boolean;
  }) =>
    api.post('/api/v1/bulk/updates', { siteIds, ...options }),

  getUpdatesSummary: () =>
    api.get('/api/v1/bulk/updates/summary'),

  runBackups: (siteIds: number[], backupType = 'full') =>
    api.post('/api/v1/bulk/backups', { siteIds, backupType }),

  securityScan: (siteIds: number[]) =>
    api.post('/api/v1/bulk/security/scan', { siteIds }),

  installPlugin: (siteIds: number[], pluginSlug: string) =>
    api.post('/api/v1/bulk/plugins/install', { siteIds, pluginSlug }),

  deactivatePlugin: (siteIds: number[], pluginSlug: string) =>
    api.post('/api/v1/bulk/plugins/deactivate', { siteIds, pluginSlug }),

  getJobs: (limit = 20) =>
    api.get(`/api/v1/bulk/jobs?limit=${limit}`),

  getJobStatus: (jobId: string) =>
    api.get(`/api/v1/bulk/jobs/${jobId}`),

  cancelJob: (jobId: string) =>
    api.delete(`/api/v1/bulk/jobs/${jobId}`),
};

export const syncApi = {
  syncSite: (siteId: string) =>
    api.post(`/api/v1/sync/sites/${siteId}/sync`),

  syncAllSites: () =>
    api.post('/api/v1/sync/sync-all'),

  getSyncedData: (siteId: string) =>
    api.get(`/api/v1/sync/sites/${siteId}/synced-data`),

  verifyPlugin: (siteId: string) =>
    api.post(`/api/v1/sites/${siteId}/verify-plugin`),
};

export const paymentApi = {
  getStatus: () =>
    api.get('/api/v1/payment/status'),

  subscribe: (planType: string) =>
    api.post('/api/v1/payment/subscribe', { planType }),

  cancel: () =>
    api.post('/api/v1/payment/cancel'),

  update: (planType: string) =>
    api.put('/api/v1/payment/update', { planType }),
};

export const contentApi = {
  // Projects
  listProjects: () =>
    api.get('/api/v1/content/projects'),

  createProject: (data: {
    name: string;
    type: string;
    url?: string;
    site_id?: number;
    config?: Record<string, any>;
    ip_whitelist?: string[];
  }) =>
    api.post('/api/v1/content/projects', data),

  getProject: (id: number) =>
    api.get(`/api/v1/content/projects/${id}`),

  updateProject: (id: number, data: Partial<{ name: string; url: string; config: any; ip_whitelist: string[]; active: boolean }>) =>
    api.put(`/api/v1/content/projects/${id}`, data),

  deleteProject: (id: number) =>
    api.delete(`/api/v1/content/projects/${id}`),

  rotateToken: (id: number) =>
    api.post(`/api/v1/content/projects/${id}/rotate-token`),

  // Content generation
  generateContent: (data: {
    topic: string;
    keywords?: string[];
    language?: string;
    tone?: string;
    length?: string;
    additional_instructions?: string;
    project_id?: number;
    save?: boolean;
  }) =>
    api.post('/api/v1/content/generate', data),

  // Posts
  listPosts: (params?: { project_id?: number; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.project_id) qs.set('project_id', String(params.project_id));
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return api.get(`/api/v1/content/posts${qs.toString() ? '?' + qs : ''}`);
  },

  createPost: (data: { project_id: number; title: string; content: string; excerpt?: string; keywords?: string[]; language?: string }) =>
    api.post('/api/v1/content/posts', data),

  getPost: (id: number) =>
    api.get(`/api/v1/content/posts/${id}`),

  updatePost: (id: number, data: Partial<{ title: string; content: string; excerpt: string; keywords: string[]; status: string }>) =>
    api.put(`/api/v1/content/posts/${id}`, data),

  deletePost: (id: number) =>
    api.delete(`/api/v1/content/posts/${id}`),

  // Media
  searchMedia: (q: string, params?: { page?: number; per_page?: number; orientation?: string }) => {
    const qs = new URLSearchParams({ q });
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    if (params?.orientation) qs.set('orientation', params.orientation);
    return api.get(`/api/v1/content/media/search?${qs}`);
  },

  getCuratedMedia: (params?: { page?: number; per_page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    return api.get(`/api/v1/content/media/curated${qs.toString() ? '?' + qs : ''}`);
  },

  attachMedia: (postId: number, media: any[]) =>
    api.post(`/api/v1/content/posts/${postId}/media`, { media }),

  removeMedia: (mediaId: number) =>
    api.delete(`/api/v1/content/media/${mediaId}`),

  // Publish
  publishPost: (postId: number, projectId: number) =>
    api.post(`/api/v1/content/publish/${postId}`, { project_id: projectId }),

  listJobs: (params?: { post_id?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.post_id) qs.set('post_id', String(params.post_id));
    if (params?.limit) qs.set('limit', String(params.limit));
    return api.get(`/api/v1/content/track${qs.toString() ? '?' + qs : ''}`);
  },

  // Stats
  getStats: () =>
    api.get('/api/v1/content/stats'),
};

export const onboardingApi = {
  getStatus: (siteId: string) =>
    api.get(`/api/v1/onboarding/${siteId}`),

  retry: (siteId: string) =>
    api.post(`/api/v1/onboarding/${siteId}/retry`),

  submitLicense: (siteId: string, pluginSlug: string, licenseKey: string) =>
    api.post(`/api/v1/onboarding/${siteId}/license`, { pluginSlug, licenseKey }),

  skipLicense: (siteId: string, pluginSlug: string) =>
    api.post(`/api/v1/onboarding/${siteId}/license/skip`, { pluginSlug }),
};

export const lighthouseApi = {
  run: (siteId: string) =>
    api.post(`/api/v1/performance/${siteId}/lighthouse`),
  get: (siteId: string) =>
    api.get(`/api/v1/performance/${siteId}/lighthouse`),
};

export const revenueApi = {
  getSummary: (siteId: string, days = 30) =>
    api.get(`/api/v1/revenue/${siteId}/summary?days=${days}`),
  getCorrelations: (siteId: string) =>
    api.get(`/api/v1/revenue/${siteId}/correlations`),
  getImpact: (siteId: string) =>
    api.get(`/api/v1/revenue/${siteId}/impact`),
  analyze: (siteId: string) =>
    api.post(`/api/v1/revenue/${siteId}/analyze`),
  resolveCorrelation: (siteId: string, corrId: number, action: string) =>
    api.post(`/api/v1/revenue/${siteId}/correlations/${corrId}/resolve`, { action }),
};

export const whiteLabelApi = {
  getConfig: () => api.get('/api/v1/white-label/config'),
  saveConfig: (data: any) => api.post('/api/v1/white-label/config', data),
};

export const clientsApi = {
  list: () => api.get('/api/v1/clients'),
  create: (data: { name: string; email: string; password: string; notes?: string }) =>
    api.post('/api/v1/clients', data),
  update: (id: number, data: any) => api.put(`/api/v1/clients/${id}`, data),
  remove: (id: number) => api.delete(`/api/v1/clients/${id}`),
  getSites: (id: number) => api.get(`/api/v1/clients/${id}/sites`),
  setSites: (id: number, siteIds: number[]) => api.post(`/api/v1/clients/${id}/sites`, { siteIds }),
};

export const clientPortalApi = {
  login: (email: string, password: string) =>
    api.post('/api/v1/client-portal/login', { email, password }),
  me: () => api.get('/api/v1/client-portal/me'),
  getSites: () => api.get('/api/v1/client-portal/sites'),
};

export const linksApi = {
  scan: (siteId: string) => api.post(`/api/v1/links/${siteId}/scan`),
  getLatest: (siteId: string) => api.get(`/api/v1/links/${siteId}/latest`),
  getHistory: (siteId: string) => api.get(`/api/v1/links/${siteId}/history`),
};

export const stagingApi = {
  // Staging environments
  list: (siteId?: string) =>
    api.get(`/api/v1/staging${siteId ? `?siteId=${siteId}` : ''}`),
  create: (siteId: string, options?: { fromBackupId?: number }) =>
    api.post(`/api/v1/staging/${siteId}/create`, options || {}),
  remove: (stagingId: number) =>
    api.delete(`/api/v1/staging/${stagingId}`),
  // Push/Pull
  push: (stagingId: number, options?: { includeDatabase?: boolean; includeFiles?: boolean; includeUploads?: boolean; createBackupFirst?: boolean }) =>
    api.post(`/api/v1/staging/${stagingId}/push`, options || {}),
  pull: (stagingId: number, options?: { includeDatabase?: boolean; includeUploads?: boolean }) =>
    api.post(`/api/v1/staging/${stagingId}/pull`, options || {}),
  getSyncJob: (jobId: number) =>
    api.get(`/api/v1/staging/sync-job/${jobId}`),
  // Clone
  clone: (siteId: string, targetDomain: string, options?: { includeUploads?: boolean }) =>
    api.post(`/api/v1/staging/${siteId}/clone`, { targetDomain, ...options }),
  getCloneJob: (jobId: number) =>
    api.get(`/api/v1/staging/clone-job/${jobId}`),
  // Migration
  migrate: (siteId: string, config: { targetUrl: string; newHosting?: string }) =>
    api.post(`/api/v1/staging/${siteId}/migrate`, config),
  getMigrationJob: (jobId: number) =>
    api.get(`/api/v1/staging/migration-job/${jobId}`),
};

export const uptimeApi = {
  getStats: (siteId: string, hours = 24) =>
    api.get(`/api/v1/monitoring/${siteId}/uptime?hours=${hours}`),
  getHistory: (siteId: string, limit = 100) =>
    api.get(`/api/v1/monitoring/${siteId}/uptime?hours=${limit}`),
  getIncidents: (siteId: string, limit = 10) =>
    api.get(`/api/v1/monitoring/${siteId}/incidents?limit=${limit}`),
  checkNow: (siteId: string) =>
    api.post(`/api/v1/monitoring/${siteId}/check`),
};

export const notificationsApi = {
  getSettings: () =>
    api.get('/api/v1/notifications/settings'),
  saveSettings: (data: any) =>
    api.post('/api/v1/notifications/settings', data),
  test: (channel: string) =>
    api.post('/api/v1/notifications/test', { channel }),
};

export const teamApi = {
  getTeam: () =>
    api.get('/api/v1/team'),
  getMembers: () =>
    api.get('/api/v1/team/members'),
  getRoles: () =>
    api.get('/api/v1/team/roles'),
  inviteMember: (data: { email: string; role: string; siteIds?: number[] }) =>
    api.post('/api/v1/team/invite', data),
  updateMember: (memberId: number, data: { role: string }) =>
    api.put(`/api/v1/team/members/${memberId}`, data),
  removeMember: (memberId: number) =>
    api.delete(`/api/v1/team/members/${memberId}`),
  getInvites: () =>
    api.get('/api/v1/team/invites'),
  cancelInvite: (inviteId: number) =>
    api.delete(`/api/v1/team/invites/${inviteId}`),
};

export const updatesApi = {
  getAvailable: (siteId: string) =>
    api.get(`/api/v1/updates/${siteId}/check`),
  getSettings: (siteId: string) =>
    api.get(`/api/v1/updates/${siteId}/settings`),
  saveSettings: (siteId: string, data: any) =>
    api.put(`/api/v1/updates/${siteId}/settings`, data),
  getHistory: (siteId: string) =>
    api.get(`/api/v1/updates/${siteId}/history`),
  triggerUpdate: (siteId: string, data: { updatePlugins?: boolean; updateThemes?: boolean; updateCore?: boolean }) =>
    api.post(`/api/v1/updates/${siteId}/auto-update`, data),
};

export const sslApi = {
  getSiteSSL: (siteId: string) =>
    api.get(`/api/v1/ssl/${siteId}`),
  checkNow: (siteId: string) =>
    api.post(`/api/v1/ssl/${siteId}/check`),
  getAllSSL: () =>
    api.get(`/api/v1/ssl`),
};

export default api;
