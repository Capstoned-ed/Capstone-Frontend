import { apiClient } from './client';

export const auditApi = {
  /**
   * Fetch audit log entries performed by the currently authenticated user.
   */
  getMyLogs: async () => {
    try {
      const response = await apiClient.get('/audit/my-logs/');
      return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
      console.warn('Failed to fetch backend audit logs:', err);
      return [];
    }
  },

  /**
   * Fetch system-wide audit log entries (Admin only).
   */
  getAllLogs: async (params = {}) => {
    try {
      const response = await apiClient.get('/api/audit/', { params });
      return Array.isArray(response.data) ? response.data : (response.data?.results || []);
    } catch (err) {
      console.warn('Failed to fetch system audit logs:', err);
      return [];
    }
  },
};

export default auditApi;
