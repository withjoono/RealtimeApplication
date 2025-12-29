# 정시 기능 마이그레이션 가이드

> GB-Front / GB-Back-Nest에서 Application-Rate로 정시 관련 기능 마이그레이션 참고 문서

## 소스 프로젝트 경로

- **프론트엔드**: `E:\Dev\github\GB-Front`
- **백엔드**: `E:\Dev\github\GB-Back-Nest`

---

## 1. GB-Front 정시 관련 코드

### 1.1 경쟁률 관련 (우선 마이그레이션 대상)

| 구분 | 경로 | 설명 |
|------|------|------|
| **페이지** | `src/routes/jungsi/application-rate.lazy.tsx` | 경쟁률 정보 페이지 |
| | `src/routes/jungsi/competition.lazy.tsx` | 실시간 모니터링 |
| | `src/routes/jungsi/heatmap.lazy.tsx` | 경쟁률 히트맵 |
| | `src/routes/jungsi/realtime-dashboard.lazy.tsx` | 실시간 대시보드 |
| **API** | `src/lib/api/application-rate/types.ts` | 타입 정의 |
| | `src/lib/api/application-rate/api.ts` | API 함수 |
| **훅** | `src/hooks/useApplicationRate.ts` | React Query 훅 (5분 갱신) |

### 1.2 정시 전체 기능

#### 라우팅 구조 (`src/routes/jungsi/`)
```
/jungsi                      # 메인 페이지
├── /score-input             # 성적 입력
├── /score-analysis          # 성적 분석
├── /strategy                # 지원전략
├── /a, /b, /c, /gunoe       # 가/나/다/군외 분석
├── /interest                # 관심대학
├── /combination             # 모의지원
├── /application-rate        # 경쟁률 정보
├── /competition             # 실시간 모니터링
├── /heatmap                 # 히트맵
├── /report                  # 리포트
├── /dashboard               # 대시보드
├── /realtime-dashboard      # 실시간 대시보드
├── /notifications           # 알림 설정
├── /guide                   # 사용안내
└── /demo                    # 데모
```

#### 상태관리 (`src/stores/server/features/jungsi/`)
- `interfaces.ts` - 타입 정의 (IRegularAdmission, ISavedScore 등)
- `apis.ts` - API 호출 함수
- `queries.ts` - React Query 훅

#### 컴포넌트 (`src/components/`)
- `jungsi-header.tsx` - 정시 헤더
- `jungsi-program-section.tsx` - 프로그램 섹션
- `reports/jungsi-report/` - 리포트 컴포넌트
- `services/explore/jungsi/` - 탐색 컴포넌트 (Step 1~4)
- `interests/interest-regular.tsx` - 관심대학

#### 계산 로직 (`src/lib/calculations/regular-v2/`)
- `types.ts`, `risk.ts`, `advantage.ts`
- `calc-percentile.ts`, `lazy-load.ts`
- 대학별 환산식 (경기자전, 고려세, 이화간호)

---

## 2. GB-Back-Nest 정시 관련 코드

### 2.1 경쟁률 모듈 (우선 마이그레이션 대상)

**경로**: `src/modules/application-rate/`

```
application-rate/
├── application-rate.module.ts
├── application-rate.controller.ts    # API 엔드포인트
├── application-rate.service.ts       # 크롤링 & 저장
├── dto/
│   └── application-rate.dto.ts
└── entities/
    ├── application-rate.entity.ts         # 경쟁률 데이터
    └── application-rate-history.entity.ts # 변동 이력
```

**API 엔드포인트:**
```
GET  /application-rate                    # 경쟁률 조회
GET  /application-rate/university/:code   # 대학별 상세
GET  /application-rate/changes            # 변동 내역
GET  /application-rate/sources            # 크롤링 소스
POST /application-rate/crawl              # 수동 크롤링
```

### 2.2 정시 전체 모듈

