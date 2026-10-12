import { Router } from 'express';
import { pantryController } from '../controllers/pantry.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', pantryController.getAll);
router.get('/expiring', pantryController.getExpiring);
router.get('/low-stock', pantryController.getLowStock);
router.get('/:id', pantryController.getById);
router.post('/', pantryController.create);
router.put('/:id', pantryController.update);
router.delete('/:id', pantryController.delete);
router.patch('/:id/quantity', pantryController.updateQuantity);
router.patch('/:id/toggle-low-stock', pantryController.toggleLowStock);

export default router;
