import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crawlApi } from '../api';

export function useCrawlStatus() {
  return useQuery({
    queryKey: ['crawl-status'],
    queryFn: () => crawlApi.getStatus(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useCrawlLogs(params?: { status?: string; limit?: number }) {
  return useQuery({
    queryKey: ['crawl-logs', params],
    queryFn: () => crawlApi.getLogs(params),
  });
}

export function useCrawlAll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ admissionType, year }: { admissionType?: string; year?: number }) =>
      crawlApi.crawlAll(admissionType, year),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crawl-status'] });
      queryClient.invalidateQueries({ queryKey: ['crawl-logs'] });
    },
  });
}

// SmartRatio Hooks
export function useSmartRatioUniversities() {
  return useQuery({
    queryKey: ['smartratio-universities'],
    queryFn: () => crawlApi.getSmartRatioUniversities(),
  });
}

export function useCheckAvailability() {
  return useQuery({
    queryKey: ['smartratio-availability'],
    queryFn: () => crawlApi.checkAvailability(),
    refetchInterval: 60000, // Refresh every 1 minute
  });
}

export function useDiscoverUrls(limit = 10) {
  return useQuery({
    queryKey: ['smartratio-discover', limit],
    queryFn: () => crawlApi.discoverUrls(limit),
    enabled: false, // Manual trigger only
  });
}

export function useCrawlProgress(enabled = false) {
  return useQuery({
    queryKey: ['smartratio-progress'],
    queryFn: () => crawlApi.getCrawlProgress(),
    refetchInterval: enabled ? 2000 : false, // Refresh every 2 seconds when enabled
    enabled,
  });
}

export function useSmartRatioCrawlAll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      admissionType = '정시',
      year = 2026,
      delay = 1.0,
    }: {
      admissionType?: string;
      year?: number;
      delay?: number;
    }) => crawlApi.crawlAllFromSmartRatio(admissionType, year, delay),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smartratio-progress'] });
      queryClient.invalidateQueries({ queryKey: ['crawl-status'] });
    },
  });
}
