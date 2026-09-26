import apiClient from './apiClient';

/**
 * Analytics API client (Day 14 / Milestone 3).
 */
export const analyticsService = {
  /**
   * Aggregated analytics for a single form.
   * GET /api/forms/{form_id}/analytics
   */
  getFormAnalytics: async (formId) => {
    try {
      const response = await apiClient.get(`/api/forms/${formId}/analytics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching form analytics:', error);
      throw error;
    }
  },

  /**
   * Cross-form summary for the admin Analytics dashboard.
   * GET /api/analytics/summary
   */
  getAnalyticsSummary: async () => {
    try {
      const response = await apiClient.get('/api/analytics/summary');
      return response.data;
    } catch (error) {
      console.error('Error fetching analytics summary:', error);
      throw error;
    }
  },

  /**
   * Track that a public form was opened (started session).
   * POST /api/public/forms/{link_token}/sessions
   */
  trackSession: async (linkToken, sessionId, startedAt) => {
    try {
      const response = await apiClient.post(`/api/public/forms/${linkToken}/sessions`, {
        session_id: sessionId,
        started_at: startedAt,
      });
      return response.data;
    } catch (error) {
      // Session tracking must never break the form experience.
      console.warn('Session tracking failed (non-blocking):', error);
      return null;
    }
  },
};

export default analyticsService;
