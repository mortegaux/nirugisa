import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { pantryController } from '../controllers/pantry.controller';
import { authMiddleware } from '../middleware/auth';
import { recipeExtractionUpload, validateImageContent } from '../middleware/upload';

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).userId ?? ipKeyGenerator(req.ip ?? '127.0.0.1'),
  message: { error: 'Too many AI requests, please try again later' },
});

const router = Router();

router.use(authMiddleware);

router.get('/', pantryController.getAll);
router.get('/expiring', pantryController.getExpiring);
router.get('/low-stock', pantryController.getLowStock);
router.get('/locations', pantryController.getLocations);
router.post('/locations', pantryController.createLocation);
router.put('/locations/:name', pantryController.updateLocation);
router.delete('/locations/:name', pantryController.deleteLocation);
router.get('/:id', pantryController.getById);
router.post('/', pantryController.create);
router.put('/:id', pantryController.update);
router.delete('/:id', pantryController.delete);
router.patch('/:id/quantity', pantryController.updateQuantity);
router.patch('/:id/toggle-low-stock', pantryController.toggleLowStock);

// AI vision: scan pantry/fridge photos, return candidates for review.
// Nothing is written to the pantry until the user confirms in the UI.
router.post(
  '/scan-images',
  aiLimiter,
  recipeExtractionUpload.array('files', 5),
  validateImageContent,
  pantryController.scanImages
);

export default router;
