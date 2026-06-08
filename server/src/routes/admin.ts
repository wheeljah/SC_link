import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getStats, listUsers, listDownloads,
  exportUsers, exportDownloads,
  deleteOldDownloads, deleteUser,
} from '../controllers/adminController';

const router = Router();
router.use(requireAuth);

router.get('/stats',             getStats);
router.get('/users',             listUsers);
router.get('/downloads',         listDownloads);
router.get('/export/users',      exportUsers);
router.get('/export/downloads',  exportDownloads);
router.delete('/downloads/old',  deleteOldDownloads);
router.delete('/users/:id',      deleteUser);

export default router;
