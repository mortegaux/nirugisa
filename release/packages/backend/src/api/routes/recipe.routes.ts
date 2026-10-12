import { Router } from 'express';
import { RecipeController } from '../controllers/recipe.controller';
import { authMiddleware } from '../middleware';
import { recipeImageUpload, recipeExtractionUpload } from '../middleware/upload';

const router = Router();
const controller = new RecipeController();

router.use(authMiddleware);

router.get('/', controller.findAll.bind(controller));
router.post('/', controller.create.bind(controller));
router.post('/bulk-delete', controller.bulkDelete.bind(controller));
router.post('/bulk-update', controller.bulkUpdate.bind(controller));
router.get('/:id', controller.findById.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

// Special endpoints
router.post('/import', controller.importFromUrl.bind(controller));
router.post('/generate', controller.generateWithAI.bind(controller));
router.post('/:id/enhance', controller.enhanceWithAI.bind(controller));
router.post('/extract-from-images', recipeExtractionUpload.array('files', 5), controller.extractFromImages.bind(controller));
router.post('/detect-ingredients', recipeExtractionUpload.single('image'), controller.detectIngredientsFromImage.bind(controller));

// Image upload
router.post('/upload-image', recipeImageUpload.single('image'), controller.uploadImage.bind(controller));
router.post('/:id/upload-image', recipeImageUpload.single('image'), controller.uploadImage.bind(controller));

export default router;
