import apiClient from './client';

/**
 * User Management API service
 * Interacts with /api/users/ endpoints
 */
export const usersApi = {
  /**
   * List all users
   * @param {Object} [params] - Optional query parameters
   * @returns {Promise<Array>} List of user objects
   */
  async list(params = {}) {
    const response = await apiClient.get('/api/users/', { params });
    // DRF may return array or paginated object { results: [...] }
    return Array.isArray(response.data) ? response.data : (response.data?.results || []);
  },

  /**
   * Get single user by ID
   * @param {number|string} id
   * @returns {Promise<Object>}
   */
  async get(id) {
    const response = await apiClient.get(`/api/users/${id}/`);
    return response.data;
  },

  /**
   * Provision a new user
   * @param {Object} userData - { username, email, password, role, first_name, last_name }
   * @returns {Promise<Object>}
   */
  async create(userData) {
    const response = await apiClient.post('/api/users/', userData);
    return response.data;
  },

  /**
   * Update an existing user
   * @param {number|string} id
   * @param {Object} updates - { email, role, is_active, first_name, last_name }
   * @returns {Promise<Object>}
   */
  async update(id, updates) {
    const response = await apiClient.patch(`/api/users/${id}/`, updates);
    return response.data;
  },

  /**
   * Soft-deactivate a user (DELETE /api/users/{id}/)
   * @param {number|string} id
   * @returns {Promise<void>}
   */
  async deactivate(id) {
    const response = await apiClient.delete(`/api/users/${id}/`);
    return response.data;
  },

  /**
   * Reactivate a user (PATCH /api/users/{id}/ with { is_active: true })
   * @param {number|string} id
   * @returns {Promise<Object>}
   */
  async activate(id) {
    const response = await apiClient.patch(`/api/users/${id}/`, { is_active: true });
    return response.data;
  },
};

export default usersApi;
