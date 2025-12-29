const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { processAndSave } = require('./processData');

const CONFIG = {
  MAIN_URL: 'https://apply.jinhakapply.com/SmartRatio',
  RATIO_BASE_URL: 'https://addon.jinhakapply.com/RatioV1/RatioH/',
  UWAY_BASE_URL: 'https://ratio.uwayapply.com/',
  OUTPUT_DIR: './output',
  FRONTEND_PUBLIC_DIR: './frontend/public',
  MONITOR_INTERVAL: 300000, // 5분마다 체크
  AUTO_DEPLOY: true, // 자동 배포 활성화
};

// 출력 디렉토리 생성
if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
  fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
}

// 프론트엔드 public 디렉토리 확인
if (!fs.existsSync(CONFIG.FRONTEND_PUBLIC_DIR)) {
  fs.mkdirSync(CONFIG.FRONTEND_PUBLIC_DIR, { recursive: true });
}

/**
 * 프론트엔드에 데이터 복사 및 배포
 */
async function syncToFrontendAndDeploy() {
  const sourceFile = path.join(CONFIG.OUTPUT_DIR, 'organized_latest.json');
  const targetFile = path.join(CONFIG.FRONTEND_PUBLIC_DIR, 'organized_latest.json');

  if (!fs.existsSync(sourceFile)) {
    console.log('⚠️ organized_latest.json 파일이 없습니다.');
    return false;
  }

  try {
    // 1. 프론트엔드로 복사
    fs.copyFileSync(sourceFile, targetFile);
    console.log('📋 프론트엔드에 데이터 복사 완료');

    // 2. 자동 배포 (설정된 경우)
    if (CONFIG.AUTO_DEPLOY) {
      console.log('🚀 배포 시작...');
      const { execSync } = require('child_process');

      try {
        // 프론트엔드 빌드
        execSync('npm run build', {
          cwd: path.resolve('./frontend'),
          stdio: 'inherit'
        });
        console.log('✅ 빌드 완료');

        // Cloud Run 배포 (gcloud 설치되어 있는 경우)
        try {
          execSync('gcloud run deploy jinhak-ratio --source . --region asia-northeast3 --allow-unauthenticated --quiet', {
            cwd: path.resolve('./frontend'),
            stdio: 'inherit'
          });
          console.log('🎉 Cloud Run 배포 완료!');
        } catch (deployErr) {
          console.log('⚠️ Cloud Run 배포 실패 (gcloud 미설치 또는 권한 문제)');
          console.log('   수동 배포: cd frontend && gcloud run deploy');
        }
      } catch (buildErr) {
        console.log('⚠️ 빌드 실패:', buildErr.message);
      }
    }

    return true;
  } catch (err) {
    console.log('❌ 프론트엔드 동기화 실패:', err.message);
    return false;
  }
}

/**
 * 메인 페이지에서 대학 목록 추출 (jinhakapply + uwayapply 모두 지원)
 */
async function getUniversityList(page) {
  await page.goto(CONFIG.MAIN_URL, { waitUntil: 'networkidle' });

  const universities = await page.evaluate(() => {
    const results = [];
    const addedNames = new Set();

    // 모든 rate 링크 추출 (a.rate[data-link])
    const rateLinks = document.querySelectorAll('a.rate[data-link]');
    rateLinks.forEach(link => {
      const url = link.getAttribute('data-link');
      const label = link.getAttribute('data-label') || link.textContent.trim();
      const name = label.replace(' 정시', '').trim();

      if (!url || addedNames.has(name)) return;
      addedNames.add(name);

      // URL 유형 판별
      let urlType = 'unknown';
      let code = null;

      if (url.includes('addon.jinhakapply.com')) {
        urlType = 'jinhak';
        const codeMatch = url.match(/Ratio(\d+)\.html/);
        if (codeMatch) code = codeMatch[1];
      } else if (url.includes('ratio.uwayapply.com')) {
        urlType = 'uway';
        // uwayapply URL에서 코드 추출 (마지막 경로 부분)
        const parts = url.split('/');
        code = parts[parts.length - 1];
      } else if (url.includes('http')) {
        urlType = 'custom';
      }

      results.push({
        name: name,
        code: code,
        ratioUrl: url,
        urlType: urlType,
        status: 'open'
      });
    });

    // 준비중인 대학 추출 (rate 링크가 없는 대학)
    const allUniItems = document.querySelectorAll('li[class*="item"], .univ-item, main li');
    allUniItems.forEach(item => {
      const text = item.textContent;
      if (text.includes('준비중') && (text.includes('정시') || text.includes('모집'))) {
        // 대학명 추출 시도
        const nameEl = item.querySelector('[class*="name"], strong, b');
        const name = nameEl ? nameEl.textContent.trim() : null;

        if (name && !addedNames.has(name)) {
          addedNames.add(name);
          results.push({
            name: name,
            code: null,
            ratioUrl: null,
            urlType: null,
            status: 'preparing'
          });
        }
      }
    });

    return results;
  });

  return universities;
}

