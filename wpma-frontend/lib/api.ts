import axios, { AxiosInstance, AxiosResponse } from 'axios';

export interface ApiResponse<T = any> {
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
    api.post<{ user: any; token: string }>('/api/v1/auth/login', { email, password }),
  
  register: (userData: any) =>
    api.post<{ user: any; token: string }>('/api/v1/auth/register', userData),
  
  me: () =>
    api.get('/api/v1/auth/me'),
  
  refreshToken: () =>
    api.post<{ user: any; token: string }>('/api/v1/auth/refresh'),
};

export const sitesApi = {
  getSites: () =>
    api.get('/api/v1/sites'),
  
  getSite: (siteId: string) =>
    api.get(`/api/v1/sites/${siteId}`),
  
  createSite: (siteData: any) =>
    api.post('/api/v1/sites', siteData),
  
  updateSite: (siteId: string, siteData: any) =>
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
    api.get(`/api/v1/backup/${backupId}/download`),
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
};

export const syncApi = {
  syncSite: (siteId: string) =>
    api.post(`/api/v1/sync/sites/${siteId}/sync`),

  syncAllSites: () =>
    api.post('/api/v1/sync/sync-all'),

  getSyncedData: (siteId: string) =>
    api.get(`/api/v1/sync/sites/${siteId}/synced-data`),
};

export default api;
