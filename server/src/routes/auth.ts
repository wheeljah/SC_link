import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/auth';
import {
  register, verifyEmail, resendVerification,
  login, forgotPassword, resetPassword, logout, getMe, deleteMe,
  changePassword,
  devGetVerifyLink
} from '../controllers/authController';
import { getMyStats } from '../controllers/userStatsController';

const router = Router();

router.post('/register', authLimiter, register);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', authLimiter, resendVerification);
router.post('/login', authLimiter, login);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, getMe);
router.get('/me/stats', requireAuth, getMyStats);
router.patch('/me/password', requireAuth, changePassword);
router.delete('/me', requireAuth, deleteMe);
router.get('/dev-verify-link', devGetVerifyLink); // 개발 전용

export default router;
