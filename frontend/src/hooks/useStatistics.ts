import { useQuery } from '@tanstack/react-query';
import { statisticsApi } from '../api';

export function useStatisticsSummary(admissionType?: string) {
  return useQuery({
    queryKey: ['statistics-summary', admissionType],
    queryFn: () => statisticsApi.getSummary(admissionType),
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useTopCompetition(params?: { admission_type?: string; limit?: number }) {
  return useQuery({
    queryKey: ['top-competition', params],
    queryFn: () => statisticsApi.getTopCompetition(params),
    refetchInterval: 60000,
  });
}
