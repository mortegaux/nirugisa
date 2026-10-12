import { AppDataSource } from '../../db/data-source';
import { Recipe, MealPlanRecipe, PantryItem, ShoppingListItem } from '../../db/entities';

export interface MealPlanningContext {
  recentRecipeIds: string[]; // Recipes used in last 30 days
  availableRecipes: RecipeWithScore[];
  pantryIngredients: string[];
  shoppingListIngredients: string[];
  totalRecipeCount: number;
}

export interface RecipeWithScore {
  recipe: Recipe;
  daysSinceLastUsed: number | null; // null if never used
  ingredientMatchScore: number; // 0-1, how many ingredients are available
  freshnessPriority: number; // higher = should use soon
}

export class MealPlanContextService {
  /**
   * Gather all context needed for intelligent meal planning
   */
  static async gatherContext(): Promise<MealPlanningContext> {
    try {
      const recipeRepo = AppDataSource.getRepository(Recipe);
      const mealPlanRecipeRepo = AppDataSource.getRepository(MealPlanRecipe);
      const pantryItemRepo = AppDataSource.getRepository(PantryItem);
      const shoppingListItemRepo = AppDataSource.getRepository(ShoppingListItem);

      console.log('[MealPlanContext] Gathering context');

      // Get recipes used in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let recentRecipeIds: string[] = [];
      try {
        const recentMealPlanRecipes = await mealPlanRecipeRepo
          .createQueryBuilder('mpr')
          .innerJoin('mpr.mealPlan', 'mp')
          .where('mpr.date >= :thirtyDaysAgo', { thirtyDaysAgo })
          .select('mpr.recipe_id')
          .distinct(true)
          .getRawMany();

        recentRecipeIds = recentMealPlanRecipes.map((r) => r.recipe_id);
        console.log('[MealPlanContext] Found', recentRecipeIds.length, 'recently used recipes');
      } catch (error: any) {
        console.log('[MealPlanContext] No recent meal plans found, continuing with empty list');
        recentRecipeIds = [];
      }

    // Get all recipes with ingredients
    const allRecipes = await recipeRepo.find({
      relations: ['ingredients'],
      order: { createdAt: 'DESC' },
    });

    const totalRecipeCount = allRecipes.length;

    console.log('[MealPlanContext] Found', totalRecipeCount, 'total recipes');

    // Get pantry contents (ingredient names)
    const pantryItems = await pantryItemRepo.find({
      select: ['name'],
    });
    const pantryIngredients = pantryItems
      .filter((item) => item.name) // Filter out null/undefined names
      .map((item) => item.name.toLowerCase());

    console.log('[MealPlanContext] Found', pantryItems.length, 'pantry items,', pantryIngredients.length, 'with valid names');

    // Get shopping list items
    const shoppingListItems = await shoppingListItemRepo
      .createQueryBuilder('sli')
      .innerJoin('sli.shoppingList', 'sl')
      .where('sli.checked = false') // Only unchecked items
      .select('sli.name')
      .getRawMany();

    const shoppingListIngredients = shoppingListItems
      .filter((item) => item.name) // Filter out null/undefined names
      .map((item) => item.name.toLowerCase());

    console.log('[MealPlanContext] Found', shoppingListItems.length, 'shopping list items,', shoppingListIngredients.length, 'with valid names');

    // Combine pantry + shopping list for availability checking
    const availableIngredients = [
      ...new Set([...pantryIngredients, ...shoppingListIngredients]),
    ];

    // Score each recipe
    const availableRecipes = await Promise.all(
      allRecipes.map(async (recipe) => {
        const score = await this.scoreRecipe(
          recipe,
          recentRecipeIds,
          availableIngredients,
          mealPlanRecipeRepo
        );
        return score;
      })
    );

      // Sort by freshness priority (higher first)
      availableRecipes.sort((a, b) => b.freshnessPriority - a.freshnessPriority);

      console.log('[MealPlanContext] Context gathered successfully');

      return {
        recentRecipeIds,
        availableRecipes,
        pantryIngredients,
        shoppingListIngredients,
        totalRecipeCount,
      };
    } catch (error: any) {
      console.error('[MealPlanContext] Error gathering context:', error.message);
      console.error('[MealPlanContext] Stack:', error.stack);
      throw new Error(`Failed to gather meal plan context: ${error.message}`);
    }
  }

  /**
   * Score a recipe for meal planning suitability
   */
  private static async scoreRecipe(
    recipe: Recipe,
    recentRecipeIds: string[],
    availableIngredients: string[],
    mealPlanRecipeRepo: any
  ): Promise<RecipeWithScore> {
    // Find last time this recipe was used
    const lastUsed = await mealPlanRecipeRepo
      .createQueryBuilder('mpr')
      .where('mpr.recipe_id = :recipeId', { recipeId: recipe.id })
      .orderBy('mpr.date', 'DESC')
      .getOne();

    let daysSinceLastUsed: number | null = null;
    if (lastUsed) {
      const diff = Date.now() - new Date(lastUsed.date).getTime();
      daysSinceLastUsed = Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    // Calculate ingredient match score
    const recipeIngredients = recipe.ingredients?.map((ing) =>
      ing.name.toLowerCase()
    ) || [];

    let matchedIngredients = 0;
    if (recipeIngredients.length > 0) {
      recipeIngredients.forEach((ingredient) => {
        const hasIngredient = availableIngredients.some((available) =>
          available.includes(ingredient) || ingredient.includes(available)
        );
        if (hasIngredient) matchedIngredients++;
      });
    }

    const ingredientMatchScore =
      recipeIngredients.length > 0
        ? matchedIngredients / recipeIngredients.length
        : 0;

    // Calculate freshness priority (higher = should use soon)
    // Factors:
    // - Never used: high priority (100)
    // - Not used in 30+ days: high priority (80)
    // - Not used recently (14-30 days): medium priority (50)
    // - Used recently: low priority (10)
    let freshnessPriority = 0;

    if (daysSinceLastUsed === null) {
      freshnessPriority = 100; // Never used
    } else if (daysSinceLastUsed >= 30) {
      freshnessPriority = 80 + daysSinceLastUsed / 10; // Older = higher priority
    } else if (daysSinceLastUsed >= 14) {
      freshnessPriority = 50;
    } else {
      freshnessPriority = 10;
    }

    // Bonus points for high ingredient match
    freshnessPriority += ingredientMatchScore * 20;

    return {
      recipe,
      daysSinceLastUsed,
      ingredientMatchScore,
      freshnessPriority,
    };
  }

  /**
   * Get recipes that haven't been used recently
   */
  static filterFreshRecipes(
    recipes: RecipeWithScore[],
    minDaysSinceUse: number = 14
  ): RecipeWithScore[] {
    return recipes.filter(
      (r) =>
        r.daysSinceLastUsed === null || r.daysSinceLastUsed >= minDaysSinceUse
    );
  }

  /**
   * Get recipes with high ingredient availability
   */
  static filterByIngredientMatch(
    recipes: RecipeWithScore[],
    minMatchScore: number = 0.5
  ): RecipeWithScore[] {
    return recipes.filter((r) => r.ingredientMatchScore >= minMatchScore);
  }
}
