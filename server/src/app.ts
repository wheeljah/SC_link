import dotenv from 'dotenv';
dotenv.config();

// Crash logging
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
import { startMonitoringCron, checkAllServers } from './services/serverMonitorService';

import authRoutes from './routes/auth';
import serverRoutes from './routes/servers';
import paperRoutes from './routes/papers';
import communityRoutes from './routes/community';
import adRoutes from './routes/ads';

const app = express();
const PORT = parseInt(process.env.PORT || '4000');

// 보안 미들웨어
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS
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
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// 로깅/파싱
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api', generalLimiter);

// 정적 파일 서빙
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads')));

// API 라우터
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/servers', serverRoutes);
app.use('/api/v1/papers', paperRoutes);
app.use('/api/v1/community', communityRoutes);
app.use('/api/v1/ads', adRoutes);

// 헬스체크 — Render가 5초 안에 이 응답을 받아야 배포 성공
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// 루트
app.get('/', (req, res) => res.json({ service: 'ScholarLink API', status: 'running' }));

// 에러 핸들러
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
});

app.listen(PORT, () => {
  console.log(`🚀 ScholarLink API 서버 시작: http://localhost:${PORT}`);
  startMonitoringCron();

  // 서버 체크는 10초 뒤 백그라운드 실행 — health check 응답 절대 차단 안 함
  setTimeout(() => {
    checkAllServers().catch((e) => console.error('[startup check]', e));
  }, 10_000);
});

export default app;
