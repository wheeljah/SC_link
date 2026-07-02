// server/src/controllers/jobsController.ts
// 🎓 커리어 — 공개 API (비로그인 가능)
//
// - GET /api/v1/jobs                  : 국내 공고 목록 (region=kr 고정)
// - GET /api/v1/jobs/:id              : 상세
// - GET /api/v1/jobs/sources          : 활성 소스 + 마지막 크롤 시각
// - POST /api/v1/jobs/foreign-interest: 해외 공고 출시 알림 구독 (이메일)

import { Request, Response } from 'express';
import { pool } from '../db/pool';

export async function listJobs(req: Request, res: Response): Promise<void> {
  const category = (req.query.category as string) || '';
  const keyword = (req.query.keyword as string)?.trim() || '';
  const deadlineWithin = parseInt(req.query.deadline_within as string) || 90; // 기본 90일
  const region = ((req.query.region as string) || 'kr').slice(0, 10);
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  const params: (string | number)[] = [region, deadlineWithin];
  let where = `WHERE jp.is_active = TRUE AND jp.region = $1
                AND (jp.deadline IS NULL OR jp.deadline BETWEEN NOW() AND NOW() + ($2 || ' days')::interval)`;
  if (category && ['graduate', 'postdoc', 'researcher', 'professor', 'staff'].includes(category)) {
    params.push(category);
    where += ` AND jp.category = $${params.length}`;
  }
  if (keyword) {
    params.push(`%${keyword}%`);
    where += ` AND (jp.title ILIKE $${params.length} OR jp.organization ILIKE $${params.length})`;
  }
  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT jp.id, jp.title, jp.organization, jp.category, jp.fields, jp.deadline, jp.posted_at,
            jp.canonical_url, jp.region, jp.language, jp.created_at, jp.updated_at,
            js.code AS source_code, js.name AS source_name,
            CASE WHEN jp.deadline IS NOT NULL
                 THEN GREATEST(0, EXTRACT(DAY FROM jp.deadline - NOW())::int)
                 ELSE NULL END AS days_left
     FROM job_postings jp
     JOIN job_sources js ON js.id = jp.source_id
     ${where}
     ORDER BY jp.deadline ASC NULLS LAST, jp.posted_at DESC NULLS LAST, jp.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const countParams = params.slice(0, params.length - 2);
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM job_postings jp
     JOIN job_sources js ON js.id = jp.source_id
     ${where.replace(`LIMIT $${params.length - 1} OFFSET $${params.length}`, '')}`,
    countParams,
  );

  res.json({
    success: true,
    items: rows,
    total: countRows[0]?.total || 0,
    page,
    limit,
  });
}

export async function getJob(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  if (!id) { res.status(400).json({ success: false, message: 'invalid id' }); return; }

  const { rows } = await pool.query(
    `SELECT jp.*, js.code AS source_code, js.name AS source_name
     FROM job_postings jp
     JOIN job_sources js ON js.id = jp.source_id
     WHERE jp.id = $1 AND jp.is_removed = FALSE`,
    [id],
  );
  if (rows.length === 0) { res.status(404).json({ success: false, message: 'not found' }); return; }

  res.json({ success: true, data: rows[0] });
}

export async function listSources(_req: Request, res: Response): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id, code, name, crawl_method, cron_expr, enabled, last_crawled_at, last_status,
            rate_limit_ms, region
     FROM job_sources
     WHERE enabled = TRUE
     ORDER BY id`,
  );
  res.json({ success: true, items: rows });
}

/**
 * 해외 공고 출시 알림 구독 (비로그인 가능)
 * 중복 이메일이면 200 + 이미 등록됨 메시지
 */
export async function subscribeForeignInterest(req: Request, res: Response): Promise<void> {
  const email = (req.body?.email as string || '').trim().toLowerCase();
  const fields = Array.isArray(req.body?.fields) ? (req.body.fields as string[]).slice(0, 10) : [];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ success: false, message: '올바른 이메일을 입력해 주세요.' });
    return;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO foreign_interest_signup (email, fields) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET fields = COALESCE(EXCLUDED.fields, foreign_interest_signup.fields)
       RETURNING id, email, fields, created_at`,
      [email, fields.length > 0 ? fields : null],
    );
    res.json({ success: true, message: '등록 완료! 출시되면 알려드릴게요 🎓', data: rows[0] });
  } catch (err) {
    console.error('[jobs] foreign-interest signup error:', (err as Error).message);
    res.status(500).json({ success: false, message: '등록 중 오류가 발생했습니다.' });
  }
}