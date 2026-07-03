// server/src/services/visitorStats/tracker.ts
// 페이지뷰 기록 + 통계 조회 비즈니스 로직 (pg.Pool 기반)

import { pool } from '../../db/pool';
import type {
  PageViewInsert,
  VisitorStats,
  VisitorStatsOptions,
} from './types';
import { extractGeo, hashIp } from './geo';
import { detectDevice } from './device';

/**
 * 트래커 인스턴스 — 라우트에서 직접 사용
 */
export class VisitorTracker {
  private readonly opts: Required<VisitorStatsOptions>;

  constructor(opts: VisitorStatsOptions = {}) {
    this.opts = {
      daysBack: opts.daysBack ?? 30,
      topPathsLimit: opts.topPathsLimit ?? 20,
      recentLimit: opts.recentLimit ?? 30,
      dedupWindowMinutes: opts.dedupWindowMinutes ?? 30,
    };
  }

  /**
   * 요청 헤더 + body로 페이지뷰 1건 기록
   * @returns deduped: true 면 중복으로 무시됨
   */
  async track(
    headers: Record<string, string | string[] | undefined>,
    body: { path?: string; sessionId?: string; referrer?: string }
  ): Promise<{ ok: boolean; deduped?: boolean; error?: string; id?: number }> {
    const path = String(body.path ?? '').slice(0, 500);
    const sessionId = String(body.sessionId ?? '').slice(0, 100);
    if (!path || !sessionId) {
      return { ok: false, error: 'missing path/sessionId' };
    }

    // 봇 UA면 아예 기록 안 함 (스토리지 절약 + 통계 정확도)
    const geo = extractGeo(headers);
    const ua = geo.user_agent.slice(0, 500);
    const deviceType = detectDevice(ua);
    if (deviceType === 'bot') {
      return { ok: true, deduped: true };
    }

    // dedup: 같은 세션 + 같은 path + N분 이내 재방문 무시
    const dedupMs = this.opts.dedupWindowMinutes * 60 * 1000;
    const since = new Date(Date.now() - dedupMs).toISOString();
    const dup = await pool.query(
      `SELECT 1 FROM page_views
       WHERE session_id = $1 AND path = $2 AND created_at >= $3
       LIMIT 1`,
      [sessionId, path, since]
    );
    if ((dup.rowCount ?? 0) > 0) {
      return { ok: true, deduped: true };
    }

    const referrer = body.referrer ?? extractReferrer(headers);
    const record: PageViewInsert = {
      path,
      referrer: referrer ? referrer.slice(0, 500) : null,
      user_agent: ua,
      ip_hash: hashIp(geo.ip),
      session_id: sessionId,
      country: geo.country,
      country_name: geo.country_name,
      region: geo.region,
      city: geo.city,
      device_type: deviceType,
    };

    try {
      const { rows } = await pool.query(
        `INSERT INTO page_views
          (path, referrer, user_agent, ip_hash, session_id, country, country_name, region, city, device_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          record.path, record.referrer, record.user_agent, record.ip_hash,
          record.session_id, record.country, record.country_name, record.region,
          record.city, record.device_type,
        ]
      );
      return { ok: true, id: rows[0]?.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[visitorStats.track] insert failed:', msg);
      return { ok: false, error: msg };
    }
  }

  /**
   * 통계 조회 — 단일 RPC 호출로 모든 KPI 반환
   */
  async getStats(daysBack?: number): Promise<VisitorStats> {
    const days = Math.min(365, Math.max(1, daysBack ?? this.opts.daysBack));
    const { rows } = await pool.query(
      `SELECT get_visitor_stats($1::int, $2::int, $3::int) AS stats`,
      [days, this.opts.topPathsLimit, this.opts.recentLimit]
    );
    const raw = rows[0]?.stats;
    if (!raw) {
      throw new Error('get_visitor_stats returned null');
    }
    return raw as VisitorStats;
  }
}

/** 헤더에서 referrer 추출 (브라우저 Referer 헤더) */
function extractReferrer(headers: Record<string, string | string[] | undefined>): string | null {
  const r = headers['referer'] || headers['referrer'];
  if (!r) return null;
  return Array.isArray(r) ? r[0] : r;
}