import { Request, Response } from 'express';
import { AnalyticsService } from '../../services/analytics/analytics.service';

const analyticsService = new AnalyticsService();

export const getAnalyticsSummary = async (req: Request, res: Response) => {
  try {
    const summary = await analyticsService.getAnalyticsSummary();

    res.json(summary);
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
};

export const getMealHistory = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await analyticsService.getMealHistory(limit);

    res.json(history);
  } catch (error) {
    console.error('Error fetching meal history:', error);
    res.status(500).json({ error: 'Failed to fetch meal history' });
  }
};