/**
 * uwayapply.com 경쟁률 페이지에서 데이터 추출
 */
async function scrapeUwayRatioPage(page, url, universityName) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const data = await page.evaluate(() => {
      const result = {
        title: '',
        updateTime: '',
        details: []
      };

      // 대학명 추출
      const univImg = document.querySelector('#UivImg');
      result.title = univImg ? univImg.alt : (document.title.split(' ')[0] || '');

      // 업데이트 시간 추출
      const dateLabel = document.querySelector('#ID_DateStr label');
      if (dateLabel) {
        result.updateTime = dateLabel.textContent.trim();
      }

      // 섹션별 전형명 추출을 위한 매핑
      const sectionHeaders = [];
      document.querySelectorAll('h3 .bul').forEach(el => {
        sectionHeaders.push(el.textContent.trim());
      });

      // 테이블 데이터 추출
      const tables = document.querySelectorAll('table');
      let sectionIndex = 0;

      tables.forEach((table, tableIndex) => {
        // 첫 번째 테이블(전체 경쟁률)과 두 번째 테이블(전형별 요약)은 건너뛰기
        if (tableIndex < 2) return;

        const headers = [];
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
          headerRow.querySelectorAll('th').forEach(th => {
            headers.push(th.textContent.trim());
          });
        }

        // 섹션 헤더 찾기 (상세 테이블은 index 2부터 시작)
        const heading = sectionHeaders[sectionIndex + 2] || `전형 ${tableIndex}`;
        sectionIndex++;

        const tableData = {
          heading: heading.replace(' 경쟁률 현황', ''),
          headers: headers.length > 0 ? headers : ['대학', '모집단위', '모집인원', '지원인원', '경쟁률'],
          rows: []
        };

        // 데이터 행 추출
        const rows = table.querySelectorAll('tbody tr');
        let currentCollege = '';

        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          const rowData = Array.from(cells).map(cell => cell.textContent.trim());

          // 총계, 소계 행 제외
          if (rowData.some(cell =>
            cell === '총계' || cell === '소계' ||
            cell.includes('소계') || cell.includes('정원내 소계') ||
            cell.includes('정원외 소계'))) {
            return;
          }

          // 빈 행 제외
          if (rowData.length === 0 || rowData.every(cell => !cell)) return;

          // rowspan으로 인한 대학명 누락 처리
          if (rowData.length === 5) {
            // 정상적인 5컬럼 데이터
            currentCollege = rowData[0] || currentCollege;
            tableData.rows.push(rowData);
          } else if (rowData.length === 4) {
            // 대학명이 rowspan으로 생략된 경우
            tableData.rows.push([currentCollege, ...rowData]);
          } else if (rowData.length >= 3) {
            // 기타 경우도 처리
            tableData.rows.push(rowData);
          }
        });

        // 데이터가 있는 테이블만 추가
        if (tableData.rows.length > 0) {
          result.details.push(tableData);
        }
      });

      return result;
    });

    return {
      university: universityName,
      url: url,
      urlType: 'uway',
      scrapedAt: new Date().toISOString(),
      ...data
    };
  } catch (error) {
    console.error(`Error scraping uwayapply ${url}:`, error.message);
    return {
      university: universityName,
      url: url,
      urlType: 'uway',
      scrapedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * jinhakapply.com 경쟁률 페이지에서 데이터 추출
 * - 첫 번째 테이블(전형별 경쟁률 현황)은 제외
 * - 모든 총계 행 제외
 * - 캠퍼스, 모집단위, 모집인원, 지원인원, 경쟁률 데이터만 수집
 */
async function scrapeJinhakRatioPage(page, url, universityName) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const data = await page.evaluate(() => {
      const result = {
        title: document.querySelector('h1, .title, header p')?.textContent?.trim() || '',
        updateTime: '',
        details: []
      };

      // 업데이트 시간
      const timeEl = document.querySelector('p[class*="time"], .update-time, [class*="현황"]');
      if (timeEl) {
        result.updateTime = timeEl.textContent.trim();
      } else {
        const pageText = document.body.textContent;
        const timeMatch = pageText.match(/\d{4}-\d{2}-\d{2}[^현]*현황/);
        if (timeMatch) result.updateTime = timeMatch[0];
      }

      // 테이블 데이터 추출
      const tables = document.querySelectorAll('table');
      tables.forEach((table, tableIndex) => {
        // 첫 번째 테이블은 건너뛰기
        if (tableIndex === 0) return;

        const heading = table.previousElementSibling?.textContent?.trim() ||
                       table.closest('div')?.querySelector('h2, h3')?.textContent?.trim() ||
                       `전형 ${tableIndex}`;

        // "전형별 경쟁률 현황" 요약 테이블 건너뛰기
        if (heading.includes('전형별 경쟁률 현황')) return;

        const rows = table.querySelectorAll('tr');
        const tableData = {
          heading: heading,
          headers: [],
          rows: []
        };

        rows.forEach((row, rowIndex) => {
          const cells = row.querySelectorAll('th, td');
          const rowData = Array.from(cells).map(cell => cell.textContent.trim());

          // 총계, 소계 행 제외
          if (rowData.some(cell => cell === '총계' || cell === '소계' || cell.includes('소계') || cell.includes('정원내 소계') || cell.includes('정원외 소계'))) {
            return;
          }

          if (rowIndex === 0 && row.querySelectorAll('th').length > 0) {
            tableData.headers = rowData;
          } else if (rowData.length > 0) {
            tableData.rows.push(rowData);
          }
        });

        // 데이터가 있는 테이블만 추가
        if (tableData.rows.length > 0) {
          result.details.push(tableData);
        }
      });

      return result;
    });

    return {
      university: universityName,
      url: url,
      urlType: 'jinhak',
      scrapedAt: new Date().toISOString(),
      ...data
    };
  } catch (error) {
    console.error(`Error scraping jinhak ${url}:`, error.message);
    return {
      university: universityName,
      url: url,
      urlType: 'jinhak',
      scrapedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * URL 유형에 따라 적절한 스크래퍼 호출
 */
async function scrapeRatioPage(page, url, universityName, urlType) {
  if (urlType === 'uway' || url.includes('uwayapply.com')) {
    return await scrapeUwayRatioPage(page, url, universityName);
  } else {
    return await scrapeJinhakRatioPage(page, url, universityName);
  }
}

/**
 * 모든 오픈된 대학 크롤링 (jinhakapply + uwayapply + custom 모두 지원)
 */
async function crawlAllUniversities() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('📚 대학 목록 가져오는 중...');
  const universities = await getUniversityList(page);

  const openUniversities = universities.filter(u => u.status === 'open' && u.ratioUrl);
  const preparingUniversities = universities.filter(u => u.status === 'preparing');

  // URL 유형별 통계
  const jinhakCount = openUniversities.filter(u => u.urlType === 'jinhak').length;
  const uwayCount = openUniversities.filter(u => u.urlType === 'uway').length;
  const customCount = openUniversities.filter(u => u.urlType === 'custom').length;

  console.log(`\n✅ 오픈된 대학: ${openUniversities.length}개`);
  console.log(`   - jinhakapply: ${jinhakCount}개`);
  console.log(`   - uwayapply: ${uwayCount}개`);
  console.log(`   - 기타: ${customCount}개`);
  console.log(`⏳ 준비중인 대학: ${preparingUniversities.length}개`);

  const results = [];

  for (const univ of openUniversities) {
    // custom URL은 현재 지원하지 않음
    if (univ.urlType === 'custom') {
      console.log(`\n⚠️ 건너뛰기 (미지원 URL): ${univ.name}`);
      continue;
    }

    console.log(`\n🔍 크롤링 중: ${univ.name} [${univ.urlType}]`);
    const data = await scrapeRatioPage(page, univ.ratioUrl, univ.name, univ.urlType);
    results.push(data);

    // 서버 부하 방지를 위한 딜레이
    await page.waitForTimeout(1000);
  }

  await browser.close();

  // 결과 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // JSON 저장
  const jsonPath = path.join(CONFIG.OUTPUT_DIR, `ratio_data_${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n💾 JSON 저장: ${jsonPath}`);

  // Excel 저장
  const excelPath = path.join(CONFIG.OUTPUT_DIR, `ratio_data_${timestamp}.xlsx`);
  saveToExcel(results, excelPath);
  console.log(`📊 Excel 저장: ${excelPath}`);

  // 군별 정리된 데이터 저장
  try {
    processAndSave(jsonPath, CONFIG.OUTPUT_DIR);
  } catch (e) {
    console.log('⚠️ 데이터 정리 중 오류:', e.message);
  }

  // 대학 목록 저장
  const listPath = path.join(CONFIG.OUTPUT_DIR, 'university_list.json');
  fs.writeFileSync(listPath, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    open: openUniversities,
    preparing: preparingUniversities
  }, null, 2), 'utf-8');

  return { results, universities };
}

