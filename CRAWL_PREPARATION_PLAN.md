# 진학사 SmartRatio 크롤링 준비 계획서

> **목표**: 2025-12-29 경쟁률 페이지 오픈 시 즉시 크롤링 가능하도록 완벽 준비
> **작성일**: 2024-12-27
> **D-Day**: 2025-12-29 (접수 시작)

---

## 1. 현재 페이지 구조 분석

### 1.1 SmartRatio 메인 페이지
**URL**: `https://apply.jinhakapply.com/SmartRatio`

```
┌─────────────────────────────────────────────────────────────┐
│  경쟁률 정보 조회                                              │
├─────────────────────────────────────────────────────────────┤
│  [지역] [대학명]        [입시구분]  [기간]           [상태]     │
├─────────────────────────────────────────────────────────────┤
│  서울   가톨릭대학교    정시모집   2025-12-29~12-31  준비중    │
│  서울   건국대학교      정시모집   2025-12-29~12-31  접수예정  │
│  ...    (약 100개 대학)                                       │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 현재 상태
- **링크 상태**: `javascript:void(0)` (비활성)
- **예정 상태**: 12/29 00:00부터 실제 URL로 변경 예상
- **대학 수**: 약 100개 (4년제 대학 위주)

### 1.3 예상 URL 패턴
```
기본: https://addon.jinhakapply.com/RatioV1/RatioH/Ratio{code}.html

코드 구조: {대학코드}{전형코드}{버전}
- 대학코드: 4자리 (예: 1003 = 가톨릭대)
- 전형코드: 3자리 (수시: 031, 정시: 032 추정)
- 버전: 1자리 (1, 2 등)

예시:
- 수시: Ratio10030311.html
- 정시: Ratio10030321.html (추정)
```

---

## 2. 작업 체크리스트

### Phase 1: 사전 준비 (12/27~28)

#### 2.1 대학 목록 수집 자동화
- [ ] SmartRatio 페이지에서 대학명/지역 목록 파싱
- [ ] 대학 코드 매핑 테이블 확장
- [ ] DB에 대학 기본 정보 저장

#### 2.2 크롤러 개선
- [ ] 페이지 오픈 감지 로직 추가
- [ ] 에러 핸들링 강화
- [ ] 재시도 로직 구현 (지수 백오프)
- [ ] 동시 크롤링 제한 (rate limiting)

#### 2.3 모니터링 준비
- [ ] 크롤링 상태 대시보드
- [ ] 실시간 로그 표시
- [ ] 알림 시스템 (선택)

### Phase 2: D-Day 즉시 실행 (12/29)

#### 2.4 URL 수집
- [ ] 페이지 활성화 확인
- [ ] 모든 대학의 경쟁률 URL 수집
- [ ] URL 유효성 검증

#### 2.5 크롤링 실행
- [ ] 전체 대학 크롤링
- [ ] 데이터 정합성 검증
- [ ] 실패 대학 재크롤링

### Phase 3: 운영 (12/29~31)

#### 2.6 자동 크롤링
- [ ] 주기적 크롤링 (5분/10분 간격)
- [ ] 변동 이력 기록
- [ ] 프론트엔드 실시간 갱신

---

## 3. 구현 상세

### 3.1 대학 목록 크롤러 (SmartRatio 페이지)

```python
# 새로운 크롤러: smartratio_crawler.py

async def fetch_universities_from_smartratio() -> list[UniversityInfo]:
    """
    SmartRatio 메인 페이지에서 대학 목록 및 링크 추출

    페이지 구조:
    <table class="...">
      <tr>
        <td>지역</td>
        <td><a href="javascript:void(0)" onclick="goRatio('1003', '032')">가톨릭대학교</a></td>
        <td>정시모집</td>
        <td>2025-12-29 ~ 2025-12-31</td>
        <td>준비중</td>
      </tr>
    </table>

    활성화 시 예상 변경:
    onclick="goRatio('1003', '032')" → href="https://addon.../Ratio10030321.html"
    """
```

### 3.2 경쟁률 페이지 HTML 구조 (예상)

```html
<!-- tableRatio2: 전형별 요약 -->
<table class="tableRatio2">
  <tr><th>전형명</th><th>모집인원</th><th>지원인원</th><th>경쟁률</th></tr>
  <tr><td>일반전형</td><td>100</td><td>350</td><td>3.5 : 1</td></tr>
  <tr><td>지역균형</td><td>50</td><td>120</td><td>2.4 : 1</td></tr>
</table>

<!-- tableRatio3: 학과별 상세 -->
<table class="tableRatio3">
  <tr><th>캠퍼스</th><th>모집단위</th><th>모집인원</th><th>지원인원</th><th>경쟁률</th></tr>
  <tr><td rowspan="5">서울</td><td>경영학과</td><td>10</td><td>45</td><td>4.5 : 1</td></tr>
  <tr><td>경제학과</td><td>10</td><td>38</td><td>3.8 : 1</td></tr>
  ...
