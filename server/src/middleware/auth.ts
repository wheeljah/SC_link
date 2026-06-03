import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db/pool';

export interface AuthRequest extends Request {
  userId?: number;
  userEmail?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

    if (payload.jti) {
      const { rows } = await pool.query(
        `SELECT id FROM token_blacklist WHERE token_jti = $1 AND expires_at > NOW()`,
        [payload.jti]
      );
      if (rows.length > 0) {
        res.status(401).json({ success: false, message: '로그아웃된 토큰입니다.' });
        return;
      }
    }

    req.userId = Number(payload.sub);
    req.userEmail = payload.email as string;
    next();
  } catch {
    res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
}

export function signToken(userId: number, email: string): string {
  const jti = crypto.randomBytes(16).toString('hex');
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
  return jwt.sign({ sub: String(userId), email, jti }, JWT_SECRET, { expiresIn });
}
