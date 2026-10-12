import { Router } from 'express';
import authRoutes from './auth.routes';
import recipeRoutes from './recipe.routes';
import aiRoutes from './ai.routes';
import mealPlanRoutes from './meal-plan.routes';
import mealPlanTemplateRoutes from './meal-plan-template.routes';
import shoppingListRoutes from './shopping-list.routes';
import invitationRoutes from './invitation.routes';
import settingsRoutes from './settings.routes';
import userRoutes from './user.routes';
import pantryRoutes from './pantry.routes';
import analyticsRoutes from './analytics.routes';
import preferencesRoutes from './preferences.routes';
import batchCookingRoutes from './batch-cooking.routes';
import gamificationRoutes from './gamification.routes';
import taxonomyRoutes from './taxonomy.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/recipes', recipeRoutes);
router.use('/ai', aiRoutes);
router.use('/meal-plans', mealPlanRoutes);
router.use('/meal-plan-templates', mealPlanTemplateRoutes);
router.use('/shopping-lists', shoppingListRoutes);
router.use('/invitations', invitationRoutes);
router.use('/settings', settingsRoutes);
router.use('/users', userRoutes);
router.use('/pantry', pantryRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/preferences', preferencesRoutes);
router.use('/batch-cooking', batchCookingRoutes);
router.use('/gamification', gamificationRoutes);
router.use('/taxonomies', taxonomyRoutes);

export default router;
