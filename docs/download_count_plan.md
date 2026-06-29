# ScholarLink — 계정별 다운로드 횟수 표시 기능 코딩계획서

> 작성일: 2026-06-25
> 대상: 1인 프로젝트, DB 마이그레이션 없이 빠르게 추가 가능한 범위
> 예상 작업량: Phase 1 기준 1~2일 (프론트 + 백엔드 각 1일)

---

## 1. 배경 및 현재 상태

### 1-1. 이미 있는 것

| 위치 | 현재 동작 | 비고 |
|---|---|---|
| `users.download_count` 컬럼 | 다운로드 성공 시 1씩 증가 | `paperController.ts:139` |
| `paper_requests` 테이블 | 모든 요청/성공/실패 기록 | user_id, server_id, status, created_at 포함 |
| `/auth/me` 응답 | `download_count` 정수 1개 노출 | `authController.ts:305` |
| Profile 페이지 | "검색 횟수" 라벨로 정수 1개 표시 | 라벨이 부정확 (실제로는 다운로드 횟수) |
| History 페이지 | 개별 다운로드 이력 리스트만 | 총 N건 텍스트만 있음, 통계 없음 |
| Admin 페이지 | 전체 누적 + 7일 신규 카운트 | 사용자별 카운트 컬럼은 이미 있음 |

### 1-2. 부족한 것

- **단일 정수만** 보여줌 → 사용자가 "내 사용 패턴이 어떤지" 전혀 모름
- **기간별 분해 없음** (오늘 / 이번 주 / 이번 달 / 누적)
- **OA 소스별 분해 없음** (어떤 서버로 많이 받는지)
- **성공률 없음** (현재 download_count는 성공만, paper_requests에는 실패도 있음)
- **추세 없음** (최근 30일 일별 그래프 같은 시각화)
- **입력 유형별 분해 없음** (DOI로 많이 받는지, arXiv로 많이 받는지)
- **Profile 라벨 오기** — "검색 횟수" (실제로는 다운로드 성공 횟수)

---

## 2. 방향 (Direction)

### 2-1. 핵심 컨셉

> **"내 다운로드 사용 패턴을 한눈에"**

DB 마이그레이션 없이 `paper_requests` 테이블만으로 풍부한 통계를 집계해서, 사용자가 자기 계정 페이지에서 자기다운로드 행태를 파악할 수 있게 한다.

### 2-2. 표시 원칙

1. **즉시 가치** — 첫 화면에서 핵심 카운터(오늘/누적)가 보여야 함
2. **드릴다운** — 카드 클릭 시 상세 페이지(소스별, 일별)로 이동 가능
3. **프라이버시 기본값** — 본인만 본다. 타인 공개는 옵션
4. **한국어/영어** — 기존 i18n 구조 그대로 사용
5. **외부 라이브러리 X** — CSS만으로 막대그래프 구현 (Chart.js 등 도입 안 함)

### 2-3. 비범위 (이번에 안 함)

- 다른 사용자와 비교하는 리더보드
- 다운로드 속도/품질 분석 (평균 파일 크기, 평균 소요 시간)
- 일별/주별 알림 (이메일/푸시)
- 유료 티어 결제 연동

---

## 3. 표시 항목 정의

### 3-1. 핵심 카운터 (Phase 1)

| 항목 | 의미 | 데이터 소스 |
|---|---|---|
| 오늘 | 오늘 00:00 이후 완료된 다운로드 수 | `paper_requests` WHERE status='completed' AND created_at >= CURRENT_DATE |
| 7일 | 최근 7일 완료 수 | `>= NOW() - INTERVAL '7 days'` |
| 30일 | 최근 30일 완료 수 | `>= NOW() - INTERVAL '30 days'` |
| 누적 | 회원 가입 이후 완료 수 (현재 users.download_count) | `users.download_count` |

### 3-2. 부가 통계 (Phase 1)

| 항목 | 의미 | 데이터 소스 |
|---|---|---|
| 성공률 | completed / (completed + failed) | `paper_requests` GROUP BY status |
| 입력 유형 분포 | DOI / PMID / arXiv / URL 각각 카운트 | `paper_requests.input_type` |
| 자주 쓰는 OA 소스 Top 5 | 서버별 다운로드 수 | `paper_requests` JOIN `download_servers` ON server_id |

