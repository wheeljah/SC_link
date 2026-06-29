import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { sendVerificationEmail, sendPasswordResetEmail, getEmailProviderStatus } from '../services/emailService';
import { signToken, AuthRequest } from '../middleware/auth';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'wheeljah@gmail.com';

// ── 행정구역 코드 매핑 (ipapi.co region 문자열 → 내부 코드) ──────────────
const REGION_MAP: Record<string, string> = {
  seoul: 'seoul', busan: 'busan', daegu: 'daegu', incheon: 'incheon',
  gwangju: 'gwangju', daejeon: 'daejeon', ulsan: 'ulsan',
  sejong: 'sejong', gyeonggi: 'gyeonggi', gangwon: 'gangwon',
  'north chungcheong': 'chungbuk', 'south chungcheong': 'chungnam',
  chungcheongbuk: 'chungbuk', chungcheongnam: 'chungnam',
  'north jeolla': 'jeonbuk', 'south jeolla': 'jeonnam',
  'north gyeongsang': 'gyeongbuk', 'south gyeongsang': 'gyeongnam',
  gyeongsangbuk: 'gyeongbuk', gyeongsangnam: 'gyeongnam',
  jeollabuk: 'jeonbuk', jeollanam: 'jeonnam',
  jeju: 'jeju',
};

function mapRegion(raw: string): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase()
    .replace(/-do$/, '').replace(/-si$/, '').replace(' special self-governing.*', '')
    .replace(' special.*', '').trim();
  for (const [k, v] of Object.entries(REGION_MAP)) {
    if (key === k || key.startsWith(k) || k.startsWith(key)) return v;
  }
  return null;
}

type GeoLookup = { countryCode: string; region: string | null };

/**
 * IP 기반 국가 + (한국 한정) 행정구역 감지
 * - 국가 코드: 전 세계 (ipapi.co 응답의 `country` 필드 = ISO alpha-2)
 * - 행정구역: KR일 때만 mapRegion()으로 매핑, 그 외 국가면 null
 */
async function detectGeoFromIp(ip: string): Promise<GeoLookup | null> {
  try {
    const cleanIp = ip.replace(/^::ffff:/, ''); // IPv4-mapped IPv6 제거
    if (cleanIp === '127.0.0.1' || cleanIp === '::1') return null;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`https://ipapi.co/${cleanIp}/json/`);
    clearTimeout(tid);
    if (!res.ok) return null;
    const data = await res.json() as { country?: string; region?: string };
    const countryCode = (data.country || '').toUpperCase();
    if (!countryCode || countryCode.length !== 2) return null;
    const region = countryCode === 'KR' ? mapRegion(data.region || '') : null;
    return { countryCode, region };
  } catch {
    return null;
  }
}

/** 하위 호환: detectRegionFromIp 사용처가 있으면 그 동작 유지 */
async function detectRegionFromIp(ip: string): Promise<string | null> {
  const geo = await detectGeoFromIp(ip);
  return geo?.region ?? null;
}

