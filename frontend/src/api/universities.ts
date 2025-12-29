import { apiClient } from './client';
import type { University, UniversityDetail } from '../types';

export const universitiesApi = {
  getAll: async (params?: { region?: string; type?: string }) => {
    const response = await apiClient.get<University[]>('/universities', { params });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await apiClient.get<UniversityDetail>(`/universities/${id}`);
    return response.data;
  },
};
