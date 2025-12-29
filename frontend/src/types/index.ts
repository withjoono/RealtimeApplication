// University Types
export interface University {
  id: number;
  code: string;
  name: string;
  region: string | null;
  type: string | null;
  ratio_url: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Department {
  id: number;
  admission_id: number;
  campus: string | null;
  name: string;
  detail: string | null;
  recruit_count: number;
  apply_count: number;
  competition_rate: number;
  created_at: string;
  updated_at: string | null;
}

export interface Admission {
  id: number;
  university_id: number;
  admission_type: string;
  admission_name: string;
  year: number;
  departments: Department[];
  created_at: string;
}

export interface UniversityDetail extends University {
  admissions: Admission[];
}

// Competition Rate Types
export interface CompetitionRate {
  university_name: string;
  university_code: string;
  admission_type: string;
  admission_name: string;
  campus: string | null;
  department_name: string;
  detail: string | null;
  recruit_count: number;
  apply_count: number;
  competition_rate: number;
  additional_recruit: number | null;
  actual_competition_rate: number | null;
  updated_at: string | null;
}

// Ratio History
export interface RatioHistory {
  id: number;
  department_id: number;
  recruit_count: number;
  apply_count: number;
  competition_rate: number;
  recorded_at: string;
}

// Statistics
export interface StatisticsSummary {
  university_count: number;
  admission_count: number;
  department_count: number;
  average_competition_rate: number;
  max_competition_rate: number;
  min_competition_rate: number;
  last_crawled_at: string | null;
}

export interface TopCompetition {
  university_name: string;
  admission_name: string;
  department_name: string;
  competition_rate: number;
  recruit_count: number;
  apply_count: number;
}

// Crawl Status
export interface CrawlStatus {
  status: string;
  message: string;
  last_crawled_at: string | null;
  total_universities: number;
  total_departments: number;
}

export interface CrawlLog {
  id: number;
  university_code: string;
  status: string;
  message: string;
  duration_seconds: number;
  crawled_at: string;
}

// Search Params
export interface SearchParams {
  university_name?: string;
  department_name?: string;
  admission_type?: string;
  min_rate?: number;
  max_rate?: number;
  limit?: number;
  offset?: number;
}

// SmartRatio Types
export interface SmartRatioUniversity {
  name: string;
  region: string;
  admission_type: string;
  period_start: string | null;
  period_end: string | null;
  status: '준비중' | '접수예정' | '접수중' | '마감' | '알수없음';
  ratio_url: string | null;
  univ_code: string | null;
}

export interface AvailabilityCheck {
  is_open: boolean;
  checked_at: string;
  message: string;
  next_check_recommended: string | null;
}

export interface DiscoverUrlsResult {
  total_checked: number;
  available_count: number;
  universities: {
    name: string;
    ratio_url: string;
    univ_code: string;
    status: string;
  }[];
}

export interface CrawlProgress {
  is_running: boolean;
  progress: number;
  total: number;
  current_university: string;
  results: {
    success: number;
    failed: number;
    skipped: number;
  };
  started_at: string | null;
  recent_logs: string[];
}

// 크롤러 데이터 타입 (organized_with_chuhap.json)
export interface CrawlerDataEntry {
  대학명: string;
  캠퍼스: string;
  전형명: string;
  모집단위: string;
  모집인원: string | number;
  지원인원: string | number;
  경쟁률: string;
  지역?: string;  // regionMapper.js에서 추가
  // 추합 관련 필드 (lastYearMapper.js에서 추가)
  정원?: number;
  현재경쟁률?: string;
  작년추합?: number;
  예상최종경쟁?: string;
  예상실질경쟁?: string;
  예상실질경쟁값?: number;  // 정렬/비교용 숫자값
  _matchType?: 'exact' | 'group' | 'univ' | null;
  _chuhapMatchType?: 'exact' | 'group' | 'univ' | null;
  // 예측 관련 필드 (predictFinalRate.js에서 추가)
  예상최종경쟁값?: number;  // 예측된 최종경쟁률 숫자값
  증가율?: string;  // 3일전→최종 증가율
  _predictionType?: 'exact' | 'group' | 'univ' | 'overall';
}

export interface CrawlerData {
  가군: CrawlerDataEntry[];
  나군: CrawlerDataEntry[];
  다군: CrawlerDataEntry[];
}

export type AdmissionGroup = '가군' | '나군' | '다군';
