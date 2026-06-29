import { Response } from 'express';
import { pool } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'wheeljah@gmail.com';

/**
 * 단일 사용자에 대한 CTE 통계 쿼리. userStatsController와 adminController에서 공유.
 * 검색 = 모든 paper_requests 행, 다운로드 = status='completed' 행.
 */
export async function computeUserStats(userId: number): Promise<{
  counters: {
    searches:  { today: number; week7: number; month30: number; total: number };
    downloads: { today: number; week7: number; month30: number; total: number };
  };
  success_rate: { completed: number; failed: number; ratio: number };
  input_types:  Array<{ type: string; label: string; count: number }>;
  daily_30d:    Array<{ day: string; cnt: number }>;
}> {
  const { rows } = await pool.query(`
    WITH req AS (
      SELECT id, status, input_type, created_at
      FROM paper_requests
      WHERE user_id = $1
    ),
    counters AS (
      SELECT
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS searches_today,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS searches_7d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS searches_30d,
        COUNT(*) AS searches_total,
        COUNT(*) FILTER (WHERE status='completed' AND created_at >= CURRENT_DATE) AS downloads_today,
        COUNT(*) FILTER (WHERE status='completed' AND created_at >= NOW() - INTERVAL '7 days') AS downloads_7d,
        COUNT(*) FILTER (WHERE status='completed' AND created_at >= NOW() - INTERVAL '30 days') AS downloads_30d,
        COUNT(*) FILTER (WHERE status='completed') AS downloads_total,
        COUNT(*) FILTER (WHERE status='failed') AS failed_total
      FROM req
    ),
    input_breakdown AS (
      SELECT input_type, COUNT(*)::int AS cnt
      FROM req WHERE status='completed' GROUP BY input_type
    ),
    daily_30d AS (
      SELECT TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS cnt
      FROM req
      WHERE status='completed' AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1
    )
    SELECT
      (SELECT row_to_json(c) FROM counters c) AS counters,
      (SELECT COALESCE(json_agg(row_to_json(i)), '[]'::json) FROM input_breakdown i) AS input_breakdown,
      (SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM daily_30d d) AS daily_30d
    ;
  `, [userId]);

  const row = rows[0];
  const c = row.counters;

  // 입력 유형 5종 모두 0으로 초기화 (없는 타입도 UI에 표시)
  const inputTypes: Record<string, number> = { doi: 0, pmid: 0, arxiv: 0, url: 0, title: 0 };
  for (const r of row.input_breakdown as Array<{ input_type: string; cnt: number }>) {
    if (r.input_type in inputTypes) inputTypes[r.input_type] = r.cnt;
  }

  const searchesTotal  = Number(c.searches_total);
  const downloadsTotal = Number(c.downloads_total);
  const failedTotal    = Number(c.failed_total);
  const successRatio   = searchesTotal > 0 ? downloadsTotal / searchesTotal : 0;

  return {
    counters: {
      searches: {
        today:    Number(c.searches_today),
        week7:    Number(c.searches_7d),
        month30:  Number(c.searches_30d),
        total:    searchesTotal,
      },
      downloads: {
        today:    Number(c.downloads_today),
        week7:    Number(c.downloads_7d),
        month30:  Number(c.downloads_30d),
        total:    downloadsTotal,
      },
    },
    success_rate: {
      completed: downloadsTotal,
      failed:    failedTotal,
      ratio:     Number(successRatio.toFixed(4)),
    },
    input_types: [
      { type: 'doi',   label: 'DOI',       count: inputTypes.doi },
      { type: 'pmid',  label: 'PubMed',    count: inputTypes.pmid },
      { type: 'arxiv', label: 'arXiv',     count: inputTypes.arxiv },
      { type: 'url',   label: 'URL',       count: inputTypes.url },
      { type: 'title', label: '논문 제목', count: inputTypes.title },
    ],
    daily_30d: row.daily_30d,
  };
}

/**
 * 본인 통계 — Admin 전용 (admin이 자기 통계 조회용).
 * 일반 사용자가 호출하면 403.
 */
export async function getMyStats(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    return;
  }
  if (req.userEmail !== ADMIN_EMAIL) {
    res.status(403).json({ success: false, message: '관리자만 조회할 수 있습니다.' });
    return;
  }

  try {
    const data = await computeUserStats(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[userStats] error:', err);
    res.status(500).json({ success: false, message: '통계 조회 실패' });
  }
}