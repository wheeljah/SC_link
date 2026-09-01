# AI 홍보 자동화 모듈 — ScholarLink 이식 계획

원본 가이드: [`AI_홍보_자동화_모듈_가이드.md`](./AI_홍보_자동화_모듈_가이드.md) (BidVibe, Next.js+Supabase+Vercel 기반)
대상: **ScholarLink** (Express + pg + Vite + React Router v6 + node-cron, Render 배포)

---

## 0. 결론 요약 (TL;DR)

- 가이드 모듈의 **로직/UX는 그대로**, 인프라 결합 부분(Supabase, Next.js App Router, Vercel Cron)만 SC_link 스택에 맞게 **재작성**한다.
- 핵심 비즈니스 로직 4개(콘텐츠 생성·평가·개선·실게시 분기)는 TypeScript 함수로 거의 그대로 이식 가능.
- DB 접근은 `supabaseAdmin.from(...)` → `pool.query(...)`, API는 Next.js Route Handler → Express Router, Cron은 Vercel Cron → `node-cron`.
- 마이그레이션은 별도 파일이 아닌 `server/src/db/migrate.ts`의 `RUNTIME_UPDATES` 배열에 추가 (SC_link 기존 패턴).
- **결정 필요 3가지** (브랜드 톤 / 실게시 채널 / LLM 키) 확정 후 Phase 1부터 순차 진행. 전체 작업량 **신규 TS 파일 ~20개 + 클라이언트 페이지 1개 + 수정 4파일** 규모.

---

## 1. 가이드 vs SC_link 환경 — 변환 매핑

| 가이드 모듈 (BidVibe) | ScholarLink 환경 | 작업 |
|---|---|---|
| Next.js App Router (`app/api/.../route.ts`) | Express Router (`server/src/routes/...`) | 라우트 핸들러 → Express 컨트롤러 함수로 재작성 |
| Supabase (`@supabase/supabase-js` + `service_role`) | `pg` Pool (`server/src/db/pool.ts`) | `supabaseAdmin.from(...).select()` → `pool.query(...)` |
| 쿠키 기반 admin 세션 (`admin_session`) | JWT Bearer (`requireAuth` 미들웨어) + `req.userEmail === ADMIN_EMAIL` 가드 | `isAuthenticated()` 교체, 기존 `adminController.guard()` 패턴 그대로 활용 |
| Vercel Cron (`vercel.json`) | `node-cron` (기존 `jobCrawlerService.initCrawlerCron()` 패턴) | 서버 부팅 시 cron 등록 (`app.ts`에서 호출) |
| Supabase RLS 정책 | RLS 없음 — `pool`이 단일 사용자 권한으로 동작 | 별도 권한 분리 불요 (이미 admin 전용 라우트 가드 존재) |
| `supabase/migrations/*.sql` | `server/src/db/migrate.ts`의 `RUNTIME_UPDATES` | 새 SQL 블록 추가 (단일 파일 패턴 유지) |
| Next.js Page (`app/admin/promotion/page.tsx`) | React Router v6 Page (`client/src/pages/PromotionAdmin.tsx`) | App Router `use client` → `useState/useEffect` 일반 컴포넌트 |
| GitHub Contents API (자사 블로그 발행) | ScholarLink은 별도 블로그 미보유 → **신규 필요 시 별도 작업** | Phase 결정에 따라 처리 |
| X API v2 OAuth 1.0a | 동일 SDK 없이 fetch 기반 (가이드 코드 그대로) | `lib/promotion/twitter.ts` → `server/src/services/promotion/twitter.ts`로 이식 |
| IndexNow | `pingIndexNow()` 동일 로직 | 그대로 이식 |
| LLM (`MINIMAX_API_KEY`, OpenAI 호환) | 동일 | 그대로 사용 (단, 모델명은 결정 필요) |
| `lib/promotion/admin-auth.ts` | `server/src/middleware/auth.ts`의 `requireAuth` + `adminController.guard()` | 신규 어댑터 1개만 작성 |

---

## 2. 신규/수정 파일 전체 목록

### 2-1. 서버 — 신규 (총 18개)

```
server/src/services/promotion/
  minimax.ts                 # LLM 호출 (가이드 그대로, OpenAI 호환)
  fetch-page.ts              # HTML → 텍스트 추출
  github-blog.ts             # 자사 블로그 발행 (Phase 결정 시)
  indexnow.ts                # IndexNow 핑
  twitter.ts                 # X API v2 OAuth 1.0a
  promotionAgentService.ts   # ★ 오케스트레이터 (cron + 수동 트리거 공용)
  publishService.ts          # ★ 채널별 실게시 분기 (own_blog/twitter_api/manual)

server/src/controllers/promotion/
  statsController.ts
  logsController.ts
  keywordsController.ts
  channelsController.ts
  configController.ts
  analyzeController.ts
  qualityScoreController.ts
  batchGenerateController.ts
  improveController.ts
  checkDuplicateController.ts
  summaryReportController.ts
  trendSuggestController.ts
  activityFeedController.ts
  keywordPerformanceController.ts
  calendarController.ts
  exportController.ts
  publishController.ts       # ★ 실게시 수동 트리거

server/src/routes/
  promotion.ts               # 17개 엔드포인트 묶음 (admin 가드)
```

