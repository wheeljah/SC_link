import { Response } from 'express';
import { pool } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';
import { sendMail, getEmailProviderStatus, sendVerificationEmail } from '../services/emailService';
import { computeUserStats } from './userStatsController';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'wheeljah@gmail.com';

function guard(req: AuthRequest, res: Response): boolean {
  if (req.userEmail !== ADMIN_EMAIL) {
    res.status(403).json({ success: false, message: '\uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.' });
    return false;
  }
  return true;
}

export async function getStats(req: AuthRequest, res: Response): Promise<void> {
  if (!guard(req, res)) return;
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users)          AS user_count,
      (SELECT COUNT(*)::int FROM paper_requests) AS download_count,
      (SELECT COUNT(*)::int FROM bug_reports)    AS bug_count,
      pg_size_pretty(pg_database_size(current_database())) AS db_size,
      (SELECT COUNT(*)::int FROM users
       WHERE created_at > NOW() - INTERVAL '7 days')        AS new_users_7d,
      (SELECT COUNT(*)::int FROM paper_requests
       WHERE created_at > NOW() - INTERVAL '7 days')        AS downloads_7d
  `);
  res.json({ success: true, data: rows[0] });
}

export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
  if (!guard(req, res)) return;
  const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit  = Math.min(200, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;
  const [{ rows }, { rows: cnt }] = await Promise.all([
    pool.query(
      `SELECT id, email, nickname, tier, download_count, email_verified, last_login_at, created_at, region, region_ip
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    pool.query('SELECT COUNT(*)::int AS total FROM users'),
  ]);
  res.json({ success: true, data: rows, total: cnt[0].total, page, limit });
}

