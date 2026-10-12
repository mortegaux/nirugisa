import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware';
import { SeederService } from '../../services/seeder/seeder.service';
import { EmailService } from '../../services/email/email.service';
import { SystemSettingsService } from '../../services/settings/system-settings.service';

export class SettingsController {
  static async clearData(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await SeederService.clearUserData(req.userId!);

      res.json({
        message: 'All data cleared successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getGeneralSettings(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const settings = await SystemSettingsService.getSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  static async updateGeneralSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const settings = await SystemSettingsService.updateSettings(req.body || {});
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  static async getSmtpSettings(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const settings = await EmailService.getSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  static async saveSmtpSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const settings = await EmailService.saveSettings(req.body || {});
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  static async testSmtpSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await EmailService.sendTestEmail(req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
