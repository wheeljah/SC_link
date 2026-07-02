// server/src/routes/jobs.ts
import { Router, type Request, type Response, type NextFunction } from 'express';
import { listJobs, getJob, listSources, subscribeForeignInterest } from '../controllers/jobsController';
import { runCrawl, runAllCrawls } from '../services/jobCrawlerService';
import { requireAuth } from '../middleware/auth';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'wheeljah@gmail.com';

const router = Router();

// 어드민 미들웨어 (jobs/admin/* 라우트 전용)
async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    const email = (req as { userEmail?: string }).userEmail || '';
    if (email !== ADMIN_EMAIL) {
      res.status(403).json({ success: false, message: 'admin only' });
      return;
    }
    next();
  });
}

// ── 공개 API (비로그인 가능) ──────────────────────────────────────────────
router.get('/', listJobs);
router.get('/sources', listSources);
router.get('/:id', getJob);
router.post('/foreign-interest', subscribeForeignInterest);

// ── 어드민 — 수동 크롤 트리거 ────────────────────────────────────────────
router.post('/admin/crawl/:code', requireAdmin, async (req, res) => {
  try {
    const result = await runCrawl(req.params.code);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});
router.post('/admin/crawl-all', requireAdmin, async (_req, res) => {
  try {
    const results = await runAllCrawls();
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

export default router;