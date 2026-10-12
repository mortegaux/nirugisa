import { Repository } from 'typeorm';
import { AppDataSource } from '../../db/data-source';
import { MealPlan, MealPlanRecipe, Recipe } from '../../db/entities';

interface RecipeFrequency {
  recipeId: string;
  recipeTitle: string;
  count: number;
  imageUrl?: string;
  categories: string[];
}

interface MealTypeDistribution {
  breakfast: number;
  lunch: number;
  dinner: number;
  snack: number;
}

interface CookingFrequency {
  date: string;
  mealCount: number;
}

interface RecipeVariety {
  totalMeals: number;
  uniqueRecipes: number;
  varietyScore: number; // uniqueRecipes / totalMeals
  mostRepeatedRecipe?: {
    title: string;
    count: number;
  };
}

interface NutritionTrends {
  averageCalories: number;
  averageProtein: number;
  averageCarbs: number;
  averageFat: number;
  averageFiber: number;
  totalMealsAnalyzed: number;
}

interface CategoryPopularity {
  category: string;
  count: number;
  percentage: number;
}

interface AnalyticsSummary {
  totalMealPlans: number;
  totalMeals: number;
  dateRange: {
    earliest: string | null;
    latest: string | null;
  };
  mostCookedRecipes: RecipeFrequency[];
  mealTypeDistribution: MealTypeDistribution;
  cookingFrequency: CookingFrequency[];
  recipeVariety: RecipeVariety;
  nutritionTrends: NutritionTrends;
  categoryPopularity: CategoryPopularity[];
  aiGeneratedRatio: number;
}

export class AnalyticsService {
  private mealPlanRepository: Repository<MealPlan>;
  private mealPlanRecipeRepository: Repository<MealPlanRecipe>;
  private recipeRepository: Repository<Recipe>;

  constructor() {
    this.mealPlanRepository = AppDataSource.getRepository(MealPlan);
    this.mealPlanRecipeRepository = AppDataSource.getRepository(MealPlanRecipe);
    this.recipeRepository = AppDataSource.getRepository(Recipe);
  }

  async getAnalyticsSummary(userId: string): Promise<AnalyticsSummary> {
    const [
      totalMealPlans,
      totalMeals,
      dateRange,
      mostCookedRecipes,
      mealTypeDistribution,
      cookingFrequency,
      recipeVariety,
      nutritionTrends,
      categoryPopularity,
      aiGeneratedRatio,
    ] = await Promise.all([
      this.getTotalMealPlans(userId),
      this.getTotalMeals(userId),
      this.getDateRange(userId),
      this.getMostCookedRecipes(userId),
      this.getMealTypeDistribution(userId),
      this.getCookingFrequency(userId),
      this.getRecipeVariety(userId),
      this.getNutritionTrends(userId),
      this.getCategoryPopularity(userId),
      this.getAiGeneratedRatio(userId),
    ]);

    return {
      totalMealPlans,
      totalMeals,
      dateRange,
      mostCookedRecipes,
      mealTypeDistribution,
      cookingFrequency,
      recipeVariety,
      nutritionTrends,
      categoryPopularity,
      aiGeneratedRatio,
    };
  }

  private async getTotalMealPlans(userId: string): Promise<number> {
    return await this.mealPlanRepository.count({ where: { userId } });
  }

  private async getTotalMeals(userId: string): Promise<number> {
    const result = await this.mealPlanRecipeRepository
      .createQueryBuilder('mpr')
      .innerJoin('mpr.mealPlan', 'mp')
      .where('mp.userId = :userId', { userId })
      .getCount();

    return result;
  }

  private async getDateRange(
    userId: string
  ): Promise<{ earliest: string | null; latest: string | null }> {
    const result = await this.mealPlanRecipeRepository
      .createQueryBuilder('mpr')
      .innerJoin('mpr.mealPlan', 'mp')
      .select('MIN(mpr.date)', 'earliest')
      .addSelect('MAX(mpr.date)', 'latest')
      .where('mp.userId = :userId', { userId })
      .getRawOne();

    return {
      earliest: result?.earliest || null,
      latest: result?.latest || null,
    };
  }

