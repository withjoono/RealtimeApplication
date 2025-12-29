import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, Search } from 'lucide-react';
import { useUniversities } from '../hooks';
import {
  Card,
  CardContent,
  Input,
  PageLoading,
  EmptyState
} from '../components/ui';

export function Universities() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: universities, isLoading, error } = useUniversities();

  const filteredUniversities = universities?.filter((univ) =>
    univ.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대학별 조회</h1>
        <p className="text-gray-500 mt-1">대학을 선택하여 상세 경쟁률을 확인하세요</p>
      </div>

      {/* Search */}
      <Input
        placeholder="대학명 검색..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        leftIcon={<Search className="w-4 h-4" />}
        className="max-w-md"
      />

      {/* University List */}
      {isLoading ? (
        <PageLoading />
      ) : error ? (
        <EmptyState
          type="error"
          title="데이터를 불러올 수 없습니다"
          description="잠시 후 다시 시도해주세요"
        />
      ) : !filteredUniversities || filteredUniversities.length === 0 ? (
        <EmptyState
          type="search"
          title="대학을 찾을 수 없습니다"
          description="다른 검색어로 시도해보세요"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUniversities.map((university) => (
            <Link key={university.id} to={`/universities/${university.id}`}>
              <Card className="hover:shadow-md hover:border-primary-200 transition-all cursor-pointer">
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-primary-50 rounded-lg">
                      <Building2 className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{university.name}</p>
                      <p className="text-xs text-gray-500">
                        {university.region || '지역 정보 없음'}
                        {university.type && ` · ${university.type}`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
