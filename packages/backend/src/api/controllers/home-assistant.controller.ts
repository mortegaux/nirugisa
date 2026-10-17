import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { HomeAssistantService } from '../../services/home-assistant/home-assistant.service';

const homeAssistantService = new HomeAssistantService();

/**
 * Read-only Home Assistant summary endpoints (slice of issue #34).
 * Auth is the existing session auth — see the routes file. No mutations.
 */
export const homeAssistantController = {
  async getTonightsDinner(req: AuthRequest, res: Response) {
    try {
      res.json(await homeAssistantService.getTonightsDinner(req.userId!));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getLowStock(req: AuthRequest, res: Response) {
    try {
      res.json(await homeAssistantService.getLowStock(req.userId!));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getExpiring(req: AuthRequest, res: Response) {
    try {
      // `days` window: default 7 (matches Kitchen Today), clamped to 1–30.
      const parsed = parseInt(req.query.days as string, 10);
      const windowDays = Number.isNaN(parsed) ? 7 : Math.min(30, Math.max(1, parsed));
      res.json(await homeAssistantService.getExpiring(req.userId!, windowDays));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getShoppingLists(req: AuthRequest, res: Response) {
    try {
      res.json(await homeAssistantService.getShoppingLists(req.userId!));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
