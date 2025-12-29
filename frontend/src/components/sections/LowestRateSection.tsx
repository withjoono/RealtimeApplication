import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CrawlerDataEntry } from '../../types';
import { Card } from '../ui/Card';

interface LowestRateSectionProps {
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

export function LowestRateSection({ data, groupColor }: LowestRateSectionProps) {
  const [displayCount, setDisplayCount] = useState<number>(10);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // 예상실질경쟁 값으로 정렬 (낮은순)
  const lowestRateData = useMemo(() => {
    return [...data]
      .sort((a, b) => calcRealRate(a) - calcRealRate(b))
      .slice(0, displayCount);
  }, [data, displayCount]);

  // 예상실질경쟁 색상
  const getRateColor = (value: number) => {
    if (value <= 1) return 'text-red-600 bg-red-50';
    if (value < 3) return 'text-green-600 bg-green-50';
    if (value < 5) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  // 미달 여부 (예상실질경쟁 <= 1)
  const isUnfilled = (item: CrawlerDataEntry) => calcRealRate(item) <= 1;

  return (
    <Card className="mb-6">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📉</span>
            <h3 className="font-semibold text-gray-800">해당지역 경쟁률 리스트</h3>
            <span className="text-sm text-gray-500">
              (총 {data.length}개 중 {Math.min(displayCount, data.length)}개)
            </span>
          </div>

          {/* 표시 개수 선택 */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
            >
              {displayCount}개 표시
              <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                {DISPLAY_OPTIONS.map(count => (
                  <button
                    key={count}
                    onClick={() => {
                      setDisplayCount(count);
                      setIsDropdownOpen(false);
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
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        {lowestRateData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>데이터가 없습니다.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-center font-medium text-gray-600 w-10">#</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">대학명</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">캠퍼스</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">모집단위</th>
                <th className="px-3 py-3 text-center font-medium text-gray-600">정원</th>
                <th className="px-3 py-3 text-center font-medium text-gray-600">지원</th>
                <th className="px-3 py-3 text-center font-medium text-gray-600">현재경쟁률</th>
                <th className="px-3 py-3 text-center font-medium text-gray-600">예상최종경쟁</th>
                <th className="px-3 py-3 text-center font-medium text-gray-600">작년추합</th>
                <th className="px-3 py-3 text-center font-medium text-gray-600 bg-orange-50">예상실질경쟁</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lowestRateData.map((item, idx) => (
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
                  <td className="px-3 py-3 text-gray-600">{item.모집단위}</td>
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
