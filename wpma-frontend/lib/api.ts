import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';

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
          
          const errorMessage = error.response?.data?.error || error.message || 'Ein Fehler ist aufgetreten';
          toast.error(errorMessage);
        }
        
        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.get(url);
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

  async delete<T = any>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.delete(url);
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
  
  getSecurityInsights: (siteId: string) =>
    api.get(`/api/v1/security/${siteId}/insights`),
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
};

export const performanceApi = {
  getMetrics: (siteId: string) =>
    api.get(`/api/v1/performance/${siteId}/metrics`),
  
  getInsights: (siteId: string) =>
    api.get(`/api/v1/performance/${siteId}/insights`),
};

export const aiApi = {
  getInsights: (siteId: string) =>
    api.get(`/api/v1/ai/${siteId}/insights`),
  
  generateRecommendations: (siteId: string) =>
    api.post(`/api/v1/ai/${siteId}/recommendations`),
};

export default api;