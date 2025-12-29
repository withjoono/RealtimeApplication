import { apiClient } from './client';
import type { CompetitionRate, RatioHistory, SearchParams } from '../types';

export const competitionRatesApi = {
  search: async (params: SearchParams) => {
    const response = await apiClient.get<CompetitionRate[]>('/competition-rates', { params });
    return response.data;
  },

  getHistory: async (departmentId: number, limit = 50) => {
    const response = await apiClient.get<RatioHistory[]>(
      `/departments/${departmentId}/history`,
      { params: { limit } }
    );
    return response.data;
  },
};
