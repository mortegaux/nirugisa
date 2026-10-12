import { Repository, In } from 'typeorm';
import { AppDataSource } from '../../db/data-source';
import { MealPlan, MealPlanRecipe } from '../../db/entities';
import {
  MealPlanCreateDto,
  MealPlanUpdateDto,
  MealPlanSearchQuery,
  PaginatedResponse,
  PAGINATION_DEFAULTS,
} from '@nommable/shared';
import { AppError } from '../../api/middleware';
import { SystemSettingsService } from '../settings/system-settings.service';

export class MealPlanService {
  private mealPlanRepo: Repository<MealPlan>;
  private mealPlanRecipeRepo: Repository<MealPlanRecipe>;

  constructor() {
    this.mealPlanRepo = AppDataSource.getRepository(MealPlan);
    this.mealPlanRecipeRepo = AppDataSource.getRepository(MealPlanRecipe);
  }

  async create(
    userId: string,
    dto: MealPlanCreateDto,
    isAiGenerated = false
  ): Promise<MealPlan> {
    const mealPlan = this.mealPlanRepo.create({
      userId,
      name: dto.name,
      description: dto.description,
      startDate: dto.startDate,
      endDate: dto.endDate,
      isAiGenerated,
    });

    await this.mealPlanRepo.save(mealPlan);

    // Create meal plan recipes
    if (dto.meals?.length) {
      const meals = dto.meals.map((meal) =>
        this.mealPlanRecipeRepo.create({
          mealPlanId: mealPlan.id,
          recipeId: meal.recipeId,
          date: meal.date,
          mealType: meal.mealType,
          servings: meal.servings,
          notes: meal.notes,
        })
      );
      await this.mealPlanRecipeRepo.save(meals);
    }

    return this.findById(mealPlan.id, userId);
  }

  async findAll(userId: string, query: MealPlanSearchQuery = {}): Promise<PaginatedResponse<MealPlan>> {
    const page = Math.max(1, query.page ?? PAGINATION_DEFAULTS.page);
    const pageSize = Math.min(
      query.pageSize ?? PAGINATION_DEFAULTS.pageSize,
      PAGINATION_DEFAULTS.maxPageSize
    );
    const skip = (page - 1) * pageSize;
    const sharedMealPlans = await SystemSettingsService.isSharedMealPlansEnabled();

    const qb = this.mealPlanRepo
      .createQueryBuilder('mealPlan')
      .select('mealPlan.id')
      .orderBy('mealPlan.startDate', 'DESC');

    if (!sharedMealPlans) {
      qb.where('mealPlan.userId = :userId', { userId });
    }

    if (query.query) {
      qb.andWhere(
        '(mealPlan.name ILIKE :search OR mealPlan.description ILIKE :search)',
        { search: `%${query.query}%` }
      );
    }

    const [idResults, total] = await qb.skip(skip).take(pageSize).getManyAndCount();
    const ids = idResults.map((mp) => mp.id);

    if (ids.length === 0) {
      return { data: [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    const data = await this.mealPlanRepo.find({
      where: { id: In(ids) },
      relations: ['meals', 'meals.recipe'],
      order: { startDate: 'DESC' },
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(id: string, userId: string): Promise<MealPlan> {
    const sharedMealPlans = await SystemSettingsService.isSharedMealPlansEnabled();
    const mealPlan = await this.mealPlanRepo.findOne({
      where: sharedMealPlans ? { id } : { id, userId },
      relations: ['meals', 'meals.recipe', 'meals.recipe.ingredients'],
      order: { meals: { date: 'ASC' } },
    });

    if (!mealPlan) {
      throw new AppError(404, 'Meal plan not found');
    }

    return mealPlan;
  }

  async update(id: string, userId: string, dto: MealPlanUpdateDto): Promise<MealPlan> {
    const mealPlan = await this.findById(id, userId);

    if (dto.name !== undefined) mealPlan.name = dto.name;
    if (dto.description !== undefined) mealPlan.description = dto.description;
    if (dto.startDate !== undefined) mealPlan.startDate = dto.startDate;
    if (dto.endDate !== undefined) mealPlan.endDate = dto.endDate;

    await this.mealPlanRepo.save(mealPlan);

    // Update meals if provided
    if (dto.meals !== undefined) {
      // Delete old meals
      await this.mealPlanRecipeRepo.delete({ mealPlanId: id });

      // Create new meals
      if (dto.meals.length) {
        const meals = dto.meals.map((meal) =>
          this.mealPlanRecipeRepo.create({
            mealPlanId: id,
            recipeId: meal.recipeId,
            date: meal.date,
            mealType: meal.mealType,
            servings: meal.servings,
            notes: meal.notes,
          })
        );
        await this.mealPlanRecipeRepo.save(meals);
      }
    }

    return this.findById(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const mealPlan = await this.findById(id, userId);
    await this.mealPlanRepo.remove(mealPlan);
  }

  async bulkDelete(ids: string[], userId: string): Promise<number> {
    const sharedMealPlans = await SystemSettingsService.isSharedMealPlansEnabled();
    const mealPlans = await this.mealPlanRepo.find({
      where: sharedMealPlans
        ? { id: In(ids) }
        : {
            id: In(ids),
            userId,
          },
    });

    if (mealPlans.length === 0) {
      return 0;
    }

    await this.mealPlanRepo.remove(mealPlans);
    return mealPlans.length;
  }

  async addMeal(
    mealPlanId: string,
    userId: string,
    meal: {
      recipeId: string;
      date: Date;
      mealType: string;
      servings: number;
      notes?: string;
    }
  ): Promise<MealPlan> {
    // Verify meal plan exists and belongs to user
    await this.findById(mealPlanId, userId);

    const mealPlanRecipe = this.mealPlanRecipeRepo.create({
      mealPlanId,
      ...meal,
    });

    await this.mealPlanRecipeRepo.save(mealPlanRecipe);

    return this.findById(mealPlanId, userId);
  }

  async removeMeal(mealPlanId: string, userId: string, mealId: string): Promise<MealPlan> {
    // Verify meal plan exists and belongs to user
    await this.findById(mealPlanId, userId);

    await this.mealPlanRecipeRepo.delete({ id: mealId, mealPlanId });

    return this.findById(mealPlanId, userId);
  }
}