/**
 * Excel 파일로 저장
 * - 요약 시트: 대학명, 업데이트시간, 크롤링시간
 * - 각 대학별 상세 시트: 전형별 상세 데이터 (총계 제외)
 */
function saveToExcel(data, filePath) {
  const workbook = XLSX.utils.book_new();

  // 요약 시트
  const summaryData = data.map(d => ({
    '대학명': d.university,
    '업데이트시간': d.updateTime || '',
    '크롤링시간': d.scrapedAt,
    'URL': d.url
  }));
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, '요약');

  // 각 대학별 상세 시트
  data.forEach(d => {
    if (d.details && d.details.length > 0) {
      const sheetName = d.university.substring(0, 31); // Excel 시트명 제한
      const allRows = [];

      d.details.forEach((table, tableIdx) => {
        // 전형명 구분을 위해 빈 행 추가 (첫 번째 테이블 제외)
        if (tableIdx > 0 && allRows.length > 0) {
          allRows.push({}); // 빈 행
        }

        // 전형명 헤더 추가
        if (table.heading) {
          const headingRow = { '전형': `【${table.heading}】` };
          allRows.push(headingRow);
        }

        // 테이블 데이터 추가
        table.rows.forEach(row => {
          const obj = {};
          table.headers.forEach((header, i) => {
            obj[header] = row[i] || '';
          });
          allRows.push(obj);
        });
      });

      if (allRows.length > 0) {
        const sheet = XLSX.utils.json_to_sheet(allRows);
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      }
    }
  });

  try {
    XLSX.writeFile(workbook, filePath);
  } catch (error) {
    console.log(`⚠️ Excel 저장 실패 (파일이 열려있을 수 있음): ${filePath}`);
  }
}

