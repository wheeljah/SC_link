// server/src/controllers/citationController.ts

import { Request, Response } from 'express';
import { buildCitationGraph, purgeExpiredCitationCache } from '../services/citationService';

/**
 * POST /api/v1/citations/network
 * Body: { seedDoi: string, depth?: 1|2, maxNodes?: number, direction?: 'both'|'cites'|'cited_by' }
 *
 * 인용 네트워크 그래프 빌드/조회.
 * 공개 API (인증 불필요) — DOI만 알면 누구나 인용 관계도 확인 가능.
 */
export async function getCitationNetwork(req: Request, res: Response): Promise<void> {
  try {
    const { seedDoi, depth = 1, maxNodes = 200, direction = 'both' } = req.body || {};

    if (!seedDoi || typeof seedDoi !== 'string') {
      res.status(400).json({ success: false, message: 'seedDoi는 필수입니다.' });
      return;
    }
    if (depth !== 1 && depth !== 2) {
      res.status(400).json({ success: false, message: 'depth는 1 또는 2만 허용됩니다.' });
      return;
    }
    if (direction && !['both', 'cites', 'cited_by'].includes(direction)) {
      res.status(400).json({ success: false, message: 'direction은 both/cites/cited_by 중 하나여야 합니다.' });
      return;
    }

    const data = await buildCitationGraph({
      seedDoi: seedDoi.trim(),
      depth,
      maxNodes: typeof maxNodes === 'number' ? maxNodes : 200,
      direction,
    });

    res.json({
      success: true,
      data,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`[citation] network error: ${msg}`);

    // OpenAlex에서 DOI 못 찾은 경우 404
    if (msg.includes('찾을 수 없습니다')) {
      res.status(404).json({ success: false, message: msg });
      return;
    }

    res.status(500).json({
      success: false,
      message: '인용 네트워크 빌드 중 오류가 발생했습니다.',
      detail: process.env.NODE_ENV === 'production' ? undefined : msg,
    });
  }
}

/**
 * GET /api/v1/citations/cache/stats
 * Admin only — citation_cache 테이블 상태 조회.
 */
export async function getCacheStats(_req: Request, res: Response): Promise<void> {
  try {
    const { pool } = await import('../db/pool');
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE expires_at > NOW())::int AS active,
        COUNT(*) FILTER (WHERE expires_at <= NOW())::int AS expired,
        COALESCE(SUM(node_count), 0)::int AS total_nodes_cached,
        COALESCE(AVG(build_time_ms), 0)::int AS avg_build_time_ms
      FROM citation_cache
    `);
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
}

/**
 * DELETE /api/v1/citations/cache
 * Admin only — 만료된 캐시 정리.
 */
export async function cleanupCache(_req: Request, res: Response): Promise<void> {
  try {
    const purged = await purgeExpiredCitationCache();
    res.json({ success: true, data: { purged } });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
}
