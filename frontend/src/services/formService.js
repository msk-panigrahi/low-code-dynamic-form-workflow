import apiClient from './apiClient';

/**
 * Build FormData payload for file upload submissions.
 * Sends form_values as a JSON string and files as multipart fields.
 * Optionally includes analytics session tracking fields (session_id / started_at).
 */
function buildFormDataWithFiles(formValues, fileFields, sessionInfo = null) {
  const formData = new FormData();
  
  // Build ALL form values as a JSON string (including file field values)
  // File field values like "filename.ext||size" are validated server-side
  // The file itself is uploaded separately as file_{fieldId}
  const plainValues = {};
  for (const [fieldId, value] of Object.entries(formValues)) {
    plainValues[fieldId] = value;
  }
  
  // Add form_values as JSON string
  formData.append('form_values', JSON.stringify(plainValues));
  
  // Add analytics session tracking fields (optional, non-blocking)
  if (sessionInfo?.session_id) {
    formData.append('session_id', sessionInfo.session_id);
  }
  if (sessionInfo?.started_at) {
    formData.append('started_at', sessionInfo.started_at);
  }
  
  // Add file fields as file_{fieldId}
  for (const { fieldId, file } of fileFields) {
    if (file) {
      formData.append(`file_${fieldId}`, file);
    }
  }
  
  return formData;
}

