import apiClient from './apiClient';

export const fieldTypeService = {
  getFieldTypes: async () => {
    try {
      const response = await apiClient.get('/api/field-types');
      return response.data;
    } catch (error) {
      console.error('Error fetching field types:', error);
      throw error;
    }
  },
};