#### Jungsi Calculation (`src/modules/jungsi/calculation/`)
- 환산점수 계산 (SC001~SC488 환산식)
- 백분위 변환, 유불리 분석
- 대학별 특수 환산식 처리

#### Jungsi Prediction (`src/modules/jungsi/prediction/`)
- AI 합격 예측 (XGBoost + LightGBM + CatBoost)
- RAG 기반 Q&A

#### Jungsi Notification (`src/modules/jungsi/notification/`)
- 경쟁률 변동 알림
- FCM 푸시, 이메일 발송

#### 데이터베이스 엔티티
- `ts_regular_admissions` - 정시 입시 정보
- `ts_regular_admission_previous_results` - 과거 입결
- `ts_member_jungsi_calculated_scores` - 회원 환산점수
- `ts_member_regular_combinations` - 회원 정시 조합
- `ts_application_rates` - 경쟁률 데이터
- `ts_application_rate_histories` - 변동 이력

---

## 3. 마이그레이션 우선순위

### Phase 1: 경쟁률 기능 (현재 진행 중)
- [x] 경쟁률 크롤러 (Python - 진학사)
- [x] 경쟁률 API (FastAPI)
- [x] 프론트엔드 기본 구조 (React + TypeScript)
- [ ] 히트맵 시각화
- [ ] 실시간 알림

### Phase 2: 추가 데이터 소스
- [ ] 어디가 크롤러
- [ ] 유웨이 크롤러
- [ ] 다중 소스 통합

### Phase 3: 정시 핵심 기능
- [ ] 환산점수 계산 로직
- [ ] 입결 데이터 연동
- [ ] 모의지원 기능

### Phase 4: AI/ML 기능
- [ ] 합격 예측 모델
- [ ] RAG Q&A

---

## 4. 기술 스택 비교

| 구분 | GB 프로젝트 | Application-Rate |
|------|-------------|------------------|
| **백엔드** | NestJS (TypeScript) | FastAPI (Python) |
| **프론트엔드** | React + TanStack Router | React + React Router |
| **상태관리** | React Query | React Query |
| **DB** | TypeORM + MySQL | SQLAlchemy + SQLite |
| **크롤링** | axios + cheerio | httpx + BeautifulSoup |
| **스케줄링** | @nestjs/schedule | APScheduler |

---

## 5. 참고 파일 전체 목록

### 프론트엔드 (GB-Front)
```
src/routes/jungsi/                          # 21개 페이지
src/stores/server/features/jungsi/          # 상태관리
src/lib/api/application-rate/               # 경쟁률 API
src/hooks/useApplicationRate.ts             # 훅
src/components/jungsi-*.tsx                 # 컴포넌트
src/components/reports/jungsi-report/       # 리포트
src/components/services/explore/jungsi/     # 탐색
src/lib/calculations/regular-v2/            # 계산 로직
```

### 백엔드 (GB-Back-Nest)
```
src/modules/application-rate/               # 경쟁률 모듈
src/modules/jungsi/calculation/             # 환산점수
src/modules/jungsi/prediction/              # AI 예측
src/modules/jungsi/notification/            # 알림
src/modules/jungsi/mock-application/        # 모의지원
src/modules/exploration/                    # 탐색
src/database/entities/core/                 # 엔티티
```

---

## 6. 마이그레이션 시 주의사항

1. **인증 체계**: GB 프로젝트는 JWT 인증 사용 - 독립 운영 시 별도 인증 필요
2. **DB 스키마**: 기존 MySQL → SQLite 변환 시 타입 호환성 확인
3. **환산식 데이터**: `score-calculation-codes.json` 등 데이터 파일 이전 필요
4. **크롤링 소스**: 어디가/진학사/유웨이 각각 다른 HTML 구조
5. **실시간 기능**: WebSocket 또는 SSE 구현 필요

---

*문서 작성일: 2024-12-27*
*작성 목적: 추후 정시 기능 마이그레이션 참고용*
