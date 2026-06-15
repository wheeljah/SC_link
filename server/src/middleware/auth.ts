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
    res.status(401).json({ success: false, message: '\uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.' });
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
        res.status(401).json({ success: false, message: '\uB85C\uADF8\uC544\uC6C3\uB41C \uD1A0\uD070\uC785\uB2C8\uB2E4.' });
        return;
      }
    }

    req.userId = Number(payload.sub);
    req.userEmail = payload.email as string;
    next();
  } catch {
    res.status(401).json({ success: false, message: '\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uD1A0\uD070\uC785\uB2C8\uB2E4.' });
  }
}

export function signToken(userId: number, email: string, rememberMe = false): string {
  const jti = crypto.randomBytes(16).toString('hex');
  const expiresIn = (rememberMe
    ? (process.env.JWT_EXPIRES_LONG || '30d')
    : (process.env.JWT_EXPIRES_IN  || '1d')
  ) as SignOptions['expiresIn'];
  return jwt.sign({ sub: String(userId), email, jti }, JWT_SECRET, { expiresIn });
}
