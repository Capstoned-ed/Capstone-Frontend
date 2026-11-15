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
};

export default auditApi;
