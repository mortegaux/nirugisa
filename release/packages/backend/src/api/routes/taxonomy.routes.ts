import { Router } from 'express';
import { taxonomyController } from '../controllers/taxonomy.controller';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';

const router = Router();
router.use(authMiddleware);

router.get('/', taxonomyController.getAll);
router.post('/', requireAdmin, taxonomyController.create);
router.put('/:id', requireAdmin, taxonomyController.update);
router.delete('/:id', requireAdmin, taxonomyController.delete);
router.post('/reorder', requireAdmin, taxonomyController.reorder);

export default router;