### 3-3. 시각화 (Phase 2)

| 항목 | 의미 |
|---|---|
| 최근 30일 일별 막대그래프 | 일자별 완료 수, CSS height 비율로 표현 |
| 월별 요약 카드 | 이번 달 vs 지난 달 비교 |

---

## 4. 백엔드 변경

### 4-1. 새 라우트

```
GET /api/v1/users/me/stats
  Auth: required (JWT)
  Response: 200 OK
```

### 4-2. 응답 스키마

```typescript
{
  success: true,
  data: {
    counters: {
      today: number,
      week7: number,
      month30: number,
      total: number  // users.download_count (정합성)
    },
    success_rate: {
      completed: number,
      failed: number,
      ratio: number  // 0~1
    },
    input_types: Array<{
      type: 'doi' | 'pmid' | 'arxiv' | 'url',
      count: number
    }>,
    top_servers: Array<{
      server_id: number | null,
      server_name: string,  // server_id null이면 "직접 다운로드"
      count: number
    }>,
    daily_30d: Array<{
      date: string,   // 'YYYY-MM-DD'
      count: number
    }>
  }
}
```

### 4-3. SQL (단일 쿼리, CTE 활용)

`server/src/controllers/userStatsController.ts` 신규 파일:

```sql
WITH req AS (
  SELECT id, status, input_type, server_id, created_at
  FROM paper_requests
  WHERE user_id = $1
),
counters AS (
  SELECT
    COUNT(*) FILTER (WHERE status='completed' AND created_at >= CURRENT_DATE) AS today,
    COUNT(*) FILTER (WHERE status='completed' AND created_at >= NOW() - INTERVAL '7 days') AS week7,
    COUNT(*) FILTER (WHERE status='completed' AND created_at >= NOW() - INTERVAL '30 days') AS month30
  FROM req
),
status_breakdown AS (
  SELECT status, COUNT(*) AS cnt FROM req GROUP BY status
),
input_breakdown AS (
  SELECT input_type, COUNT(*) AS cnt FROM req WHERE status='completed' GROUP BY input_type
),
server_breakdown AS (
  SELECT COALESCE(server_id, 0) AS server_id, COUNT(*) AS cnt
  FROM req WHERE status='completed'
  GROUP BY COALESCE(server_id, 0)
  ORDER BY cnt DESC LIMIT 5
),
daily AS (
  SELECT TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
         COUNT(*) AS cnt
  FROM req
  WHERE status='completed' AND created_at >= NOW() - INTERVAL '30 days'
  GROUP BY 1 ORDER BY 1
)
SELECT
  (SELECT row_to_json(counters) FROM counters) AS counters,
  (SELECT json_agg(row_to_json(s)) FROM status_breakdown s) AS status_breakdown,
  (SELECT json_agg(row_to_json(i)) FROM input_breakdown i) AS input_breakdown,
  (SELECT json_agg(json_build_object(
    'server_id', sb.server_id,
    'server_name', COALESCE(ds.name, 'Direct'),
    'count', sb.cnt
  )) FROM server_breakdown sb
   LEFT JOIN download_servers ds ON ds.id = NULLIF(sb.server_id, 0)) AS top_servers,
  (SELECT json_agg(row_to_json(d)) FROM daily d) AS daily_30d,
  (SELECT download_count FROM users WHERE id = $1) AS total
;
```

> **성능 참고**: `paper_requests.user_id`에 이미 인덱스 있음 (`migrate.ts:157`). 6개 집계가 CTE 안에서 한 번의 풀스캔으로 끝남. 사용자당 통상 수백~수천 건 수준이라 응답 시간 수 ms 예상.

### 4-4. 라우트 등록

`server/src/routes/auth.ts` (또는 신규 `routes/users.ts`):

```typescript
// 옵션 A: auth.ts에 추가
import { getMyStats } from '../controllers/userStatsController';
router.get('/me/stats', requireAuth, getMyStats);

// 옵션 B: 별도 routes/users.ts 신규 (이 라우트가 늘어나면 권장)
```

### 4-5. Phase 1 변경 요약

| 파일 | 변경 |
|---|---|
| `server/src/controllers/userStatsController.ts` | 신규 (응답 집계 로직) |
| `server/src/routes/auth.ts` (또는 `routes/users.ts`) | `/me/stats` 라우트 1줄 추가 |
| `server/src/controllers/paperController.ts` | **변경 없음** (이미 download_count 증가) |

