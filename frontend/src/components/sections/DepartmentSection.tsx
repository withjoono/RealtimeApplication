import { useState, useMemo } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import type { CrawlerDataEntry } from '../../types';
import { Card } from '../ui/Card';

interface DepartmentSectionProps {
  data: CrawlerDataEntry[];
  groupName: string;
  groupColor: {
    bg: string;
    text: string;
    border: string;
  };
}

const DISPLAY_OPTIONS = [10, 20, 50] as const;

// 예상실질경쟁 계산: 정원 * 예상최종경쟁 / (정원 + 작년추합)
function calcRealRate(item: CrawlerDataEntry): number {
  const 정원 = item.정원 ?? (parseInt(String(item.모집인원)) || 0);
  const 예상최종 = item.예상최종경쟁값 ?? 0;
  const 작년추합 = item.작년추합 ?? 0;
  const 분모 = 정원 + 작년추합;
  return 분모 > 0 ? (정원 * 예상최종) / 분모 : 0;
}

export function DepartmentSection({ data, groupColor }: DepartmentSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [displayCount, setDisplayCount] = useState<number>(10);
  const [isCountDropdownOpen, setIsCountDropdownOpen] = useState(false);

  // 모든 모집단위 목록 (중복 제거)
  const allDepartments = useMemo(() => {
    const depts = [...new Set(data.map(d => d.모집단위))];
    return depts.sort();
  }, [data]);

  // 검색어로 필터링된 모집단위 목록
  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allDepartments.filter(dept =>
      dept.toLowerCase().includes(query)
    ).slice(0, 30);
  }, [allDepartments, searchQuery]);

  // 선택된 모집단위들의 데이터 (예상실질경쟁 낮은순 정렬)
  const selectedData = useMemo(() => {
    if (selectedDepartments.length === 0) return [];
    return [...data]
      .filter(d => selectedDepartments.includes(d.모집단위))
      .sort((a, b) => calcRealRate(a) - calcRealRate(b))
      .slice(0, displayCount);
  }, [data, selectedDepartments, displayCount]);

  // 선택된 모집단위들의 전체 개수
  const totalCount = useMemo(() => {
    if (selectedDepartments.length === 0) return 0;
    return data.filter(d => selectedDepartments.includes(d.모집단위)).length;
  }, [data, selectedDepartments]);

  // 예상실질경쟁 색상
  const getRateColor = (value: number) => {
    if (value <= 1) return 'text-red-600 bg-red-50';
    if (value < 3) return 'text-green-600 bg-green-50';
    if (value < 5) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  // 미달 여부 (예상실질경쟁 <= 1)
  const isUnfilled = (item: CrawlerDataEntry) => calcRealRate(item) <= 1;

  // 모집단위 추가
  const handleAddDepartment = (dept: string) => {
    if (!selectedDepartments.includes(dept)) {
      setSelectedDepartments([...selectedDepartments, dept]);
    }
  };

  // 모집단위 제거
  const handleRemoveDepartment = (dept: string) => {
    setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
  };

  // 검색 결과 전체 추가
  const handleAddAll = () => {
    const newDepts = filteredDepartments.filter(d => !selectedDepartments.includes(d));
    setSelectedDepartments([...selectedDepartments, ...newDepts]);
    setSearchQuery('');
  };

  // 전체 제거
  const handleClearAll = () => {
    setSelectedDepartments([]);
  };

  return (
    <Card className="mb-6">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔍</span>
            <h3 className="font-semibold text-gray-800">해당지역 모집단위별 경쟁률</h3>
            {selectedDepartments.length > 0 && (
              <span className="text-sm text-gray-500">
                ({selectedDepartments.length}개 모집단위 · 총 {totalCount}개 중 {Math.min(displayCount, totalCount)}개)
              </span>
            )}
          </div>

          {/* 표시 개수 선택 */}
          {selectedDepartments.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setIsCountDropdownOpen(!isCountDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                {displayCount}개 표시
                <ChevronDown size={14} className={`transition-transform ${isCountDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCountDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  {DISPLAY_OPTIONS.map(count => (
                    <button
                      key={count}
                      onClick={() => {
                        setDisplayCount(count);
                        setIsCountDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors
                        ${displayCount === count ? `${groupColor.bg} ${groupColor.text}` : 'text-gray-700'}`}
                    >
                      {count}개
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 검색 입력 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="모집단위명을 입력하세요 (예: 의, 간호, 컴퓨터...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>

        {/* 검색 결과: 모집단위 태그들 */}
        {searchQuery && filteredDepartments.length > 0 && (
          <div className="mt-4 text-center">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              검색 할 학과 (총 {filteredDepartments.length}개)
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {filteredDepartments.map(dept => {
                const isSelected = selectedDepartments.includes(dept);
                return (
                  <button
                    key={dept}
                    onClick={() => isSelected ? handleRemoveDepartment(dept) : handleAddDepartment(dept)}
                    className={`px-3 py-1.5 rounded-full text-sm border-2 transition-colors
                      ${isSelected
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-orange-500 border-orange-500 hover:bg-orange-50'}`}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleAddAll}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              전체선택
            </button>
          </div>
        )}

        {/* 검색 안내 */}
        {searchQuery && filteredDepartments.length === 0 && (
          <p className="mt-4 text-center text-sm text-gray-500">
            "{searchQuery}"에 해당하는 모집단위가 없습니다.
          </p>
        )}

        {/* 선택된 모집단위 태그 (검색어 없을 때만 표시) */}
        {!searchQuery && selectedDepartments.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">선택된 모집단위</p>
            <div className="flex flex-wrap gap-2">
              {selectedDepartments.map(dept => (
                <span
                  key={dept}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-orange-500 text-white"
                >
                  {dept}
                  <button
                    onClick={() => handleRemoveDepartment(dept)}
                    className="hover:bg-white/20 rounded-full p-0.5"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              <button
                onClick={handleClearAll}
                className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                전체 삭제
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 결과 테이블 */}
      <div className="overflow-x-auto">
        {selectedDepartments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>모집단위명을 검색하고 선택하면 해당 학과를 모집하는 모든 대학의 경쟁률을 비교할 수 있습니다.</p>
          </div>
        ) : selectedData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>선택한 모집단위에 해당하는 데이터가 없습니다.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-center font-medium text-gray-600 w-10">#</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">대학명</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">캠퍼스</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">전형명</th>
                <th className="px-3 py-3 text-center font-medium text-gray-600">정원</th>
                <th className="px-3 py-3 text-center font-medium text-gray-600">지원</th>
                <th className="px-3 py-3 text-center font-medium text-gray-600">현재경쟁률</th>
                <th className="px-3 py-3 text-center font-medium text-gray-600">예상최종경쟁</th>
                <th className="px-3 py-3 text-center font-medium text-gray-600">작년추합</th>
                <th className="px-3 py-3 text-center font-medium text-gray-600 bg-orange-50">예상실질경쟁</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {selectedData.map((item, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-gray-50 ${isUnfilled(item) ? 'bg-red-50/50' : ''}`}
                >
                  <td className="px-3 py-3 text-center font-medium text-gray-500">{idx + 1}</td>
                  <td className="px-3 py-3 font-medium text-gray-800">
                    {item.대학명}
                    {isUnfilled(item) && (
                      <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded font-medium">
                        미달
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-600 text-xs">{item.캠퍼스 || '-'}</td>
                  <td className="px-3 py-3 text-gray-600 text-xs">{item.전형명}</td>
                  <td className="px-3 py-3 text-center text-gray-600">{item.정원 ?? item.모집인원}</td>
                  <td className="px-3 py-3 text-center text-gray-600">{item.지원인원}</td>
                  <td className="px-3 py-3 text-center text-gray-600">{item.현재경쟁률 ?? item.경쟁률}</td>
                  <td className="px-3 py-3 text-center text-gray-600">{item.예상최종경쟁 ?? '-'}</td>
                  <td className="px-3 py-3 text-center text-gray-600">{item.작년추합 ?? '-'}</td>
                  <td className="px-3 py-3 text-center bg-orange-50/50">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRateColor(calcRealRate(item))}`}>
                      {calcRealRate(item).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
