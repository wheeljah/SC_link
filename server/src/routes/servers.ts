import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { listServers, refreshServers, getServerSSE, getServerCount, listCredentials, upsertCredential, deleteCredential } from '../controllers/serverController';

const router = Router();

router.get('/status', listServers);
router.get('/count', getServerCount); // 공개: 활성 서버 카운트만 (랜딩 페이지용)
router.get('/sse', getServerSSE);
router.post('/refresh', requireAuth, refreshServers);

// 자격증명 관리 (로그인 필요)
router.get('/credentials', requireAuth, listCredentials);
router.put('/:serverId/credentials', requireAuth, upsertCredential);
router.delete('/:serverId/credentials', requireAuth, deleteCredential);

export default router;
