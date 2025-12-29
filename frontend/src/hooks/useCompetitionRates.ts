import { useQuery } from '@tanstack/react-query';
import { competitionRatesApi } from '../api';
import type { SearchParams } from '../types';

export function useCompetitionRates(params: SearchParams) {
  return useQuery({
    queryKey: ['competition-rates', params],
    queryFn: () => competitionRatesApi.search(params),
  });
}

export function useRatioHistory(departmentId: number, limit = 50) {
  return useQuery({
    queryKey: ['ratio-history', departmentId, limit],
    queryFn: () => competitionRatesApi.getHistory(departmentId, limit),
    enabled: !!departmentId,
  });
}