</table>
```

### 3.3 페이지 오픈 감지 로직

```python
async def check_page_availability() -> bool:
    """경쟁률 페이지 활성화 여부 확인"""

    # 1. SmartRatio 페이지에서 실제 링크 확인
    # 2. 샘플 URL 접근 테스트
    # 3. HTML 내용 검증 (경쟁률 데이터 존재 여부)

    test_urls = [
        "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio10030321.html",  # 가톨릭대
        "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio10020321.html",  # 연세대
    ]

    for url in test_urls:
        response = await client.get(url)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text)
            if soup.find("table", class_="tableRatio2"):
                return True

    return False
```

---

## 4. 필요한 코드 변경사항

### 4.1 university_list.py 개선

```python
# 추가할 기능:
1. SmartRatio 페이지 실시간 파싱
2. onclick 파라미터 추출 → URL 생성
3. 대학 상태 확인 (준비중/접수중/마감)
```

### 4.2 ratio_crawler.py 개선

```python
# 추가할 기능:
1. 정시 전형 코드 지원 (032)
2. 에러 타입별 처리 (준비중 페이지 vs 실제 에러)
3. 크롤링 속도 조절 옵션
```

### 4.3 새로운 API 엔드포인트

```python
# routes.py에 추가:
POST /api/v1/crawl/check-availability  # 페이지 오픈 상태 확인
POST /api/v1/crawl/discover-urls       # URL 목록 수집
POST /api/v1/crawl/all                 # 전체 크롤링 시작
GET  /api/v1/crawl/status              # 크롤링 진행 상태
```

---

## 5. 타임라인

### 12/27 (금) - 준비 Day 1
| 시간 | 작업 |
|------|------|
| 오전 | 대학 목록 크롤러 구현 |
| 오후 | 크롤러 테스트 (수시 페이지로) |
| 저녁 | 에러 핸들링 강화 |

### 12/28 (토) - 준비 Day 2
| 시간 | 작업 |
|------|------|
| 오전 | 프론트엔드 크롤링 상태 UI |
| 오후 | 통합 테스트 |
| 저녁 | 최종 점검 & 대기 모드 |

### 12/29 (일) - D-Day
| 시간 | 작업 |
|------|------|
| 00:00 | 페이지 오픈 확인 시작 |
| 00:00~ | 오픈 확인되면 즉시 URL 수집 |
| +10분 | 전체 대학 크롤링 시작 |
| +30분 | 데이터 검증 & 프론트엔드 확인 |
| +1시간 | 자동 크롤링 스케줄러 활성화 |

---

## 6. 테스트 전략

### 6.1 수시 데이터로 테스트
현재 수시 경쟁률 페이지가 있다면 동일한 구조일 가능성 높음:
```
수시 예상 URL: Ratio{대학코드}0311.html
```

### 6.2 Mock 테스트
실제 페이지 구조를 기반으로 테스트 HTML 생성:
```python
# tests/mock_ratio_page.html
```

### 6.3 통합 테스트 순서
1. SmartRatio 페이지 파싱 테스트
2. 단일 대학 크롤링 테스트
3. 다중 대학 크롤링 테스트
4. DB 저장 테스트
5. 이력 기록 테스트
6. 프론트엔드 연동 테스트

---

## 7. 리스크 & 대응

| 리스크 | 가능성 | 대응 방안 |
|--------|--------|----------|
| URL 패턴 변경 | 중 | 다양한 패턴 시도, 페이지 파싱으로 URL 추출 |
| 페이지 구조 변경 | 저 | 유연한 파서 구현, 다중 셀렉터 지원 |
| 크롤링 차단 | 중 | Rate limiting, User-Agent 변경, 프록시 사용 |
| 페이지 지연 오픈 | 저 | 대기 루프, 주기적 확인 |
| 서버 과부하 | 저 | 지수 백오프, 우선순위 크롤링 |

---

## 8. 즉시 실행 가능한 코드

### 8.1 페이지 오픈 체크 스크립트
```bash
python -m app.scripts.check_availability
```

### 8.2 전체 크롤링 스크립트
```bash
python -m app.scripts.crawl_all --type 정시 --year 2026
```

### 8.3 프론트엔드 크롤링 버튼
`/crawl` 페이지에서 수동 트리거 가능

---

## 9. 참고 자료

### 현재 파일 구조
```
app/
├── crawler/
│   ├── ratio_crawler.py      # 경쟁률 페이지 크롤러 ✅
│   └── university_list.py    # 대학 목록 크롤러 (개선 필요)
├── services/
│   └── crawl_service.py      # 크롤링 & DB 저장 서비스 ✅
├── models.py                 # DB 모델 ✅
├── api/routes.py             # API 엔드포인트 (확장 필요)
└── main.py                   # FastAPI 앱 & 스케줄러 ✅
```

### 데이터베이스 스키마
```
universities (대학)
  → admissions (전형)
    → departments (학과)
      → ratio_history (변동 이력)
```

---

*다음 단계: 위 체크리스트의 Phase 1 작업 시작*
