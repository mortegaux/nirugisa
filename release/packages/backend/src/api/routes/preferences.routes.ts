import { Router } from 'express';
import * as preferencesController from '../controllers/preferences.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// All preferences routes require authentication
router.use(authMiddleware);

// Get user preferences
router.get('/', preferencesController.getPreferences);

// Update user preferences
router.put('/', preferencesController.updatePreferences);

// Delete user preferences
router.delete('/', preferencesController.deletePreferences);

// Check recipe compatibility with preferences
router.post('/check-compatibility', preferencesController.checkRecipeCompatibility);

export default router;
