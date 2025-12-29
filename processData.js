const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

/**
 * 테이블 헤딩에서 군과 전형명 추출
 * 예: "가군 일반학생전형[수능] 경쟁률 현황" → { 군: "가군", 전형명: "일반학생전형[수능]" }
 */
function parseHeading(heading) {
  // 군 추출 (가군, 나군, 다군)
  const gunMatch = heading.match(/^(가군|나군|다군)/);
  const gun = gunMatch ? gunMatch[1] : '';

  // 전형명 추출 (군 다음부터 "경쟁률 현황" 전까지)
  let jeonhyung = '';
  if (gun) {
    const afterGun = heading.substring(gun.length).trim();
    const endIdx = afterGun.indexOf('경쟁률');
    if (endIdx > 0) {
      jeonhyung = afterGun.substring(0, endIdx).trim();
    } else {
      jeonhyung = afterGun;
    }
  } else {
    // 군이 없는 경우 전체 헤딩에서 추출 시도
    const endIdx = heading.indexOf('경쟁률');
    if (endIdx > 0) {
      jeonhyung = heading.substring(0, endIdx).trim();
    } else {
      jeonhyung = heading;
    }
  }

  return { gun, jeonhyung };
}

/**
 * 행 데이터에서 캠퍼스, 모집단위, 모집인원, 지원인원, 경쟁률 추출
 * - 학부가 있으면 제외하고 모집단위만 사용
 * - 모집단위가 세분화되면 마지막 세부단위만 사용
 * - 슬로건, 홈페이지 등은 무시
 */
