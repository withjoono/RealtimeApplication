const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * 2026 정시 디비에서 지역 매핑 정보를 추출하고
 * 크롤링 데이터에 지역 정보를 매핑하는 스크립트
 */

// 군 변환 (가 -> 가군, 나 -> 나군, 다 -> 다군)
function normalizeGroup(group) {
  if (!group) return null;
  const g = String(group).trim();
  if (g === '가' || g === '가군') return '가군';
  if (g === '나' || g === '나군') return '나군';
  if (g === '다' || g === '다군') return '다군';
  return null;
}

// 모집단위명 정규화 (특수문자, 공백 제거 등)
function normalizeDepartment(name) {
  if (!name) return '';
  return String(name)
    .replace(/\s+/g, '')  // 공백 제거
    .replace(/\[.*?\]/g, '')  // [교직] 등 제거
    .replace(/\(.*?\)/g, '')  // (전주) 등 제거
    .toLowerCase()
    .trim();
}

// 대학명 정규화
function normalizeUniversity(name) {
  if (!name) return '';
  return String(name)
    .replace(/\s+/g, '')
    .replace(/대학교$/, '')
    .replace(/대학$/, '')
    .toLowerCase()
    .trim();
}

/**
 * Excel 파일에서 지역 매핑 데이터 추출
 */
function extractRegionMapping(excelPath) {
  console.log(`📖 Excel 파일 읽는 중: ${excelPath}`);

  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // 컬럼 인덱스 찾기
  const header = data[0];
  const regionIdx = 0;  // 지역
  const univIdx = 1;    // 대학명
  const groupIdx = 3;   // 모집군
  const deptIdx = 6;    // 모집단위명

  // 매핑 데이터 구조
  // 1. 대학+군+모집단위 -> 지역 (가장 정확)
  // 2. 대학+군 -> 지역 (차선책)
  // 3. 대학 -> 지역 (최후의 수단)
  const exactMapping = new Map();      // 대학+군+모집단위 -> 지역
  const groupMapping = new Map();      // 대학+군 -> 지역
  const univMapping = new Map();       // 대학 -> 지역
  const univRegionCount = new Map();   // 대학별 지역 빈도 (가장 많은 지역 선택용)

  let rowCount = 0;

  for (let i = 2; i < data.length; i++) {  // 2행부터 데이터 시작 (0: 헤더, 1: 서브헤더)
    const row = data[i];
    if (!row || !row[univIdx]) continue;

    const region = row[regionIdx];
    const univ = row[univIdx];
    const group = normalizeGroup(row[groupIdx]);
    const dept = row[deptIdx];

    if (!region || !univ) continue;

    rowCount++;

    const normUniv = normalizeUniversity(univ);
    const normDept = normalizeDepartment(dept);

    // 1. 정확한 매핑 (대학+군+모집단위)
    if (group && dept) {
      const exactKey = `${normUniv}|${group}|${normDept}`;
      exactMapping.set(exactKey, region);
    }

    // 2. 군 매핑 (대학+군)
    if (group) {
      const groupKey = `${normUniv}|${group}`;
      groupMapping.set(groupKey, region);
    }

    // 3. 대학 매핑 (빈도 기반)
    if (!univRegionCount.has(normUniv)) {
      univRegionCount.set(normUniv, new Map());
    }
    const regionCount = univRegionCount.get(normUniv);
    regionCount.set(region, (regionCount.get(region) || 0) + 1);
  }

  // 대학별 가장 빈도 높은 지역 선택
  for (const [univ, regionCount] of univRegionCount) {
    let maxRegion = null;
    let maxCount = 0;
    for (const [region, count] of regionCount) {
      if (count > maxCount) {
        maxCount = count;
        maxRegion = region;
      }
    }
    if (maxRegion) {
      univMapping.set(univ, maxRegion);
    }
  }

  console.log(`✅ 매핑 데이터 추출 완료:`);
  console.log(`   - 총 ${rowCount}개 행 처리`);
  console.log(`   - 정확한 매핑: ${exactMapping.size}개`);
  console.log(`   - 군 매핑: ${groupMapping.size}개`);
  console.log(`   - 대학 매핑: ${univMapping.size}개`);

  return { exactMapping, groupMapping, univMapping };
}

/**
 * 크롤링 데이터에 지역 정보 매핑
 */
