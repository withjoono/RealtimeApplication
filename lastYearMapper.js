const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * 2025 정시 실제컷 데이터에서 작년 추합 정보를 추출하고
 * 크롤링 데이터에 매핑하는 스크립트
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

// 모집단위명 정규화
function normalizeDepartment(name) {
  if (!name) return '';
  return String(name)
    .replace(/\s+/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
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
 * Excel 파일에서 작년 추합 데이터 추출
 */
function extractLastYearData(excelPath) {
  console.log(`📖 Excel 파일 읽는 중: ${excelPath}`);

  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]]; // 2025_전체 시트
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // 컬럼 인덱스 (헤더 행 0 기준)
  const univIdx = 1;      // 대학명
  const groupIdx = 2;     // 구분 (군)
  const deptIdx = 3;      // 모집단위
  const recruitIdx = 4;   // 모집인원(최종)
  const rateIdx = 5;      // 경쟁률
  const chuhapIdx = 6;    // 충원합격순위 (작년추합)

  // 매핑 데이터 구조
  const exactMapping = new Map();   // 대학+군+모집단위 -> 작년추합
  const groupMapping = new Map();   // 대학+군 -> 평균 작년추합
  const univMapping = new Map();    // 대학 -> 평균 작년추합

  const groupChuhapSum = new Map();
  const univChuhapSum = new Map();

  let rowCount = 0;

  for (let i = 3; i < data.length; i++) {  // 3행부터 데이터 시작
    const row = data[i];
    if (!row || !row[univIdx]) continue;

    const univ = row[univIdx];
    const group = normalizeGroup(row[groupIdx]);
    const dept = row[deptIdx];
    const chuhap = row[chuhapIdx];

    if (!univ || !group) continue;

    rowCount++;

    const normUniv = normalizeUniversity(univ);
    const normDept = normalizeDepartment(dept);
    const chuhapNum = typeof chuhap === 'number' ? chuhap : (parseInt(chuhap) || 0);

    // 1. 정확한 매핑 (대학+군+모집단위)
    if (dept) {
      const exactKey = `${normUniv}|${group}|${normDept}`;
      exactMapping.set(exactKey, chuhapNum);
    }

    // 2. 군 매핑 (대학+군) - 평균 계산용
    const groupKey = `${normUniv}|${group}`;
    if (!groupChuhapSum.has(groupKey)) {
      groupChuhapSum.set(groupKey, { sum: 0, count: 0 });
    }
    const gs = groupChuhapSum.get(groupKey);
    gs.sum += chuhapNum;
    gs.count += 1;

    // 3. 대학 매핑 - 평균 계산용
    if (!univChuhapSum.has(normUniv)) {
      univChuhapSum.set(normUniv, { sum: 0, count: 0 });
    }
    const us = univChuhapSum.get(normUniv);
    us.sum += chuhapNum;
    us.count += 1;
  }

  // 평균 계산
  for (const [key, val] of groupChuhapSum) {
    groupMapping.set(key, Math.round(val.sum / val.count));
  }
  for (const [key, val] of univChuhapSum) {
    univMapping.set(key, Math.round(val.sum / val.count));
  }

  console.log(`✅ 작년 추합 데이터 추출 완료:`);
  console.log(`   - 총 ${rowCount}개 행 처리`);
  console.log(`   - 정확한 매핑: ${exactMapping.size}개`);
  console.log(`   - 군 매핑: ${groupMapping.size}개`);
  console.log(`   - 대학 매핑: ${univMapping.size}개`);

  return { exactMapping, groupMapping, univMapping };
}

/**
 * 크롤링 데이터에 작년 추합 및 예상 경쟁률 정보 추가
 */
