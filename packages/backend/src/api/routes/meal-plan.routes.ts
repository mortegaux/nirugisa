import { Router } from 'express';
import { MealPlanController } from '../controllers/meal-plan.controller';
import { authMiddleware } from '../middleware';

const router = Router();
const controller = new MealPlanController();

router.use(authMiddleware);

router.get('/', controller.findAll.bind(controller));
router.post('/', controller.create.bind(controller));
router.post('/bulk-delete', controller.bulkDelete.bind(controller));
router.get('/:id', controller.findById.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

// Calendar export
router.get('/:id/export/ics', controller.exportToCalendar.bind(controller));

// Shopping list integration
router.get('/:id/missing-ingredients', controller.getMissingIngredients.bind(controller));
router.post('/:id/add-to-shopping-list', controller.addToShoppingList.bind(controller));

// Meal management
router.post('/:id/meals', controller.addMeal.bind(controller));
router.delete('/:id/meals/:mealId', controller.removeMeal.bind(controller));

// AI generation (legacy)
router.post('/generate', controller.generateWithAI.bind(controller));

// Intelligent meal plan generation
router.post('/preview', controller.generatePreview.bind(controller));
router.post('/preview/replace-meal', controller.replaceMeal.bind(controller));
router.post('/commit', controller.commitPreview.bind(controller));

export default router;
