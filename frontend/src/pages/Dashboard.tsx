import {
  Building2,
  GraduationCap,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStatisticsSummary, useTopCompetition } from '../hooks';
import { Card, CardHeader, CardTitle, CardContent, PageLoading } from '../components/ui';
import { formatNumber, formatRate, getRateColorClass, formatRelativeTime } from '../lib/utils';

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStatisticsSummary('정시');
  const { data: topRates, isLoading: topLoading } = useTopCompetition({
    admission_type: '정시',
    limit: 10
  });

  if (statsLoading) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 mt-1">2026학년도 정시 경쟁률 현황</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="대학 수"
          value={formatNumber(stats?.university_count || 0)}
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="모집단위 수"
          value={formatNumber(stats?.department_count || 0)}
          icon={GraduationCap}
          color="green"
        />
        <StatCard
          title="평균 경쟁률"
          value={formatRate(stats?.average_competition_rate || 0)}
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          title="마지막 업데이트"
          value={stats?.last_crawled_at ? formatRelativeTime(stats.last_crawled_at) : '-'}
          icon={Clock}
          color="orange"
        />
      </div>

      {/* Rate Range */}
      <Card>
        <CardHeader>
          <CardTitle>경쟁률 범위</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                <ArrowDownRight className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">최저 경쟁률</p>
                <p className="text-xl font-bold text-green-600">
                  {formatRate(stats?.min_competition_rate || 0)}
                </p>
              </div>
            </div>
            <div className="h-12 w-px bg-gray-200" />
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full">
                <ArrowUpRight className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">최고 경쟁률</p>
                <p className="text-xl font-bold text-red-600">
                  {formatRate(stats?.max_competition_rate || 0)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Competition Rates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>경쟁률 TOP 10</CardTitle>
          <Link
            to="/ranking"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            전체보기 →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {topLoading ? (
            <div className="p-6 text-center text-gray-500">로딩 중...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {topRates?.map((item, index) => (
                <div
                  key={`${item.university_name}-${item.department_name}-${index}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex items-center justify-center w-6 h-6 text-xs font-bold text-gray-500 bg-gray-100 rounded-full">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{item.department_name}</p>
                      <p className="text-sm text-gray-500">
                        {item.university_name} · {item.admission_name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${getRateColorClass(item.competition_rate)}`}>
                      {formatRate(item.competition_rate)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatNumber(item.apply_count)} / {formatNumber(item.recruit_count)}명
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
};

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
