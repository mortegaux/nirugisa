import { Router } from 'express';
import * as gamificationController from '../controllers/gamification.controller';
import { authMiddleware } from '../middleware';

const router = Router();

router.use(authMiddleware);

// Get user stats
router.get('/stats', gamificationController.getUserStats);

// Get user achievements
router.get('/achievements', gamificationController.getUserAchievements);

// Get achievement progress (completed, in-progress, available)
router.get('/achievements/progress', gamificationController.getAchievementProgress);

// Get all achievement definitions
router.get('/achievements/all', gamificationController.getAllAchievements);

// Get leaderboard
router.get('/leaderboard', gamificationController.getLeaderboard);

// Record meal cooked (for manual tracking)
router.post('/record-meal', gamificationController.recordMealCooked);

export default router;
