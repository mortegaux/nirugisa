import { Router } from 'express';
import { homeAssistantController } from '../controllers/home-assistant.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Existing session auth (Better Auth session via cookie or Bearer token) —
// no new auth surface. Personal API tokens are a separate piece of #34.
router.use(authMiddleware);

// Read-only summaries for automation consumers (e.g. Home Assistant).
router.get('/tonights-dinner', homeAssistantController.getTonightsDinner);
router.get('/low-stock', homeAssistantController.getLowStock);
router.get('/expiring', homeAssistantController.getExpiring);
router.get('/shopping-lists', homeAssistantController.getShoppingLists);

export default router;
