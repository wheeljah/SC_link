import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Render/외부 PostgreSQL은 SSL 필요. 로컬은 불필요.
// DATABASE_URL에 'render.com' 또는 sslmode=require가 있거나 production이면 SSL 활성화.
const dbUrl = process.env.DATABASE_URL || '';
const needsSSL =
  process.env.NODE_ENV === 'production' ||
  dbUrl.includes('render.com') ||
  dbUrl.includes('sslmode=require') ||
  process.env.DB_SSL === 'true';

export const pool = new Pool({
  connectionString: dbUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Render 무료 DB 첫 연결이 느릴 수 있어 여유
  ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected DB client error', err);
});