/** 이메일 발송에 타임아웃 적용 (15초 초과 시 오류 대신 경고만 남김) */
async function sendVerificationEmailWithTimeout(email: string, token: string): Promise<string | null> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('이메일 발송 타임아웃 (15s)')), 15000)
  );
  return Promise.race([sendVerificationEmail(email, token), timeout]);
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, nickname, region, countryCode, consents } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력해주세요.' });
    return;
  }

  // ── 개인정보 동의 검증 (PIPA §22: 필수 동의 항목 확인) ──
  // 하위 호환: consents가 없는 옛 클라이언트는 거부 (가입 시점부터 동의 필수)
  const c = (consents && typeof consents === 'object') ? consents : {};
  if (!c.terms || !c.privacy) {
    res.status(400).json({
      success: false,
      message: '이용약관 및 개인정보 수집·이용 동의는 필수입니다.',
      code: 'CONSENT_REQUIRED',
    });
    return;
  }
  const now = new Date();
  const consentTermsAt = c.terms ? now : null;
  const consentPrivacyAt = c.privacy ? now : null;
  const consentMarketingAt = c.marketing ? now : null;
  const VALID_REGIONS = ['seoul','busan','daegu','incheon','gwangju','daejeon','ulsan',
    'sejong','gyeonggi','gangwon','chungbuk','chungnam','jeonbuk','jeonnam',
    'gyeongbuk','gyeongnam','jeju'];

  // countryCode 정규화: 'KR', 'US' 등 2글자. 없거나 형식 안 맞으면 null (외국인 가입 허용)
  const normalizedCountry: string | null = (typeof countryCode === 'string')
    ? countryCode.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || null
    : null;

  // region 검증: 제공된 경우에만 enum 검증. KR이 아닌데 region 있으면 거부.
  if (region && !VALID_REGIONS.includes(region)) {
    res.status(400).json({ success: false, message: '올바른 행정구역을 선택해주세요.' });
    return;
  }
  if (region && normalizedCountry && normalizedCountry !== 'KR') {
    res.status(400).json({ success: false, message: '행정구역은 한국(KR) 사용자에 한정됩니다.' });
    return;
  }
  // 하위 호환: countryCode 없이 region만 보내는 옛 클라이언트는 KR로 간주
  const finalCountry = normalizedCountry || (region ? 'KR' : '');

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
  // IP 기반 국가/행정구역 감지 (실패해도 가입 계속)
  const geo = await detectGeoFromIp(req.ip || '').catch(() => null);
  // 클라이언트가 보낸 country/region 우선, 없으면 IP 감지값으로 fallback
  const finalCountryCode = finalCountry || geo?.countryCode || null;
  const regionIp = region ? null : (geo?.region || null); // 사용자가 명시 선택하면 IP 추정값 무시
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, nickname, region, region_ip, country_code,
       consent_terms_at, consent_privacy_at, consent_marketing_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      email.toLowerCase(), hash, nickname || null, region || null, regionIp, finalCountryCode,
      consentTermsAt, consentPrivacyAt, consentMarketingAt,
    ]
  );
  const userId = rows[0].id;

  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
    [userId, token]
  );

  const emailStatus = getEmailProviderStatus();

  let previewUrl: string | null = null;
  let emailError: string | null = null;
  try {
    previewUrl = await sendVerificationEmailWithTimeout(email, token);
  } catch (err) {
    emailError = err instanceof Error ? err.message : String(err);
    console.error('이메일 발송 오류 (회원가입 계속 진행):', emailError);
  }

  const emailSent = !emailError;
  let message: string;
  if (emailSent && emailStatus.provider === 'ethereal') {
    message = '테스트 메일을 발송했습니다. 아래 미리보기 링크에서 확인하세요.';
  } else if (emailSent) {
    message = '인증 이메일을 발송했습니다. 받은 편지함을 확인해주세요.';
  } else {
    message = '계정이 생성되었으나 인증 이메일 발송에 실패했습니다. "인증 메일 재발송"을 시도하거나 관리자에게 문의하세요.';
  }

  res.status(201).json({
    success: true,
    emailSent,
    emailProvider: emailStatus.provider,
    message,
    devMode: emailStatus.provider === 'ethereal',
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
  const { email, password, rememberMe } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력해주세요.' });
    return;
  }

  const { rows } = await pool.query(
    `SELECT id, email, password_hash, nickname, email_verified, tier, download_count, region, country_code FROM users WHERE email = $1`,
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

  // 기존 가입자 중 region/country 누락 시 → 로그인 시 IP 기반 자동 보강 (non-blocking)
  if (!user.region || !user.country_code) {
    detectGeoFromIp(req.ip || '').then(geo => {
      if (!geo) return;
      if (geo.region && !user.region) {
        pool.query(`UPDATE users SET region_ip = $1 WHERE id = $2 AND region IS NULL`, [geo.region, user.id]).catch(() => {});
      }
      if (geo.countryCode && !user.country_code) {
        pool.query(`UPDATE users SET country_code = $1 WHERE id = $2 AND country_code IS NULL`, [geo.countryCode, user.id]).catch(() => {});
      }
    }).catch(() => {});
  }

  const token = signToken(user.id, user.email, !!rememberMe);

  res.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, nickname: user.nickname, emailVerified: true, tier: user.tier, downloadCount: user.download_count, isAdmin: user.email === ADMIN_EMAIL },
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
  res.json({
    success: true,
    data: { ...rows[0], is_admin: rows[0].email === ADMIN_EMAIL },
  });
}

/**
 * [개발 전용] SMTP 미설정 시 이메일 인증 링크를 직접 반환
 * 운영 환경(NODE_ENV=production)에서는 404 반환
 */
export async function deleteMe(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ success: false, message: '인증이 필요합니다.' }); return; }

  // 토큰 블랙리스트 등록
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

  // 관련 데이터 삭제 후 계정 삭제
  await pool.query(`DELETE FROM bug_reports WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM paper_requests WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

  res.json({ success: true, message: '계정이 삭제되었습니다.' });
}

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
