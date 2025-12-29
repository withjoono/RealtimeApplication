import { apiClient } from './client';
import type {
  CrawlStatus,
  CrawlLog,
  SmartRatioUniversity,
  AvailabilityCheck,
  DiscoverUrlsResult,
  CrawlProgress,
} from '../types';

export const crawlApi = {
  getStatus: async () => {
    const response = await apiClient.get<CrawlStatus>('/crawl/status');
    return response.data;
  },

  getLogs: async (params?: { status?: string; limit?: number }) => {
    const response = await apiClient.get<CrawlLog[]>('/crawl/logs', { params });
    return response.data;
  },

  crawlAll: async (admissionType = '정시', year = 2026) => {
    const response = await apiClient.post('/crawl/all', null, {
      params: { admission_type: admissionType, year },
    });
    return response.data;
  },

  crawlUniversity: async (url: string, admissionType = '정시', year = 2026) => {
    const response = await apiClient.post('/crawl/university', null, {
      params: { url, admission_type: admissionType, year },
    });
    return response.data;
  },

  // SmartRatio APIs
  getSmartRatioUniversities: async () => {
    const response = await apiClient.get<SmartRatioUniversity[]>('/smartratio/universities');
    return response.data;
  },

  checkAvailability: async () => {
    const response = await apiClient.get<AvailabilityCheck>('/smartratio/check-availability');
    return response.data;
  },

  discoverUrls: async (limit = 10) => {
    const response = await apiClient.get<DiscoverUrlsResult>('/smartratio/discover-urls', {
      params: { limit },
    });
    return response.data;
  },

  crawlAllFromSmartRatio: async (admissionType = '정시', year = 2026, delay = 1.0) => {
    const response = await apiClient.post('/smartratio/crawl-all', null, {
      params: { admission_type: admissionType, year, delay },
    });
    return response.data;
  },

  getCrawlProgress: async () => {
    const response = await apiClient.get<CrawlProgress>('/smartratio/crawl-progress');
    return response.data;
  },
};
