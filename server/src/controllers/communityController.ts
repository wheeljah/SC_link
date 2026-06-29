import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { sendCommunityResponseNotification } from '../services/emailService';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'wheeljah@gmail.com';

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

export async function getRequest(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  await pool.query(`UPDATE community_requests SET view_count = view_count + 1 WHERE id = $1`, [id]);

  const { rows } = await pool.query(
    `SELECT cr.*, u.nickname as author_nickname
     FROM community_requests cr JOIN users u ON u.id = cr.user_id WHERE cr.id = $1`,
    [id]
  );
  if (!rows[0]) { res.status(404).json({ success: false, message: '요청을 찾을 수 없습니다.' }); return; }
  const request = rows[0];

  // ── 답변 접근 권한 체크 ──
  // 허용 대상: 요청자 본인 / 기존 답변자 / 어드민
  // 미인증 또는 권한 없으면 → responses 빈 배열 + can_view_responses=false 반환
  const viewerUserId = req.userId ?? null;
  const viewerEmail = req.userEmail ?? '';
  const isAdmin = viewerEmail === ADMIN_EMAIL;
  const isRequester = viewerUserId !== null && request.user_id === viewerUserId;

  let canViewResponses = isRequester || isAdmin;
  if (!canViewResponses && viewerUserId !== null) {
    const { rows: responderRows } = await pool.query(
      `SELECT 1 FROM community_responses WHERE request_id = $1 AND user_id = $2 LIMIT 1`,
      [id, viewerUserId]
    );
    canViewResponses = responderRows.length > 0;
  }

  let responses: unknown[] = [];
  if (canViewResponses) {
    const { rows: responseRows } = await pool.query(
      `SELECT r.id, r.message, r.file_url, r.file_size, r.created_at,
              u.nickname as responder_nickname
       FROM community_responses r
       JOIN users u ON u.id = r.user_id
       WHERE r.request_id = $1
       ORDER BY r.created_at`,
      [id]
    );
    responses = responseRows;
  } else {
    // 권한 없는 경우: 응답 개수만 별도로 카운트 (UI에 "n개의 답변이 있습니다" 표시용)
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int as count FROM community_responses WHERE request_id = $1`,
      [id]
    );
    request.response_count = countRows[0].count;
  }

  res.json({
    success: true,
    data: {
      ...request,
      responses,
      can_view_responses: canViewResponses,
    },
  });
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

  // 요청자 정보 + 알림 수신 설정까지 함께 조회 (이메일 알림용)
  const { rows: reqRows } = await pool.query(
    `SELECT cr.id, cr.title, cr.user_id as requester_id, u.email as requester_email,
            u.nickname as requester_nickname, COALESCE(u.notify_community_response, TRUE) as notify_enabled
     FROM community_requests cr
     JOIN users u ON u.id = cr.user_id
     WHERE cr.id = $1`,
    [requestId]
  );
  if (!reqRows[0]) { res.status(404).json({ success: false, message: '요청을 찾을 수 없습니다.' }); return; }
  const reqRow = reqRows[0];

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

  // 응답자에게 이메일 알림 (비동기 fire-and-forget — 응답 latency 영향 없음)
  // 조건: 자기 자신 응답 X, 요청자 이메일 존재, 알림 수신 동의
  const isSelfResponse = reqRow.requester_id === req.userId;
  if (!isSelfResponse && reqRow.requester_email && reqRow.notify_enabled) {
    const { rows: userRows } = await pool.query(
      `SELECT nickname FROM users WHERE id = $1`,
      [req.userId]
    );
    const responderNickname = userRows[0]?.nickname || '익명';
    sendCommunityResponseNotification({
      to: reqRow.requester_email,
      requestTitle: reqRow.title,
      requestId,
      responderNickname,
      hasMessage: !!message,
      hasFile: !!file,
      messagePreview: message || undefined,
    }).catch((err) => {
      console.error('[Community] Response notification email failed:', err);
    });
  }

  res.status(201).json({ success: true, message: '응답이 등록되었습니다.' });
}
