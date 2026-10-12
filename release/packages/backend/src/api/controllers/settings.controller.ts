import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware';
import { SeederService } from '../../services/seeder/seeder.service';

export class SettingsController {
  static async clearData(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await SeederService.clearUserData();

      res.json({
        message: 'All data cleared successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
