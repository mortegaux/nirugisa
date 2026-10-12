import { Repository, In } from 'typeorm';
import { AppDataSource } from '../../db/data-source';
import { MealPlan, MealPlanRecipe } from '../../db/entities';
import { MealPlanCreateDto, MealPlanUpdateDto } from '@nommable/shared';
import { AppError } from '../../api/middleware';

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

    return this.findById(mealPlan.id);
  }

  async findAll(): Promise<MealPlan[]> {
    return this.mealPlanRepo.find({
      relations: ['meals', 'meals.recipe'],
      order: { startDate: 'DESC' },
    });
  }

  async findById(id: string): Promise<MealPlan> {
    const mealPlan = await this.mealPlanRepo.findOne({
      where: { id },
      relations: ['meals', 'meals.recipe', 'meals.recipe.ingredients'],
      order: { meals: { date: 'ASC' } },
    });

    if (!mealPlan) {
      throw new AppError(404, 'Meal plan not found');
    }

    return mealPlan;
  }

  async update(id: string, dto: MealPlanUpdateDto): Promise<MealPlan> {
    const mealPlan = await this.findById(id);

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

    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const mealPlan = await this.findById(id);
    await this.mealPlanRepo.remove(mealPlan);
  }

  async bulkDelete(ids: string[]): Promise<number> {
    const mealPlans = await this.mealPlanRepo.find({
      where: {
        id: In(ids),
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
    meal: {
      recipeId: string;
      date: Date;
      mealType: string;
      servings: number;
      notes?: string;
    }
  ): Promise<MealPlan> {
    // Verify meal plan exists
    await this.findById(mealPlanId);

    const mealPlanRecipe = this.mealPlanRecipeRepo.create({
      mealPlanId,
      ...meal,
    });

    await this.mealPlanRecipeRepo.save(mealPlanRecipe);

    return this.findById(mealPlanId);
  }

  async removeMeal(mealPlanId: string, mealId: string): Promise<MealPlan> {
    // Verify meal plan exists
    await this.findById(mealPlanId);

    await this.mealPlanRecipeRepo.delete({ id: mealId, mealPlanId });

    return this.findById(mealPlanId);
  }
}