/**
 * 데이터 비교하여 변경사항 감지
 */
function compareData(oldData, newData) {
  const changes = [];

  if (!oldData || !oldData.details) return { hasChanges: true, changes: ['새로운 데이터'] };
  if (!newData || !newData.details) return { hasChanges: false, changes: [] };

  // 업데이트 시간 비교
  if (oldData.updateTime !== newData.updateTime) {
    changes.push(`업데이트 시간: ${oldData.updateTime} → ${newData.updateTime}`);
  }

  // 상세 데이터 행 수 비교
  const oldRowCount = oldData.details.reduce((sum, t) => sum + t.rows.length, 0);
  const newRowCount = newData.details.reduce((sum, t) => sum + t.rows.length, 0);

  if (oldRowCount !== newRowCount) {
    changes.push(`모집단위 수: ${oldRowCount} → ${newRowCount}`);
  }

  // 지원인원 합계 비교 (경쟁률 열 인덱스 추정: 보통 4번째 열)
  const getApplicantSum = (data) => {
    let sum = 0;
    data.details.forEach(table => {
      const applicantIdx = table.headers.findIndex(h => h.includes('지원'));
      if (applicantIdx >= 0) {
        table.rows.forEach(row => {
          const val = parseInt(row[applicantIdx]?.replace(/,/g, '') || '0', 10);
          if (!isNaN(val)) sum += val;
        });
      }
    });
    return sum;
  };

  const oldApplicants = getApplicantSum(oldData);
  const newApplicants = getApplicantSum(newData);

  if (oldApplicants !== newApplicants) {
    changes.push(`총 지원인원: ${oldApplicants.toLocaleString()} → ${newApplicants.toLocaleString()}`);
  }

  return { hasChanges: changes.length > 0, changes };
}

