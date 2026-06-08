import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { listReports, createReport, updateStatus } from '../controllers/bugReportController';

const router = Router();

router.get('/',            listReports);
router.post('/',           requireAuth, createReport);
router.patch('/:id/status', requireAuth, updateStatus);

export default router;