  private async getMostCookedRecipes(
    userId: string,
    limit: number = 10
  ): Promise<RecipeFrequency[]> {
    const results = await this.mealPlanRecipeRepository
      .createQueryBuilder('mpr')
      .innerJoin('mpr.mealPlan', 'mp')
      .innerJoin('mpr.recipe', 'r')
      .select('r.id', 'recipeId')
      .addSelect('r.title', 'recipeTitle')
      .addSelect('r.imageUrl', 'imageUrl')
      .addSelect('r.categories', 'categories')
      .addSelect('COUNT(mpr.id)', 'count')
      .where('mp.userId = :userId', { userId })
      .groupBy('r.id, r.title, r.imageUrl, r.categories')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r) => {
      let categories: string[] = [];
      if (Array.isArray(r.categories)) {
        categories = r.categories;
      } else if (typeof r.categories === 'string' && r.categories.trim()) {
        try {
          const parsed = JSON.parse(r.categories);
          if (Array.isArray(parsed)) categories = parsed;
        } catch {
          categories = r.categories.split(',').map((c: string) => c.trim()).filter(Boolean);
        }
      }
      return {
        recipeId: r.recipeId,
        recipeTitle: r.recipeTitle,
        count: parseInt(r.count, 10),
        imageUrl: r.imageUrl,
        categories,
      };
    });
  }

  private async getMealTypeDistribution(userId: string): Promise<MealTypeDistribution> {
    const results = await this.mealPlanRecipeRepository
      .createQueryBuilder('mpr')
      .innerJoin('mpr.mealPlan', 'mp')
      .select('mpr.mealType', 'mealType')
      .addSelect('COUNT(mpr.id)', 'count')
      .where('mp.userId = :userId', { userId })
      .groupBy('mpr.mealType')
      .getRawMany();

    const distribution: MealTypeDistribution = {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      snack: 0,
    };

    results.forEach((r) => {
      distribution[r.mealType as keyof MealTypeDistribution] = parseInt(r.count, 10);
    });

    return distribution;
  }

  private async getCookingFrequency(userId: string): Promise<CookingFrequency[]> {
    const results = await this.mealPlanRecipeRepository
      .createQueryBuilder('mpr')
      .innerJoin('mpr.mealPlan', 'mp')
      .select('mpr.date', 'date')
      .addSelect('COUNT(mpr.id)', 'mealCount')
      .where('mp.userId = :userId', { userId })
      .groupBy('mpr.date')
      .orderBy('mpr.date', 'ASC')
      .getRawMany();

    return results.map((r) => ({
      date: r.date,
      mealCount: parseInt(r.mealCount, 10),
    }));
  }

  private async getRecipeVariety(userId: string): Promise<RecipeVariety> {
    const totalMealsResult = await this.mealPlanRecipeRepository
      .createQueryBuilder('mpr')
      .innerJoin('mpr.mealPlan', 'mp')
      .where('mp.userId = :userId', { userId })
      .getCount();

    const uniqueRecipesResult = await this.mealPlanRecipeRepository
      .createQueryBuilder('mpr')
      .innerJoin('mpr.mealPlan', 'mp')
      .select('COUNT(DISTINCT mpr.recipeId)', 'count')
      .where('mp.userId = :userId', { userId })
      .getRawOne();

    const uniqueRecipes = parseInt(uniqueRecipesResult?.count || '0', 10);
    const totalMeals = totalMealsResult;

    // Find most repeated recipe
    const mostRepeated = await this.mealPlanRecipeRepository
      .createQueryBuilder('mpr')
      .innerJoin('mpr.mealPlan', 'mp')
      .innerJoin('mpr.recipe', 'r')
      .select('r.title', 'title')
      .addSelect('COUNT(mpr.id)', 'count')
      .where('mp.userId = :userId', { userId })
      .groupBy('r.id, r.title')
      .orderBy('count', 'DESC')
      .limit(1)
      .getRawOne();

    return {
      totalMeals,
      uniqueRecipes,
      varietyScore: totalMeals > 0 ? uniqueRecipes / totalMeals : 0,
      mostRepeatedRecipe: mostRepeated
        ? {
            title: mostRepeated.title,
            count: parseInt(mostRepeated.count, 10),
          }
        : undefined,
    };
  }

  private async getNutritionTrends(userId: string): Promise<NutritionTrends> {
    const results = await this.mealPlanRecipeRepository
      .createQueryBuilder('mpr')
      .innerJoin('mpr.mealPlan', 'mp')
      .innerJoin('mpr.recipe', 'r')
      .select("AVG(CAST(json_extract(r.nutrition, '$.calories') AS REAL))", 'avgCalories')
      .addSelect("AVG(CAST(json_extract(r.nutrition, '$.protein') AS REAL))", 'avgProtein')
      .addSelect("AVG(CAST(COALESCE(json_extract(r.nutrition, '$.carbohydrates'), json_extract(r.nutrition, '$.carbs')) AS REAL))", 'avgCarbs')
      .addSelect("AVG(CAST(json_extract(r.nutrition, '$.fat') AS REAL))", 'avgFat')
      .addSelect("AVG(CAST(json_extract(r.nutrition, '$.fiber') AS REAL))", 'avgFiber')
      .addSelect('COUNT(mpr.id)', 'totalMeals')
      .where('mp.userId = :userId', { userId })
      .andWhere('r.nutrition IS NOT NULL AND json_valid(r.nutrition)')
      .getRawOne();

    return {
      averageCalories: parseFloat(results?.avgCalories || '0'),
      averageProtein: parseFloat(results?.avgProtein || '0'),
      averageCarbs: parseFloat(results?.avgCarbs || '0'),
      averageFat: parseFloat(results?.avgFat || '0'),
      averageFiber: parseFloat(results?.avgFiber || '0'),
      totalMealsAnalyzed: parseInt(results?.totalMeals || '0', 10),
    };
  }

  private async getCategoryPopularity(userId: string): Promise<CategoryPopularity[]> {
    // Get all recipes used in meal plans with their categories
    const recipes = await this.mealPlanRecipeRepository
      .createQueryBuilder('mpr')
      .innerJoin('mpr.mealPlan', 'mp')
      .innerJoin('mpr.recipe', 'r')
      .select('r.categories', 'categories')
      .where('mp.userId = :userId', { userId })
      .getRawMany();

    // Flatten and count categories
    const categoryCount: Record<string, number> = {};
    let totalCategories = 0;

    recipes.forEach((r) => {
      let categories: string[] = [];
      if (Array.isArray(r.categories)) {
        categories = r.categories;
      } else if (typeof r.categories === 'string' && r.categories.trim()) {
        try {
          const parsed = JSON.parse(r.categories);
          if (Array.isArray(parsed)) categories = parsed;
        } catch {
          categories = r.categories.split(',').map((c: string) => c.trim()).filter(Boolean);
        }
      }
      categories.forEach((cat: string) => {
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        totalCategories++;
      });
    });

    // Convert to array and calculate percentages
    const categoryPopularity = Object.entries(categoryCount)
      .map(([category, count]) => ({
        category,
        count,
        percentage: totalCategories > 0 ? (count / totalCategories) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 categories

    return categoryPopularity;
  }

  private async getAiGeneratedRatio(userId: string): Promise<number> {
    const totalPlans = await this.mealPlanRepository.count({ where: { userId } });

    if (totalPlans === 0) {
      return 0;
    }

    const aiGeneratedPlans = await this.mealPlanRepository.count({
      where: { userId, isAiGenerated: true },
    });

    return aiGeneratedPlans / totalPlans;
  }

  async getMealHistory(userId: string, limit: number = 50): Promise<any[]> {
    const meals = await this.mealPlanRecipeRepository
      .createQueryBuilder('mpr')
      .innerJoin('mpr.mealPlan', 'mp')
      .leftJoinAndSelect('mpr.recipe', 'r')
      .select([
        'mpr.id',
        'mpr.date',
        'mpr.mealType',
        'mpr.servings',
        'mpr.notes',
        'r.id',
        'r.title',
        'r.imageUrl',
        'r.categories',
        'r.prepTime',
        'r.cookTime',
        'mp.name',
      ])
      .where('mp.userId = :userId', { userId })
      .orderBy('mpr.date', 'DESC')
      .addOrderBy('mpr.mealType', 'ASC')
      .limit(limit)
      .getMany();

    return meals.map((meal) => ({
      id: meal.id,
      date: meal.date,
      mealType: meal.mealType,
      servings: meal.servings,
      notes: meal.notes,
      recipe: meal.recipe
        ? {
            id: meal.recipe.id,
            title: meal.recipe.title,
            imageUrl: meal.recipe.imageUrl,
            categories: meal.recipe.categories,
            prepTime: meal.recipe.prepTime,
            cookTime: meal.recipe.cookTime,
          }
        : null,
    }));
  }
}
