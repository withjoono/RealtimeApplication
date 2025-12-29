import { Link } from 'react-router-dom';
import { BarChart3, RefreshCw } from 'lucide-react';
import { useCrawlStatus } from '../../hooks';
import { formatRelativeTime } from '../../lib/utils';
import { Badge } from '../ui';

export function Header() {
  const { data: crawlStatus } = useCrawlStatus();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 bg-primary-600 rounded-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">실시간 경쟁률</h1>
              <p className="text-xs text-gray-500">2026학년도 정시</p>
            </div>
          </Link>

          {/* Status */}
          <div className="flex items-center gap-4">
            {crawlStatus && (
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">
                  {crawlStatus.last_crawled_at
                    ? `${formatRelativeTime(crawlStatus.last_crawled_at)} 업데이트`
                    : '업데이트 정보 없음'}
                </span>
                <Badge
                  variant={crawlStatus.status === 'success' ? 'success' : 'warning'}
                >
                  {crawlStatus.status === 'success' ? '정상' : crawlStatus.status}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
