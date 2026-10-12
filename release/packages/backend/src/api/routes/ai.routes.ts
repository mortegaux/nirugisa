import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { authMiddleware, requireAdmin } from '../middleware';

const router = Router();
const controller = new AIController();

router.use(authMiddleware);

router.get('/status', controller.getStatus.bind(controller));

router.get('/config', requireAdmin, controller.getConfig.bind(controller));
router.post('/config', requireAdmin, controller.createConfig.bind(controller));
router.put('/config', requireAdmin, controller.updateConfig.bind(controller));
router.post('/config/test', requireAdmin, controller.testConnection.bind(controller));

router.post('/substitute-ingredient', controller.substituteIngredient.bind(controller));

export default router;
