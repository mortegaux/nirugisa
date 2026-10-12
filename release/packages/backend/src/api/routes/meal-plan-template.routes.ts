import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import mealPlanTemplateController from '../controllers/meal-plan-template.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Create template from existing meal plan
router.post(
  '/from-meal-plan',
  mealPlanTemplateController.createFromMealPlan.bind(mealPlanTemplateController)
);

// Create template from scratch
router.post('/', mealPlanTemplateController.create.bind(mealPlanTemplateController));

// Get all templates
router.get('/', mealPlanTemplateController.getAll.bind(mealPlanTemplateController));

// Get specific template
router.get('/:id', mealPlanTemplateController.getById.bind(mealPlanTemplateController));

// Delete template
router.delete(
  '/:id',
  mealPlanTemplateController.delete.bind(mealPlanTemplateController)
);

// Apply template to create meal plan
router.post(
  '/:id/apply',
  mealPlanTemplateController.apply.bind(mealPlanTemplateController)
);

export default router;
