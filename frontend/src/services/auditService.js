import apiClient from './apiClient';

/**
 * Audit log service (Day 19).
 * Append-only trail of archive/delete operations.
 */
export const auditService = {
  /**
   * Browse audit logs with filters + pagination.
   * GET /api/audit-logs
   * @param {object} params - { limit, offset, action, entity_type, form_id, from_date, to_date }
   */
  listLogs: async (params = {}) => {
    try {
      const response = await apiClient.get('/api/audit-logs', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }
  },
};

export default auditService;
