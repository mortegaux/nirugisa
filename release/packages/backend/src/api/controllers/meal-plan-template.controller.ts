import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MealPlanTemplateService } from '../../services/meal-plan-template/meal-plan-template.service';

export class MealPlanTemplateController {
  /**
   * Create a template from an existing meal plan
   * POST /api/meal-plan-templates/from-meal-plan
   */
  async createFromMealPlan(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { mealPlanId, name, description, tags } = req.body;

      if (!mealPlanId || !name) {
        res.status(400).json({ error: 'mealPlanId and name are required' });
        return;
      }

      const template = await MealPlanTemplateService.createFromMealPlan(
        userId,
        mealPlanId,
        { name, description, tags }
      );

      res.json(template);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a template from scratch
   * POST /api/meal-plan-templates
   */
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const dto = req.body;

      if (!dto.name || !dto.duration || !dto.meals || dto.meals.length === 0) {
        res.status(400).json({
          error: 'name, duration, and meals are required',
        });
        return;
      }

      const template = await MealPlanTemplateService.create(userId, dto);

      res.json(template);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all templates for the authenticated user
   * GET /api/meal-plan-templates
   */
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = await MealPlanTemplateService.findAll();
      res.json(templates);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific template by ID
   * GET /api/meal-plan-templates/:id
   */
  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const template = await MealPlanTemplateService.findById(id);

      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      res.json(template);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a template
   * DELETE /api/meal-plan-templates/:id
   */
  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const deleted = await MealPlanTemplateService.delete(id);

      if (!deleted) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Apply a template to create a new meal plan
   * POST /api/meal-plan-templates/:id/apply
   */
  async apply(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { startDate, name, description } = req.body;

      if (!startDate) {
        res.status(400).json({ error: 'startDate is required' });
        return;
      }

      const mealPlan = await MealPlanTemplateService.applyTemplate(userId, {
        templateId: id,
        startDate,
        name,
        description,
      });

      res.json(mealPlan);
    } catch (error) {
      next(error);
    }
  }
}

export default new MealPlanTemplateController();
