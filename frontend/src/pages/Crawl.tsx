import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Play,
  Pause,
  Loader2,
  Wifi,
  WifiOff,
  List,
  Activity,
  ArrowLeft,
} from 'lucide-react';
import {
  useCrawlStatus,
  useCrawlLogs,
  useCheckAvailability,
  useCrawlProgress,
  useSmartRatioCrawlAll,
  useSmartRatioUniversities,
} from '../hooks';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageLoading,
  EmptyState,
} from '../components/ui';
import { formatDate, formatRelativeTime } from '../lib/utils';

export function Crawl() {
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { data: status, isLoading: statusLoading } = useCrawlStatus();
  const { data: logs, isLoading: logsLoading } = useCrawlLogs({ limit: 30 });
  const { data: availability, refetch: refetchAvailability } = useCheckAvailability();
  const { data: progress } = useCrawlProgress(isMonitoring);
  const { data: universities } = useSmartRatioUniversities();
  const smartRatioCrawl = useSmartRatioCrawlAll();

  // Auto-start monitoring when crawl starts
  useEffect(() => {
    if (progress?.is_running) {
      setIsMonitoring(true);
    } else if (isMonitoring && progress && !progress.is_running) {
      // Crawl finished
      setIsMonitoring(false);
    }
  }, [progress?.is_running, isMonitoring]);

  const handleStartCrawl = () => {
    if (confirm('SmartRatio 페이지에서 전체 대학 크롤링을 시작하시겠습니까?')) {
      smartRatioCrawl.mutate({ admissionType: '정시', year: 2026 });
      setIsMonitoring(true);
    }
  };

  const handleCheckAvailability = () => {
    refetchAvailability();
  };

  const getStatusIcon = (statusStr: string) => {
    switch (statusStr) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case 'success':
        return <Badge variant="success">성공</Badge>;
      case 'failed':
        return <Badge variant="danger">실패</Badge>;
      case 'skipped':
        return <Badge variant="warning">스킵</Badge>;
      default:
        return <Badge variant="default">{statusStr}</Badge>;
    }
  };

  const getUnivStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case '접수중':
        return <Badge variant="success">접수중</Badge>;
      case '준비중':
        return <Badge variant="warning">준비중</Badge>;
      case '접수예정':
        return <Badge variant="info">접수예정</Badge>;
      case '마감':
        return <Badge variant="danger">마감</Badge>;
      default:
        return <Badge variant="default">{statusStr}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>홈으로</span>
            </Link>
            <div className="h-6 w-px bg-gray-300" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">크롤링 현황</h1>
              <p className="text-sm text-gray-500">진학사 SmartRatio 경쟁률 데이터 수집</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Availability Check Card */}
      <Card className={availability?.is_open ? 'border-green-500 border-2' : 'border-orange-300 border-2'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {availability?.is_open ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-orange-500" />
            )}
            정시 경쟁률 페이지 상태
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">
                {availability?.is_open ? (
                  <span className="text-green-600">페이지 오픈됨!</span>
                ) : (
                  <span className="text-orange-600">아직 준비 중</span>
                )}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {availability?.message}
              </p>
              {availability?.checked_at && (
                <p className="text-xs text-gray-400 mt-1">
                  마지막 확인: {formatDate(availability.checked_at, 'MM.dd HH:mm:ss')}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCheckAvailability}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                다시 확인
              </Button>
              {availability?.is_open && (
                <Button
                  onClick={handleStartCrawl}
                  isLoading={smartRatioCrawl.isPending}
                  leftIcon={<Play className="w-4 h-4" />}
                  variant="primary"
                >
                  크롤링 시작
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Card (shown when crawling) */}
      {(progress?.is_running || isMonitoring) && progress && (
        <Card className="border-blue-500 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
              크롤링 진행 중
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>진행률</span>
                  <span>{progress.progress} / {progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                    style={{
                      width: `${progress.total > 0 ? (progress.progress / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Current University */}
              {progress.current_university && (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span>현재: <strong>{progress.current_university}</strong></span>
                </div>
              )}

              {/* Results Summary */}
              <div className="flex gap-4 text-sm">
                <span className="text-green-600">
                  성공: {progress.results.success}
                </span>
                <span className="text-red-600">
                  실패: {progress.results.failed}
                </span>
                <span className="text-yellow-600">
                  스킵: {progress.results.skipped}
                </span>
              </div>

              {/* Recent Logs */}
              {progress.recent_logs.length > 0 && (
                <div className="bg-gray-900 text-gray-100 rounded-lg p-3 font-mono text-xs max-h-40 overflow-y-auto">
                  {progress.recent_logs.map((log, index) => (
                    <div key={index} className="py-0.5">
                      {log}
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMonitoring(!isMonitoring)}
                leftIcon={isMonitoring ? <Pause className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
              >
                {isMonitoring ? '모니터링 중지' : '모니터링 시작'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Cards */}
      {statusLoading ? (
        <PageLoading />
      ) : (
        status && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent>
                <div className="flex items-center gap-3">
                  {getStatusIcon(status.status)}
                  <div>
                    <p className="text-sm text-gray-500">상태</p>
                    <p className="font-medium capitalize">{status.status}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div>
                  <p className="text-sm text-gray-500">마지막 크롤링</p>
                  <p className="font-medium">
                    {status.last_crawled_at
                      ? formatRelativeTime(status.last_crawled_at)
                      : '기록 없음'}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div>
                  <p className="text-sm text-gray-500">수집된 대학</p>
                  <p className="font-medium">{status.total_universities}개</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div>
                  <p className="text-sm text-gray-500">수집된 모집단위</p>
                  <p className="font-medium">{status.total_departments}개</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      )}

      {/* University List from SmartRatio */}
      {universities && universities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="w-5 h-5" />
              SmartRatio 대학 목록 ({universities.length}개)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>지역</TableHead>
                    <TableHead>대학명</TableHead>
                    <TableHead>구분</TableHead>
                    <TableHead>기간</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {universities.slice(0, 20).map((univ, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-sm">{univ.region || '-'}</TableCell>
                      <TableCell className="font-medium">{univ.name}</TableCell>
                      <TableCell className="text-sm">{univ.admission_type}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {univ.period_start && univ.period_end
                          ? `${univ.period_start} ~ ${univ.period_end}`
                          : '-'}
                      </TableCell>
                      <TableCell>{getUnivStatusBadge(univ.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {universities.length > 20 && (
              <div className="p-3 text-center text-sm text-gray-500 border-t">
                외 {universities.length - 20}개 대학...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Crawl Logs */}
      <Card>
        <CardHeader>
          <CardTitle>크롤링 로그</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logsLoading ? (
            <PageLoading />
          ) : !logs || logs.length === 0 ? (
            <EmptyState type="data" title="크롤링 로그가 없습니다" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">상태</TableHead>
                  <TableHead>대학 코드</TableHead>
                  <TableHead>메시지</TableHead>
                  <TableHead align="right">소요시간</TableHead>
                  <TableHead align="right">시간</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.university_code || '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-gray-600">
                      {log.message}
                    </TableCell>
                    <TableCell align="right" className="text-sm">
                      {log.duration_seconds
                        ? `${log.duration_seconds.toFixed(2)}s`
                        : '-'}
                    </TableCell>
                    <TableCell align="right" className="text-sm text-gray-500">
                      {formatDate(log.crawled_at, 'MM.dd HH:mm:ss')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        </Card>
      </main>
    </div>
  );
}
