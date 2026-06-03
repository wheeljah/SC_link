import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { requireAuth } from '../middleware/auth';
import { listRequests, getRequest, createRequest, respondToRequest } from '../controllers/communityController';

const storage = multer.diskStorage({
  destination: process.env.UPLOAD_DIR || './uploads',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '50')) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.zip', '.rar', '.tar', '.gz'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('허용되지 않는 파일 형식입니다.'));
    }
  },
});

const router = Router();

router.get('/requests', listRequests);
router.get('/requests/:id', getRequest);
router.post('/requests', requireAuth, createRequest);
router.post('/requests/:id/respond', requireAuth, upload.single('file'), respondToRequest);

export default router;