function applyLastYearData(crawlerData, mapping) {
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

      let 작년추합 = 0;
      let matchType = null;

      // 1. 정확한 매핑 시도
      const exactKey = `${normUniv}|${group}|${normDept}`;
      if (exactMapping.has(exactKey)) {
        작년추합 = exactMapping.get(exactKey);
        matchType = 'exact';
        matchedExact++;
      }

      // 2. 군 매핑 시도
      if (matchType === null) {
        const groupKey = `${normUniv}|${group}`;
        if (groupMapping.has(groupKey)) {
          작년추합 = groupMapping.get(groupKey);
          matchType = 'group';
          matchedGroup++;
        }
      }

      // 3. 대학 매핑 시도
      if (matchType === null) {
        if (univMapping.has(normUniv)) {
          작년추합 = univMapping.get(normUniv);
          matchType = 'univ';
          matchedUniv++;
        }
      }

      // 4. 매핑 실패
      if (matchType === null) {
        unmatched++;
      }

      // 경쟁률 파싱
      const parseRate = (rate) => {
        const match = String(rate).match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : 0;
      };

      const 현재경쟁률 = parseRate(item.경쟁률);
      const 정원 = parseInt(item.모집인원) || 0;
      const 지원인원 = parseInt(item.지원인원) || 0;

      // 예상최종경쟁: 현재 경쟁률의 약 1.5배 추정 (마감 전이므로)
      // 또는 현재가 마감 후라면 현재경쟁률 그대로
      const 예상최종경쟁 = 현재경쟁률;  // 일단 현재값 사용 (마감 시점에 따라 조정 가능)

      // 예상실질경쟁: 지원인원 / (정원 + 작년추합)
      const 실질분모 = 정원 + 작년추합;
      const 예상실질경쟁 = 실질분모 > 0 ? (지원인원 / 실질분모) : 0;

      result[group].push({
        ...item,
        정원: 정원,
        현재경쟁률: item.경쟁률,  // 원본 형식 유지
        작년추합: 작년추합,
        예상최종경쟁: 예상최종경쟁.toFixed(2) + ' : 1',
        예상실질경쟁: 예상실질경쟁.toFixed(2),
        예상실질경쟁값: 예상실질경쟁,  // 정렬용 숫자값
        _chuhapMatchType: matchType
      });
    }
  }

  console.log(`\n📊 작년 추합 매핑 결과:`);
  console.log(`   - 정확한 매핑: ${matchedExact}개`);
  console.log(`   - 군 매핑: ${matchedGroup}개`);
  console.log(`   - 대학 매핑: ${matchedUniv}개`);
  console.log(`   - 미매칭: ${unmatched}개`);

  return result;
}

/**
 * 메인 함수
 */
async function main() {
  const lastYearExcelPath = path.join(__dirname, 'Upload', '2025정시-실제컷-정리(지원자,실질경쟁율).xlsx');
  const inputDataPath = path.join(__dirname, 'output', 'organized_with_region.json');
  const outputPath = path.join(__dirname, 'output', 'organized_with_chuhap.json');

  // 1. 작년 Excel에서 추합 데이터 추출
  if (!fs.existsSync(lastYearExcelPath)) {
    console.error(`❌ Excel 파일을 찾을 수 없습니다: ${lastYearExcelPath}`);
    process.exit(1);
  }

  const lastYearMapping = extractLastYearData(lastYearExcelPath);

  // 2. 지역 매핑된 크롤링 데이터 로드
  if (!fs.existsSync(inputDataPath)) {
    console.error(`❌ 입력 데이터를 찾을 수 없습니다: ${inputDataPath}`);
    process.exit(1);
  }

  console.log(`\n📖 크롤링 데이터 로드 중: ${inputDataPath}`);
  const crawlerData = JSON.parse(fs.readFileSync(inputDataPath, 'utf-8'));

  // 3. 작년 추합 데이터 적용
  console.log('\n🔄 작년 추합 데이터 적용 중...');
  const enrichedData = applyLastYearData(crawlerData, lastYearMapping);

  // 4. 결과 저장
  fs.writeFileSync(outputPath, JSON.stringify(enrichedData, null, 2), 'utf-8');
  console.log(`\n💾 결과 저장: ${outputPath}`);

  // 5. 통계 출력
  let totalUnder1 = 0;
  for (const group of ['가군', '나군', '다군']) {
    const under1 = enrichedData[group].filter(d => d.예상실질경쟁값 <= 1).length;
    totalUnder1 += under1;
    console.log(`   ${group}: 예상실질경쟁 1 이하 = ${under1}개`);
  }
  console.log(`   총 미달 예상: ${totalUnder1}개`);
}

// 모듈 export
module.exports = {
  extractLastYearData,
  applyLastYearData,
  normalizeUniversity,
  normalizeDepartment,
  normalizeGroup
};

// 직접 실행 시
if (require.main === module) {
  main().catch(console.error);
}