---

## 5. 프론트 변경

### 5-1. 새 컴포넌트

#### `client/src/components/DownloadStatsCard.tsx` (신규)

```typescript
interface Props {
  stats: UserStats;
  lang: 'ko' | 'en';
}
```

- 상단: 4개 카운터 카드 (오늘 / 7일 / 30일 / 누적)
- 중단: 성공률 도넛 (CSS만) + 입력 유형 분포 가로 막대
- 하단: 자주 쓰는 서버 Top 5 리스트

#### `client/src/components/DailyBarChart.tsx` (신규, Phase 2)

```typescript
interface Props {
  data: Array<{ date: string; count: number }>;
  lang: 'ko' | 'en';
}
```

- 30개 일자 컬럼, 높이 = (count / max) * 100%
- Tailwind: `bg-teal-400`, 호버 시 툴팁

### 5-2. 기존 컴포넌트 수정

| 파일 | 변경 |
|---|---|
| `client/src/pages/Profile.tsx` | 단일 `<Row>` → `<DownloadStatsCard>` 교체. 라벨 "검색 횟수" → "다운로드 횟수"로 일관성. |
| `client/src/pages/History.tsx` | 헤더에 "총 N건 (성공 N / 실패 M / 성공률 X%)" 추가 요약 |
| `client/src/components/Navbar.tsx` | (옵션) 로그인 시 Navbar 우측에 미니 카운터 표시 |
| `client/src/services/api.ts` | `getMyStats()` 함수 1개 추가 (옵션: 캐싱 30초) |

### 5-3. Phase 1 와이어프레임 (Profile 페이지)

```
┌────────────────────────────────────────────┐
│ 계정정보                                  │
├────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│ │오늘  │ │ 7일  │ │ 30일 │ │ 누적 │      │
│ │  3   │ │  18  │ │  67  │ │ 234  │      │
│ │ 회   │ │  회  │ │  회  │ │  회  │      │
│ └──────┘ └──────┘ └──────┘ └──────┘      │
├────────────────────────────────────────────┤
│ 📊 입력 유형별 분포                       │
│  DOI    ████████████████  45  (67%)      │
│  arXiv  █████              14  (21%)      │
│  PMID   ███                 6  (9%)       │
│  URL    █                   2  (3%)       │
├────────────────────────────────────────────┤
│ ✅ 성공률: 91% (234 / 256건)              │
├────────────────────────────────────────────┤
│ 🏆 자주 쓴 OA 소스                        │
│  • arXiv                   78회          │
│  • Europe PMC              52회          │
│  • Zenodo                  34회          │
│  • Unpaywall               28회          │
│  • DOAJ                    19회          │
├────────────────────────────────────────────┤
│ (기존: 이메일, 닉네임, 플랜, 가입일)      │
└────────────────────────────────────────────┘
```

### 5-4. Phase 2 — 막대그래프 (옵션)

Profile 또는 새 탭:

```
최근 30일 다운로드 추이
   ┌                                    
 5 │              ▄                    
   │        ▄  ▄  █ ▄                  
 3 │     ▄  █  █  █ █  ▄  ▄             
   │  ▄  █  █  █  █ █  █  █  ▄  ▄       
 1 │  █  █  █  █  █ █  █  █  █  █  ...
   └────────────────────────────────── 
   6/1              6/15             6/30
```

---

## 6. DB 변경

**없음.** `paper_requests`와 `users.download_count` 기존 컬럼으로 충분.

> 인덱스 점검: `migrate.ts:157` `idx_paper_requests_user ON paper_requests(user_id)` 이미 존재. WHERE user_id = $1 필터에 충분.

---

## 7. 다국어 (i18n)

`client/src/i18n/dictionary.ts`에 추가할 키 (한/영):

| 한국어 | English |
|---|---|
| '오늘' | 'Today' |
| '최근 7일' | 'Last 7 days' |
| '최근 30일' | 'Last 30 days' |
| '누적 다운로드' | 'Total downloads' |
| '성공률' | 'Success rate' |
| '입력 유형별 분포' | 'Input type breakdown' |
| '자주 쓴 OA 소스' | 'Most used OA sources' |
| '최근 30일 다운로드 추이' | 'Last 30 days download trend' |
| '다운로드 횟수' | 'Download count' (Profile 라벨 교체) |

