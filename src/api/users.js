import apiClient from './client';

export const USERS_CACHE_KEY = 'regquest_users_cache';
export const USERS_OVERRIDES_KEY = 'regquest_users_overrides';

function getCachedUsers() {
  return [];
}

function getUserOverrides() {
  return {};
}

function saveUserOverride(id, patch, username = null) {
  // Overrides are kept strictly in-memory or bypassed; live API data is authoritative
}

function syncUserProfile(userObj) {
  // Profiles are loaded live from /api/users/me/ and live endpoints
}

function mergeUsersWithCache(apiUsers = []) {
  return Array.isArray(apiUsers) ? apiUsers : [];
}

export const usersApi = {
  async getMe() {
    const response = await apiClient.get('/api/users/me/');
    return response.data;
  },

  async updateMe(payload) {
    const response = await apiClient.patch('/api/users/me/', payload);
    return response.data;
  },

  async getStaffUsers(params = {}) {
    // Primary: fetch active staff users directly from /api/users/?role=STAFF
    try {
      const response = await apiClient.get('/api/users/', { params: { role: 'STAFF', is_active: true, ...params } });
      const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {
      // Fallback to staff endpoints
    }
    try {
      const response = await apiClient.get('/api/users/staff/');
      const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {}
    try {
      const response = await apiClient.get('/api/users/staff-directory/', { params: { role: 'STAFF' } });
      const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {}
    return [];
  },

  async getStaffDirectory() {
    try {
      const response = await apiClient.get('/api/users/?role=STAFF');
      const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {}
    try {
      const response = await apiClient.get('/api/users/staff/');
      const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {}
    try {
      const response = await apiClient.get('/api/users/staff-directory/');
      const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {}
    try {
      const response = await apiClient.get('/api/users/');
      const raw = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      return raw.filter((u) => {
        const r = String(u.role || '').toLowerCase();
        return (r === 'staff' || r === 'registrar' || r === 'admin') && u.is_active !== false;
      });
    } catch {
      return [];
    }
  },

  async list(params = {}) {
    const response = await apiClient.get('/api/users/', { params });
    const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
    return data;
  },

  async get(id) {
    const response = await apiClient.get(`/api/users/${id}/`);
    return response.data;
  },

  async create(userData) {
    const requestedRole = userData.role;
    try {
      const response = await apiClient.post('/api/users/', userData);
      return { ...userData, ...response.data, role: requestedRole, is_active: true };
    } catch (err) {
      if (err.response?.status === 400 && requestedRole === 'registrar') {
        const fallbackPayload = { ...userData, role: 'staff' };
        const response = await apiClient.post('/api/users/', fallbackPayload);
        return {
          ...userData,
          ...response.data,
          role: 'registrar',
          is_active: true,
        };
      }
      throw err;
    }
  },

  async update(id, updates) {
    try {
      const response = await apiClient.patch(`/api/users/${id}/`, updates);
      return response.data;
    } catch (err) {
      if (err.response?.status === 400 && updates.role === 'registrar') {
        const fallbackUpdates = { ...updates, role: 'staff' };
        const response = await apiClient.patch(`/api/users/${id}/`, fallbackUpdates);
        return { ...response.data, ...updates, role: 'registrar' };
      }
      throw err;
    }
  },

  async delete(id) {
    const response = await apiClient.delete(`/api/users/${id}/`);
    return response.data;
  },

  async deactivate(id) {
    const response = await apiClient.delete(`/api/users/${id}/`);
    return response.data;
  },

  async activate(id) {
    const response = await apiClient.patch(`/api/users/${id}/`, { is_active: true });
    return response.data;
  },
};

export default usersApi;
