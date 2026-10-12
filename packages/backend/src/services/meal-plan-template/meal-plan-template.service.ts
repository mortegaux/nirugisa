import { AppDataSource } from '../../db/data-source';
import {
  MealPlanTemplate,
  TemplateMeal,
  MealPlan,
  MealPlanRecipe,
  Recipe,
} from '../../db/entities';
import {
  MealPlanTemplateCreateDto,
  ApplyTemplateRequest,
} from '@nommable/shared';
import { SystemSettingsService } from '../settings/system-settings.service';

export class MealPlanTemplateService {
  /**
   * Create a template from an existing meal plan
   */
  static async createFromMealPlan(
    userId: string,
    mealPlanId: string,
    dto: { name: string; description?: string; tags?: string[] }
  ): Promise<MealPlanTemplate> {
    const mealPlanRepo = AppDataSource.getRepository(MealPlan);
    const templateRepo = AppDataSource.getRepository(MealPlanTemplate);
    const sharedMealPlans = await SystemSettingsService.isSharedMealPlansEnabled();

    // Get the meal plan with recipes
    const mealPlan = await mealPlanRepo.findOne({
      where: sharedMealPlans ? { id: mealPlanId } : { id: mealPlanId, userId },
      relations: ['meals', 'meals.recipe'],
    });

    if (!mealPlan) {
      throw new Error('Meal plan not found');
    }

    if (!mealPlan.meals || mealPlan.meals.length === 0) {
      throw new Error('Meal plan has no meals');
    }

    // Calculate duration and convert to day offsets
    const dates = mealPlan.meals.map((mpr: any) => new Date(mpr.date));
    const minDate = new Date(Math.min(...dates.map((d: any) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d: any) => d.getTime())));
    const duration =
      Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Create template meals with day offsets
    const templateMeals: Partial<TemplateMeal>[] = mealPlan.meals.map(
      (mpr: any) => {
        const mealDate = new Date(mpr.date);
        const dayOffset = Math.floor(
          (mealDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          dayOffset,
          mealType: mpr.mealType,
          recipeId: mpr.recipeId,
          servings: mpr.servings,
          notes: mpr.notes,
        };
      }
    );

    // Create the template
    const template = templateRepo.create({
      userId,
      name: dto.name,
      description: dto.description,
      duration,
      tags: dto.tags,
      meals: templateMeals as TemplateMeal[],
    });

    return await templateRepo.save(template);
  }

  /**
   * Create a template from scratch
   */
  static async create(
    userId: string,
    dto: MealPlanTemplateCreateDto
  ): Promise<MealPlanTemplate> {
    const templateRepo = AppDataSource.getRepository(MealPlanTemplate);
    const recipeRepo = AppDataSource.getRepository(Recipe);

    // Verify all recipes exist
    const recipeIds = dto.meals.map((m) => m.recipeId);
    const recipes = await recipeRepo.findBy({
      id: recipeIds as any,
    });

    if (recipes.length !== recipeIds.length) {
      throw new Error('One or more recipes not found');
    }

    // Create template
    const template = templateRepo.create({
      userId,
      name: dto.name,
      description: dto.description,
      duration: dto.duration,
      tags: dto.tags,
      meals: dto.meals.map((m) => ({
        dayOffset: m.dayOffset,
        mealType: m.mealType,
        recipeId: m.recipeId,
        servings: m.servings,
        notes: m.notes,
      })) as TemplateMeal[],
    });

    return await templateRepo.save(template);
  }

  /**
   * Get all templates for a user
   */
  static async findAll(userId: string): Promise<MealPlanTemplate[]> {
    const templateRepo = AppDataSource.getRepository(MealPlanTemplate);
    const sharedMealPlans = await SystemSettingsService.isSharedMealPlansEnabled();

    return await templateRepo.find({
      where: sharedMealPlans ? undefined : { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a specific template by ID
   */
  static async findById(
    id: string,
    userId: string
  ): Promise<MealPlanTemplate | null> {
    const templateRepo = AppDataSource.getRepository(MealPlanTemplate);
    const sharedMealPlans = await SystemSettingsService.isSharedMealPlansEnabled();

    return await templateRepo.findOne({
      where: sharedMealPlans ? { id } : { id, userId },
    });
  }

  /**
   * Delete a template
   */
  static async delete(id: string, userId: string): Promise<boolean> {
    const templateRepo = AppDataSource.getRepository(MealPlanTemplate);
    const sharedMealPlans = await SystemSettingsService.isSharedMealPlansEnabled();

    const result = await templateRepo.delete(sharedMealPlans ? { id } : { id, userId });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Apply a template to create a new meal plan
   */
  static async applyTemplate(
    userId: string,
    request: ApplyTemplateRequest
  ): Promise<MealPlan> {
    const templateRepo = AppDataSource.getRepository(MealPlanTemplate);
    const mealPlanRepo = AppDataSource.getRepository(MealPlan);
    const mealPlanRecipeRepo = AppDataSource.getRepository(MealPlanRecipe);
    const sharedMealPlans = await SystemSettingsService.isSharedMealPlansEnabled();

    // Get the template
    const template = await templateRepo.findOne({
      where: sharedMealPlans
        ? { id: request.templateId }
        : { id: request.templateId, userId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Parse start date
    const startDate = new Date(request.startDate + 'T00:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + template.duration - 1);

    // Create meal plan
    const mealPlan = mealPlanRepo.create({
      userId,
      name: request.name || template.name,
      description: request.description || template.description,
      startDate,
      endDate,
    });

    await mealPlanRepo.save(mealPlan);

    // Create meal plan recipes from template meals
    const mealPlanRecipes: MealPlanRecipe[] = template.meals.map(
      (tm) => {
        const mealDate = new Date(startDate);
        mealDate.setDate(mealDate.getDate() + tm.dayOffset);

        const mealPlanRecipe = mealPlanRecipeRepo.create({
          mealPlanId: mealPlan.id,
          recipeId: tm.recipeId,
          date: mealDate,
          mealType: tm.mealType,
          servings: tm.servings,
          notes: tm.notes,
        });

        return mealPlanRecipe;
      }
    );

    await mealPlanRecipeRepo.save(mealPlanRecipes);

    // Return meal plan with recipes
    return (await mealPlanRepo.findOne({
      where: { id: mealPlan.id },
      relations: ['meals', 'meals.recipe'],
    }))!;
  }
}
