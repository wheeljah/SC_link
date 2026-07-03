// lib/visitor-stats/server/tracker.ts
// 페이지뷰 기록 + 통계 조회 비즈니스 로직
// Supabase 의존하지만, generic DB 인터페이스 사용 → 다른 DB로 교체 가능

import type {
  PageViewInsert,
  VisitorStats,
  VisitorStatsOptions,
} from './types'
import { extractGeo, hashIp } from './geo'
import { detectDevice } from './device'

/** DB 인터페이스 — Supabase든 다른 구현체든 이걸 구현하면 OK */
export interface VisitorDB {
  insertPageView(record: PageViewInsert): Promise<{ ok: boolean; id?: string; deduped?: boolean; error?: string }>
  getRecentDuplicate(sessionId: string, path: string, windowMs: number): Promise<boolean>
  getStats(daysBack: number, opts: { topPathsLimit: number; recentLimit: number }): Promise<VisitorStats>
}

/** 환경에 맞는 VisitorDB 구현 가져오기 (Supabase) */
export function createSupabaseVisitorDB(client: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}): VisitorDB {
  return {
    async insertPageView(record) {
      const { data, error } = await client.from('page_views').insert(record).select('id').single()
      if (error) return { ok: false, error: error.message || String(error) }
      return { ok: true, id: data?.id }
    },

    async getRecentDuplicate(sessionId, path, windowMs) {
      const since = new Date(Date.now() - windowMs).toISOString()
      const { data } = await client
        .from('page_views')
        .select('id')
        .eq('session_id', sessionId)
        .eq('path', path)
        .gte('created_at', since)
        .limit(1)
      return Boolean(data && data.length > 0)
    },

    async getStats(daysBack, { topPathsLimit, recentLimit }) {
      // Supabase RPC 사용 (SQL 함수에 통계 로직 위임)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (client as any).rpc('get_visitor_stats', {
        days_back: daysBack,
        top_paths_limit: topPathsLimit,
        recent_limit: recentLimit,
      })
      if (error) throw new Error(error.message || String(error))
      return data as VisitorStats
    },
  }
}

/** 트래커 인스턴스 — API 라우트에서 사용 */
export class VisitorTracker {
  constructor(
    private db: VisitorDB,
    private opts: Required<VisitorStatsOptions> = {
      daysBack: 30,
      topPathsLimit: 20,
      recentLimit: 30,
      dedupWindowMinutes: 30,
    }
  ) {}

  /**
   * 요청 헤더 + body로 페이지뷰 1건 기록
   * @returns deduped: true 면 중복으로 무시됨
   */
  async track(
    request: Request,
    body: { path?: string; sessionId?: string }
  ): Promise<{ ok: boolean; deduped?: boolean; error?: string }> {
    const path = String(body.path ?? '').slice(0, 500)
    const sessionId = String(body.sessionId ?? '').slice(0, 100)
    if (!path || !sessionId) {
      return { ok: false, error: 'missing path/sessionId' }
    }

    const dedupMs = this.opts.dedupWindowMinutes * 60 * 1000
    const isDup = await this.db.getRecentDuplicate(sessionId, path, dedupMs)
    if (isDup) return { ok: true, deduped: true }

    const headers = request.headers
    const geo = extractGeo(headers)
    const ua = geo.user_agent.slice(0, 500)
    const referrer = headers.get('referer')?.slice(0, 500) ?? null

    const record: PageViewInsert = {
      path,
      referrer,
      user_agent: ua,
      ip_hash: hashIp(geo.ip),
      session_id: sessionId,
      country: geo.country,
      country_name: geo.country_name,
      region: geo.region,
      city: geo.city,
      device_type: detectDevice(ua),
    }

    return await this.db.insertPageView(record)
  }

  /**
   * 통계 조회
   */
  async getStats(daysBack?: number): Promise<VisitorStats> {
    return await this.db.getStats(daysBack ?? this.opts.daysBack, {
      topPathsLimit: this.opts.topPathsLimit,
      recentLimit: this.opts.recentLimit,
    })
  }
}