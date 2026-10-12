import { Router } from 'express';
import { CollectionController } from '../controllers/collection.controller';
import { authMiddleware } from '../middleware';

const router = Router();
const controller = new CollectionController();

router.use(authMiddleware);

router.get('/', controller.findAll.bind(controller));
router.post('/', controller.create.bind(controller));
// Convenience endpoint for frontend favorite toggle
router.post('/toggle-favorite', controller.toggleFavorite.bind(controller));
router.get('/:id', controller.findById.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));
router.post('/:id/recipes', controller.addRecipe.bind(controller));
router.delete('/:id/recipes/:recipeId', controller.removeRecipe.bind(controller));

export default router;
