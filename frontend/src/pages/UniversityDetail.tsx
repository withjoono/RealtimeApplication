import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, GraduationCap } from 'lucide-react';
import { useUniversity } from '../hooks';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  PageLoading,
  EmptyState
} from '../components/ui';
import { formatNumber, formatRate, getRateBadgeClass } from '../lib/utils';

export function UniversityDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: university, isLoading, error } = useUniversity(Number(id));

  if (isLoading) {
    return <PageLoading />;
  }

  if (error || !university) {
    return (
      <EmptyState
        type="error"
        title="대학 정보를 찾을 수 없습니다"
        action={
          <Link to="/universities">
            <Button variant="outline">목록으로 돌아가기</Button>
          </Link>
        }
      />
    );
  }

  const totalDepartments = university.admissions.reduce(
    (sum, adm) => sum + adm.departments.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        to="/universities"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        대학 목록으로
      </Link>

      {/* University Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-16 h-16 bg-primary-100 rounded-xl">
          <Building2 className="w-8 h-8 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{university.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {university.region && (
              <Badge variant="default">{university.region}</Badge>
            )}
            {university.type && (
              <Badge variant="info">{university.type}</Badge>
            )}
            <span className="text-sm text-gray-500">
              {university.admissions.length}개 전형 · {totalDepartments}개 모집단위
            </span>
          </div>
        </div>
      </div>

      {/* Admissions */}
      {university.admissions.length === 0 ? (
        <EmptyState
          type="data"
          title="등록된 전형이 없습니다"
          description="아직 경쟁률 데이터가 수집되지 않았습니다"
        />
      ) : (
        university.admissions.map((admission) => (
          <Card key={admission.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-gray-400" />
                <div>
                  <CardTitle>{admission.admission_name}</CardTitle>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {admission.admission_type} · {admission.year}학년도 ·{' '}
                    {admission.departments.length}개 모집단위
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {admission.departments.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  모집단위 정보가 없습니다
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>캠퍼스</TableHead>
                      <TableHead>모집단위</TableHead>
                      <TableHead align="right">모집인원</TableHead>
                      <TableHead align="right">지원인원</TableHead>
                      <TableHead align="right">경쟁률</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admission.departments.map((dept) => (
                      <TableRow key={dept.id}>
                        <TableCell>{dept.campus || '-'}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{dept.name}</p>
                            {dept.detail && (
                              <p className="text-xs text-gray-500">{dept.detail}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(dept.recruit_count)}명
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(dept.apply_count)}명
                        </TableCell>
                        <TableCell align="right">
                          <Badge className={getRateBadgeClass(dept.competition_rate)}>
                            {formatRate(dept.competition_rate)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
