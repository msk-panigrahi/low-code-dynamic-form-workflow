import apiClient from './apiClient';

export const ruleService = {
  createRule: async (formId, ruleData) => {
    try {
      const response = await apiClient.post(`/api/forms/${formId}/rules`, ruleData);
      return response.data;
    } catch (error) {
      console.error('Error creating rule:', error);
      throw error;
    }
  },

  listRules: async (formId) => {
    try {
      const response = await apiClient.get(`/api/forms/${formId}/rules`);
      return response.data;
    } catch (error) {
      console.error('Error listing rules:', error);
      throw error;
    }
  },

  updateRule: async (formId, ruleId, ruleData) => {
    try {
      const response = await apiClient.put(`/api/forms/${formId}/rules/${ruleId}`, ruleData);
      return response.data;
    } catch (error) {
      console.error('Error updating rule:', error);
      throw error;
    }
  },

  toggleRule: async (formId, ruleId) => {
    try {
      const response = await apiClient.patch(`/api/forms/${formId}/rules/${ruleId}/toggle`);
      return response.data;
    } catch (error) {
      console.error('Error toggling rule:', error);
      throw error;
    }
  },

  deleteRule: async (formId, ruleId) => {
    try {
      const response = await apiClient.delete(`/api/forms/${formId}/rules/${ruleId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting rule:', error);
      throw error;
    }
  },
};