function parseRow(row, headers, currentCampus, currentJeonhyung) {
  // 헤더 인덱스 찾기 (다양한 형식 지원)
  const campusIdx = headers.findIndex(h => h.includes('캠퍼스'));
  const collegeIdx = headers.findIndex(h => h === '대학' || h.includes('대학') && !h.includes('모집'));
  const danwiIdx = headers.findIndex(h => h.includes('모집단위'));
  const mojipIdx = headers.findIndex(h => h.includes('모집인원'));
  const jiwonIdx = headers.findIndex(h => h.includes('지원인원'));
  const gyeongIdx = headers.findIndex(h => h.includes('경쟁률'));
  const jeonhyungIdx = headers.findIndex(h => h.includes('전형') && !h.includes('전형명') && !h.includes('전형요소'));

  // 무시할 컬럼들 (슬로건, 홈페이지 등)
  const ignoreIdx = headers.findIndex(h => h.includes('슬로건') || h.includes('홈페이지') || h.includes('학과홈'));

  let campus = '';
  let jeonhyung = currentJeonhyung;
  let mojipDanwi = '';
  let mojipInwon = '';
  let jiwonInwon = '';
  let gyeongjaengryul = '';

  // 경쟁률 형식 확인 (예: "0.00 : 1")
  const isGyeongryul = (val) => {
    const str = val?.toString() || '';
    return str.includes(':') && str.includes('1');
  };

  // 숫자인지 확인
  const isNumeric = (val) => {
    const str = val?.toString().replace(/,/g, '') || '';
    return /^\d+$/.test(str);
  };

  // 뒤에서부터 숫자 컬럼 찾기
  const findNumericFromEnd = (row) => {
    let gyeong = -1, jiwon = -1, mojip = -1;
    for (let i = row.length - 1; i >= 0; i--) {
      const val = row[i];
      if (gyeong < 0 && isGyeongryul(val)) {
        gyeong = i;
      } else if (gyeong >= 0 && jiwon < 0 && isNumeric(val)) {
        jiwon = i;
      } else if (gyeong >= 0 && jiwon >= 0 && mojip < 0 && isNumeric(val)) {
        mojip = i;
        break;
      }
    }
    return { mojip, jiwon, gyeong };
  };

  // 슬로건 판별 함수 (설명문인지)
  const isSlogan = (text) => {
    if (!text) return false;
    return text.length > 50 || text.includes('!') || text.includes('양성') ||
           text.includes('전문가') || text.includes('인재') || text.includes('교육') ||
           text.includes('취업') || text.includes('진로');
  };

  // 학과/전공명 판별 함수
  const isMajorName = (text) => {
    if (!text) return false;
    return text.length < 40 && (
      text.includes('학과') || text.includes('학부') || text.includes('전공') ||
      text.includes('교육과') || text.includes('계열') || text.endsWith('과')
    );
  };

  // 캠퍼스 판별 함수 (캠퍼스명처럼 생겼는지)
  const isCampusLike = (text) => {
    if (!text) return false;
    return text.includes('캠퍼스') || text.includes('본교') ||
           text.includes('교정') || text.includes('분교') ||
           (text.includes('[') && (text.includes('서울') || text.includes('대전') ||
            text.includes('논산') || text.includes('부산') || text.includes('천안') ||
            text.includes('세종') || text.includes('인천') || text.includes('광주') ||
            text.includes('대구')));
  };

  // 전형명 판별 함수 (전형명처럼 생겼는지)
  const isJeonhyungLike = (text) => {
    if (!text) return false;
    // 숫자만 있으면 전형이 아님
    if (/^\d+$/.test(text)) return false;
    // 학과/학부/전공으로 끝나면 전형이 아님 (모집단위)
    if (text.endsWith('학과') || text.endsWith('학부') || text.endsWith('전공') || text.endsWith('과')) return false;
    // 전형으로 끝나거나 전형 관련 키워드 포함
    return text.includes('전형') || text.includes('수능') || text.includes('정시') ||
           text.includes('수시') || text.includes('특별') || text.includes('우수자');
  };

  // 헤더 기반 + 위치 기반 혼합 추출
  const numIdx = findNumericFromEnd(row);

  if (numIdx.gyeong >= 0) {
    gyeongjaengryul = row[numIdx.gyeong];
    jiwonInwon = numIdx.jiwon >= 0 ? row[numIdx.jiwon] : '';
    mojipInwon = numIdx.mojip >= 0 ? row[numIdx.mojip] : '';

    // 캠퍼스/대학 추출 - 캠퍼스처럼 생긴 경우에만
    if (campusIdx >= 0 && row[campusIdx] && isCampusLike(row[campusIdx])) {
      campus = row[campusIdx];
    } else if (collegeIdx >= 0 && row[collegeIdx] && isCampusLike(row[collegeIdx])) {
      campus = row[collegeIdx];
    }

    // 전형 추출 - 전형처럼 생긴 경우에만, 아니면 상속
    if (jeonhyungIdx >= 0 && row[jeonhyungIdx] && isJeonhyungLike(row[jeonhyungIdx])) {
      jeonhyung = row[jeonhyungIdx];
    } else {
      jeonhyung = currentJeonhyung;
    }

    // 모집단위 추출 - 뒤에서부터 분석
    // 구조: [캠퍼스/대학?, 모집단위, 슬로건?, 모집인원, 지원인원, 경쟁률, 홈페이지?]
    const textEndIdx = numIdx.mojip >= 0 ? numIdx.mojip : numIdx.jiwon;

    // 텍스트 컬럼들 분석
    const textCols = [];
    for (let i = 0; i < textEndIdx; i++) {
      const val = row[i]?.toString() || '';
      if (val && val !== '홈페이지') {
        textCols.push({ idx: i, val, len: val.length });
      }
    }

    // 텍스트 컬럼에서 모집단위 찾기
    for (let i = textCols.length - 1; i >= 0; i--) {
      const { val } = textCols[i];
      if (isSlogan(val)) continue; // 슬로건은 스킵
      if (isMajorName(val)) {
        mojipDanwi = val;
        // 캠퍼스는 그 앞 컬럼 - 캠퍼스처럼 생긴 경우에만 설정
        if (i > 0 && !isSlogan(textCols[i-1].val) && isCampusLike(textCols[i-1].val)) {
          campus = textCols[i-1].val;
        }
        break;
      }
    }

    // 모집단위를 못 찾았으면 짧은 텍스트 사용
    if (!mojipDanwi) {
      for (let i = textCols.length - 1; i >= 0; i--) {
        const { val } = textCols[i];
        if (!isSlogan(val) && val.length < 50) {
          mojipDanwi = val;
          // 캠퍼스처럼 생긴 경우에만 설정
          if (i > 0 && isCampusLike(textCols[i-1].val)) {
            campus = textCols[i-1].val;
          }
          break;
        }
      }
    }

    // 캠퍼스를 못 찾았으면 이전 행에서 상속
    if (!campus) {
      campus = currentCampus;
    }
  } else if (mojipIdx >= 0 && jiwonIdx >= 0 && gyeongIdx >= 0) {
    // 헤더 인덱스로 직접 추출 - 캠퍼스, 전형은 검증 후 상속
    const campusCandidate = campusIdx >= 0 ? row[campusIdx] || '' : (collegeIdx >= 0 ? row[collegeIdx] || '' : '');
    campus = isCampusLike(campusCandidate) ? campusCandidate : currentCampus;
    const jeonhyungCandidate = jeonhyungIdx >= 0 ? row[jeonhyungIdx] || '' : '';
    jeonhyung = isJeonhyungLike(jeonhyungCandidate) ? jeonhyungCandidate : currentJeonhyung;
    mojipDanwi = danwiIdx >= 0 ? row[danwiIdx] || '' : '';
    mojipInwon = row[mojipIdx] || '';
    jiwonInwon = row[jiwonIdx] || '';
    gyeongjaengryul = row[gyeongIdx] || '';
  }

  // 캠퍼스와 전형 업데이트 (다음 행을 위해)
  const newCampus = campus || currentCampus;
  const newJeonhyung = jeonhyung || currentJeonhyung;

  return {
    campus: campus || currentCampus,
    jeonhyung: jeonhyung,
    mojipDanwi,
    mojipInwon,
    jiwonInwon,
    gyeongjaengryul,
    newCampus,
    newJeonhyung
  };
}

