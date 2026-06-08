import { Response } from 'express';
import { pool } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { sendMail, getEmailProviderStatus } from '../services/emailService';

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
      `SELECT id, email, nickname, tier, download_count, email_verified, last_login_at, created_at
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
    { name: 'sci-hub.kr',         url: 'https://sci-hub.kr/' },
    { name: 'sci-hub.st',         url: 'https://sci-hub.st/' },
    { name: 'libgen.rs',          url: 'https://libgen.rs/' },
    { name: 'library.lol',        url: 'https://library.lol/' },
    { name: 'annas-archive.gl',   url: 'https://annas-archive.gl/' },
    { name: 'sci-hub.run',        url: 'https://sci-hub.run/' },
    { name: 'unpaywall.org',      url: 'https://unpaywall.org/10.1038/nature12373?email=test@test.com' },
    { name: 'openalex.org',       url: 'https://api.openalex.org/works/doi:10.1038/nature12373?select=id' },
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
