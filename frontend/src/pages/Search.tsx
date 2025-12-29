import { useState } from 'react';
import { Search as SearchIcon, Filter, X } from 'lucide-react';
import { useCompetitionRates } from '../hooks';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Select,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  PageLoading,
  EmptyState
} from '../components/ui';
import { formatNumber, formatRate, getRateBadgeClass, formatDate } from '../lib/utils';
import type { SearchParams } from '../types';

export function Search() {
  const [filters, setFilters] = useState<SearchParams>({
    university_name: '',
    department_name: '',
    admission_type: '정시',
    limit: 100,
  });
  const [appliedFilters, setAppliedFilters] = useState<SearchParams>(filters);

  const { data: rates, isLoading, error } = useCompetitionRates(appliedFilters);

  const handleSearch = () => {
    setAppliedFilters({ ...filters });
  };

  const handleReset = () => {
    const reset = {
      university_name: '',
      department_name: '',
      admission_type: '정시',
      limit: 100,
    };
    setFilters(reset);
    setAppliedFilters(reset);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">경쟁률 검색</h1>
        <p className="text-gray-500 mt-1">대학, 학과별 경쟁률을 검색하세요</p>
      </div>

      {/* Search Filters */}
      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="대학명"
              placeholder="대학명 검색..."
              value={filters.university_name || ''}
              onChange={(e) => setFilters({ ...filters, university_name: e.target.value })}
              onKeyDown={handleKeyDown}
              leftIcon={<SearchIcon className="w-4 h-4" />}
            />
            <Input
              label="학과명"
              placeholder="학과명 검색..."
              value={filters.department_name || ''}
              onChange={(e) => setFilters({ ...filters, department_name: e.target.value })}
              onKeyDown={handleKeyDown}
              leftIcon={<SearchIcon className="w-4 h-4" />}
            />
            <Select
              label="전형"
              value={filters.admission_type || ''}
              onChange={(e) => setFilters({ ...filters, admission_type: e.target.value })}
              options={[
                { value: '정시', label: '정시' },
                { value: '수시', label: '수시' },
              ]}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="최소 경쟁률"
                type="number"
                placeholder="0"
                value={filters.min_rate || ''}
                onChange={(e) => setFilters({ ...filters, min_rate: e.target.value ? Number(e.target.value) : undefined })}
                onKeyDown={handleKeyDown}
              />
              <Input
                label="최대 경쟁률"
                type="number"
                placeholder="∞"
                value={filters.max_rate || ''}
                onChange={(e) => setFilters({ ...filters, max_rate: e.target.value ? Number(e.target.value) : undefined })}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={handleReset} leftIcon={<X className="w-4 h-4" />}>
              초기화
            </Button>
            <Button onClick={handleSearch} leftIcon={<Filter className="w-4 h-4" />}>
              검색
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            검색 결과
            {rates && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({formatNumber(rates.length)}건)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoading />
          ) : error ? (
            <EmptyState
              type="error"
              title="데이터를 불러올 수 없습니다"
              description="잠시 후 다시 시도해주세요"
            />
          ) : !rates || rates.length === 0 ? (
            <EmptyState
              type="search"
              title="검색 결과가 없습니다"
              description="다른 검색어로 시도해보세요"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>대학</TableHead>
                  <TableHead>전형</TableHead>
                  <TableHead>캠퍼스</TableHead>
                  <TableHead>모집단위</TableHead>
                  <TableHead align="right">모집</TableHead>
                  <TableHead align="right">지원</TableHead>
                  <TableHead align="right">경쟁률</TableHead>
                  <TableHead align="right">업데이트</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate, index) => (
                  <TableRow key={`${rate.university_code}-${rate.department_name}-${index}`}>
                    <TableCell className="font-medium">{rate.university_name}</TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-500">{rate.admission_name}</span>
                    </TableCell>
                    <TableCell>{rate.campus || '-'}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{rate.department_name}</p>
                        {rate.detail && (
                          <p className="text-xs text-gray-500">{rate.detail}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell align="right">{formatNumber(rate.recruit_count)}</TableCell>
                    <TableCell align="right">{formatNumber(rate.apply_count)}</TableCell>
                    <TableCell align="right">
                      <Badge className={getRateBadgeClass(rate.competition_rate)}>
                        {formatRate(rate.competition_rate)}
                      </Badge>
                    </TableCell>
                    <TableCell align="right" className="text-xs text-gray-500">
                      {rate.updated_at ? formatDate(rate.updated_at, 'MM.dd HH:mm') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
