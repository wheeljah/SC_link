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
import { startMonitoringCron } from './services/serverMonitorService';
import { checkAllServers } from './services/serverMonitorService';

import authRoutes from './routes/auth';
import serverRoutes from './routes/servers';
import paperRoutes from './routes/papers';
import communityRoutes from './routes/community';
import adRoutes from './routes/ads';

const app = express();
const PORT = parseInt(process.env.PORT || '4000');

// 보안 미들웨어
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: allow localhost dev + GitHub Pages
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://wheeljah.github.io/SC_link',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
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

// 정적 파일 서빙 (업로드 파일)
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads')));

// API 라우터
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/servers', serverRoutes);
app.use('/api/v1/papers', paperRoutes);
app.use('/api/v1/community', communityRoutes);
app.use('/api/v1/ads', adRoutes);

// 헬스체크
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// 에러 핸들러
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
});

app.listen(PORT, async () => {
  console.log(`🚀 ScholarLink API 서버 시작: http://localhost:${PORT}`);
  // 시작 시 서버 상태 즉시 체크
  try { await checkAllServers(); } catch { /* 시작 시 실패해도 계속 */ }
  startMonitoringCron();
});

export default app;
