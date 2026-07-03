# visitor-stats — 웹사이트 방문자 통계 모듈

어느 Next.js + Supabase 프로젝트에 5분이면 추가 가능한 독립 모듈. 페이지 자동 추적 + 어드민 대시보드 + 국가/지역 통계까지 한 번에.

## 포함된 것

| 파일 | 역할 |
|---|---|
| `server/types.ts` | 공통 타입 (`VisitorStats`, `DeviceType` 등) |
| `server/geo.ts` | IP/UA → 국가·시/도·도시 파싱 (Vercel/Cloudflare 호환) |
| `server/device.ts` | UA → 디바이스/브라우저/OS 분류 (봇 감지 포함) |
| `server/tracker.ts` | `VisitorTracker` 클래스 + `VisitorDB` 인터페이스 |
| `client/PageViewTracker.tsx` | 페이지 추적 React 컴포넌트 (pathname 변경 시 자동 POST) |
| `client/VisitorStatsDashboard.tsx` | 재사용 가능한 어드민 대시보드 컴포넌트 |
| `migrations/001_page_views.sql` | Supabase 스키마 + RPC 함수 (전체 마이그레이션) |

## 3-step 설치

### Step 1. SQL 마이그레이션 적용

Supabase SQL Editor에서 `migrations/001_page_views.sql` 파일 내용 실행.

또는 `psql`/`supabase db push` 사용:
```bash
psql "$SUPABASE_DB_URL" -f lib/visitor-stats/migrations/001_page_views.sql
```

### Step 2. 클라이언트 추적기 마운트

```tsx
// app/layout.tsx
import { PageViewTracker } from '@/lib/visitor-stats'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PageViewTracker />
        {children}
      </body>
    </html>
  )
}
```

### Step 3. Track API 라우트

```ts
// app/api/track-view/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { VisitorTracker, createSupabaseVisitorDB } from '@/lib/visitor-stats'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const tracker = new VisitorTracker(createSupabaseVisitorDB(supabaseAdmin))

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const result = await tracker.track(req, body)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
```

### Step 4. (선택) 어드민 대시보드

```tsx
// app/admin/visitors/page.tsx
import { VisitorStatsDashboard } from '@/lib/visitor-stats'

export default function Page() {
  return (
    <VisitorStatsDashboard
      endpoint="/api/visitor-stats"
      loginPath="/admin"
      title="방문자 통계"
      backHref="/admin/dashboard"
    />
  )
}
```

```ts
// app/api/visitor-stats/route.ts (인증 필요)
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { VisitorTracker, createSupabaseVisitorDB } from '@/lib/visitor-stats'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const tracker = new VisitorTracker(createSupabaseVisitorDB(supabaseAdmin))

async function isAuth() {
  const c = await cookies()
  return c.get('admin_session')?.value === 'authenticated'
}

export async function GET(req: NextRequest) {
  if (!(await isAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const days = Number(new URL(req.url).searchParams.get('days') ?? 30)
  return NextResponse.json(await tracker.getStats(days))
}
```

## 커스터마이징

### 추적 제외할 페이지 지정

```tsx
<PageViewTracker
  excludePrefixes={['/admin', '/api/', '/private/']}
  debug={process.env.NODE_ENV === 'development'}
/>
```

### API endpoint 변경

```tsx
<PageViewTracker endpoint="/api/track" />
```

### 대시보드 다크모드

```tsx
<VisitorStatsDashboard
  darkMode
  locale="en"        // 'ko' | 'en' | 'string'
  periodOptions={[1, 7, 30]}
  onUnauthorized="logout"  // 401 시 localStorage 정리
/>
```

## DB 인터페이스 교체 (Supabase → 다른 DB)

`VisitorDB` 인터페이스 구현 후 주입:

```ts
// 예: D1, PlanetScale, 자체 DB
import type { VisitorDB } from '@/lib/visitor-stats'

const myDb: VisitorDB = {
  async insertPageView(record) { /* ... */ return { ok: true, id: 'xxx' } },
  async getRecentDuplicate(sid, path, winMs) { /* ... */ return false },
  async getStats(daysBack, { topPathsLimit, recentLimit }) { /* ... */ return stats },
}

const tracker = new VisitorTracker(myDb)
```

`server/tracker.ts`의 `createSupabaseVisitorDB` 구현이 어떻게 생겼는지 참고 — 같은 인터페이스로 다른 DB에 맞게 구현하면 됨.

## 추적 원리

1. **세션 ID**: `sessionStorage`에 UUID 저장 (브라우저 종료 시 삭제)
2. **중복 방지**: 같은 세션 + 같은 path + 30분 이내 재방문은 카운트 안 함
3. **IP 비식별화**: 원본 IP 저장 안 함, 32-bit hash만 저장 (GDPR 친화)
4. **지리 정보**: Vercel/Cloudflare 헤더 자동 감지 (배포 환경 자동 작동)
5. **봇 제외**: Googlebot, crawler 등은 `device_type='bot'`으로 분류되어 통계에서 선택적 제외 가능

## 환경별 헤더

| 환경 | 국가 헤더 | 시/도 헤더 | 도시 헤더 |
|---|---|---|---|
| Vercel | `x-vercel-ip-country` | `x-vercel-ip-country-region` | `x-vercel-ip-city` |
| Cloudflare | `cf-ipcountry` | `cf-region-code` | `cf-ipcity` |
| 그 외 | `X-Country-Code` | `X-Region-Code` | (없음) |

`extractGeo()` 함수가 위 모든 헤더를 자동 순회해서 찾음.

## 디폴트 통계 출력 형식

```ts
interface VisitorStats {
  totalViews: number
  uniqueSessions: number
  todayViews: number
  todayUnique: number
  topPaths: { path: string; views: number; unique_visitors: number }[]
  dailyTrend: { day: string; views: number; unique_visitors: number }[]
  recentViews: {
    id: string
    path: string
    session_id: string
    country: string | null
    country_name: string | null
    region: string | null
    city: string | null
    device_type: 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown' | null
    created_at: string
  }[]
  byCountry: { country_code: string; country_name: string | null; views: number; unique_visitors: number }[]
  byRegion: { region: string; views: number; unique_visitors: number }[]   // KR 한정
  byDevice: { device_type: string; views: number }[]
}
```

## 라이선스

MIT — 마음대로 사용/수정/배포 가능.