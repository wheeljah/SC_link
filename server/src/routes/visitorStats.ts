// server/src/routes/visitorStats.ts
// 공개 트래킹 엔드포인트 — POST /api/v1/track-view
// IP/세션/UA는 헤더에서 자동 추출, 봇은 무시

import { Router } from 'express';
import { VisitorTracker } from '../services/visitorStats/tracker';

const router = Router();
const tracker = new VisitorTracker();

router.post('/track-view', async (req, res) => {
  const result = await tracker.track(req.headers as Record<string, string | string[] | undefined>, {
    path: req.body?.path,
    sessionId: req.body?.sessionId,
    referrer: req.body?.referrer,
  });
  if (!result.ok) {
    res.status(400).json({ success: false, message: result.error ?? 'track failed' });
    return;
  }
  res.json({ success: true, deduped: result.deduped ?? false });
});

export default router;