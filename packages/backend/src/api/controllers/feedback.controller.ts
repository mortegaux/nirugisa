import { Response } from 'express';
import { AppDataSource } from '../../db/data-source';
import { FeedbackReport } from '../../db/entities/FeedbackReport';
import { AuthRequest } from '../middleware';
import { FeedbackStatus, FeedbackType } from '@nommable/shared';

const VALID_TYPES: FeedbackType[] = ['bug', 'feature'];
const VALID_STATUSES: FeedbackStatus[] = ['open', 'in-progress', 'resolved'];
const MAX_SUMMARY_LENGTH = 200;
const MAX_DETAILS_LENGTH = 5000;

const feedbackRepo = () => AppDataSource.getRepository(FeedbackReport);

export const feedbackController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const { type, summary, details, route, userAgent, viewport, appVersion } = req.body ?? {};

      if (!type || !VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: "type must be 'bug' or 'feature'" });
      }
      if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
        return res.status(400).json({ error: 'summary is required' });
      }
      if (summary.length > MAX_SUMMARY_LENGTH) {
        return res.status(400).json({ error: `summary must be at most ${MAX_SUMMARY_LENGTH} characters` });
      }
      if (details && details.length > MAX_DETAILS_LENGTH) {
        return res.status(400).json({ error: `details must be at most ${MAX_DETAILS_LENGTH} characters` });
      }

      const report = feedbackRepo().create({
        type,
        summary: summary.trim(),
        details,
        route,
        userAgent,
        viewport,
        appVersion,
        userId: req.userId!,
        status: 'open' as FeedbackStatus,
      });
      const saved = await feedbackRepo().save(report);
      res.status(201).json(saved);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async list(req: AuthRequest, res: Response) {
    try {
      const { type, status } = req.query;

      if (type && !VALID_TYPES.includes(type as FeedbackType)) {
        return res.status(400).json({ error: "type must be 'bug' or 'feature'" });
      }
      if (status && !VALID_STATUSES.includes(status as FeedbackStatus)) {
        return res.status(400).json({ error: "status must be 'open', 'in-progress' or 'resolved'" });
      }

      const where: Record<string, string> = {};
      if (type) where.type = type as string;
      if (status) where.status = status as string;

      const reports = await feedbackRepo().find({
        where,
        order: { createdAt: 'DESC' },
      });
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateStatus(req: AuthRequest, res: Response) {
    try {
      const { status } = req.body ?? {};

      if (!status || !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: "status must be 'open', 'in-progress' or 'resolved'" });
      }

      const report = await feedbackRepo().findOneBy({ id: req.params.id });
      if (!report) {
        return res.status(404).json({ error: 'Feedback report not found' });
      }

      report.status = status;
      const saved = await feedbackRepo().save(report);
      res.json(saved);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
};
