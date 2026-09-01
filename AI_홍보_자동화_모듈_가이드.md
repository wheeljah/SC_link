# AI 홍보 자동화 모듈 가이드 (Promotion Agent Module)

ai-traffic.kr(BidVibe) 프로젝트에 구축한 "AI 홍보 에이전트" 중 자동화 로직만 떼어내 다른 프로젝트에 이식할 수 있도록 정리한 모듈 문서입니다. 원본 위치는 `web/` (Next.js 14 App Router + Supabase + Vercel) 기준입니다.

## 1. 이 모듈이 하는 일

키워드/채널을 기반으로 LLM(MiniMax)이 홍보 콘텐츠를 생성·평가·개선하고, 그중 두 채널(자사 블로그, X)에 한해 실제로 자동 게시까지 수행합니다. 나머지 채널(네이버블로그·티스토리·커뮤니티 등)은 공식 게시 API가 없어(대부분 스팸 방지 목적으로 폐지됨) 초안 생성 + 수동 복사까지만 지원합니다. 이 설계는 의도적입니다 — 자동화 대상을 넓히려는 유혹을 이 문서에서도 그대로 이어가지 마세요. 새 채널을 추가할 땐 반드시 "공식 게시 API가 있는가"부터 확인하세요(§7 참고).

## 2. 전제 조건

- Next.js App Router (13+), TypeScript
- Supabase(Postgres) — `@supabase/supabase-js`로 `service_role` 키를 쓰는 관리자 API 패턴
- Vercel 배포 (Cron, 서버리스 함수)
- 관리자 인증 — 쿠키 기반 세션(`admin_session` 쿠키 존재 확인) 같은 자체 admin 인증이 이미 있어야 함. 없으면 `lib/promotion/admin-auth.ts`의 `isAuthenticated()`를 프로젝트의 인증 방식으로 교체해야 함
- (선택) 자사 블로그가 git 저장소 내 마크다운 파일 기반일 것 — GitHub 커밋 발행 기능을 쓰려면 필요
- (선택) X(트위터) 계정 + Developer 결제 등록 — X 발행 기능을 쓰려면 필요

## 3. 파일 구성

```
lib/promotion/
  admin-auth.ts       # Supabase 서비스 클라이언트 + isAuthenticated() — ★프로젝트별 교체 필요
  minimax.ts          # MiniMax(OpenAI 호환) 채팅 완성 헬퍼 (fetch 기반, SDK 불필요)
  fetch-page.ts        # 외부 URL → 텍스트 추출 (경쟁사 분석용, HTML 태그 제거)
  github-blog.ts       # GitHub Contents API로 자사 블로그(md 파일) 커밋 발행 — ★frontmatter 스키마 프로젝트별 확인
  indexnow.ts           # IndexNow 핑 (Naver/Bing 등에 신규 URL 즉시 통보) — ★HOST/키 프로젝트별 교체
  twitter.ts             # X API v2 OAuth 1.0a 서명 + 게시 (외부 SDK 없음)

app/api/admin/promotion/
  stats/route.ts                 # 통계 + 채널/상태 분포
  logs/route.ts                  # 목록 조회 + AI 콘텐츠 생성(POST)
  keywords/route.ts, keywords/[id]/route.ts   # 키워드 CRUD
  channels/route.ts, channels/[id]/route.ts   # 채널 CRUD
  config/route.ts                # 자동화 설정 (key-value)
  analyze/route.ts                # 경쟁사 URL 분석 (fetch-page + LLM)
  quality-score/route.ts          # AI 품질 4차원 평가
  batch-generate/route.ts          # 여러 채널 일괄 생성
  improve/route.ts                 # 기존 콘텐츠 AI 개선
  check-duplicate/route.ts          # 콘텐츠 중복도 검사
  summary-report/route.ts           # 일일/주간 요약 리포트
  trend-suggest/route.ts             # LLM 지식 기반 트렌드 제안 (실시간 검색 아님)
  activity-feed/route.ts             # 통합 활동 피드
  keyword-performance/route.ts        # 키워드별 성과 분석
  calendar/route.ts                    # 날짜별 캘린더 뷰
  export/route.ts                       # CSV/JSON 내보내기
  publish/route.ts                       # ★핵심: 실게시 분기 (own_blog/twitter_api/manual)

app/api/cron/promotion-agent/route.ts    # Vercel Cron — 주기 실행 + (옵션) 자동 실게시
app/admin/promotion/page.tsx              # 관리 UI (6탭: 대시보드/콘텐츠/키워드/채널/경쟁사분석/설정)

supabase/migrations/
  NNN_promotion_agent.sql            # promotion_logs/keywords/channels/config 4테이블 + RLS
  NNN_promotion_publish_method.sql    # channels.publish_method 컬럼 (manual/own_blog/twitter_api)

vercel.json         # crons 배열에 promotion-agent 항목 추가
public/{키}.txt      # IndexNow 소유 인증 파일
```

