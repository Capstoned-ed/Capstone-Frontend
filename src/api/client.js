import axios from 'axios';
import { API_URL } from '../config/env';
import { ROUTES } from '../constants/routes';
import apiCache, { isNonFallbackSuccessResponse } from './cache';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// SWR In-Memory Cache & In-Flight Request Deduplication for GET requests
const originalGet = apiClient.get.bind(apiClient);

apiClient.get = function (url, config = {}) {
  if (config?.skipCache) {
    return originalGet(url, config);
  }

  const key = apiCache.generateKey('GET', url, config?.params);

  // In-flight deduplication: simultaneous identical calls share the pending promise
  return apiCache.deduplicate(key, async () => {
    try {
      const response = await originalGet(url, config);
      if (isNonFallbackSuccessResponse(response, url)) {
        apiCache.set(key, response.data);
      } else {
        // Never cache error or fallback responses
        apiCache.delete(key);
      }
      return response;
    } catch (err) {
      // Purge on error
      apiCache.delete(key);
      throw err;
    }
  });
};

apiClient.getCached = function (url, config = {}) {
  const key = apiCache.generateKey('GET', url, config?.params);
  return apiCache.get(key);
};

apiClient.invalidateCache = function (prefix) {
  apiCache.invalidate(prefix);
};

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Attach JWT Access Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 with Silent Refresh & Request Queuing
apiClient.interceptors.response.use(
  (response) => {
    // Invalidate relevant cache namespaces on successful mutations
    const method = String(response.config?.method || '').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const url = String(response.config?.url || '');
      if (url.includes('/requests') || url.includes('/credentials')) {
        apiCache.invalidate('/requests');
        apiCache.invalidate('/credentials');
      }
      if (url.includes('/notifications')) {
        apiCache.invalidate('/notifications');
      }
      if (url.includes('/clearances')) {
        apiCache.invalidate('/clearances');
        apiCache.invalidate('/requests');
      }
      if (url.includes('/payments')) {
        apiCache.invalidate('/payments');
        apiCache.invalidate('/requests');
      }
      if (url.includes('/users')) {
        apiCache.invalidate('/users');
      }
    }
    return response;
  },
  async (error) => {
    // Sanitize any raw HTML 500 error pages to clean user-friendly object
    if (
      error?.response?.data &&
      typeof error.response.data === 'string' &&
      (/<[a-z][\s\S]*>/i.test(error.response.data) ||
        error.response.data.trim().toLowerCase().startsWith('<!doctype'))
    ) {
      const statusCode = error.response.status || 500;
      error.response.data = {
        detail:
          statusCode >= 500
            ? 'A server error occurred. Please try again later.'
            : 'An unexpected error occurred while communicating with the server.',
      };
    }

    const originalRequest = error.config;

    // Reject immediately if no response or not a 401 or request already retried
    if (!error.response || error.response.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Do not attempt refresh on auth login, refresh, or logout endpoints
    const requestUrl = originalRequest.url || '';
    if (
      requestUrl.includes('/api/auth/login/') ||
      requestUrl.includes('/api/auth/refresh/') ||
      requestUrl.includes('/api/auth/logout/')
    ) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      try {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        sessionStorage.clear();
        apiCache.clear();
      } catch {}
      if (window.location.pathname !== ROUTES.LOGIN) {
        window.location.href = ROUTES.LOGIN;
      }
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Use clean axios instance to bypass interceptors during refresh
      const refreshResponse = await axios.post(`${API_URL}/api/auth/refresh/`, {
        refresh: refreshToken,
      });

      const { access, refresh: newRefresh } = refreshResponse.data;

      localStorage.setItem('access_token', access);
      if (newRefresh) {
        localStorage.setItem('refresh_token', newRefresh);
      }

      apiClient.defaults.headers.common.Authorization = `Bearer ${access}`;
      originalRequest.headers.Authorization = `Bearer ${access}`;

      processQueue(null, access);
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      try {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        sessionStorage.clear();
        apiCache.clear();
      } catch {}
      if (window.location.pathname !== ROUTES.LOGIN) {
        window.location.href = ROUTES.LOGIN;
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
