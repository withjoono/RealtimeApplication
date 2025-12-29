import { useQuery } from '@tanstack/react-query';
import { universitiesApi } from '../api';

export function useUniversities(params?: { region?: string; type?: string }) {
  return useQuery({
    queryKey: ['universities', params],
    queryFn: () => universitiesApi.getAll(params),
  });
}

export function useUniversity(id: number) {
  return useQuery({
    queryKey: ['university', id],
    queryFn: () => universitiesApi.getById(id),
    enabled: !!id,
  });
}
