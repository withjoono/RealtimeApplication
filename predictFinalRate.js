const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * 2022-2024 실시간 경쟁률 데이터를 분석하여
 * 3일전 경쟁률 → 최종 경쟁률 증가율을 계산하고
 * 올해 데이터에 적용하는 스크립트
 */

// 대학명 정규화 (가야대, 가야대학, 가야대학교 -> 가야)
function normalizeUniversity(name) {
  if (!name) return '';
  return String(name)
    .replace(/\s+/g, '')
    .replace(/\(.*?\)/g, '')  // (서울), (ERICA) 등 제거
    .replace(/^국립/, '')      // 국립 접두어 제거
    .replace(/서울캠퍼스$/, '')
    .replace(/여자대학교$/, '여대')  // 여자대학교 -> 여대
    .replace(/외국어대학교$/, '외대')  // 외국어대학교 -> 외대
    .replace(/대학교$/, '')
    .replace(/대학$/, '')
    .replace(/대$/, '')  // "가야대" -> "가야"
    .toLowerCase()
    .trim();
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

// 군 정규화
function normalizeGroup(group) {
  if (!group) return null;
  const g = String(group).trim();
  if (g === '가' || g === '가군') return '가군';
  if (g === '나' || g === '나군') return '나군';
  if (g === '다' || g === '다군') return '다군';
  return null;
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
 * 과거 데이터에서 증가율 패턴 추출
 */
function extractRatePatterns(excelPath) {
  console.log(`📖 과거 경쟁률 데이터 읽는 중: ${excelPath}`);

  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // 컬럼 인덱스 (헤더 행 1 기준)
  // 2024: 모집인원(6), 3일전(7), 2일전(8), 1일전(9), 마감오전(10), 마감오후(11), 최종(12)
  // 2023: 모집인원(13), 3일전(14), ... 최종(19)
  // 2022: 모집인원(20), 3일전(21), ... 최종(26)

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
    const yearData = [
      { threeDaysBefore: parseRate(row[7]), final: parseRate(row[12]) },   // 2024
      { threeDaysBefore: parseRate(row[14]), final: parseRate(row[19]) },  // 2023
      { threeDaysBefore: parseRate(row[21]), final: parseRate(row[26]) },  // 2022
    ];

    for (const yd of yearData) {
      // 유효한 데이터만 사용 (3일전 > 0, 최종 > 0)
      if (yd.threeDaysBefore > 0 && yd.final > 0) {
        const ratio = yd.final / yd.threeDaysBefore;

        // 이상치 제거 (증가율 0.5 ~ 20 사이만)
        if (ratio >= 0.5 && ratio <= 20) {
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

  // 평균 계산
  const calcAvg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const avgPatterns = {
    exact: new Map(),
    group: new Map(),
    univ: new Map(),
    overall: calcAvg(patterns.overall)
  };

  for (const [key, arr] of patterns.exact) {
    avgPatterns.exact.set(key, calcAvg(arr));
  }
  for (const [key, arr] of patterns.group) {
    avgPatterns.group.set(key, calcAvg(arr));
  }
  for (const [key, arr] of patterns.univ) {
    avgPatterns.univ.set(key, calcAvg(arr));
  }

  console.log(`✅ 증가율 패턴 추출 완료:`);
  console.log(`   - 유효 데이터: ${validCount}개`);
  console.log(`   - 정확한 매핑: ${avgPatterns.exact.size}개`);
  console.log(`   - 군 매핑: ${avgPatterns.group.size}개`);
  console.log(`   - 대학 매핑: ${avgPatterns.univ.size}개`);
  console.log(`   - 전체 평균 증가율: ${avgPatterns.overall.toFixed(2)}배`);

  return avgPatterns;
}

/**
 * 크롤링 데이터에 예상최종경쟁 적용
 */
function applyPrediction(crawlerData, patterns) {
  const result = {
    가군: [],
    나군: [],
    다군: []
  };

  let matchedExact = 0;
  let matchedGroup = 0;
  let matchedUniv = 0;
  let unmatched = 0;
  const unmatchedUnivs = new Set();

  for (const group of ['가군', '나군', '다군']) {
    const items = crawlerData[group] || [];

    for (const item of items) {
      const normUniv = normalizeUniversity(item.대학명);
      const normDept = normalizeDepartment(item.모집단위);

      let ratio = null;
      let matchType = null;

      // 1. 정확한 매핑 시도
      const exactKey = `${normUniv}|${group}|${normDept}`;
      if (patterns.exact.has(exactKey)) {
        ratio = patterns.exact.get(exactKey);
        matchType = 'exact';
        matchedExact++;
      }

      // 2. 군 매핑 시도
      if (ratio === null) {
        const groupKey = `${normUniv}|${group}`;
        if (patterns.group.has(groupKey)) {
          ratio = patterns.group.get(groupKey);
          matchType = 'group';
          matchedGroup++;
        }
      }

      // 3. 대학 매핑 시도
      if (ratio === null) {
        if (patterns.univ.has(normUniv)) {
          ratio = patterns.univ.get(normUniv);
          matchType = 'univ';
          matchedUniv++;
        }
      }

      // 4. 전체 평균 사용
      if (ratio === null) {
        ratio = patterns.overall;
        matchType = 'overall';
        unmatched++;
        unmatchedUnivs.add(item.대학명);
      }

      // 현재 경쟁률 파싱
      const currentRate = parseRate(item.현재경쟁률 || item.경쟁률);

      // 예상최종경쟁 계산
      const predictedFinal = currentRate * ratio;

      // 예상실질경쟁 재계산
      const 정원 = item.정원 || parseInt(item.모집인원) || 0;
      const 작년추합 = item.작년추합 || 0;
      const 예상지원 = predictedFinal * 정원;
      const 예상실질분모 = 정원 + 작년추합;
      const 예상실질경쟁 = 예상실질분모 > 0 ? (예상지원 / 예상실질분모) : 0;

      result[group].push({
        ...item,
        예상최종경쟁: predictedFinal.toFixed(2) + ' : 1',
        예상최종경쟁값: predictedFinal,
        예상실질경쟁: 예상실질경쟁.toFixed(2),
        예상실질경쟁값: 예상실질경쟁,
        증가율: ratio.toFixed(2),
        _predictionType: matchType
      });
    }
  }

  console.log(`\n📊 예측 매핑 결과:`);
  console.log(`   - 정확한 매핑: ${matchedExact}개`);
  console.log(`   - 군 매핑: ${matchedGroup}개`);
  console.log(`   - 대학 매핑: ${matchedUniv}개`);
  console.log(`   - 전체 평균 사용: ${unmatched}개`);

  if (unmatchedUnivs.size > 0) {
    console.log(`\n⚠️ 매칭되지 않은 대학 (${unmatchedUnivs.size}개):`);
    const sorted = [...unmatchedUnivs].sort();
    sorted.forEach(u => console.log(`   - ${u}`));
  }

  return result;
}

/**
 * 메인 함수
 */
async function main() {
  const historyExcelPath = path.join(__dirname, 'Upload', '2022-2024 정시 실시간 경쟁율.xlsx');
  const inputDataPath = path.join(__dirname, 'output', 'organized_with_chuhap.json');
  const outputPath = path.join(__dirname, 'output', 'organized_with_prediction.json');

  // 1. 과거 데이터에서 증가율 패턴 추출
  if (!fs.existsSync(historyExcelPath)) {
    console.error(`❌ 과거 데이터 파일을 찾을 수 없습니다: ${historyExcelPath}`);
    process.exit(1);
  }

  const patterns = extractRatePatterns(historyExcelPath);

  // 2. 현재 크롤링 데이터 로드
  if (!fs.existsSync(inputDataPath)) {
    console.error(`❌ 크롤링 데이터를 찾을 수 없습니다: ${inputDataPath}`);
    process.exit(1);
  }

  console.log(`\n📖 크롤링 데이터 로드 중: ${inputDataPath}`);
  const crawlerData = JSON.parse(fs.readFileSync(inputDataPath, 'utf-8'));

  // 3. 예측 적용
  console.log('\n🔮 예상최종경쟁 계산 중...');
  const predictedData = applyPrediction(crawlerData, patterns);

  // 4. 결과 저장
  fs.writeFileSync(outputPath, JSON.stringify(predictedData, null, 2), 'utf-8');
  console.log(`\n💾 결과 저장: ${outputPath}`);

  // 5. 통계 출력
  console.log('\n📈 예측 통계:');
  for (const group of ['가군', '나군', '다군']) {
    const items = predictedData[group];
    const avgRatio = items.reduce((sum, i) => sum + parseFloat(i.증가율), 0) / items.length;
    const under1 = items.filter(i => i.예상실질경쟁값 <= 1).length;
    console.log(`   ${group}: 평균 증가율 ${avgRatio.toFixed(2)}배, 예상 미달 ${under1}개`);
  }
}

// 직접 실행 시
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { extractRatePatterns, applyPrediction };
