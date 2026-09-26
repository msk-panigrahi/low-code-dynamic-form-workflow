import apiClient from './apiClient';

/**
 * Export API client (Day 15 / Milestone 3).
 */
export const exportService = {
  /**
   * Download form responses as CSV or JSON.
   * GET /api/forms/{form_id}/export?format=csv|json&version=latest|<version_id>
   *
   * Returns { blob, filename } — the browser triggers the download.
   * @param {number} formId
   * @param {'csv'|'json'} format
   * @param {string} version - 'latest' (default) or a version id
   */
  exportFormResponses: async (formId, format = 'csv', version = 'latest') => {
    try {
      const response = await apiClient.get(`/api/forms/${formId}/export`, {
        params: { format, version },
        responseType: 'blob',
      });

      // Extract the suggested filename from Content-Disposition if present
      let filename = `form_${formId}.${format}`;
      const disposition = response.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      if (match?.[1]) {
        filename = match[1];
      }

      return { blob: response.data, filename };
    } catch (error) {
      console.error('Error exporting form responses:', error);
      throw error;
    }
  },
};

export default exportService;