/**
 * 전체 대학 모니터링 및 업데이트
 */
async function monitorNewOpenings() {
  console.log('🔄 모니터링 시작 (5분 간격)...\n');

  // 이전 데이터 로드
  const latestDataPath = path.join(CONFIG.OUTPUT_DIR, 'latest_data.json');
  let previousData = {};
  if (fs.existsSync(latestDataPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(latestDataPath, 'utf-8'));
      previousData = saved.data || {};
    } catch (e) {
      previousData = {};
    }
  }

  let previousOpenCount = Object.keys(previousData).length;

  const check = async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR');
    const dateStr = now.toLocaleDateString('ko-KR');

    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`⏰ ${dateStr} ${timeStr} - 크롤링 시작`);
      console.log('='.repeat(60));

      const universities = await getUniversityList(page);
      const openUniversities = universities.filter(u => u.status === 'open' && u.ratioUrl);
      const preparingUniversities = universities.filter(u => u.status === 'preparing');

      // URL 유형별 통계
      const jinhakCount = openUniversities.filter(u => u.urlType === 'jinhak').length;
      const uwayCount = openUniversities.filter(u => u.urlType === 'uway').length;
      const customCount = openUniversities.filter(u => u.urlType === 'custom').length;

      console.log(`📊 오픈: ${openUniversities.length}개 (jinhak: ${jinhakCount}, uway: ${uwayCount}, 기타: ${customCount}) | 준비중: ${preparingUniversities.length}개`);

      // 새로 오픈된 대학 확인
      const newlyOpened = openUniversities.filter(u => !previousData[u.name]);
      if (newlyOpened.length > 0) {
        console.log('\n🎉 새로 오픈된 대학:');
        newlyOpened.forEach(u => console.log(`   ✨ ${u.name} [${u.urlType}]`));
      }

      // 전체 오픈된 대학 크롤링
      const results = [];
      const changesLog = [];

      for (const univ of openUniversities) {
        // custom URL은 현재 지원하지 않음
        if (univ.urlType === 'custom') {
          continue;
        }

        const data = await scrapeRatioPage(page, univ.ratioUrl, univ.name, univ.urlType);
        results.push(data);

        // 이전 데이터와 비교
        const { hasChanges, changes } = compareData(previousData[univ.name], data);

        if (hasChanges) {
          changesLog.push({ university: univ.name, changes });
        }

        // 서버 부하 방지
        await page.waitForTimeout(500);
      }

      // 변경사항 출력
      if (changesLog.length > 0) {
        console.log('\n📝 변경된 대학:');
        changesLog.forEach(({ university, changes }) => {
          console.log(`   🔄 ${university}`);
          changes.forEach(c => console.log(`      - ${c}`));
        });
      } else {
        console.log('\n✅ 변경사항 없음');
      }

      // 최신 데이터 저장
      const currentData = {};
      results.forEach(r => { currentData[r.university] = r; });

      fs.writeFileSync(latestDataPath, JSON.stringify({
        lastUpdated: now.toISOString(),
        data: currentData
      }, null, 2), 'utf-8');

      // 최신 데이터 엑셀 저장 (항상 업데이트)
      const latestExcelPath = path.join(CONFIG.OUTPUT_DIR, 'latest_data.xlsx');
      saveToExcel(results, latestExcelPath);

      // 군별 정리된 데이터 저장
      const tempJsonPath = path.join(CONFIG.OUTPUT_DIR, '_temp_results.json');
      fs.writeFileSync(tempJsonPath, JSON.stringify(results, null, 2), 'utf-8');
      try {
        processAndSave(tempJsonPath, CONFIG.OUTPUT_DIR);
        fs.unlinkSync(tempJsonPath);
      } catch (e) {
        console.log('⚠️ 데이터 정리 중 오류:', e.message);
      }

      // JSON 저장 (변경사항이 있을 때만 타임스탬프 파일 생성)
      if (changesLog.length > 0 || newlyOpened.length > 0) {
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const jsonPath = path.join(CONFIG.OUTPUT_DIR, `ratio_data_${timestamp}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');

        const excelPath = path.join(CONFIG.OUTPUT_DIR, `ratio_data_${timestamp}.xlsx`);
        saveToExcel(results, excelPath);

        console.log(`\n💾 저장: ${jsonPath}`);
      }

      // 대학 목록 업데이트
      const listPath = path.join(CONFIG.OUTPUT_DIR, 'university_list.json');
      fs.writeFileSync(listPath, JSON.stringify({
        lastUpdated: now.toISOString(),
        open: openUniversities,
        preparing: preparingUniversities
      }, null, 2), 'utf-8');

      // 프론트엔드 동기화 및 배포 (변경사항이 있을 때만)
      if (changesLog.length > 0 || newlyOpened.length > 0) {
        await syncToFrontendAndDeploy();
      }

      // 이전 데이터 업데이트
      previousData = currentData;
      previousOpenCount = openUniversities.length;

      console.log(`\n⏳ 다음 체크: 5분 후`);

    } catch (error) {
      console.error('\n❌ 모니터링 에러:', error.message);
    } finally {
      await browser.close();
    }
  };

  // 즉시 한 번 체크
  await check();

  // 주기적으로 체크
  setInterval(check, CONFIG.MONITOR_INTERVAL);
}

/**
 * 특정 대학만 크롤링
 */
async function crawlSpecificUniversity(universityName) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`🔍 ${universityName} 검색 중...`);
  const universities = await getUniversityList(page);

  const target = universities.find(u =>
    u.name.includes(universityName) && u.status === 'open' && u.ratioUrl
  );

  if (!target) {
    console.log(`❌ ${universityName}을(를) 찾을 수 없거나 아직 오픈되지 않았습니다.`);
    await browser.close();
    return null;
  }

  if (target.urlType === 'custom') {
    console.log(`⚠️ ${target.name}은(는) 현재 지원하지 않는 URL 형식입니다.`);
    await browser.close();
    return null;
  }

  console.log(`✅ 발견: ${target.name} [${target.urlType}]`);
  const data = await scrapeRatioPage(page, target.ratioUrl, target.name, target.urlType);

  await browser.close();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(CONFIG.OUTPUT_DIR, `${target.name}_${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`💾 저장: ${jsonPath}`);

  return data;
}

// CLI 인터페이스
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'crawl':
    crawlAllUniversities().then(() => {
      console.log('\n✅ 크롤링 완료!');
      process.exit(0);
    });
    break;

  case 'monitor':
    monitorNewOpenings();
    break;

  case 'university':
    if (args[1]) {
      crawlSpecificUniversity(args[1]).then(() => process.exit(0));
    } else {
      console.log('사용법: node crawler.js university <대학명>');
      process.exit(1);
    }
    break;

  default:
    console.log(`
🎓 대학 경쟁률 크롤러

사용법:
  node crawler.js crawl              - 모든 오픈된 대학 크롤링
  node crawler.js monitor            - 새로 오픈되는 대학 모니터링 (Ctrl+C로 종료)
  node crawler.js university <이름>  - 특정 대학만 크롤링
    `);
}

module.exports = { crawlAllUniversities, monitorNewOpenings, crawlSpecificUniversity, syncToFrontendAndDeploy };