---

## 8. 구현 단계

### Phase 1 — 핵심 통계 카드 (1~2일)

- [ ] `userStatsController.ts` 신규 (CTE 쿼리)
- [ ] `/api/v1/users/me/stats` 라우트 등록
- [ ] `DownloadStatsCard.tsx` 컴포넌트 신규
- [ ] Profile 페이지에 카드 삽입, 기존 단일 Row 교체
- [ ] History 페이지 헤더 요약 추가
- [ ] i18n 키 9개 추가
- [ ] 로컬 테스트 (계정 2개로 비교)
- [ ] Render 배포 후 확인

### Phase 2 — 시각화 강화 (1일)

- [ ] `DailyBarChart.tsx` 컴포넌트 (CSS 막대)
- [ ] Profile 페이지 하단에 그래프 섹션 추가
- [ ] Navbar 미니 카운터 (옵션)
- [ ] 모바일 반응형 점검

### Phase 3 — 부가 기능 (옵션, 1일+)

- [ ] 다른 사용자 공개 여부 토글 (Profile 설정)
- [ ] 커뮤니티 페이지 "이번 주 Top 다운로더" 위젯 (프라이버시 옵트인만)
- [ ] CSV 내보내기 (자기 이력만)

---

## 9. 기술 결정 요약

| 항목 | 결정 | 이유 |
|---|---|---|
| 마이그레이션 | **불필요** | `paper_requests` 데이터 충분 |
| 차트 라이브러리 | **CSS만** | 외부 의존성 X, 번들 크기 0 |
| 통계 캐싱 | **없음 (Phase 1)** | 사용자 본인만 조회, 트래픽 적음. 필요 시 React Query 30s 캐시 |
| 다른 사용자 공개 | **기본 비공개** | 프라이버시 기본값 |
| 라벨 변경 | "검색 횟수" → "다운로드 횟수" | 의미 정합성 |
| `download_count` 컬럼 | **유지** | 누적 카운터의 빠른 조회용. 0인 사용자도 0으로 일관성 |

---

## 10. 의사결정 사항 (확정)

2026-06-25 사용자 확정 — 모두 기본 추천 A로 진행.

| # | 결정 | 선택 |
|---|---|---|
| ① | Phase 1 막대그래프 포함? | **A. 미포함** (Phase 2로 분리) |
| ② | Navbar 미니 카운터? | **B. 미표시** (Profile/History에서만) |
| ③ | 타인에게 카운트 공개? | **A. 완전 비공개** (Phase 3 옵션) |
| ④ | 입력 유형별 분포? | **A. 표시** |
| ⑤ | 성공/실패 비율? | **A. 표시** |
| ⑥ | "검색 횟수" 라벨? | **A. "다운로드 횟수"로 교체** |
| ⑦ | 검색 회수 카운터 추가? | **A. 포함** (검색 vs 다운로드 구분) |
| ⑧ | 통계 조회 권한? | **A. Admin 전용** (정정: 일반 사용자 본인도 볼 수 없음, admin만 자기 것 조회) |

### ⑧ 정정 배경 (2026-06-25 추가)

사용자 요구: "admin계정만 볼수있게 해야한다" — 통계 기능은 admin 전용으로 제한.
- 일반 사용자: 통계 카드/요약 표시 안 함, `/auth/me/stats` 호출 시 403
- admin(wheeljah@gmail.com): 기존대로 본인 통계 조회 가능

### Phase 1 변경 사항 (⑦ 반영)

- **카운터 4 → 8개**: 검색(오늘/7일/30일/누적) + 다운로드(오늘/7일/30일/누적)
- **응답 스키마**:
  ```typescript
  counters: {
    searches:  { today, week7, month30, total },  // 모든 시도
    downloads: { today, week7, month30, total },  // 성공만
  }
  ```
- **UI**: 2행 4열 카드 (상단: 검색, 하단: 다운로드) 또는 4행 비교형 리스트
- **라벨 문제 자동 해결**: 기존 "검색 횟수" 라벨 → 진짜 검색 횟수 표시 + 다운로드 횟수 별도 표시

