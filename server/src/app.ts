import dotenv from 'dotenv';
dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('[CRASH] uncaughtException:', err.message, err.stack?.substring(0, 500));
});
process.on('unhandledRejection', (reason) => {
  console.error('[CRASH] unhandledRejection:', String(reason));
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

import { generalLimiter } from './middleware/rateLimit';
import authRoutes from './routes/auth';
import serverRoutes from './routes/servers';
import paperRoutes from './routes/papers';
import communityRoutes from './routes/community';
import adRoutes from './routes/ads';

const app = express();
const PORT = parseInt(process.env.PORT || '4000');

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://wheeljah.github.io',
];
if (process.env.APP_URL) {
  try { allowedOrigins.push(new URL(process.env.APP_URL).origin); } catch { /* ignore */ }
}
if (process.env.CORS_EXTRA_ORIGINS) {
  allowedOrigins.push(...process.env.CORS_EXTRA_ORIGINS.split(',').map(s => s.trim()));
}

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      /\.onrender\.com$/.test(origin) ||
      /\.ngrok-free\.(app|dev)$/.test(origin) ||
      /\.github\.io$/.test(origin)
    ) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked origin: ' + origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// health check: rate limiter 앞에 등록 (Render 반복 요청이 429에 걸리지 않게)
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/', (_req, res) => res.json({ service: 'ScholarLink API', status: 'running' }));

app.use('/api', generalLimiter);
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads')));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/servers', serverRoutes);
app.use('/api/v1/papers', paperRoutes);
app.use('/api/v1/community', communityRoutes);
app.use('/api/v1/ads', adRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Server error' });
});

// listen 먼저 -> health check 즉시 응답 -> migrate 백그라운드 실행
app.listen(PORT, () => {
  console.log('ScholarLink API started on port ' + PORT);

  void (async () => {
    const timer = setTimeout(() => console.warn('[migrate] timeout'), 20000);
    try {
      const { migrate } = await import('./db/migrate');
      await migrate();
      console.log('[migrate] done');
    } catch (e) {
      console.warn('[migrate] skipped:', (e as Error).message);
    } finally {
      clearTimeout(timer);
    }
  })();
});

export default app;
