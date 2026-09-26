import apiClient from './apiClient';

/**
 * Retention policy service (Day 19).
 * Per-form data lifecycle: how long submissions stay active before archival.
 */
export const retentionService = {
  /**
   * List retention policies for all accessible forms (incl. "Never" rows).
   * GET /api/retention-policies
   */
  listPolicies: async () => {
    try {
      const response = await apiClient.get('/api/retention-policies');
      return response.data;
    } catch (error) {
      console.error('Error listing retention policies:', error);
      throw error;
    }
  },

  /**
   * Get one form's retention policy.
   * GET /api/forms/{formId}/retention-policy
   */
  getPolicy: async (formId) => {
    try {
      const response = await apiClient.get(`/api/forms/${formId}/retention-policy`);
      return response.data;
    } catch (error) {
      console.error('Error fetching retention policy:', error);
      throw error;
    }
  },

  /**
   * Create a retention policy for a form.
   * POST /api/forms/{formId}/retention-policy
   * @param {object} data - { retention_days, action, enabled }
   */
  createPolicy: async (formId, data) => {
    try {
      const response = await apiClient.post(`/api/forms/${formId}/retention-policy`, data);
      return response.data;
    } catch (error) {
      console.error('Error creating retention policy:', error);
      throw error;
    }
  },

  /**
   * Update a form's retention policy.
   * PUT /api/forms/{formId}/retention-policy
   * @param {object} data - { retention_days?, action?, enabled? }
   */
  updatePolicy: async (formId, data) => {
    try {
      const response = await apiClient.put(`/api/forms/${formId}/retention-policy`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating retention policy:', error);
      throw error;
    }
  },

  /**
   * Remove a form's retention policy (back to "Never").
   * DELETE /api/forms/{formId}/retention-policy
   */
  deletePolicy: async (formId) => {
    try {
      const response = await apiClient.delete(`/api/forms/${formId}/retention-policy`);
      return response.data;
    } catch (error) {
      console.error('Error deleting retention policy:', error);
      throw error;
    }
  },

  /**
   * Run the retention archival job manually.
   * POST /api/retention/run
   */
  runJob: async () => {
    try {
      const response = await apiClient.post('/api/retention/run');
      return response.data;
    } catch (error) {
      console.error('Error running retention job:', error);
      throw error;
    }
  },
};

export default retentionService;