export async function listDownloads(req: AuthRequest, res: Response): Promise<void> {
  if (!guard(req, res)) return;
  const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit  = Math.min(200, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;
  const [{ rows }, { rows: cnt }] = await Promise.all([
    pool.query(
      `SELECT r.id, r.input_type, r.input_value, r.normalized_doi, r.title,
              r.status, r.file_size, r.created_at, u.email AS user_email
       FROM paper_requests r LEFT JOIN users u ON u.id = r.user_id
       ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    pool.query('SELECT COUNT(*)::int AS total FROM paper_requests'),
  ]);
  res.json({ success: true, data: rows, total: cnt[0].total, page, limit });
}

function esc(val: unknown): string {
  if (val == null) return '""';
  return '"' + String(val).replace(/"/g, '""') + '"';
}

export async function exportUsers(req: AuthRequest, res: Response): Promise<void> {
  if (!guard(req, res)) return;
  const { rows } = await pool.query(
    `SELECT id, email, nickname, tier, download_count, email_verified, last_login_at, created_at
     FROM users ORDER BY created_at DESC`
  );
  const lines = [
    'id,email,nickname,tier,download_count,email_verified,last_login_at,created_at',
    ...rows.map(r =>
      [r.id, r.email, r.nickname, r.tier, r.download_count,
       r.email_verified, r.last_login_at, r.created_at].map(esc).join(',')
    ),
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition',
    `attachment; filename="users_${new Date().toISOString().slice(0,10)}.csv"`);
  res.send('\uFEFF' + lines);
}

export async function exportDownloads(req: AuthRequest, res: Response): Promise<void> {
  if (!guard(req, res)) return;
  const { rows } = await pool.query(
    `SELECT r.id, r.input_type, r.input_value, r.normalized_doi, r.title,
            r.status, r.file_size, r.created_at, u.email AS user_email
     FROM paper_requests r LEFT JOIN users u ON u.id = r.user_id
     ORDER BY r.created_at DESC`
  );
  const lines = [
    'id,input_type,input_value,doi,title,status,file_size_bytes,user_email,created_at',
    ...rows.map(r =>
      [r.id, r.input_type, r.input_value, r.normalized_doi, r.title,
       r.status, r.file_size, r.user_email, r.created_at].map(esc).join(',')
    ),
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition',
    `attachment; filename="downloads_${new Date().toISOString().slice(0,10)}.csv"`);
  res.send('\uFEFF' + lines);
}

export async function deleteOldDownloads(req: AuthRequest, res: Response): Promise<void> {
  if (!guard(req, res)) return;
  const days = Math.max(1, Math.min(3650, parseInt(req.body.days as string) || 30));
  const { rowCount } = await pool.query(
    `DELETE FROM paper_requests WHERE created_at < NOW() - ($1 || ' days')::INTERVAL`,
    [String(days)]
  );
  res.json({ success: true, deleted: rowCount ?? 0 });
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  if (!guard(req, res)) return;
  const id = parseInt(req.params.id);
  if (!id) { res.status(400).json({ success: false, message: 'Invalid id' }); return; }
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
  res.json({ success: true });
}

export async function testConnectivity(req: AuthRequest, res: Response): Promise<void> {
  if (!guard(req, res)) return;
  const targets = [
    { name: 'unpaywall.org',      url: 'https://unpaywall.org/10.1038/nature12373?email=test@test.com' },
    { name: 'openalex.org',       url: 'https://api.openalex.org/works/doi:10.1038/nature12373?select=id' },
    { name: 'openaire.eu',        url: 'https://api.openaire.eu/graph/v1/researchProducts?doi=10.1038/nature12373&type=publication&pageSize=1&format=json' },
    { name: 'oa.mg',              url: 'https://api.oa.mg/v2/work?doi=10.1038/nature12373' },
    { name: 'doaj.org',           url: 'https://doaj.org/api/v4/search/articles/doi:10.1371\\/journal.pone.0173664' },
    { name: 'fatcat.wiki',        url: 'https://api.fatcat.wiki/v0/release/lookup?doi=10.1038/nature12373' },
    { name: 'archives-ouvertes.fr', url: 'https://api.archives-ouvertes.fr/search/?q=*:*&fq=doiId_s:%2210.1038/nature12373%22&rows=1&wt=json' },
    { name: 'crossref.org',       url: 'https://api.crossref.org/works/10.1038/nature12373' },
    { name: 'osf.io',             url: 'https://api.osf.io/v2/preprints/?filter[doi]=10.31234/osf.io/abc12&page[size]=1' },
    { name: 'datacite.org',       url: 'https://api.datacite.org/dois/10.5281/zenodo.31780' },
    { name: 'figshare.com',       url: 'https://api.figshare.com/v2/articles?page_size=1' },
    { name: 'chemrxiv.org',       url: 'https://chemrxiv.org/engage/chemrxiv/public-api/v1/categories' },
    { name: 'preprints.org',      url: 'https://www.preprints.org/manuscript/202101.0001/v1/download' },
  ];
  const axios = (await import('axios')).default;
  const results = await Promise.all(targets.map(async t => {
    try {
      const r = await axios.get(t.url, { timeout: 8000, maxRedirects: 3,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        validateStatus: () => true });
      const blocked = String(r.headers['x-proxy-error'] || '').includes('blocked');
      return { name: t.name, status: r.status, blocked, ok: !blocked && r.status < 500 };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'error';
      return { name: t.name, status: 0, blocked: msg.includes('blocked'), ok: false, error: msg.slice(0,60) };
    }
  }));
  res.json({ success: true, timestamp: new Date().toISOString(), results });
}

export async function testEmail(req: AuthRequest, res: Response): Promise<void> {
  if (!guard(req, res)) return;
  const status = getEmailProviderStatus();
  if (!status.configured) {
    res.status(503).json({ success: false, message: '이메일 설정이 없습니다.', status });
    return;
  }
  const targetEmail = (req.query.to as string) || req.userEmail || ADMIN_EMAIL;
  try {
    await sendMail({
      to: targetEmail,
      subject: '[ScholarLink] 이메일 발송 테스트',
      html: '<div style="font-family:sans-serif;padding:24px"><h3>✅ 이메일 발송 테스트 성공</h3><p>제공자: <b>' + status.provider + '</b></p><p>FROM: ' + status.from + '</p><p>TO: ' + targetEmail + '</p></div>',
    });
    res.json({ success: true, message: 'Test email sent to ' + targetEmail, provider: status.provider, from: status.from });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: '발송 실패: ' + msg, status });
  }
}

export async function resendUnverified(req: AuthRequest, res: Response): Promise<void> {
  if (!guard(req, res)) return;
  const { rows } = await pool.query(
    `SELECT id, email FROM users WHERE email_verified = false ORDER BY created_at DESC`
  );
  if (rows.length === 0) {
    res.json({ success: true, total: 0, sent: 0, failed: 0, results: [] });
    return;
  }
  let sent = 0, failed = 0;
  const results: { email: string; status: string }[] = [];
  for (const user of rows) {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      await pool.query(
        `INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
        [user.id, token]
      );
      await sendVerificationEmail(user.email, token);
      sent++;
      results.push({ email: user.email, status: 'sent' });
    } catch (e) {
      failed++;
      results.push({ email: user.email, status: 'failed: ' + (e instanceof Error ? e.message.slice(0, 80) : String(e)) });
    }
    await new Promise(r => setTimeout(r, 300)); // rate limit
  }
  res.json({ success: true, total: rows.length, sent, failed, results });
}

// ── 사용자별/전체 통계 (admin 전용) ─────────────────────────────────────────

/**
 * 특정 사용자 상세 통계 — admin이 다른 사용자 통계를 drill-down.
 * GET /api/v1/admin/users/:id/stats
 */
export async function getUserStatsById(req: AuthRequest, res: Response): Promise<void> {
  if (!guard(req, res)) return;
  const id = parseInt(req.params.id);
  if (!id) { res.status(400).json({ success: false, message: 'Invalid user id' }); return; }

  try {
    // 사용자 존재 확인 + 기본 정보
    const userRes = await pool.query(
      `SELECT id, email, nickname, tier, created_at FROM users WHERE id = $1`,
      [id]
    );
    if (!userRes.rows[0]) {
      res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      return;
    }
    const stats = await computeUserStats(id);
    res.json({
      success: true,
      data: {
        user: userRes.rows[0],
        ...stats,
      },
    });
  } catch (err) {
    console.error('[admin/user-stats] error:', err);
    res.status(500).json({ success: false, message: '통계 조회 실패' });
  }
}

/**
 * 전체 사용자 통계 집계 + 리더보드.
 * GET /api/v1/admin/stats/all
 */
export async function getAllUserStatsSummary(req: AuthRequest, res: Response): Promise<void> {
  if (!guard(req, res)) return;

  try {
    const { rows } = await pool.query(`
      WITH req AS (
        SELECT user_id, status, input_type, created_at
        FROM paper_requests
      ),
      agg AS (
        SELECT
          COUNT(*) AS searches_total,
          COUNT(*) FILTER (WHERE status='completed') AS downloads_total,
          COUNT(*) FILTER (WHERE status='failed') AS failed_total,
          COUNT(*) FILTER (WHERE status='completed' AND created_at >= NOW() - INTERVAL '7 days') AS downloads_7d,
          COUNT(*) FILTER (WHERE status='completed' AND created_at >= CURRENT_DATE) AS downloads_today
        FROM req
      ),
      per_user AS (
        SELECT
          u.id, u.email, u.nickname, u.tier, u.created_at,
          COALESCE(c.cnt, 0)::int AS downloads,
          COALESCE(s.cnt, 0)::int AS searches,
          COALESCE(f.cnt, 0)::int AS failures
        FROM users u
        LEFT JOIN (
          SELECT user_id, COUNT(*) AS cnt FROM paper_requests
          WHERE status='completed' GROUP BY user_id
        ) c ON c.user_id = u.id
        LEFT JOIN (
          SELECT user_id, COUNT(*) AS cnt FROM paper_requests GROUP BY user_id
        ) s ON s.user_id = u.id
        LEFT JOIN (
          SELECT user_id, COUNT(*) AS cnt FROM paper_requests
          WHERE status='failed' GROUP BY user_id
        ) f ON f.user_id = u.id
      ),
      leaderboard AS (
        SELECT id, email, nickname, downloads, searches, failures
        FROM per_user
        ORDER BY downloads DESC, searches DESC
        LIMIT 10
      ),
      input_dist AS (
        SELECT input_type, COUNT(*)::int AS cnt
        FROM req WHERE status='completed'
        GROUP BY input_type ORDER BY cnt DESC
      )
      SELECT
        (SELECT row_to_json(a) FROM agg a) AS aggregate,
        (SELECT COALESCE(json_agg(row_to_json(l)), '[]'::json) FROM leaderboard l) AS leaderboard,
        (SELECT COALESCE(json_agg(row_to_json(i)), '[]'::json) FROM input_dist i) AS input_distribution,
        (SELECT COUNT(*)::int FROM users) AS user_count
      ;
    `);

    const row = rows[0];
    const agg = row.aggregate;
    const searchesTotal = Number(agg.searches_total);
    const downloadsTotal = Number(agg.downloads_total);

    res.json({
      success: true,
      data: {
        aggregate: {
          user_count:        row.user_count,
          searches_total:    searchesTotal,
          downloads_total:   downloadsTotal,
          failed_total:      Number(agg.failed_total),
          downloads_today:   Number(agg.downloads_today),
          downloads_7d:      Number(agg.downloads_7d),
          success_ratio:     searchesTotal > 0 ? Number((downloadsTotal / searchesTotal).toFixed(4)) : 0,
        },
        leaderboard: row.leaderboard,
        input_distribution: row.input_distribution,
      },
    });
  } catch (err) {
    console.error('[admin/all-stats] error:', err);
    res.status(500).json({ success: false, message: '전체 통계 조회 실패' });
  }
}
