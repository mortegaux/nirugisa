import { Router } from 'express';
import { feedbackController } from '../controllers/feedback.controller';
import { authMiddleware, requireAdmin } from '../middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', feedbackController.create);
router.get('/', requireAdmin, feedbackController.list);
router.patch('/:id', requireAdmin, feedbackController.updateStatus);

export default router;