### Phase 1 변경 사항 (⑧ 반영)

- **백엔드 가드**: `userStatsController.ts`에서 `req.userEmail !== ADMIN_EMAIL` → 403 응답
- **`User.isAdmin` 필드 추가**:
  - 서버: `/auth/login` 응답 `isAdmin: email === ADMIN_EMAIL`
  - 서버: `/auth/me` 응답에 `is_admin` (snake_case, raw row 패턴 유지)
  - 클라이언트: `User` 타입에 `isAdmin?: boolean`
- **프론트 분기**:
  - `Profile.tsx`: `isAdmin && <DownloadStatsCard />`
  - `History.tsx`: `isAdmin`일 때만 `/auth/me/stats` 호출 + 헤더에 통계 표시

### Phase 1 제외 항목

- **막대그래프** → Phase 2
- **"자주 쓴 OA 소스 Top 5"** → Phase 1에서 제외
  - 사유: `paper_requests.server_id` 컬럼이 스키마에만 존재, 실제 다운로드 시 어떤 OA 소스(Europe PMC, Zenodo 등)에서 성공했는지 기록 안 됨. `downloadService`가 여러 소스 순차 시도 구조라 단일 server_id로 표현 어려움. Phase 3에서 별도 작업 (소스 추적 컬럼 추가 + `downloadService` 패치) 필요.
- **admin의 다른 사용자 통계 조회** → Phase 3
  - 사유: 현재 `/me/stats`는 본인 통계만 반환. admin이 특정 사용자의 통계를 보려면 `/admin/users/:id/stats` 같은 별도 엔드포인트 + admin 패널 UI 필요.

### 작업량

| 항목 | 추가 |
|---|---|
| SQL | 8개 FILTER 조건 (검색/다운로드 × 4 기간) |
| TypeScript 타입 | 5줄 + `isAdmin` 1줄 |
| UI 카드 | 8개 (2행 4열) |
| i18n 키 | 4개 ("검색", "다운로드", "검색 횟수", "다운로드 횟수") |
| Admin 가드 | 백엔드 2줄 + 프론트 분기 2줄 |
| **총 작업량** | Phase 1 기준 1~2일 (검색 카운터 추가로 +30분, admin 가드로 +10분) |

---

## 11. 부록: 빠른 로컬 검증 SQL

Render 프로덕션 DB에서 직접 확인할 때:

```sql
-- 특정 사용자 통계
SELECT
  COUNT(*) FILTER (WHERE status='completed' AND created_at >= CURRENT_DATE) AS today,
  COUNT(*) FILTER (WHERE status='completed' AND created_at >= NOW() - INTERVAL '7 days') AS week7,
  COUNT(*) FILTER (WHERE status='completed' AND created_at >= NOW() - INTERVAL '30 days') AS month30,
  COUNT(*) FILTER (WHERE status='completed') AS completed,
  COUNT(*) FILTER (WHERE status='failed') AS failed
FROM paper_requests
WHERE user_id = 42;  -- 본인 user_id

-- 사용자별 Top 5 소스
SELECT
  COALESCE(ds.name, 'Direct') AS source,
  COUNT(*) AS cnt
FROM paper_requests pr
LEFT JOIN download_servers ds ON ds.id = pr.server_id
WHERE pr.user_id = 42 AND pr.status = 'completed'
GROUP BY ds.name
ORDER BY cnt DESC
LIMIT 5;

-- 30일 일별 추이
SELECT
  TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
  COUNT(*) AS cnt
FROM paper_requests
WHERE user_id = 42
  AND status = 'completed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1;
```

---

## 12. 작업 시작 가이드

Phase 1 진행 순서:

1. **백엔드 먼저** (테스트 가능해지면 프론트로 넘어감)
   - `userStatsController.ts` 작성 → 로컬에서 `curl -H "Authorization: Bearer ..." /api/v1/users/me/stats`로 응답 확인
2. **프론트 컴포넌트** (`DownloadStatsCard`)
   - 목업 데이터로 UI 먼저 잡고 → 실 API 연동
3. **Profile/History 페이지 통합**
4. **i18n 키 추가**
5. **Render 배포** → 본인 계정으로 검증
6. **Git 커밋** (DB 변경 없으니 마이그레이션 단계 스킵)

---

