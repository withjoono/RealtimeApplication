// 지역 목록 (geobukschool.kr/jungsi/a 스타일)
export const REGIONS = [
  { id: 'all', name: '전국' },
  { id: 'seoul', name: '서울' },
  { id: 'gyeonggi', name: '경기' },
  { id: 'incheon', name: '인천' },
  { id: 'daejeon', name: '대전' },
  { id: 'sejong', name: '세종' },
  { id: 'chungnam', name: '충남' },
  { id: 'chungbuk', name: '충북' },
  { id: 'gwangju', name: '광주' },
  { id: 'jeonnam', name: '전남' },
  { id: 'jeonbuk', name: '전북' },
  { id: 'daegu', name: '대구' },
  { id: 'gyeongbuk', name: '경북' },
  { id: 'gyeongnam', name: '경남' },
  { id: 'busan', name: '부산' },
  { id: 'ulsan', name: '울산' },
  { id: 'gangwon', name: '강원' },
  { id: 'jeju', name: '제주' },
] as const;

export type RegionId = 'all' | 'seoul' | 'gyeonggi' | 'incheon' | 'daejeon' | 'sejong' | 'chungnam' | 'chungbuk' | 'gwangju' | 'jeonnam' | 'jeonbuk' | 'daegu' | 'gyeongbuk' | 'gyeongnam' | 'busan' | 'ulsan' | 'gangwon' | 'jeju';

export type Region = {
  id: RegionId;
  name: string;
};

// 지역 ID를 이름으로 변환
export function getRegionName(id: RegionId): string {
  const region = REGIONS.find(r => r.id === id);
  return region ? region.name : '전국';
}

// 캠퍼스 이름에서 지역 추출하는 함수 (레거시)
export function getRegionFromCampus(campus: string): RegionId {
  if (!campus) return 'all';

  const regionMap: Record<string, RegionId> = {
    '서울': 'seoul',
    '경기': 'gyeonggi',
    '인천': 'incheon',
    '대전': 'daejeon',
    '세종': 'sejong',
    '충남': 'chungnam',
    '천안': 'chungnam',
    '충북': 'chungbuk',
    '청주': 'chungbuk',
    '광주': 'gwangju',
    '전남': 'jeonnam',
    '전북': 'jeonbuk',
    '전주': 'jeonbuk',
    '대구': 'daegu',
    '경북': 'gyeongbuk',
    '경남': 'gyeongnam',
    '창원': 'gyeongnam',
    '부산': 'busan',
    '울산': 'ulsan',
    '강원': 'gangwon',
    '원주': 'gangwon',
    '춘천': 'gangwon',
    '제주': 'jeju',
    '논산': 'chungnam',
    '양주': 'gyeonggi',
    '고양': 'gyeonggi',
  };

  for (const [keyword, regionId] of Object.entries(regionMap)) {
    if (campus.includes(keyword)) {
      return regionId;
    }
  }

  return 'all';
}
