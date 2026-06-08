import { Response } from 'express';
import { pool } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

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