export const formService = {
  createForm: async (title, description) => {
    try {
      const response = await apiClient.post('/api/forms', {
        title,
        description: description || null,
      });
      return response.data;
    } catch (error) {
      console.error('Error creating form:', error);
      throw error;
    }
  },

  listForms: async () => {
    try {
      const response = await apiClient.get('/api/forms');
      return response.data;
    } catch (error) {
      console.error('Error listing forms:', error);
      throw error;
    }
  },

  addField: async (formId, fieldData) => {
    try {
      const response = await apiClient.post(`/api/forms/${formId}/fields`, fieldData);
      return response.data;
    } catch (error) {
      console.error('Error adding field:', error);
      throw error;
    }
  },

  getForm: async (formId) => {
    try {
      const response = await apiClient.get(`/api/forms/${formId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching form:', error);
      throw error;
    }
  },

  updateField: async (formId, fieldId, fieldData) => {
    try {
      const response = await apiClient.patch(`/api/forms/${formId}/fields/${fieldId}`, fieldData);
      return response.data;
    } catch (error) {
      console.error('Error updating field:', error);
      throw error;
    }
  },

  deleteField: async (formId, fieldId) => {
    try {
      const response = await apiClient.delete(`/api/forms/${formId}/fields/${fieldId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting field:', error);
      throw error;
    }
  },

  reorderFields: async (formId, orderedFieldIds) => {
    try {
      const response = await apiClient.patch(`/api/forms/${formId}/fields/reorder`, {
        ordered_field_ids: orderedFieldIds,
      });
      return response.data;
    } catch (error) {
      console.error('Error reordering fields:', error);
      throw error;
    }
  },

  // ─── Duplicate (Day 18) ───────────────────────────

  /**
   * Duplicate a form as a fresh draft (structure only — no versions,
   * submissions or analytics). POST /api/forms/{formId}/duplicate
   * @param {number} formId
   */
  duplicateForm: async (formId) => {
    try {
      const response = await apiClient.post(`/api/forms/${formId}/duplicate`);
      return response.data;
    } catch (error) {
      console.error('Error duplicating form:', error);
      throw error;
    }
  },

  // ─── Publish / Archive / Versioning ──────────────

  publishForm: async (formId) => {
    try {
      const response = await apiClient.post(`/api/forms/${formId}/publish`);
      return response.data;
    } catch (error) {
      console.error('Error publishing form:', error);
      throw error;
    }
  },

  archiveForm: async (formId) => {
    try {
      const response = await apiClient.post(`/api/forms/${formId}/archive`);
      return response.data;
    } catch (error) {
      console.error('Error archiving form:', error);
      throw error;
    }
  },

  getVersions: async (formId) => {
    try {
      const response = await apiClient.get(`/api/forms/${formId}/versions`);
      return response.data;
    } catch (error) {
      console.error('Error fetching versions:', error);
      throw error;
    }
  },

  createDraftVersion: async (formId, versionId = null) => {
    try {
      const params = versionId ? { version_id: versionId } : {};
      const response = await apiClient.post(`/api/forms/${formId}/versions`, null, { params });
      return response.data;
    } catch (error) {
      console.error('Error creating draft version:', error);
      throw error;
    }
  },

  // ─── Shareable Links (Day 6) ───────────────────────

  generateShareLink: async (formId) => {
    try {
      const response = await apiClient.post(`/api/forms/${formId}/generate-link`);
      return response.data;
    } catch (error) {
      console.error('Error generating share link:', error);
      throw error;
    }
  },

  getPublicForm: async (linkToken) => {
    try {
      const response = await apiClient.get(`/api/public/forms/${linkToken}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching public form:', error);
      throw error;
    }
  },

  /**
   * Submit form as JSON (legacy - no files).
   * @param {string} linkToken - The public form link token
   * @param {object} data - Payload ({ form_values, session_id?, started_at? })
   * @param {string|null} idempotencyKey - Optional idempotency key header
   */
  submitForm: async (linkToken, data, idempotencyKey = null) => {
    try {
      const config = {};
      if (idempotencyKey) {
        config.headers = { 'Idempotency-Key': idempotencyKey };
      }
      const response = await apiClient.post(`/api/public/forms/${linkToken}/submit`, data, config);
      return response.data;
    } catch (error) {
      console.error('Error submitting form:', error);
      throw error;
    }
  },

  /**
   * Submit form as multipart/form-data (with files).
   * @param {string} linkToken - The public form link token
   * @param {object} formValues - All form values (fieldId -> value)
   * @param {Array<{fieldId: number, file: File}>} fileFields - File field entries
   * @param {function} onUploadProgress - Optional progress callback (0-100)
   * @param {string|null} idempotencyKey - Optional idempotency key
   * @param {object|null} sessionInfo - Optional analytics session { session_id, started_at }
   */
  submitFormWithFiles: async (linkToken, formValues, fileFields, onUploadProgress, idempotencyKey = null, sessionInfo = null) => {
    try {
      const formData = buildFormDataWithFiles(formValues, fileFields, sessionInfo);
      const config = {
        // Let Axios/browser set multipart Content-Type with boundary
        onUploadProgress: (progressEvent) => {
          if (onUploadProgress && progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onUploadProgress(pct);
          }
        },
      };
      if (idempotencyKey) {
        config.headers = { 'Idempotency-Key': idempotencyKey };
      }
      const response = await apiClient.post(
        `/api/public/forms/${linkToken}/submit`,
        formData,
        config
      );
      return response.data;
    } catch (error) {
      console.error('Error submitting form with files:', error);
      throw error;
    }
  },

  // ─── Submissions / Responses (Day 12) ──────────────────

  getSubmissions: async (formId, limit = 50, offset = 0) => {
    try {
      const response = await apiClient.get(`/api/forms/${formId}/submissions`, {
        params: { limit, offset },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching submissions:', error);
      throw error;
    }
  },

  getSubmissionStats: async (formId) => {
    try {
      const response = await apiClient.get(`/api/forms/${formId}/submissions/stats`);
      return response.data;
    } catch (error) {
      console.error('Error fetching submission stats:', error);
      throw error;
    }
  },

  getSubmissionDetail: async (formId, submissionId) => {
    try {
      const response = await apiClient.get(`/api/forms/${formId}/submissions/${submissionId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching submission detail:', error);
      throw error;
    }
  },

  // ─── Response Browser (Day 16) ────────────────────────

  /**
   * Browse form responses with filters, search and pagination.
   * GET /api/forms/{formId}/responses
   * @param {number} formId
   * @param {object} params - { limit, offset, from_date, to_date, status, field_id, field_value, search }
   */
  getResponses: async (formId, params = {}) => {
    try {
      const response = await apiClient.get(`/api/forms/${formId}/responses`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching responses:', error);
      throw error;
    }
  },

  /**
   * Full detail for one response (powers the detail modal).
   * GET /api/responses/{responseId}
   * @param {string} responseId
   */
  getResponseDetail: async (responseId) => {
    try {
      const response = await apiClient.get(`/api/responses/${responseId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching response detail:', error);
      throw error;
    }
  },

  // ─── Bulk deletion (Day 19) ──────────────────────────

  /**
   * Permanently bulk-delete responses for a form (irreversible).
   * DELETE /api/forms/{formId}/responses/bulk
   * @param {number} formId
   * @param {object} payload - { response_ids?, from_date?, to_date?, status?, confirm }
   */
  bulkDeleteResponses: async (formId, payload) => {
    try {
      const response = await apiClient.delete(`/api/forms/${formId}/responses/bulk`, {
        data: payload,
      });
      return response.data;
    } catch (error) {
      console.error('Error bulk deleting responses:', error);
      throw error;
    }
  },
};

export { buildFormDataWithFiles };