/**
 * JSON 데이터를 군별로 정리
 */
function processData(inputPath) {
  const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

  // 결과 구조: { 가군: [], 나군: [], 다군: [], 기타: [] }
  const result = {
    가군: [],
    나군: [],
    다군: [],
    기타: []
  };

  rawData.forEach(univ => {
    const universityName = univ.university;

    if (!univ.details) return;

    univ.details.forEach(table => {
      const { gun, jeonhyung } = parseHeading(table.heading);
      const headers = table.headers || [];

      let currentCampus = '';
      let currentJeonhyung = jeonhyung;

      table.rows.forEach(row => {
        const parsed = parseRow(row, headers, currentCampus, currentJeonhyung);
        currentCampus = parsed.newCampus;
        currentJeonhyung = parsed.newJeonhyung || jeonhyung;

        // 모집단위가 비어있거나 숫자로만 시작하면 스킵
        if (!parsed.mojipDanwi) return;
        if (/^\d+$/.test(parsed.mojipDanwi)) return;

        // 모집인원이 숫자가 아니면 스킵 (잘못된 파싱)
        if (parsed.mojipInwon && !/^\d+$/.test(parsed.mojipInwon.toString().replace(/,/g, ''))) return;

        const entry = {
          대학명: universityName,
          캠퍼스: parsed.campus || '',
          전형명: parsed.jeonhyung || jeonhyung,
          모집단위: parsed.mojipDanwi,
          모집인원: parsed.mojipInwon,
          지원인원: parsed.jiwonInwon,
          경쟁률: parsed.gyeongjaengryul
        };

        // 군별로 분류
        if (gun === '가군') {
          result.가군.push(entry);
        } else if (gun === '나군') {
          result.나군.push(entry);
        } else if (gun === '다군') {
          result.다군.push(entry);
        } else {
          result.기타.push(entry);
        }
      });
    });
  });

  return result;
}

/**
 * 외부에서 호출 가능하도록 export
 */
function processAndSave(inputPath, outputDir = './output') {
  console.log('📊 데이터 정리 중...');

  const result = processData(inputPath);

  // 통계 출력
  console.log(`  가군: ${result.가군.length}개 | 나군: ${result.나군.length}개 | 다군: ${result.다군.length}개`);

  // JSON 저장
  const jsonPath = path.join(outputDir, 'organized_latest.json');
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');

  // Excel 저장
  const excelPath = path.join(outputDir, 'organized_latest.xlsx');
  saveToExcel(result, excelPath);
  console.log(`📊 정리된 데이터 저장: ${excelPath}`);

  return result;
}

