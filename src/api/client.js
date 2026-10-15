import axios from 'axios';
import { API_URL } from '../config/env';
import { ROUTES } from '../constants/routes';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  (response) => response,
  async (error) => {
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
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
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
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
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
