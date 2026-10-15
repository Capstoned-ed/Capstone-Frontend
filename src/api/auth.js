import apiClient from './client';
import axios from 'axios';
import { API_URL } from '../config/env';

export const authApi = {
  login: async (username, password) => {
    const response = await apiClient.post('/api/auth/login/', {
      username,
      password,
    });
    return response.data;
  },

  refresh: async (refreshToken) => {
    const response = await axios.post(`${API_URL}/api/auth/refresh/`, {
      refresh: refreshToken,
    });
    return response.data;
  },

  logout: async (refreshToken) => {
    if (!refreshToken) return;
    const response = await apiClient.post('/api/auth/logout/', {
      refresh: refreshToken,
    });
    return response.data;
  },
};

export default authApi;
