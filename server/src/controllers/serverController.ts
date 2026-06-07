import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { encrypt } from '../services/encryptionService';

export async function listServers(req: Request, res: Response): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id, name, url, type, location, requires_login
     FROM download_servers WHERE is_active = true ORDER BY type, name`
  );
  res.json({ success: true, data: rows, lastUpdated: new Date().toISOString() });
}

// 수동 새로고침 — 현재는 서버 목록만 반환 (모니터링 제거됨)
export async function refreshServers(req: Request, res: Response): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id, name, url, type, location, requires_login
     FROM download_servers WHERE is_active = true ORDER BY type, name`
  );
  res.json({ success: true, data: rows, message: '서버 목록을 불러왔습니다.' });
}

export async function getServerSSE(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = async () => {
    const { rows } = await pool.query(
      `SELECT id, name, type, location, requires_login FROM download_servers WHERE is_active = true`
    );
    res.write(`data: ${JSON.stringify(rows)}\n\n`);
  };

  await send();
  const timer = setInterval(send, 60000);
  req.on('close', () => clearInterval(timer));
}

export async function listCredentials(req: AuthRequest, res: Response): Promise<void> {
  const { rows } = await pool.query(
    `SELECT usc.server_id, ds.name as server_name, usc.login_id, usc.updated_at
     FROM user_server_credentials usc
     JOIN download_servers ds ON ds.id = usc.server_id
     WHERE usc.user_id = $1`,
    [req.userId]
  );
  res.json({ success: true, data: rows.map(r => ({ ...r, configured: true })) });
}

export async function upsertCredential(req: AuthRequest, res: Response): Promise<void> {
  const serverId = parseInt(req.params.serverId);
  const { loginId, password } = req.body;

  if (!loginId || !password) {
    res.status(400).json({ success: false, message: '로그인 아이디와 비밀번호를 입력해주세요.' });
    return;
  }

  const { rows: srv } = await pool.query(
    `SELECT id FROM download_servers WHERE id = $1 AND is_active = true`,
    [serverId]
  );
  if (!srv[0]) {
    res.status(404).json({ success: false, message: '서버를 찾을 수 없습니다.' });
    return;
  }

  const { enc, iv, tag } = encrypt(password);
  await pool.query(
    `INSERT INTO user_server_credentials (user_id, server_id, login_id, password_enc, enc_iv)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, server_id) DO UPDATE
     SET login_id = EXCLUDED.login_id, password_enc = EXCLUDED.password_enc,
         enc_iv = EXCLUDED.enc_iv, updated_at = NOW()`,
    [req.userId, serverId, loginId, enc, `${iv}:${tag}`]
  );
  res.json({ success: true, message: '자격증명이 저장되었습니다.' });
}

export async function deleteCredential(req: AuthRequest, res: Response): Promise<void> {
  await pool.query(
    `DELETE FROM user_server_credentials WHERE user_id = $1 AND server_id = $2`,
    [req.userId, parseInt(req.params.serverId)]
  );
  res.json({ success: true, message: '자격증명이 삭제되었습니다.' });
}
