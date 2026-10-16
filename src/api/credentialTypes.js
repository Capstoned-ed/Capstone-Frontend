import apiClient from './client';

/**
 * Credential Types API service
 * Interacts with /api/credential-types/ endpoints
 */
export const credentialTypesApi = {
  /**
   * List all credential types
   * Admins/Registrars get all items; Students/Staff get is_active=True items.
   * @param {Object} [params]
   * @returns {Promise<Array>}
   */
  async list(params = {}) {
    const response = await apiClient.get('/api/credential-types/', { params });
    return Array.isArray(response.data) ? response.data : (response.data?.results || []);
  },

  /**
   * Retrieve a single credential type by ID
   * @param {number|string} id
   * @returns {Promise<Object>}
   */
  async get(id) {
    const response = await apiClient.get(`/api/credential-types/${id}/`);
    return response.data;
  },

  /**
   * Create a new credential type (Admin / Registrar only)
   * @param {Object} data - { code, name, description, price, processing_days, is_active }
   * @returns {Promise<Object>}
   */
  async create(data) {
    const response = await apiClient.post('/api/credential-types/', data);
    return response.data;
  },

  /**
   * Update an existing credential type (Admin / Registrar only)
   * @param {number|string} id
   * @param {Object} updates - { code, name, description, price, processing_days, is_active }
   * @returns {Promise<Object>}
   */
  async update(id, updates) {
    const response = await apiClient.patch(`/api/credential-types/${id}/`, updates);
    return response.data;
  },

  /**
   * Soft-deactivate a credential type (DELETE /api/credential-types/{id}/)
   * @param {number|string} id
   * @returns {Promise<void>}
   */
  async deactivate(id) {
    const response = await apiClient.delete(`/api/credential-types/${id}/`);
    return response.data;
  },
};

export default credentialTypesApi;
