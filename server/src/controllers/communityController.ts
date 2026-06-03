import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

export async function listRequests(req: Request, res: Response): Promise<void> {
  const status = req.query.status as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const offset = (page - 1) * limit;

  const where = status ? `WHERE cr.status = $3` : '';
  const params: (string | number)[] = [limit, offset];
  if (status) params.push(status);

  const { rows } = await pool.query(
    `SELECT cr.id, cr.title, cr.description, cr.doi, cr.status, cr.view_count, cr.created_at,
            u.nickname as author_nickname,
            (SELECT COUNT(*) FROM community_responses r WHERE r.request_id = cr.id) as response_count
     FROM community_requests cr
     JOIN users u ON u.id = cr.user_id
     ${where}
     ORDER BY cr.created_at DESC LIMIT $1 OFFSET $2`,
    params
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) as total FROM community_requests ${status ? 'WHERE status = $1' : ''}`,
    status ? [status] : []
  );

  res.json({ success: true, data: rows, total: parseInt(countRows[0].total), page, limit });
}

export async function getRequest(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  await pool.query(`UPDATE community_requests SET view_count = view_count + 1 WHERE id = $1`, [id]);

  const { rows } = await pool.query(
    `SELECT cr.*, u.nickname as author_nickname
     FROM community_requests cr JOIN users u ON u.id = cr.user_id WHERE cr.id = $1`,
    [id]
  );
  if (!rows[0]) { res.status(404).json({ success: false, message: '요청을 찾을 수 없습니다.' }); return; }

  const { rows: responses } = await pool.query(
    `SELECT r.id, r.message, r.file_url, r.file_size, r.created_at, u.nickname as responder_nickname
     FROM community_responses r JOIN users u ON u.id = r.user_id WHERE r.request_id = $1 ORDER BY r.created_at`,
    [id]
  );

  res.json({ success: true, data: { ...rows[0], responses } });
}

export async function createRequest(req: AuthRequest, res: Response): Promise<void> {
  const { title, description, doi } = req.body;
  if (!title) { res.status(400).json({ success: false, message: '제목을 입력해주세요.' }); return; }

  const { rows } = await pool.query(
    `INSERT INTO community_requests (user_id, title, description, doi) VALUES ($1, $2, $3, $4) RETURNING id`,
    [req.userId, title, description || null, doi || null]
  );
  res.status(201).json({ success: true, data: { id: rows[0].id } });
}

export async function respondToRequest(req: AuthRequest, res: Response): Promise<void> {
  const requestId = parseInt(req.params.id);
  const { message } = req.body;
  const file = req.file;

  const { rows: reqRows } = await pool.query(`SELECT id FROM community_requests WHERE id = $1`, [requestId]);
  if (!reqRows[0]) { res.status(404).json({ success: false, message: '요청을 찾을 수 없습니다.' }); return; }

  const fileUrl = file ? `/uploads/${file.filename}` : null;
  const fileSize = file ? file.size : null;

  await pool.query(
    `INSERT INTO community_responses (request_id, user_id, message, file_url, file_size) VALUES ($1, $2, $3, $4, $5)`,
    [requestId, req.userId, message || null, fileUrl, fileSize]
  );

  if (file) {
    await pool.query(
      `UPDATE community_requests SET status = 'fulfilled', fulfilled_by = $1, fulfilled_at = NOW() WHERE id = $2 AND status = 'open'`,
      [req.userId, requestId]
    );
  }

  res.status(201).json({ success: true, message: '응답이 등록되었습니다.' });
}