### 2-2. 서버 — 수정 (3개)

```
server/src/db/migrate.ts         # RUNTIME_UPDATES에 4테이블 + 인덱스 시드 추가
server/src/app.ts                # initPromotionCron() 호출 추가 (jobCrawlerService와 동일 패턴)
server/src/services/jobCrawlerService.ts  # (참고) — promotion cron은 별도 파일
```

### 2-3. 클라이언트 — 신규 (1개) + 수정 (2개)

```
client/src/pages/PromotionAdmin.tsx          # ★ 6탭 통합 페이지 (Dashboard/Content/Keywords/Channels/CompetitorAnalysis/Settings)
client/src/services/api.ts                   # promotionApi 헬퍼 함수 묶음 추가
client/src/App.tsx                           # /admin/promotion 라우트 + AdminRoute 적용
client/src/pages/Admin.tsx                   # 진입 카드 1개 추가 (Link to /admin/promotion)
```

### 2-4. 인프라 — 수정 (1개)

```
render.yaml                                   # 환경변수 6개 추가 (아래 §6 표)
```

---

## 3. DB 스키마 (SC_link pg에 추가)

`server/src/db/migrate.ts`의 `RUNTIME_UPDATES` 배열에 다음 블록 추가. 가이드의 4테이블을 그대로 가져오되, SC_link 컨벤션(SERIAL PK, `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)에 맞춤.

```sql
-- ── AI 홍보 자동화 (2026-07-15 추가) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS promotion_logs (
  id           SERIAL PRIMARY KEY,
  channel      VARCHAR(50) NOT NULL,         -- blog/community/qna/social/review
  channel_name VARCHAR(255),
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  keywords     TEXT,                          -- 콤마 구분
  status       VARCHAR(20) DEFAULT 'draft'    -- draft/published/failed
                  CHECK (status IN ('draft','published','failed')),
  target_url   TEXT,
  result       JSONB,
  published_at TIMESTAMP,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_promotion_logs_status   ON promotion_logs(status);
CREATE INDEX IF NOT EXISTS idx_promotion_logs_channel  ON promotion_logs(channel);
CREATE INDEX IF NOT EXISTS idx_promotion_logs_created  ON promotion_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS promotion_keywords (
  id         SERIAL PRIMARY KEY,
  keyword    VARCHAR(255) UNIQUE NOT NULL,
  category   VARCHAR(50),
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_promotion_keywords_active ON promotion_keywords(is_active);

CREATE TABLE IF NOT EXISTS promotion_channels (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  type           VARCHAR(50)  NOT NULL,        -- blog/community/qna/social/review
  url            TEXT,
  is_active      BOOLEAN DEFAULT TRUE,
  publish_method VARCHAR(20) DEFAULT 'manual'  -- manual/own_blog/twitter_api
                  CHECK (publish_method IN ('manual','own_blog','twitter_api')),
  config         JSONB,                         -- 채널별 추가 설정 (예: twitter handle)
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotion_config (
  key            VARCHAR(100) PRIMARY KEY,
  value          TEXT,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 기본 config 시드
INSERT INTO promotion_config (key, value) VALUES
  ('auto_enabled',   'false'),   -- cron 자동 초안 생성 off
  ('auto_publish',   'false'),   -- cron 자동 실게시 off (안전장치, 가이드 권장)
  ('interval_hours', '24'),
  ('tone',           'academic_friendly'),
  ('target_url',     'https://wheeljah.github.io/SC_link/')
ON CONFLICT (key) DO NOTHING;
```

`promotion_logs`에 `tsvector` 인덱스(전문검색) 추가는 Phase 2 검토.

---

## 4. Phase별 작업 순서

### Phase 0 — 결정 확정 (사용자 확인 필요, 1~2일)

| # | 결정 | 옵션 | 기본 추천 |
|---|---|---|---|
| 1 | **홍보 브랜드 톤** | academic_friendly / professional / casual_kr | academic_friendly (논문 검색 서비스 톤) |
| 2 | **실게시 채널 사용 여부** | (a) 둘 다 사용 / (b) own_blog만 / (c) twitter_api만 / (d) 둘 다 안 함 (초안만) | (d) — 가이드 본문도 "초안까지만"을 안전한 기본값으로 권장 |
| 3 | **LLM 모델** | MiniMax-M2 (기본) / M3 / 외부 모델 | MiniMax-M2 (현재 AGENTS.md에 명시, 키 그대로 사용) |
| 4 | **own_blog 대상** | (a) 신규 SC_link 블로그 레포 생성 / (b) 기존 레포에 md 추가 / (c) 사용 안 함 | (c) — 별도 블로그가 없음. 필요해지면 별도 프로젝트 |
| 5 | **자사 채널 = 무엇?** | (a) ScholarLink 웹사이트 자체 / (b) github pages 의 /blog 섹션 / (c) 없음 | (a) — 사이트의 community/논문 추천 영역과 자연스럽게 연결 |

> 결정 1, 2, 3만 확정되면 Phase 1~5는 바로 진행 가능. 4, 5는 추후 별도 작업.

### Phase 1 — DB + 마이그레이션 (1일)

1. `server/src/db/migrate.ts`의 `RUNTIME_UPDATES`에 §3의 SQL 블록 추가
2. 로컬에서 `npm run db:migrate --prefix server`로 검증
3. Render 자동 마이그레이션은 `app.ts` 부팅 시 자동 실행 (기존 패턴, 변경 불요)

### Phase 2 — 백엔드 Services (3~4일)

1. `minimax.ts` — 가이드 코드 그대로, BASE_URL/모델명만 env에서
2. `fetch-page.ts` — cheerio 또는 단순 regex (cheerio는 이미 `server`에 설치됨)
3. `indexnow.ts` — 그대로 이식
4. `twitter.ts` — 그대로 이식 (Phase 0에서 (d) 선택 시에는 미사용, 그래도 코드는 둠)
5. `github-blog.ts` — Phase 0에서 (a/b) 선택 시에만 작성, 아니면 스킵
6. `publishService.ts` — `publish_method` 분기 (`'manual' | 'own_blog' | 'twitter_api'`)
7. `promotionAgentService.ts` — cron + 수동 트리거 공용. 기존 `jobCrawlerService.ts`의 `initCrawlerCron()` 패턴 그대로 모사.

**핵심**: `promotionAgentService.ts`의 cron 등록부는 `app.ts`의 부팅 비동기 블록에 추가:
```ts
try { initPromotionCron(); } catch (e) { console.warn('[promotion] init skipped:', (e as Error).message); }
```

### Phase 3 — Express 라우트 + 컨트롤러 (3~4일)

가이드의 17개 Route Handler를 Express 컨트롤러로 1:1 변환. 패턴:
```ts
// server/src/routes/promotion.ts
router.get('/stats', requireAuth, requireAdmin, statsController.get);
router.post('/logs', requireAuth, requireAdmin, logsController.generate);
// ...
```

`requireAdmin`은 `adminController.guard()`와 동일 로직을 미들웨어로 추출 (DRY):
```ts
// server/src/middleware/admin.ts
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userEmail !== (process.env.ADMIN_EMAIL || 'wheeljah@gmail.com')) {
    return res.status(403).json({ success: false, message: '권한이 없습니다.' });
  }
  next();
}
```

`app.ts`에 마운트:
```ts
app.use('/api/v1/admin/promotion', promotionRoutes);
```

### Phase 4 — Cron 등록 (0.5일)

`promotionAgentService.ts` 안에:
```ts
import cron from 'node-cron';
export function initPromotionCron() {
  if (process.env.PROMOTION_CRON_DISABLED === 'true') return;
  const expr = process.env.PROMOTION_CRON_EXPR || '0 9 * * *'; // KST 09:00 (Render TZ는 UTC이지만 한국 시간 사용자 다수)
  cron.schedule(expr, () => { runOnce().catch(console.error); });
  console.log('[promotion] cron registered:', expr);
}
```

가이드의 "Vercel Hobby = 1일 1회 제한" 이슈는 Render/node-cron에선 해당 없음 — 자유롭게 간격 설정 가능. 단, `auto_publish=false` 기본값 유지.

### Phase 5 — 프론트엔드 (2~3일)

1. `client/src/services/api.ts`에 `promotionApi` 헬퍼 묶음 추가 (예: `getStats()`, `generateContent(payload)`, ...)
2. `client/src/pages/PromotionAdmin.tsx` — 6탭 페이지. 기존 `Admin.tsx`의 탭 UI 패턴(`useState<'tab1' | 'tab2'>`) 그대로 모사
3. `client/src/App.tsx`에 `<Route path="/admin/promotion" element={<AdminRoute><PromotionAdmin /></AdminRoute>} />` 추가
4. `client/src/pages/Admin.tsx`에 진입 카드 1개 (`<Link to="/admin/promotion">AI 홍보 →</Link>`)

### Phase 6 — 환경/배포 (0.5일)

`render.yaml` envVars에 §6 표 6개 추가 후 push → 자동 배포 + 마이그레이션.

### Phase 7 — 시드 + 검증 (0.5일)

관리 UI에서 키워드 3~5개 / 채널 1~2개 시드 → 1회 수동 트리거 → 초안 생성 → 품질 점수 확인 → (Phase 0에서 실게시 결정 시) 1회 실게시 테스트.

---

## 5. 의존성 (모두 가볍거나 이미 설치됨)

- `cheerio` — ✅ 이미 설치 (`server/package.json`)
- `axios` — ✅ 이미 설치
- `node-cron` — ✅ 이미 설치
- **없음** — LLM 호출은 fetch 기반 (가이드 패턴), 트위터는 직접 OAuth 서명, GitHub는 Contents API. 외부 SDK 추가 **0개**.

---

## 6. 환경변수 (`render.yaml` 추가분)

| 변수 | 용도 | 필수 | 기본값 |
|---|---|---|---|
| `MINIMAX_API_KEY` | LLM 콘텐츠 생성/평가/개선/트렌드 | 필수 (없으면 모듈 전체 비활성) | (없음) |
| `MINIMAX_MODEL` | 모델명 | 선택 | `MiniMax-M2` |
| `GITHUB_TOKEN` | own_blog 기능용 | own_blog 사용 시 필수 | (없음) |
| `GITHUB_REPO` | `owner/repo` 형식 | 〃 | (없음) |
| `GITHUB_BRANCH` | 발행 대상 브랜치 | 〃 | `main` |
| `X_API_KEY` / `X_API_SECRET` | twitter_api 기능용 | twitter_api 사용 시 필수 | (없음) |
| `X_ACCESS_TOKEN` / `X_ACCESS_TOKEN_SECRET` | X Access Token (Read/Write 권한) | 〃 | (없음) |
| `X_HANDLE` | 트윗 URL 표시용 | 선택 | (없음) |
| `PROMOTION_CRON_DISABLED` | `true`면 cron 비활성 (수동만) | 선택 | `false` |
| `PROMOTION_CRON_EXPR` | cron 표현식 | 선택 | `0 9 * * *` (KST 18:00, Render는 UTC) |

> ⚠️ `MINIMAX_API_KEY`는 Render 대시보드에서 수동 주입 권장 (가이드 §8과 동일).

---

## 7. 안전장치 (가이드 §9 그대로 이식)

1. `promotion_config.auto_publish` 기본값 **`false`** — cron이 초안만 생성, 실게시는 관리자 명시 클릭 시에만.
2. 실게시 2채널(own_blog / twitter_api)은 Phase 0에서 명시적으로 켜야만 동작.
3. `PROMOTION_CRON_DISABLED=true`로 cron 자체를 끌 수 있는 킬 스위치 제공.
4. 모든 admin API는 `requireAuth` + `requireAdmin` 이중 가드.
5. 가이드 §7의 경고 그대로 — "공식 게시 API가 있는가"를 항상 먼저 확인. 자동화 채널을 무분별하게 늘리지 않음.

---

## 8. 작업 분량 추정 (1인 기준)

| Phase | 예상 시간 | 산출물 |
|---|---|---|
| 0 | 1~2일 | 결정 확정 |
| 1 | 0.5일 | migrate.ts 수정 |
| 2 | 3~4일 | services/* 7개 |
| 3 | 3~4일 | controllers/* + routes/* 18개 |
| 4 | 0.5일 | cron |
| 5 | 2~3일 | PromotionAdmin.tsx + 진입 |
| 6 | 0.5일 | render.yaml + 배포 |
| 7 | 0.5일 | 시드 + 검증 |
| **합계** | **약 10~15일** | 신규 19 + 수정 4 파일 |

`task` 서브에이전트에 delegation으로 쪼개면 (Phase 2 services 묶음, Phase 3 controllers 묶음) 더 빠르게 가능.

---

## 9. 다음 단계 (확정 시)

사용자가 Phase 0 결정(톤, 실게시, LLM)을 확정하면:
1. Phase 1(마이그레이션)부터 시작
2. Phase 2, 3은 services/controllers 묶음으로 분리해 서브에이전트에 delegation 가능
3. Phase 5(프론트엔드)는 1개 페이지로 묶어서 delegation 가능
4. 각 Phase 끝나면 검증 → 다음 Phase 진행

> 결정만 알려주면 바로 들어갈 수 있음. 일단 결정 보류하고 싶으면 그대로 두고 다음에 알려줘.
