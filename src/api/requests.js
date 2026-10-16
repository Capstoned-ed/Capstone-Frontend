import { apiClient } from './client';

export const requestsApi = {
  /**
   * Fetch list of all credential requests (for Admin / Staff).
   */
  list: async (params = {}) => {
    const response = await apiClient.get('/api/requests/', { params });
    return response.data;
  },

  /**
   * Fetch all credential types.
   */
  getCredentialTypes: async () => {
    const response = await apiClient.get('/api/credential-types/');
    return response.data;
  },
};

export default requestsApi;
