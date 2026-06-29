import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getStats, listUsers, listDownloads,
  exportUsers, exportDownloads,
  deleteOldDownloads, deleteUser, testConnectivity, testEmail,
  resendUnverified,
  getUserStatsById, getAllUserStatsSummary,
} from '../controllers/adminController';

const router = Router();
router.use(requireAuth);

router.get('/stats',             getStats);
router.get('/stats/all',         getAllUserStatsSummary);
router.get('/users',             listUsers);
router.get('/users/:id/stats',   getUserStatsById);
router.get('/downloads',         listDownloads);
router.get('/export/users',      exportUsers);
router.get('/export/downloads',  exportDownloads);
router.delete('/downloads/old',  deleteOldDownloads);
router.delete('/users/:id',      deleteUser);
router.get('/connectivity',      testConnectivity);
router.get('/test-email',        testEmail);
router.post('/resend-unverified', resendUnverified);

export default router;