/**
 * 결과를 Excel로 저장
 */
function saveToExcel(data, outputPath) {
  const workbook = XLSX.utils.book_new();

  const headers = ['대학명', '캠퍼스', '전형명', '모집단위', '모집인원', '지원인원', '경쟁률'];

  // 각 군별 시트 생성
  ['가군', '나군', '다군', '기타'].forEach(gun => {
    if (data[gun] && data[gun].length > 0) {
      const sheetData = [headers, ...data[gun].map(row => [
        row.대학명,
        row.캠퍼스,
        row.전형명,
        row.모집단위,
        row.모집인원,
        row.지원인원,
        row.경쟁률
      ])];

      const sheet = XLSX.utils.aoa_to_sheet(sheetData);

      // 열 너비 설정
      sheet['!cols'] = [
        { wch: 15 }, // 대학명
        { wch: 20 }, // 캠퍼스
        { wch: 25 }, // 전형명
        { wch: 30 }, // 모집단위
        { wch: 10 }, // 모집인원
        { wch: 10 }, // 지원인원
        { wch: 12 }  // 경쟁률
      ];

      XLSX.utils.book_append_sheet(workbook, sheet, gun);
    }
  });

  // 전체 시트 (모든 군 합친 것)
  const allData = [...data.가군, ...data.나군, ...data.다군, ...data.기타];
  if (allData.length > 0) {
    const allSheetData = [
      ['군', ...headers],
      ...data.가군.map(row => ['가군', row.대학명, row.캠퍼스, row.전형명, row.모집단위, row.모집인원, row.지원인원, row.경쟁률]),
      ...data.나군.map(row => ['나군', row.대학명, row.캠퍼스, row.전형명, row.모집단위, row.모집인원, row.지원인원, row.경쟁률]),
      ...data.다군.map(row => ['다군', row.대학명, row.캠퍼스, row.전형명, row.모집단위, row.모집인원, row.지원인원, row.경쟁률]),
      ...data.기타.map(row => ['기타', row.대학명, row.캠퍼스, row.전형명, row.모집단위, row.모집인원, row.지원인원, row.경쟁률])
    ];

    const allSheet = XLSX.utils.aoa_to_sheet(allSheetData);
    allSheet['!cols'] = [
      { wch: 6 },  // 군
      { wch: 15 }, // 대학명
      { wch: 20 }, // 캠퍼스
      { wch: 25 }, // 전형명
      { wch: 30 }, // 모집단위
      { wch: 10 }, // 모집인원
      { wch: 10 }, // 지원인원
      { wch: 12 }  // 경쟁률
    ];

    XLSX.utils.book_append_sheet(workbook, allSheet, '전체');
  }

  XLSX.writeFile(workbook, outputPath);
}

// 모듈 export
module.exports = { processData, processAndSave, saveToExcel };

// CLI로 직접 실행될 때만 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  const inputFile = args[0] || './output/ratio_data_2025-12-28T22-43-56-219Z.json';

  console.log('📊 데이터 처리 중...');
  console.log(`입력 파일: ${inputFile}`);

  const result = processData(inputFile);

  // 통계 출력
  console.log('\n📈 군별 통계:');
  console.log(`  가군: ${result.가군.length}개`);
  console.log(`  나군: ${result.나군.length}개`);
  console.log(`  다군: ${result.다군.length}개`);
  console.log(`  기타: ${result.기타.length}개`);
  console.log(`  총계: ${result.가군.length + result.나군.length + result.다군.length + result.기타.length}개`);

  // JSON 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join('./output', `organized_${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n💾 JSON 저장: ${jsonPath}`);

  // Excel 저장
  const excelPath = path.join('./output', `organized_${timestamp}.xlsx`);
  saveToExcel(result, excelPath);
  console.log(`📊 Excel 저장: ${excelPath}`);

  console.log('\n✅ 완료!');
}
