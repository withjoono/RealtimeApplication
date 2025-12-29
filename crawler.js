const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { processAndSave } = require('./processData');

const CONFIG = {
  MAIN_URL: 'https://apply.jinhakapply.com/SmartRatio',
  RATIO_BASE_URL: 'https://addon.jinhakapply.com/RatioV1/RatioH/',
  OUTPUT_DIR: './output',
  MONITOR_INTERVAL: 300000, // 5분마다 체크
};

// 출력 디렉토리 생성
if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
  fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
}

/**
 * 메인 페이지에서 대학 목록 추출
 */
async function getUniversityList(page) {
  await page.goto(CONFIG.MAIN_URL, { waitUntil: 'networkidle' });

  const universities = await page.evaluate(() => {
    const results = [];
    const pageHTML = document.body.innerHTML;

    // 경쟁률 링크가 있는 대학 (오픈된 대학)
    const ratioRegex = /data-link="(https:\/\/addon\.jinhakapply\.com\/RatioV1\/RatioH\/Ratio(\d+)\.html)"[^>]*data-label="([^"]+)"/g;
    let match;
    while ((match = ratioRegex.exec(pageHTML)) !== null) {
      results.push({
        name: match[3].replace(' 정시', ''),
        code: match[2],
        ratioUrl: match[1],
        status: 'open'
      });
    }

    // 모든 대학 목록 추출 (준비중 포함)
    const listItems = document.querySelectorAll('main [class*="list"] li, main ul li');
    listItems.forEach(item => {
      const text = item.textContent;
      if (text.includes('정시모집') || text.includes('정시')) {
        const nameMatch = text.match(/([가-힣]+대학교[^정]*)/);
        const isPreparing = text.includes('준비중');
        const isOpen = text.includes('경쟁률') && !isPreparing;

        if (nameMatch) {
          const name = nameMatch[1].trim();
          // 이미 추가된 대학인지 확인
          if (!results.find(u => u.name.includes(name.substring(0, 4)))) {
            results.push({
              name: name,
              code: null,
              ratioUrl: null,
              status: isPreparing ? 'preparing' : (isOpen ? 'open' : 'unknown')
            });
          }
        }
      }
    });

    return results;
  });

  return universities;
}

/**
 * 경쟁률 페이지에서 데이터 추출
 * - 첫 번째 테이블(전형별 경쟁률 현황)은 제외
 * - 모든 총계 행 제외
 * - 캠퍼스, 모집단위, 모집인원, 지원인원, 경쟁률 데이터만 수집
 */
async function scrapeRatioPage(page, url, universityName) {
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
      scrapedAt: new Date().toISOString(),
      ...data
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return {
      university: universityName,
      url: url,
      scrapedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * 모든 오픈된 대학 크롤링
 */
async function crawlAllUniversities() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('📚 대학 목록 가져오는 중...');
  const universities = await getUniversityList(page);

  const openUniversities = universities.filter(u => u.status === 'open' && u.ratioUrl);
  const preparingUniversities = universities.filter(u => u.status === 'preparing');

  console.log(`\n✅ 오픈된 대학: ${openUniversities.length}개`);
  console.log(`⏳ 준비중인 대학: ${preparingUniversities.length}개`);

  const results = [];

  for (const univ of openUniversities) {
    console.log(`\n🔍 크롤링 중: ${univ.name}`);
    const data = await scrapeRatioPage(page, univ.ratioUrl, univ.name);
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

      console.log(`📊 오픈: ${openUniversities.length}개 | 준비중: ${preparingUniversities.length}개`);

      // 새로 오픈된 대학 확인
      const newlyOpened = openUniversities.filter(u => !previousData[u.name]);
      if (newlyOpened.length > 0) {
        console.log('\n🎉 새로 오픈된 대학:');
        newlyOpened.forEach(u => console.log(`   ✨ ${u.name}`));
      }

      // 전체 오픈된 대학 크롤링
      const results = [];
      const changesLog = [];

      for (const univ of openUniversities) {
        const data = await scrapeRatioPage(page, univ.ratioUrl, univ.name);
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

  console.log(`✅ 발견: ${target.name}`);
  const data = await scrapeRatioPage(page, target.ratioUrl, target.name);

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

module.exports = { crawlAllUniversities, monitorNewOpenings, crawlSpecificUniversity };