## 13. Phase 1 구현 완료 (2026-06-25)

### 백엔드

| 파일 | 변경 |
|---|---|
| `server/src/controllers/userStatsController.ts` | 신규 — CTE 단일 쿼리로 8개 카운터 + 성공률 + 입력유형 + 일별 추이 집계 |
| `server/src/routes/auth.ts` | `/me/stats` 라우트 추가 (requireAuth) |

**엔드포인트**: `GET /api/v1/auth/me/stats`
**응답 예시**:
```json
{
  "success": true,
  "data": {
    "counters": {
      "searches":  { "today": 3, "week7": 18, "month30": 67, "total": 234 },
      "downloads": { "today": 2, "week7": 15, "month30": 60, "total": 210 }
    },
    "success_rate": { "completed": 210, "failed": 24, "ratio": 0.897 },
    "input_types": [
      { "type": "doi",   "label": "DOI",   "count": 145 },
      { "type": "pmid",  "label": "PubMed","count": 30 },
      { "type": "arxiv", "label": "arXiv", "count": 25 },
      { "type": "url",   "label": "URL",   "count": 10 },
      { "type": "title", "label": "논문 제목", "count": 0 }
    ],
    "daily_30d": [
      { "day": "2026-05-26", "cnt": 5 },
      ...
    ]
  }
}
```

### 프론트

| 파일 | 변경 |
|---|---|
| `client/src/components/DownloadStatsCard.tsx` | 신규 — 8개 카운터 + 성공률 + 입력유형 분포 카드 |
| `client/src/pages/Profile.tsx` | 단일 `<Row>` 제거, `<DownloadStatsCard />` 삽입 |
| `client/src/pages/History.tsx` | 헤더에 누적 성공/실패/성공률 요약 추가 (`/auth/me/stats` 호출) |
| `client/src/i18n/dictionary.ts` | 검색/다운로드/성공률/입력유형/오늘/7일/30일/누적 등 9개 키 추가, 기존 "검색 횟수" 제거 |

### 빌드 검증

- ✅ `server` `npm run build` → tsc 통과
- ✅ `client` `npm run build` → tsc -b + vite build 통과

### 다음 단계

1. **Render 배포** (git push → 자동 배포)
2. **본인 계정 검증** (Profile 페이지에서 카드 표시 확인, History 페이지 → 헤더 요약 확인)
3. **Phase 2 결정** — 막대그래프 (일별 추이 차트) 필요해지면 `DailyBarChart.tsx` 추가 (응답에 이미 `daily_30d` 포함돼 있음, 데이터 작업은 끝남)

---

## 14. Phase 2 — Admin의 전 사용자 통계 조회 (2026-06-25)

### 사용자 요구 정정

> "전 사용자 계정에 대한 통계를 보고싶은 거야"

기존 Phase 1은 admin 본인의 통계만 조회 가능했음. Phase 2에서 admin이 모든 사용자의 통계를 조회할 수 있도록 확장.

### 추가 구현

#### 백엔드

| 파일 | 변경 |
|---|---|
| `userStatsController.ts` | CTE 쿼리를 `computeUserStats(userId)` 헬퍼로 추출 — 본인/타인 통계 모두 재사용 |
| `adminController.ts` | 2개 엔드포인트 추가 |
| `routes/admin.ts` | `/stats/all`, `/users/:id/stats` 라우트 등록 |

**새 엔드포인트**:

1. `GET /api/v1/admin/users/:id/stats`
   - admin이 특정 사용자의 상세 통계 조회
   - 응답: `{ user: {id, email, nickname, tier, created_at}, counters, success_rate, input_types, daily_30d }`

2. `GET /api/v1/admin/stats/all`
   - 전체 사용자 집계 + Top 10 리더보드 + 입력 유형 분포
   - 응답:
     ```json
     {
       "aggregate": {
         "user_count": 234, "searches_total": 5432,
         "downloads_total": 4987, "failed_total": 445,
         "downloads_today": 23, "downloads_7d": 156,
         "success_ratio": 0.918
       },
       "leaderboard": [
         { "id": 42, "email": "researcher@univ.edu", "nickname": "Dr. Kim",
           "downloads": 234, "searches": 267, "failures": 33 },
         ...
       ],
       "input_distribution": [
         { "input_type": "doi", "cnt": 3200 },
         ...
       ]
     }
     ```

