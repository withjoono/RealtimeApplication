import { useState, useMemo, useEffect } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { RegionSelector } from '../components/RegionSelector';
import { UniversitySection, DepartmentSection, LowestRateSection } from '../components/sections';
import { getRegionName } from '../constants/regions';
import type { RegionId } from '../constants/regions';
import type { CrawlerData, CrawlerDataEntry, AdmissionGroup } from '../types';

const groupColors = {
  '가군': { bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-400', gradient: 'from-rose-500 to-pink-500' },
  '나군': { bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-400', gradient: 'from-violet-500 to-purple-500' },
  '다군': { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-400', gradient: 'from-emerald-500 to-teal-500' },
};

export function Home() {
  const [activeTab, setActiveTab] = useState<AdmissionGroup>('가군');
  const [selectedRegion, setSelectedRegion] = useState<RegionId>('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [crawlerData, setCrawlerData] = useState<CrawlerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 크롤러 데이터 로드 (지역 + 추합 매핑된 버전)
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/organized_with_chuhap.json');
      if (!response.ok) throw new Error('데이터를 불러올 수 없습니다');
      const data = await response.json();
      setCrawlerData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
      console.error('Failed to load crawler data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 지역 필터링된 데이터
  const filteredData = useMemo(() => {
    if (!crawlerData) return { 가군: [], 나군: [], 다군: [] };

    const filterByRegion = (data: CrawlerDataEntry[]) => {
      if (selectedRegion === 'all') return data;
      const regionName = getRegionName(selectedRegion);
      return data.filter(item => {
        // 새로운 지역 필드 사용 (regionMapper.js에서 생성)
        return item.지역 === regionName;
      });
    };

    return {
      가군: filterByRegion(crawlerData.가군 || []),
      나군: filterByRegion(crawlerData.나군 || []),
      다군: filterByRegion(crawlerData.다군 || []),
    };
  }, [crawlerData, selectedRegion]);

  // 현재 탭의 데이터
  const currentData = filteredData[activeTab];

  // 통계
  const stats = useMemo(() => {
    const allData = [...filteredData.가군, ...filteredData.나군, ...filteredData.다군];
    const universities = new Set(allData.map(d => d.대학명));
    return {
      total: allData.length,
      universities: universities.size,
    };
  }, [filteredData]);

  const tabs: AdmissionGroup[] = ['가군', '나군', '다군'];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black">2026 정시 경쟁률</h1>
              <p className="text-purple-200 text-sm mt-1">실시간 경쟁률 분석</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-purple-200">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{currentTime.toLocaleTimeString('ko-KR')}</span>
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-1" />
              </div>
              <button
                onClick={loadData}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                새로고침
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 군 선택 탭 (맨 위) */}
      <div className="bg-white shadow-sm sticky top-0 z-30 border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-2 py-3">
            {tabs.map(tab => {
              const count = filteredData[tab].length;
              const style = groupColors[tab];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 rounded-xl font-bold text-base transition-all ${
                    activeTab === tab
                      ? `bg-gradient-to-r ${style.gradient} text-white shadow-lg scale-105`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab}
                  <span className={`ml-2 text-sm ${activeTab === tab ? 'text-white/80' : 'text-gray-400'}`}>
                    ({count.toLocaleString()})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 지역 선택 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <RegionSelector
            selectedRegion={selectedRegion}
            onRegionChange={setSelectedRegion}
          />
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-500 font-medium">데이터를 불러오는 중...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-red-500 font-medium mb-2">오류 발생</p>
              <p className="text-gray-500 text-sm">{error}</p>
              <button
                onClick={loadData}
                className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600"
              >
                다시 시도
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 섹션 1: 대학별 경쟁률 */}
            <UniversitySection
              data={currentData}
              groupName={activeTab}
              groupColor={groupColors[activeTab]}
            />

            {/* 섹션 2: 모집단위 검색 */}
            <DepartmentSection
              data={currentData}
              groupName={activeTab}
              groupColor={groupColors[activeTab]}
            />

            {/* 섹션 3: 경쟁률 최하위 */}
            <LowestRateSection
              data={currentData}
              groupName={activeTab}
              groupColor={groupColors[activeTab]}
            />
          </div>
        )}
      </main>

      {/* 푸터 - 범례 */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-emerald-500 rounded" />
                <span className="text-gray-600">경쟁률 3:1 미만</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-amber-500 rounded" />
                <span className="text-gray-600">경쟁률 3~5:1</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-rose-500 rounded" />
                <span className="text-gray-600">경쟁률 5:1 이상</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">미달</span>
                <span className="text-gray-600">실질경쟁률 1:1 이하</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{stats.universities}개 대학 · {stats.total}개 모집단위</span>
              <a href="/crawl" className="text-purple-600 hover:text-purple-700 font-medium">
                크롤링 현황 →
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