## 4. 데이터 모델 요약

4개 테이블, 전부 `service_role`만 접근 가능(RLS 활성화, 정책 없음 → anon/authenticated 접근 차단).

- **promotion_logs** — 생성된 콘텐츠. `channel`(blog/community/qna/social/review), `channel_name`, `title`, `content`, `keywords`(콤마 구분 문자열), `status`(draft/published/failed), `target_url`, `result`, `published_at`.
- **promotion_keywords** — `keyword`, `category`, `is_active`.
- **promotion_channels** — `name`, `type`, `url`, `is_active`, **`publish_method`**(manual/own_blog/twitter_api — 실게시 자동화 분기의 핵심 컬럼).
- **promotion_config** — key-value. 주요 키: `auto_enabled`(cron이 초안 생성할지), `auto_publish`(cron이 실제 발행까지 할지 — 기본 false, 명시적 옵트인), `interval_hours`, `tone`, `target_url`.

다른 DB(Prisma/MySQL 등)를 쓰는 프로젝트에 이식하려면 이 4테이블을 해당 ORM 스키마로 재작성하고, 모든 라우트의 `supabaseAdmin.from(...)` 호출을 프로젝트의 쿼리 방식으로 바꿔야 합니다. 이 모듈 자체는 Supabase에 강하게 결합되어 있습니다.

## 5. 실게시 두 채널 상세

### 5-1. 자사 블로그 — GitHub 커밋 + IndexNow

Vercel 서버리스는 배포 시점 파일 스냅샷만 읽고 런타임에 새 파일을 쓸 수 없으므로, "게시"는 GitHub Contents API로 저장소에 커밋을 만드는 방식입니다.

1. `publishOwnBlogPost({ title, content, tags })` 호출 → 슬러그 `promo-{timestamp}` 생성 → frontmatter(title/date/excerpt/tags/author) 조립.
2. `PUT /repos/{owner}/{repo}/contents/{path}` (base64 인코딩된 본문, 커밋 메시지, 브랜치) 호출.
3. GitHub→Vercel 자동 배포 연동이 있으면 1~2분 내 실제 사이트에 반영.
4. `pingIndexNow([url])` — `api.indexnow.org`(Bing 등)와 `searchadvisor.naver.com`(네이버) 양쪽에 URL 통보.

**필요 환경변수**: `GITHUB_TOKEN`(Contents: Read/write 권한만 가진 Fine-grained PAT, 해당 저장소로 scope 제한 권장), `GITHUB_REPO`(owner/repo), `GITHUB_BRANCH`(기본 main).

**이식 시 확인할 것**: `github-blog.ts`가 만드는 frontmatter 필드(title/date/excerpt/tags/author)와 경로(`content/blog/{slug}.md`)가 대상 프로젝트의 블로그 파서(gray-matter 등)와 일치해야 합니다. 다르면 `publishOwnBlogPost()`의 `toFrontmatter()`와 경로 문자열을 프로젝트에 맞게 수정하세요. `indexnow.ts`의 `HOST` 상수와 IndexNow 키도 도메인마다 새로 발급해야 합니다(키는 비밀값이 아니라 `https://{도메인}/{키}.txt`로 공개 배포하는 소유 증빙용 토큰이라 코드에 상수로 둬도 무방).

### 5-2. X(트위터) — 공식 API v2, OAuth 1.0a

`twitter.ts`가 외부 SDK 없이 OAuth 1.0a 서명을 직접 구현합니다(회사 계정 1개로만 게시하는 용도라 3-legged 로그인 없이 고정 Access Token 사용).

1. `oauth_*` 파라미터를 키 정렬 후 인코딩해 파라미터 문자열 생성.
2. `METHOD&인코딩URL&인코딩파라미터`로 signature base string 생성.
3. `consumerSecret&accessTokenSecret`를 키로 HMAC-SHA1 → base64 → `oauth_signature`.
4. `Authorization: OAuth ...` 헤더로 `POST https://api.x.com/2/tweets` 호출. 280자 초과 시 잘라서 전송.

**필요 환경변수**: `X_API_KEY`, `X_API_SECRET`(Consumer Keys), `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`(반드시 Read and Write 권한으로 재발급 — 기본은 Read-only), 선택 `X_HANDLE`.

