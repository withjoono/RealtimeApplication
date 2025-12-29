import { apiClient } from './client';
import type { StatisticsSummary, TopCompetition } from '../types';

export const statisticsApi = {
  getSummary: async (admissionType?: string) => {
    const response = await apiClient.get<StatisticsSummary>('/statistics/summary', {
      params: admissionType ? { admission_type: admissionType } : undefined,
    });
    return response.data;
  },

  getTopCompetition: async (params?: { admission_type?: string; limit?: number }) => {
    const response = await apiClient.get<TopCompetition[]>('/statistics/top-competition', {
      params,
    });
    return response.data;
  },
};
