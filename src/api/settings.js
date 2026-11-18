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
        default_signatory_name: '',
        default_signatory_title: 'University Registrar',
        active_registrar_name: '',
      };
    }
  },

  /**
   * Update Registrar auto-approval toggle (ON / OFF) and persist active signatory if provided.
   */
  async updateRegistrarApproval(autoApprove, signatoryName = null) {
    const payload = {
      auto_approve_requests: Boolean(autoApprove),
    };
    if (signatoryName && String(signatoryName).trim()) {
      payload.default_signatory_name = String(signatoryName).trim();
    }
    const response = await apiClient.patch('/api/settings/registrar-approval/', payload);
    return response.data;
  },
};

export default settingsApi;

