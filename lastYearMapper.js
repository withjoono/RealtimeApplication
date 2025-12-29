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
    .replace(/\(.*?\)/g, '')  // (서울), (ERICA) 등 제거
    .replace(/^국립/, '')      // 국립 접두어 제거
    .replace(/서울캠퍼스$/, '')
    .replace(/여자대학교$/, '여대')
    .replace(/외국어대학교$/, '외대')
    .replace(/대학교$/, '')
    .replace(/대학$/, '')
    .replace(/대$/, '')
    .toLowerCase()
    .trim();
}

// 숫자 파싱 (경쟁률)
function parseRate(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value);
  const match = str.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * 과거 경쟁률 데이터에서 증가율 패턴 추출 (2022-2024)
 * @param {string} excelPath - 과거 경쟁률 데이터 Excel 경로
 * @param {string} dayColumn - 사용할 컬럼 ('3일전', '2일전', '1일전', '마감오전', '마감오후')
 */
function extractRatePatterns(excelPath, dayColumn = '3일전') {
  console.log(`\n📖 과거 경쟁률 패턴 추출 중: ${excelPath}`);
  console.log(`   기준 시점: ${dayColumn}`);

  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // 컬럼 인덱스 맵핑 (2024/2023/2022)
  const dayIndexMap = {
    '3일전': [7, 14, 21],
    '2일전': [8, 15, 22],
    '1일전': [9, 16, 23],
    '마감오전': [10, 17, 24],
    '마감오후': [11, 18, 25]
  };
  const finalIndexes = [12, 19, 26];  // 최종 컬럼

  const dayIndexes = dayIndexMap[dayColumn] || dayIndexMap['3일전'];

  const patterns = {
    exact: new Map(),      // 대학+군+모집단위 -> 증가율 배열
    group: new Map(),      // 대학+군 -> 증가율 배열
    univ: new Map(),       // 대학 -> 증가율 배열
    overall: []            // 전체 증가율
  };

  let validCount = 0;

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;

    const univ = row[0];
    const group = normalizeGroup(row[1]);
    const dept = row[4];

    if (!group) continue;

    const normUniv = normalizeUniversity(univ);
    const normDept = normalizeDepartment(dept);

    // 3개년 데이터에서 증가율 추출
    for (let y = 0; y < 3; y++) {
      const dayRate = parseRate(row[dayIndexes[y]]);
      const finalRate = parseRate(row[finalIndexes[y]]);

      if (dayRate > 0 && finalRate > 0) {
        const ratio = finalRate / dayRate;

        // 이상치 제거 (증가율 0.5 ~ 100 사이만)
        if (ratio >= 0.5 && ratio <= 100) {
          validCount++;

          // 1. 정확한 매핑
          const exactKey = `${normUniv}|${group}|${normDept}`;
          if (!patterns.exact.has(exactKey)) {
            patterns.exact.set(exactKey, []);
          }
          patterns.exact.get(exactKey).push(ratio);

          // 2. 군 매핑
          const groupKey = `${normUniv}|${group}`;
          if (!patterns.group.has(groupKey)) {
            patterns.group.set(groupKey, []);
          }
          patterns.group.get(groupKey).push(ratio);

          // 3. 대학 매핑
          if (!patterns.univ.has(normUniv)) {
            patterns.univ.set(normUniv, []);
          }
          patterns.univ.get(normUniv).push(ratio);

          // 4. 전체
          patterns.overall.push(ratio);
        }
      }
    }
  }

  // 중앙값 계산 함수
  const calcMedian = (arr) => {
    if (arr.length === 0) return 1;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const medianPatterns = {
    exact: new Map(),
    group: new Map(),
    univ: new Map(),
    overall: calcMedian(patterns.overall)
  };

  for (const [key, arr] of patterns.exact) {
    medianPatterns.exact.set(key, calcMedian(arr));
  }
  for (const [key, arr] of patterns.group) {
    medianPatterns.group.set(key, calcMedian(arr));
  }
  for (const [key, arr] of patterns.univ) {
    medianPatterns.univ.set(key, calcMedian(arr));
  }

  console.log(`✅ 증가율 패턴 추출 완료:`);
  console.log(`   - 유효 데이터: ${validCount}개`);
  console.log(`   - 정확한 매핑: ${medianPatterns.exact.size}개`);
  console.log(`   - 군 매핑: ${medianPatterns.group.size}개`);
  console.log(`   - 대학 매핑: ${medianPatterns.univ.size}개`);
  console.log(`   - 전체 중앙값 증가율: ${medianPatterns.overall.toFixed(2)}배`);

  return medianPatterns;
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
 * @param {object} crawlerData - 크롤링 데이터
 * @param {object} chuhapMapping - 추합 매핑 데이터
 * @param {object} ratePatterns - 증가율 패턴 데이터 (optional)
 */
function applyLastYearData(crawlerData, chuhapMapping, ratePatterns = null) {
  const { exactMapping, groupMapping, univMapping } = chuhapMapping;

  const result = {
    가군: [],
    나군: [],
    다군: []
  };

  let chuhapStats = { exact: 0, group: 0, univ: 0, unmatched: 0 };
  let rateStats = { exact: 0, group: 0, univ: 0, overall: 0 };

  for (const group of ['가군', '나군', '다군']) {
    const items = crawlerData[group] || [];

    for (const item of items) {
      const normUniv = normalizeUniversity(item.대학명);
      const normDept = normalizeDepartment(item.모집단위);

      // === 1. 작년 추합 매핑 ===
      let 작년추합 = 0;
      let chuhapMatchType = null;

      const exactKey = `${normUniv}|${group}|${normDept}`;
      const groupKey = `${normUniv}|${group}`;

      if (exactMapping.has(exactKey)) {
        작년추합 = exactMapping.get(exactKey);
        chuhapMatchType = 'exact';
        chuhapStats.exact++;
      } else if (groupMapping.has(groupKey)) {
        작년추합 = groupMapping.get(groupKey);
        chuhapMatchType = 'group';
        chuhapStats.group++;
      } else if (univMapping.has(normUniv)) {
        작년추합 = univMapping.get(normUniv);
        chuhapMatchType = 'univ';
        chuhapStats.univ++;
      } else {
        chuhapStats.unmatched++;
      }

      // === 2. 증가율 매핑 (예상최종경쟁 계산용) ===
      let 증가율 = ratePatterns ? ratePatterns.overall : 1;
      let rateMatchType = 'overall';

      if (ratePatterns) {
        if (ratePatterns.exact.has(exactKey)) {
          증가율 = ratePatterns.exact.get(exactKey);
          rateMatchType = 'exact';
          rateStats.exact++;
        } else if (ratePatterns.group.has(groupKey)) {
          증가율 = ratePatterns.group.get(groupKey);
          rateMatchType = 'group';
          rateStats.group++;
        } else if (ratePatterns.univ.has(normUniv)) {
          증가율 = ratePatterns.univ.get(normUniv);
          rateMatchType = 'univ';
          rateStats.univ++;
        } else {
          rateStats.overall++;
        }
      }

      // === 3. 경쟁률 계산 ===
      const 현재경쟁률 = parseRate(item.경쟁률);
      const 정원 = parseInt(item.모집인원) || 0;
      const 지원인원 = parseInt(item.지원인원) || 0;

      // 예상최종경쟁: 현재 경쟁률 × 증가율
      const 예상최종경쟁값 = 현재경쟁률 * 증가율;

      // 예상실질경쟁: 예상최종지원인원 / (정원 + 작년추합)
      const 예상최종지원 = 예상최종경쟁값 * 정원;
      const 실질분모 = 정원 + 작년추합;
      const 예상실질경쟁값 = 실질분모 > 0 ? (예상최종지원 / 실질분모) : 0;

      result[group].push({
        ...item,
        정원: 정원,
        현재경쟁률: item.경쟁률,
        작년추합: 작년추합,
        증가율: 증가율.toFixed(2),
        예상최종경쟁: 예상최종경쟁값.toFixed(2) + ' : 1',
        예상최종경쟁값: 예상최종경쟁값,
        예상실질경쟁: 예상실질경쟁값.toFixed(2),
        예상실질경쟁값: 예상실질경쟁값,
        _chuhapMatchType: chuhapMatchType,
        _rateMatchType: rateMatchType
      });
    }
  }

  console.log(`\n📊 작년 추합 매핑 결과:`);
  console.log(`   - 정확한 매핑: ${chuhapStats.exact}개`);
  console.log(`   - 군 매핑: ${chuhapStats.group}개`);
  console.log(`   - 대학 매핑: ${chuhapStats.univ}개`);
  console.log(`   - 미매칭: ${chuhapStats.unmatched}개`);

  if (ratePatterns) {
    console.log(`\n📈 증가율 매핑 결과:`);
    console.log(`   - 정확한 매핑: ${rateStats.exact}개`);
    console.log(`   - 군 매핑: ${rateStats.group}개`);
    console.log(`   - 대학 매핑: ${rateStats.univ}개`);
    console.log(`   - 전체 평균 사용: ${rateStats.overall}개`);
  }

  return result;
}

/**
 * 메인 함수
 * @param {string} dayColumn - 현재 시점 ('3일전', '2일전', '1일전', '마감오전', '마감오후')
 */
async function main(dayColumn = '3일전') {
  const lastYearExcelPath = path.join(__dirname, 'Upload', '2025정시-실제컷-정리(지원자,실질경쟁율).xlsx');
  const rateHistoryExcelPath = path.join(__dirname, 'Upload', '2022-2024 정시 실시간 경쟁율.xlsx');
  const inputDataPath = path.join(__dirname, 'output', 'organized_with_region.json');
  const outputPath = path.join(__dirname, 'output', 'organized_with_chuhap.json');

  console.log('='.repeat(60));
  console.log('🎯 2026 정시 경쟁률 예측 시스템');
  console.log(`📅 현재 시점: ${dayColumn} (${dayColumn === '3일전' ? '1일차' : dayColumn === '2일전' ? '2일차' : dayColumn === '1일전' ? '3일차' : dayColumn})`);
  console.log('='.repeat(60));

  // 1. 작년 Excel에서 추합 데이터 추출
  if (!fs.existsSync(lastYearExcelPath)) {
    console.error(`❌ Excel 파일을 찾을 수 없습니다: ${lastYearExcelPath}`);
    process.exit(1);
  }
  const chuhapMapping = extractLastYearData(lastYearExcelPath);

  // 2. 과거 경쟁률 데이터에서 증가율 패턴 추출
  let ratePatterns = null;
  if (fs.existsSync(rateHistoryExcelPath)) {
    ratePatterns = extractRatePatterns(rateHistoryExcelPath, dayColumn);
  } else {
    console.warn(`⚠️ 과거 경쟁률 파일을 찾을 수 없습니다: ${rateHistoryExcelPath}`);
    console.warn(`   증가율 예측 없이 진행합니다.`);
  }

  // 3. 지역 매핑된 크롤링 데이터 로드
  if (!fs.existsSync(inputDataPath)) {
    console.error(`❌ 입력 데이터를 찾을 수 없습니다: ${inputDataPath}`);
    process.exit(1);
  }

  console.log(`\n📖 크롤링 데이터 로드 중: ${inputDataPath}`);
  const crawlerData = JSON.parse(fs.readFileSync(inputDataPath, 'utf-8'));

  // 4. 작년 추합 + 증가율 예측 적용
  console.log('\n🔮 예상최종경쟁 계산 중...');
  const enrichedData = applyLastYearData(crawlerData, chuhapMapping, ratePatterns);

  // 5. 결과 저장
  fs.writeFileSync(outputPath, JSON.stringify(enrichedData, null, 2), 'utf-8');
  console.log(`\n💾 결과 저장: ${outputPath}`);

  // 6. 통계 출력
  console.log('\n' + '='.repeat(60));
  console.log('📊 예측 결과 통계');
  console.log('='.repeat(60));

  let totalItems = 0;
  let totalUnder1 = 0;
  let totalUnder3 = 0;

  for (const group of ['가군', '나군', '다군']) {
    const items = enrichedData[group];
    totalItems += items.length;
    const under1 = items.filter(d => d.예상실질경쟁값 <= 1).length;
    const under3 = items.filter(d => d.예상실질경쟁값 <= 3).length;
    totalUnder1 += under1;
    totalUnder3 += under3;

    const avgRate = items.length > 0
      ? items.reduce((sum, d) => sum + (parseFloat(d.증가율) || 1), 0) / items.length
      : 0;

    console.log(`   ${group}: ${items.length}개 모집단위`);
    console.log(`      - 평균 증가율: ${avgRate.toFixed(2)}배`);
    console.log(`      - 예상 미달(≤1): ${under1}개`);
    console.log(`      - 저경쟁(≤3): ${under3}개`);
  }

  console.log('\n   [전체]');
  console.log(`      - 총 모집단위: ${totalItems}개`);
  console.log(`      - 예상 미달: ${totalUnder1}개 (${(totalUnder1/totalItems*100).toFixed(1)}%)`);
  console.log(`      - 저경쟁(≤3): ${totalUnder3}개 (${(totalUnder3/totalItems*100).toFixed(1)}%)`);
  console.log('='.repeat(60));
}

// 모듈 export
module.exports = {
  extractLastYearData,
  extractRatePatterns,
  applyLastYearData,
  normalizeUniversity,
  normalizeDepartment,
  normalizeGroup,
  parseRate
};

// 직접 실행 시
if (require.main === module) {
  // CLI 인자 처리: node lastYearMapper.js [시점]
  // 시점: 3일전(1일차), 2일전(2일차), 1일전(3일차), 마감오전, 마감오후
  const args = process.argv.slice(2);
  let dayColumn = '3일전';  // 기본값: 1일차

  if (args.length > 0) {
    const dayMap = {
      '1': '3일전', '1일차': '3일전', '3일전': '3일전',
      '2': '2일전', '2일차': '2일전', '2일전': '2일전',
      '3': '1일전', '3일차': '1일전', '1일전': '1일전',
      '4': '마감오전', '마감오전': '마감오전',
      '5': '마감오후', '마감오후': '마감오후'
    };
    dayColumn = dayMap[args[0]] || '3일전';
  }

  main(dayColumn).catch(console.error);
}
