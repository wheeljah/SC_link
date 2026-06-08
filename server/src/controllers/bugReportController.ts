import { Response } from 'express';
import { pool } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'wheeljah@gmail.com';

// GET /api/v1/reports  — 전체 목록 (공개)
export async function listReports(_req: AuthRequest, res: Response): Promise<void> {
  const { rows } = await pool.query(
    `SELECT r.id, r.title, r.description, r.doi, r.status, r.created_at, r.updated_at,
            u.nickname, u.email
     FROM bug_reports r
     LEFT JOIN users u ON u.id = r.user_id
     ORDER BY r.created_at DESC`
  );
  res.json({ success: true, data: rows });
}

// POST /api/v1/reports  — 보고 등록 (로그인 필요)
export async function createReport(req: AuthRequest, res: Response): Promise<void> {
  const { title, description, doi } = req.body as {
    title?: string; description?: string; doi?: string;
  };
  if (!title?.trim() || !description?.trim()) {
    res.status(400).json({ success: false, message: '제목과 내용을 입력하세요.' });
    return;
  }
  const { rows } = await pool.query(
    `INSERT INTO bug_reports (title, description, doi, user_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [title.trim(), description.trim(), doi?.trim() || null, req.userId]
  );
  res.status(201).json({ success: true, data: rows[0] });
}

// PATCH /api/v1/reports/:id/status  — 상태 변경 (관리자만)
export async function updateStatus(req: AuthRequest, res: Response): Promise<void> {
  if (req.userEmail !== ADMIN_EMAIL) {
    res.status(403).json({ success: false, message: '권한이 없습니다.' });
    return;
  }
  const { status } = req.body as { status?: string };
  if (!status || !['open', 'in_progress', 'resolved'].includes(status)) {
    res.status(400).json({ success: false, message: '올바른 상태값이 아닙니다.' });
    return;
  }
  const { rows } = await pool.query(
    `UPDATE bug_reports SET status = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [status, req.params.id]
  );
  if (rows.length === 0) {
    res.status(404).json({ success: false, message: '보고를 찾을 수 없습니다.' });
    return;
  }
  res.json({ success: true, data: rows[0] });
}
