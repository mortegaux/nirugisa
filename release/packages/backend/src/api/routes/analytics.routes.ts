import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// All analytics routes require authentication
router.use(authMiddleware);

// Get analytics summary
router.get('/summary', analyticsController.getAnalyticsSummary);

// Get meal history
router.get('/history', analyticsController.getMealHistory);

export default router;