function applyRegionMapping(crawlerData, mapping) {
  const { exactMapping, groupMapping, univMapping } = mapping;

  const result = {
    가군: [],
    나군: [],
    다군: []
  };

  let matchedExact = 0;
  let matchedGroup = 0;
  let matchedUniv = 0;
  let unmatched = 0;

  for (const group of ['가군', '나군', '다군']) {
    const items = crawlerData[group] || [];

    for (const item of items) {
      const normUniv = normalizeUniversity(item.대학명);
      const normDept = normalizeDepartment(item.모집단위);

      let region = null;
      let matchType = null;

      // 1. 정확한 매핑 시도
      const exactKey = `${normUniv}|${group}|${normDept}`;
      if (exactMapping.has(exactKey)) {
        region = exactMapping.get(exactKey);
        matchType = 'exact';
        matchedExact++;
      }

      // 2. 군 매핑 시도
      if (!region) {
        const groupKey = `${normUniv}|${group}`;
        if (groupMapping.has(groupKey)) {
          region = groupMapping.get(groupKey);
          matchType = 'group';
          matchedGroup++;
        }
      }

      // 3. 대학 매핑 시도
      if (!region) {
        if (univMapping.has(normUniv)) {
          region = univMapping.get(normUniv);
          matchType = 'univ';
          matchedUniv++;
        }
      }

      // 4. 매핑 실패
      if (!region) {
        region = '미분류';
        unmatched++;
      }

      result[group].push({
        ...item,
        지역: region,
        _matchType: matchType  // 디버깅용
      });
    }
  }

  console.log(`\n📊 매핑 결과:`);
  console.log(`   - 정확한 매핑: ${matchedExact}개`);
  console.log(`   - 군 매핑: ${matchedGroup}개`);
  console.log(`   - 대학 매핑: ${matchedUniv}개`);
  console.log(`   - 미분류: ${unmatched}개`);

  return result;
}

/**
 * 지역별 통계 출력
 */
function printRegionStats(data) {
  const regionStats = {};

  for (const group of ['가군', '나군', '다군']) {
    for (const item of data[group] || []) {
      const region = item.지역 || '미분류';
      if (!regionStats[region]) {
        regionStats[region] = { 가군: 0, 나군: 0, 다군: 0, total: 0 };
      }
      regionStats[region][group]++;
      regionStats[region].total++;
    }
  }

  console.log('\n📍 지역별 통계:');
  console.log('─'.repeat(60));
  console.log('지역\t\t가군\t나군\t다군\t합계');
  console.log('─'.repeat(60));

  const sortedRegions = Object.keys(regionStats).sort((a, b) =>
    regionStats[b].total - regionStats[a].total
  );

  for (const region of sortedRegions) {
    const stats = regionStats[region];
    const regionPadded = region.padEnd(10, ' ');
    console.log(`${regionPadded}\t${stats.가군}\t${stats.나군}\t${stats.다군}\t${stats.total}`);
  }
  console.log('─'.repeat(60));
}

/**
 * 메인 함수
 */
async function main() {
  const excelPath = path.join(__dirname, 'Upload', '2026 정시 디비 1218 out.xlsx');
  const crawlerDataPath = path.join(__dirname, 'output', 'organized_latest.json');
  const outputPath = path.join(__dirname, 'output', 'organized_with_region.json');

  // 1. Excel에서 지역 매핑 추출
  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Excel 파일을 찾을 수 없습니다: ${excelPath}`);
    process.exit(1);
  }

  const mapping = extractRegionMapping(excelPath);

  // 2. 크롤링 데이터 로드
  if (!fs.existsSync(crawlerDataPath)) {
    console.error(`❌ 크롤링 데이터를 찾을 수 없습니다: ${crawlerDataPath}`);
    process.exit(1);
  }

  console.log(`\n📖 크롤링 데이터 로드 중: ${crawlerDataPath}`);
  const crawlerData = JSON.parse(fs.readFileSync(crawlerDataPath, 'utf-8'));

  // 3. 지역 매핑 적용
  console.log('\n🔄 지역 매핑 적용 중...');
  const mappedData = applyRegionMapping(crawlerData, mapping);

  // 4. 지역별 통계 출력
  printRegionStats(mappedData);

  // 5. 결과 저장
  fs.writeFileSync(outputPath, JSON.stringify(mappedData, null, 2), 'utf-8');
  console.log(`\n💾 결과 저장: ${outputPath}`);

  // 6. 매핑 테이블도 별도 저장 (프론트엔드용)
  const mappingTable = {};
  for (const [key, region] of mapping.univMapping) {
    mappingTable[key] = region;
  }
  const mappingPath = path.join(__dirname, 'output', 'university_region_mapping.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mappingTable, null, 2), 'utf-8');
  console.log(`💾 대학-지역 매핑 테이블 저장: ${mappingPath}`);
}

// 모듈로 사용할 수 있도록 export
module.exports = {
  extractRegionMapping,
  applyRegionMapping,
  normalizeUniversity,
  normalizeDepartment,
  normalizeGroup
};

// 직접 실행 시
if (require.main === module) {
  main().catch(console.error);
}
