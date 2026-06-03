import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { downloadLimiter } from '../middleware/rateLimit';
import { requestDownload, getDownloadHistory, serveFile } from '../controllers/paperController';

const router = Router();

router.post('/download', requireAuth, downloadLimiter, requestDownload);
router.get('/history', requireAuth, getDownloadHistory);
router.get('/:id/file', requireAuth, serveFile);

export default router;
