import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService';
import { signToken, AuthRequest } from '../middleware/auth';

/** 이메일 발송에 타임아웃 적용 (15초 초과 시 오류 대신 경고만 남김) */
async function sendVerificationEmailWithTimeout(email: string, token: string): Promise<string | null> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('이메일 발송 타임아웃 (15s)')), 15000)
  );
  return Promise.race([sendVerificationEmail(email, token), timeout]);
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, nickname } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력해주세요.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ success: false, message: '올바른 이메일 형식이 아닙니다.' });
    return;
  }
  if (password.length < 8 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
    res.status(400).json({ success: false, message: '비밀번호는 영문+숫자 조합 8자 이상이어야 합니다.' });
    return;
  }

  const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    res.status(409).json({ success: false, message: '이미 사용 중인 이메일입니다.' });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, nickname) VALUES ($1, $2, $3) RETURNING id`,
    [email.toLowerCase(), hash, nickname || null]
  );
  const userId = rows[0].id;

  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
    [userId, token]
  );

  const isGmail = process.env.SMTP_USER && !process.env.SMTP_USER.includes('your_gmail');

  let previewUrl: string | null = null;
  try {
    previewUrl = await sendVerificationEmailWithTimeout(email, token);
  } catch (err) {
    console.error('이메일 발송 오류 (회원가입 계속 진행):', err);
    // 이메일 실패해도 계정은 생성됨 — 재발송 안내
  }

  res.status(201).json({
    success: true,
    message: isGmail
      ? '인증 이메일을 발송했습니다. 받은 편지함을 확인해주세요.'
      : '테스트 메일을 발송했습니다. 아래 미리보기 링크에서 확인하세요.',
    devMode: !isGmail,
    previewUrl,
  });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.query as { token: string };
  if (!token) {
    res.status(400).json({ success: false, message: '토큰이 필요합니다.' });
    return;
  }

  const { rows } = await pool.query(
    `SELECT t.id, t.user_id, u.email_verified
     FROM email_verification_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token = $1 AND t.expires_at > NOW()`,
    [token]
  );

  if (!rows[0]) {
    res.status(400).json({ success: false, message: '유효하지 않거나 만료된 인증 링크입니다.' });
    return;
  }

  // 이미 인증 완료된 경우 → 멱등성: 성공 반환 (React StrictMode 이중 호출 대응)
  if (rows[0].email_verified) {
    res.json({ success: true, message: '이미 인증된 계정입니다. 로그인하세요.' });
    return;
  }

  if (rows[0].used_at) {
    res.status(400).json({ success: false, message: '이미 사용된 인증 링크입니다. 새 인증 메일을 요청하세요.' });
    return;
  }

  await pool.query(`UPDATE users SET email_verified = true WHERE id = $1`, [rows[0].user_id]);
  await pool.query(`UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1`, [rows[0].id]);

  res.json({ success: true, message: '이메일 인증이 완료되었습니다. 로그인하세요.' });
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  const { email } = req.body;
  const { rows } = await pool.query(
    `SELECT id, email_verified FROM users WHERE email = $1`,
    [email?.toLowerCase()]
  );
  if (!rows[0]) {
    res.json({ success: true, message: '해당 이메일로 인증 메일을 발송했습니다.' }); // 보안상 동일 응답
    return;
  }
  if (rows[0].email_verified) {
    res.status(400).json({ success: false, message: '이미 인증된 계정입니다.' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
    [rows[0].id, token]
  );
  try {
    await sendVerificationEmailWithTimeout(email, token);
  } catch (err) {
    console.error('인증 메일 재발송 오류:', err);
  }
  res.json({ success: true, message: '인증 이메일을 재발송했습니다.' });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력해주세요.' });
    return;
  }

  const { rows } = await pool.query(
    `SELECT id, email, password_hash, nickname, email_verified, tier, download_count FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    return;
  }
  if (!user.email_verified) {
    res.status(403).json({ success: false, message: '이메일 인증 후 로그인할 수 있습니다.', needVerification: true });
    return;
  }

  await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);
  const token = signToken(user.id, user.email);

  res.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, nickname: user.nickname, emailVerified: true, tier: user.tier, downloadCount: user.download_count },
    },
  });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body;
  const { rows } = await pool.query(`SELECT id FROM users WHERE email = $1`, [email?.toLowerCase()]);

  if (rows[0]) {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [rows[0].id, token]
    );
    try { await sendPasswordResetEmail(email, token); } catch { /* silent */ }
  }
  // 보안상 항상 동일 응답
  res.json({ success: true, message: '비밀번호 재설정 링크를 이메일로 발송했습니다.' });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    res.status(400).json({ success: false, message: '토큰과 새 비밀번호를 입력해주세요.' });
    return;
  }
  if (newPassword.length < 8 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
    res.status(400).json({ success: false, message: '비밀번호는 영문+숫자 조합 8자 이상이어야 합니다.' });
    return;
  }

  const { rows } = await pool.query(
    `SELECT id, user_id FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
    [token]
  );
  if (!rows[0]) {
    res.status(400).json({ success: false, message: '유효하지 않거나 만료된 링크입니다.' });
    return;
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, rows[0].user_id]);
  await pool.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [rows[0].id]);

  res.json({ success: true, message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.' });
}

export async function logout(req: AuthRequest, res: Response): Promise<void> {
  const header = req.headers.authorization?.slice(7);
  if (header) {
    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.decode(header) as { jti?: string; exp?: number };
      if (payload?.jti && payload?.exp) {
        await pool.query(
          `INSERT INTO token_blacklist (token_jti, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT DO NOTHING`,
          [payload.jti, payload.exp]
        );
      }
    } catch { /* silent */ }
  }
  res.json({ success: true, message: '로그아웃되었습니다.' });
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id, email, nickname, email_verified, tier, download_count, created_at FROM users WHERE id = $1`,
    [req.userId]
  );
  if (!rows[0]) { res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' }); return; }
  res.json({ success: true, data: rows[0] });
}

/**
 * [개발 전용] SMTP 미설정 시 이메일 인증 링크를 직접 반환
 * 운영 환경(NODE_ENV=production)에서는 404 반환
 */
export async function devGetVerifyLink(req: Request, res: Response): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }

  const { email } = req.query as { email: string };
  if (!email) {
    res.status(400).json({ success: false, message: 'email 파라미터가 필요합니다.' });
    return;
  }

  const { rows } = await pool.query(
    `SELECT t.token
     FROM email_verification_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE u.email = $1
       AND t.expires_at > NOW()
       AND t.used_at IS NULL
     ORDER BY t.created_at DESC
     LIMIT 1`,
    [email.toLowerCase()]
  );

  if (!rows[0]) {
    res.status(404).json({ success: false, message: '유효한 인증 토큰이 없습니다. 회원가입을 다시 시도해주세요.' });
    return;
  }

  const APP_URL = process.env.APP_URL || 'http://localhost:5173';
  const link = `${APP_URL}/verify-email?token=${rows[0].token}`;

  res.json({ success: true, verifyLink: link, message: '아래 링크를 브라우저에서 열어 인증을 완료하세요.' });
}
