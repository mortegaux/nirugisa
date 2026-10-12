import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware';
import { GamificationService, ACHIEVEMENTS } from '../../services/gamification/gamification.service';

const gamificationService = new GamificationService();

export const getUserStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await gamificationService.getUserStats(req.userId!);
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

export const getUserAchievements = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const achievements = await gamificationService.getUserAchievements();
    res.json(achievements);
  } catch (error) {
    next(error);
  }
};

export const getAchievementProgress = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const progress = await gamificationService.getAchievementProgress();
    res.json(progress);
  } catch (error) {
    next(error);
  }
};

export const getAllAchievements = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(Object.values(ACHIEVEMENTS));
  } catch (error) {
    next(error);
  }
};

export const getLeaderboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await gamificationService.getLeaderboard(limit);
    res.json(leaderboard);
  } catch (error) {
    next(error);
  }
};

export const recordMealCooked = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const newAchievements = await gamificationService.recordMealCooked(userId);
    res.json({ newAchievements });
  } catch (error) {
    next(error);
  }
};
