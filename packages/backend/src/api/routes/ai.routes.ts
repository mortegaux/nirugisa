import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AIController } from '../controllers/ai.controller';
import { authMiddleware, requireAdmin } from '../middleware';

const router = Router();
const controller = new AIController();

router.use(authMiddleware);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).userId ?? ipKeyGenerator(req.ip ?? '127.0.0.1'),
  message: { error: 'Too many AI requests, please try again later' },
});

router.use(aiLimiter);

router.get('/status', controller.getStatus.bind(controller));

// Per-user (BYOK) key management — any authenticated user. Writes are rejected
// by the controller when the instance runs in shared key mode.
router.get('/my-config', controller.getMyConfig.bind(controller));
router.put('/my-config', controller.saveMyConfig.bind(controller));
router.delete('/my-config', controller.deleteMyConfig.bind(controller));
router.post('/my-config/test', controller.testMyConfig.bind(controller));

// Instance-wide AI config — admin only. Non-admins never see the shared key here.
router.get('/config', requireAdmin, controller.getConfig.bind(controller));
router.post('/config', requireAdmin, controller.createConfig.bind(controller));
router.put('/config', requireAdmin, controller.updateConfig.bind(controller));
router.post('/config/test', requireAdmin, controller.testConnection.bind(controller));
router.get('/models', requireAdmin, controller.listModels.bind(controller));
router.post('/models', requireAdmin, controller.listModels.bind(controller));

router.post('/substitute-ingredient', controller.substituteIngredient.bind(controller));

export default router;
