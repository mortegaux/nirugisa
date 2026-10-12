import { Router } from 'express';
import { SetupController } from '../controllers/setup.controller';

const router = Router();

router.get('/status', SetupController.getStatus);
router.post('/complete', SetupController.completeSetup);

export default router;
