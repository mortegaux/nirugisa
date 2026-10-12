import { Router } from 'express';
import { ShoppingListController } from '../controllers/shopping-list.controller';
import { authMiddleware } from '../middleware';

const router = Router();
const controller = new ShoppingListController();

router.use(authMiddleware);

router.get('/', controller.findAll.bind(controller));
router.post('/', controller.create.bind(controller));
router.post('/from-meal-plan', controller.createFromMealPlan.bind(controller));
router.get('/:id', controller.findById.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

// Item management
router.patch('/:id/items/:itemId/toggle', controller.toggleItem.bind(controller));

export default router;
