import { Router } from 'express';
import { z } from 'zod';
import * as batchCookingController from '../controllers/batch-cooking.controller';
import { authMiddleware, validateBody } from '../middleware';

// Validation schemas
const createBatchPlanSchema = z.object({
  recipeId: z.string().uuid('Recipe ID must be a valid UUID'),
  name: z.string().min(1, 'Plan name is required').max(200, 'Plan name too long'),
  description: z.string().max(1000).optional(),
  cookingDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime()) && parsed >= new Date(new Date().setHours(0, 0, 0, 0));
  }, 'Cooking date must be today or in the future'),
  batches: z.number().int().min(1).max(20),
  servingsPerBatch: z.number().int().min(1),
  storageMethod: z.enum(['refrigerate', 'freeze', 'pantry']).optional(),
  storageDuration: z.number().int().min(0).optional(),
  reheatingInstructions: z.string().max(2000).optional(),
  prepNotes: z.string().max(2000).optional(),
});

const updateBatchPlanSchema = createBatchPlanSchema.partial().omit({ recipeId: true });

const updateStatusSchema = z.object({
  status: z.enum(['planned', 'in-progress', 'completed']),
});

const updateChecklistSchema = z.object({
  checklist: z.array(z.object({
    task: z.string().min(1),
    completed: z.boolean(),
    order: z.number().int().min(0),
  })),
});

const router = Router();

// All batch cooking routes require authentication
router.use(authMiddleware);

// Get batch cooking suggestions
router.get('/suggestions', batchCookingController.getSuggestions);

// Get analytics
router.get('/analytics', batchCookingController.getAnalytics);

// CRUD operations
router.get('/', batchCookingController.getAll);
router.post('/', validateBody(createBatchPlanSchema), batchCookingController.create);
router.get('/:id', batchCookingController.getById);
router.put('/:id', validateBody(updateBatchPlanSchema), batchCookingController.update);
router.delete('/:id', batchCookingController.deletePlan);

// Update status
router.patch('/:id/status', validateBody(updateStatusSchema), batchCookingController.updateStatus);

// Update checklist
router.patch('/:id/checklist', validateBody(updateChecklistSchema), batchCookingController.updateChecklist);

// Create shopping list from plan
router.post('/:id/shopping-list', batchCookingController.createShoppingList);

export default router;
