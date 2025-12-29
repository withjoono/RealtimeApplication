import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { useTopCompetition } from '../hooks';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Select,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageLoading,
  EmptyState
} from '../components/ui';
import { formatNumber, formatRate, getRateBadgeClass, cn } from '../lib/utils';

export function Ranking() {
  const [limit, setLimit] = useState(50);
  const { data: rankings, isLoading, error } = useTopCompetition({
    admission_type: '정시',
    limit
  });

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">경쟁률 순위</h1>
          <p className="text-gray-500 mt-1">2026학년도 정시 경쟁률 TOP {limit}</p>
        </div>
        <Select
          value={String(limit)}
          onChange={(e) => setLimit(Number(e.target.value))}
          options={[
            { value: '20', label: 'TOP 20' },
            { value: '50', label: 'TOP 50' },
            { value: '100', label: 'TOP 100' },
          ]}
          className="w-32"
        />
      </div>

      {/* Ranking Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <CardTitle>경쟁률 순위</CardTitle>
          </div>
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
          ) : !rankings || rankings.length === 0 ? (
            <EmptyState
              type="data"
              title="순위 데이터가 없습니다"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16" align="center">순위</TableHead>
                  <TableHead>대학</TableHead>
                  <TableHead>전형</TableHead>
                  <TableHead>모집단위</TableHead>
                  <TableHead align="right">모집</TableHead>
                  <TableHead align="right">지원</TableHead>
                  <TableHead align="right">경쟁률</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.map((item, index) => {
                  const rank = index + 1;
                  return (
                    <TableRow
                      key={`${item.university_name}-${item.department_name}-${index}`}
                      className={cn(
                        rank <= 3 && 'bg-yellow-50/50'
                      )}
                    >
                      <TableCell align="center">
                        <span className={cn(
                          'inline-flex items-center justify-center w-8 h-8 rounded-full font-bold',
                          rank === 1 && 'bg-yellow-100 text-yellow-700',
                          rank === 2 && 'bg-gray-100 text-gray-700',
                          rank === 3 && 'bg-orange-100 text-orange-700',
                          rank > 3 && 'text-gray-500'
                        )}>
                          {getRankBadge(rank)}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.university_name}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {item.admission_name}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.department_name}
                      </TableCell>
                      <TableCell align="right">
                        {formatNumber(item.recruit_count)}명
                      </TableCell>
                      <TableCell align="right">
                        {formatNumber(item.apply_count)}명
                      </TableCell>
                      <TableCell align="right">
                        <Badge className={cn(
                          getRateBadgeClass(item.competition_rate),
                          'text-sm font-bold'
                        )}>
                          {formatRate(item.competition_rate)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