#### 프론트

| 파일 | 변경 |
|---|---|
| `DownloadStatsCard.tsx` | `userId?: number`, `title?`, `refreshKey?` props 추가 → userId 있으면 `/admin/users/:id/stats` 호출 |
| `UserStatsModal.tsx` | 신규 모달 — 사용자 정보 + DownloadStatsCard, ESC 닫기, 새로고침 버튼 |
| `Admin.tsx` | "📊 전체 사용자 통계" 섹션 (집계 + 리더보드 + 입력유형), 가입자 행에 "통계" 버튼 추가 → UserStatsModal 오픈 |
| `dictionary.ts` | 14개 새 키 추가 (전체 사용자 통계, 리더보드, 입력유형, 닫기, 새로고침 등) |

### Admin 페이지 새 레이아웃

```
┌────────────────────────────────────────────────┐
│ 관리자                                          │
├────────────────────────────────────────────────┤
│ [총 가입자]  [총 다운로드]  [에러 보고]  [DB]   │  (기존 4 카드)
├────────────────────────────────────────────────┤
│ 📊 전체 사용자 통계 (신규)                       │
│ [전체 검색]  [전체 다운로드]  [오늘]  [실패]    │
│                                                 │
│ 🏆 Top 10              │ 📥 입력 유형 분포      │
│ 1. researcher@..  ↓234│ DOI       ████  64%  │
│ 2. prof@..         ↓189│ arXiv     ██    18% │
│ 3. ...                │ PMID      █     9%  │
├────────────────────────────────────────────────┤
│ [가입자 (N)] [다운로드 이력 (N)]               │
│ ┌─────────────────────────────────────┐       │
│ │ ID  이메일  ...  액션               │       │
│ │ 42  r@univ  ...  [통계] [삭제]      │ ← 신규│
│ └─────────────────────────────────────┘       │
└────────────────────────────────────────────────┘
```

클릭 시 모달:

```
┌──────────────────────────────────┐
│ 📊 사용자 통계         🔄  ×  │
│ researcher@univ.edu             │
├──────────────────────────────────┤
│ 닉네임: Dr. Kim    플랜: 무료   │
│ 가입일: 2026-01-15              │
├──────────────────────────────────┤
│ 📊 다운로드 통계                 │
│ 🔍 검색 (시도)                  │
│  [오늘 3] [7일 18] [30일 67] [누적 267] │
│ 📥 다운로드 (성공)              │
│  [오늘 2] [7일 15] [30일 60] [누적 234] │
│                                  │
│ ✅ 성공률 87% (234/267)         │
│ 입력 유형별                     │
│  DOI    ████████  189           │
│  arXiv  ███       34            │
│  PMID   █         11            │
├──────────────────────────────────┤
│          [닫기]                  │
└──────────────────────────────────┘
```

### 빌드 검증

- ✅ `server` `npm run build` → tsc 통과
- ✅ `client` `npm run build` → tsc -b + vite build 통과 (번들 451KB, +7KB)

### 권한 모델

| 엔드포인트 | 본인 | Admin | 일반 사용자 |
|---|---|---|---|
| `GET /auth/me/stats` | ✅ (admin만) | ✅ | ❌ 403 |
| `GET /admin/users/:id/stats` | ❌ 403 | ✅ | ❌ 403 |
| `GET /admin/stats/all` | ❌ 403 | ✅ | ❌ 403 |

`auth.ts` 라우트의 가드는 `requireAuth` + 컨트롤러 내부 `req.userEmail !== ADMIN_EMAIL` 체크.
`admin.ts` 라우트는 `router.use(requireAuth)` + 컨트롤러 내부 `guard()` 함수.

### 남은 작업 (Phase 3 후보)

- **막대그래프** (일별 추이) — `daily_30d` 데이터는 이미 응답에 포함됨. `DailyBarChart.tsx` 추가만 하면 됨.
- **OA 소스별 분포** — `paper_requests.server_id` 컬럼 추적 추가 필요 (`downloadService` 패치)
- **CSV/Excel 내보내기** — `/admin/stats/all.csv` 등
- **기간 필터** — 오늘/7일/30일/all 선택 UI

---

**의사결정 잠금**: 모든 결정 (①~⑧) 기본 추천 A로 확정.