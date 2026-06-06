import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const rawUrl = process.env.DATABASE_URL || '';

// SSL 필요 판단: 외부 호스트(neon/render/aws 등) 또는 production 또는 sslmode=require
const needsSSL =
  process.env.NODE_ENV === 'production' ||
  process.env.DB_SSL === 'true' ||
  /neon\.tech|render\.com|amazonaws\.com/.test(rawUrl) ||
  /sslmode=require|sslmode=verify/.test(rawUrl);

// URL의 sslmode/channel_binding 파라미터는 제거하고, SSL은 아래 ssl 객체로만 제어.
// (pg가 URL의 sslmode와 ssl 객체를 동시에 보면 경고/충돌이 발생할 수 있음)
function stripSslParams(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.delete('sslmode');
    u.searchParams.delete('channel_binding');
    return u.toString();
  } catch {
    // URL 파싱 실패 시 원본 그대로 (로컬 등)
    return url;
  }
}

const config: PoolConfig = {
  connectionString: stripSslParams(rawUrl),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000, // 외부 DB(Neon) 첫 연결·콜드스타트 여유
  ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
};

export const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('Unexpected DB client error', err);
});
