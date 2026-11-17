import apiClient from './client';

export const settingsApi = {
  /**
   * Fetch current Registrar auto-approval settings and active signatory.
   */
  async getRegistrarApproval() {
    try {
      const response = await apiClient.get('/api/settings/registrar-approval/');
      return response.data;
    } catch (err) {
      console.warn('Failed to fetch registrar approval settings:', err);
      return {
        auto_approve_requests: true,
        default_signatory_name: 'Jonalin T. Lagrada, MPSM',
        default_signatory_title: 'University Registrar',
        active_registrar_name: 'Jonalin T. Lagrada, MPSM',
      };
    }
  },

  /**
   * Update Registrar auto-approval toggle (ON / OFF).
   */
  async updateRegistrarApproval(autoApprove) {
    const response = await apiClient.patch('/api/settings/registrar-approval/', {
      auto_approve_requests: Boolean(autoApprove),
    });
    return response.data;
  },
};

export default settingsApi;