**주의**: 2026년 2월부터 완전 종량제(무료 티어 없음, 텍스트 $0.015/건, 링크 포함 $0.20/건). X Developer Portal에 결제수단 등록 필수. 이 부분은 프로젝트 이식 시 그대로 재사용 가능합니다(브랜드 종속성 없음).

## 6. 다른 프로젝트로 이식하는 절차

1. `lib/promotion/`, `app/api/admin/promotion/`, `app/api/cron/promotion-agent/`, `app/admin/promotion/page.tsx`를 통째로 복사.
2. `lib/promotion/admin-auth.ts`의 `isAuthenticated()`를 대상 프로젝트의 실제 인증 방식으로 교체 (세션 쿠키명, JWT 검증 등).
3. Supabase 마이그레이션 2개를 대상 프로젝트의 `supabase/migrations/`에 번호를 이어서 추가하고 적용.
4. 모든 라우트/`page.tsx`에 하드코딩된 브랜드 문자열을 찾아 치환 — `ai-traffic.kr`, `BidVibe` 등 (특히 `logs/route.ts`, `batch-generate/route.ts`, `analyze/route.ts`, `summary-report/route.ts`, `app/api/cron/promotion-agent/route.ts`의 LLM 프롬프트 문자열).
5. `github-blog.ts`의 frontmatter/경로를 대상 블로그 구조에 맞게 조정 (own_blog 기능을 쓸 경우).
6. `indexnow.ts`의 `HOST`를 대상 도메인으로 바꾸고, 새 IndexNow 키를 생성해 `public/{키}.txt`로 배포.
7. 대상 admin 대시보드에 진입 카드(Link) 하나 추가 — `app/admin/dashboard/page.tsx`에서 했던 것처럼 `/admin/promotion`으로 연결.
8. `vercel.json`의 `crons` 배열에 promotion-agent 항목 추가 (Hobby 플랜은 cron이 하루 1회로 제한됨에 유의).
9. 환경변수 설정 (§8 전체 목록) 후 배포, 관리 UI에서 키워드/채널 시드 데이터 등록.

## 7. 새 실게시 채널을 추가하고 싶다면

`publish_method` enum에 새 값(`'manual' | 'own_blog' | 'twitter_api'`)을 추가하고, `publish/route.ts`와 cron 라우트의 분기(`if (publishMethod === '...')`)에 새 케이스를 넣는 구조라 확장은 쉽습니다. 다만 새 채널을 추가하기 전에 반드시 다음을 확인하세요.

- 그 플랫폼에 **공식** 게시 API가 있는가 (스크래핑/브라우저 자동화는 대상에서 제외 — ToS 위반, 계정 차단, 표시 없는 홍보물은 국내 표시광고법상 리스크)
- API가 유료라면 요청당 비용과 사용자의 결제 승인 여부
- 인증 방식(OAuth1/OAuth2/API Key)에 맞는 서명 헬퍼를 `lib/promotion/`에 새로 추가

## 8. 환경변수 전체 목록

| 변수 | 용도 | 필수 여부 |
|---|---|---|
| `MINIMAX_API_KEY` | 콘텐츠 생성/평가/개선/트렌드 제안 | 모듈 핵심 기능에 필수 |
| `MINIMAX_MODEL` | 기본값 MiniMax-M2 | 선택 |
| `GITHUB_TOKEN` | 자사 블로그 커밋 발행 | own_blog 기능 사용 시 필수 |
| `GITHUB_REPO` | owner/repo | 〃 |
| `GITHUB_BRANCH` | 기본 main | 〃 |
| `X_API_KEY` / `X_API_SECRET` | X Consumer Keys | twitter_api 기능 사용 시 필수 |
| `X_ACCESS_TOKEN` / `X_ACCESS_TOKEN_SECRET` | X Access Token (Read/Write) | 〃 |
| `X_HANDLE` | 트윗 URL 표시용 | 선택 |
| `CRON_SECRET` | cron 라우트 인증 (기존 프로젝트 관행 재사용) | 권장 |

## 9. 알려진 제약사항 (그대로 이식됨)

- 실시간 웹 검색 없음 — 트렌드 제안은 MiniMax의 학습 지식 기반이며 UI에 "실시간 검색 아님"으로 명시됩니다.
- 실게시는 own_blog/twitter_api 2개 채널만 지원. 나머지는 초안까지만.
- cron 자동 실게시는 `config.auto_publish` 명시적 옵트인 필요 (기본 false) — 실수로 자동 트윗/블로그 게시되는 사고 방지용 안전장치이니 이식 후에도 유지 권장.
- Vercel Hobby 플랜은 cron 실행이 하루 1회로 제한됨(플랫폼 제약, 모듈 문제 아님).
