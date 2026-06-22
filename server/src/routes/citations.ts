// server/src/routes/citations.ts

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getCitationNetwork, getCacheStats, cleanupCache } from '../controllers/citationController';

const router = Router();

// 공개: DOI만 알면 누구나 인용 관계도 확인 가능 (비로그인도 접근)
router.post('/network', getCitationNetwork);

// Admin 전용 (requireAuth가 토큰 확인 + admin role check은 admin 라우트에서)
router.get('/cache/stats', requireAuth, getCacheStats);
router.delete('/cache', requireAuth, cleanupCache);

export default router;
