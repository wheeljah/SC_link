import { Router } from 'express';
import { getActiveBanner, trackImpression, trackClick } from '../controllers/adBannerController';

const router = Router();

router.get('/banners', getActiveBanner);
router.post('/banners/:id/impression', trackImpression);
router.post('/banners/:id/click', trackClick);

export default router;
