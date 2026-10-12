import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Data management endpoints
router.delete('/data/clear', SettingsController.clearData);

export default router;
