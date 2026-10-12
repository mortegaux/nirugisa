import { AIService } from '../ai';
import { MealPlanContextService, RecipeWithScore } from './meal-plan-context.service';
import type {
  MealPlanGenerateRequest,
  MealPlanPreview,
  MealSuggestion,
  RecipeSuggestion,
  ReplaceMealRequest,
} from '@nommable/shared';
import { v4 as uuidv4 } from 'uuid';

export class MealPlanGenerationService {
  /**
   * Generate intelligent meal plan preview
   */
  static async generatePreview(
    request: MealPlanGenerateRequest
  ): Promise<MealPlanPreview> {
    console.log('[MealPlanGeneration] Starting preview generation');

    // Gather context about recipes, pantry, shopping list
    const context = await MealPlanContextService.gatherContext();

    console.log('[MealPlanGeneration] Context gathered:', {
      totalRecipes: context.totalRecipeCount,
      availableRecipes: context.availableRecipes.length,
      pantryIngredients: context.pantryIngredients.length,
      recentRecipeIds: context.recentRecipeIds.length
    });

    // Check if user has any recipes
    if (context.totalRecipeCount === 0) {
      throw new Error('No recipes available. Please add some recipes first.');
    }

    const preferExistingRecipes = request.preferExistingRecipes ?? true;
    const minDaysSinceLastUse = request.minDaysSinceLastUse ?? 14;
    const minIngredientMatchScore = request.minIngredientMatchScore ?? 0.3;

    // Filter recipes based on preferences
    let candidateRecipes = context.availableRecipes;

    if (preferExistingRecipes) {
      // Prefer recipes not used recently
      const freshRecipes = MealPlanContextService.filterFreshRecipes(
        candidateRecipes,
        minDaysSinceLastUse
      );

      // If we have enough fresh recipes, use those
      if (freshRecipes.length >= request.mealSelections.length) {
        candidateRecipes = freshRecipes;
      }
    }

    // Try to match with available ingredients
    const matchingRecipes = MealPlanContextService.filterByIngredientMatch(
      candidateRecipes,
      minIngredientMatchScore
    );

    // Generate suggestions for each meal slot
    const mealSuggestions: MealSuggestion[] = [];

    console.log('[MealPlanGeneration] Generating suggestions for', request.mealSelections.length, 'meals');
    console.log('[MealPlanGeneration] Candidate recipes:', candidateRecipes.length);
    console.log('[MealPlanGeneration] Matching recipes:', matchingRecipes.length);

    for (const selection of request.mealSelections) {
      try {
        console.log('[MealPlanGeneration] Generating suggestion for:', selection.date, selection.mealType);

        const suggestion = await this.generateMealSuggestion(
          selection.date,
          selection.mealType,
          matchingRecipes.length > 0 ? matchingRecipes : candidateRecipes,
          context.pantryIngredients,
          context.shoppingListIngredients,
          request
        );

        mealSuggestions.push(suggestion);
        console.log('[MealPlanGeneration] Suggestion generated successfully');
      } catch (error: any) {
        console.error('[MealPlanGeneration] Error generating meal suggestion:', error.message);
        throw error;
      }
    }

    return {
      previewId: uuidv4(),
      mealSuggestions,
      context: {
        totalRecipesAvailable: context.totalRecipeCount,
        recentlyUsedCount: context.recentRecipeIds.length,
        pantryIngredientCount: context.pantryIngredients.length,
        shoppingListItemCount: context.shoppingListIngredients.length,
      },
    };
  }

  /**
   * Generate a single meal suggestion
   */
  private static async generateMealSuggestion(
    date: string,
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    candidateRecipes: RecipeWithScore[],
    pantryIngredients: string[],
    shoppingListIngredients: string[],
    request: MealPlanGenerateRequest
  ): Promise<MealSuggestion> {
    // Try to find a good existing recipe first
    const suitableRecipe = this.findBestRecipeForMeal(
      candidateRecipes,
      mealType,
      request
    );

    if (suitableRecipe) {
      const suggestion: RecipeSuggestion = {
        type: 'existing',
        recipeId: suitableRecipe.recipe.id,
        recipe: {
          id: suitableRecipe.recipe.id,
          title: suitableRecipe.recipe.title,
          description: suitableRecipe.recipe.description || '',
          servings: suitableRecipe.recipe.servings,
          prepTime: suitableRecipe.recipe.prepTime,
          cookTime: suitableRecipe.recipe.cookTime,
          difficulty: suitableRecipe.recipe.difficulty as 'easy' | 'medium' | 'hard' | undefined,
          tags: suitableRecipe.recipe.tags,
          ingredients: suitableRecipe.recipe.ingredients?.map((ing) => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
        },
        matchScore: suitableRecipe.ingredientMatchScore,
        daysSinceLastUsed: suitableRecipe.daysSinceLastUsed,
      };

      return {
        date,
        mealType,
        suggestion,
      };
    }

    // No suitable existing recipe, generate a new one with AI
    const provider = await AIService.getProvider();

    if (!provider) {
      // Fallback: return a placeholder
      return this.createPlaceholderSuggestion(date, mealType);
    }

    try {
      // Build AI prompt with context
      const prompt = this.buildAIPromptForMeal(
        mealType,
        pantryIngredients,
        shoppingListIngredients,
        request
      );

      const aiRecipe = await provider.generateRecipe(prompt, {
        dietary: request.dietary,
        cuisine: request.cuisine?.length ? request.cuisine[0] : undefined,
        servings: 4,
      });

      const suggestion: RecipeSuggestion = {
        type: 'new',
        recipe: {
          title: aiRecipe.title,
          description: aiRecipe.description,
          servings: aiRecipe.servings,
          prepTime: aiRecipe.prepTime,
          cookTime: aiRecipe.cookTime,
          difficulty: aiRecipe.difficulty,
          tags: aiRecipe.tags,
          ingredients: aiRecipe.ingredients,
        },
        matchScore: 0,
        daysSinceLastUsed: null,
      };

      return {
        date,
        mealType,
        suggestion,
      };
    } catch (error) {
      console.error('Error generating AI recipe for meal:', error);
      return this.createPlaceholderSuggestion(date, mealType);
    }
  }

  /**
   * Find the best existing recipe for a specific meal type
   */
  private static findBestRecipeForMeal(
    recipes: RecipeWithScore[],
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    request: MealPlanGenerateRequest
  ): RecipeWithScore | null {
    // Filter by meal type using tags
    const mealTypeTag = mealType.charAt(0).toUpperCase() + mealType.slice(1);

    let filtered = recipes.filter((r) =>
      r.recipe.tags?.some((tag) => tag.toLowerCase().includes(mealType.toLowerCase()))
    );

    // If no recipes match meal type, use all recipes
    if (filtered.length === 0) {
      filtered = recipes;
    }

    // Filter by dietary requirements
    if (request.dietary?.length) {
      const dietaryFiltered = filtered.filter((r) =>
        request.dietary!.some((diet) =>
          r.recipe.tags?.some((tag) => tag.toLowerCase() === diet.toLowerCase())
        )
      );

      if (dietaryFiltered.length > 0) {
        filtered = dietaryFiltered;
      }
    }

    // Filter by cuisine
    if (request.cuisine?.length) {
      const cuisineFiltered = filtered.filter((r) =>
        request.cuisine!.some((cuisine) =>
          r.recipe.tags?.some((tag) => tag.toLowerCase() === cuisine.toLowerCase())
        )
      );

      if (cuisineFiltered.length > 0) {
        filtered = cuisineFiltered;
      }
    }

    // Return the highest-scoring recipe
    if (filtered.length > 0) {
      return filtered[0];
    }

    return null;
  }

  /**
   * Build AI prompt with context
   */
  private static buildAIPromptForMeal(
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    pantryIngredients: string[],
    shoppingListIngredients: string[],
    request: MealPlanGenerateRequest
  ): string {
    let prompt = `Generate a ${mealType} recipe`;

    if (request.dietary?.length) {
      prompt += ` that is ${request.dietary.join(' and ')}`;
    }

    if (request.cuisine?.length) {
      prompt += ` with ${request.cuisine[0]} cuisine`;
    }

    prompt += `. Available ingredients: ${pantryIngredients.slice(0, 20).join(', ')}`;

    if (shoppingListIngredients.length > 0) {
      prompt += `. Shopping list: ${shoppingListIngredients.slice(0, 10).join(', ')}`;
    }

    if (request.excludeIngredients?.length) {
      prompt += `. Do not use: ${request.excludeIngredients.join(', ')}`;
    }

    return prompt;
  }

  /**
   * Create a placeholder suggestion when AI is unavailable
   */
  private static createPlaceholderSuggestion(
    date: string,
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  ): MealSuggestion {
    return {
      date,
      mealType,
      suggestion: {
        type: 'new',
        recipe: {
          title: `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Placeholder`,
          description: 'Add your own recipe here',
          servings: 4,
          prepTime: 0,
          cookTime: 0,
          difficulty: 'easy',
          tags: [],
          ingredients: [],
        },
        matchScore: 0,
        daysSinceLastUsed: null,
      },
    };
  }

  /**
   * Replace a specific meal in the preview with AI suggestion
   */
  static async replaceMeal(
    request: ReplaceMealRequest
  ): Promise<MealSuggestion> {
    const context = await MealPlanContextService.gatherContext();

    return this.generateMealSuggestion(
      request.date,
      request.mealType,
      context.availableRecipes,
      context.pantryIngredients,
      context.shoppingListIngredients,
      {
        mealSelections: [],
        dietary: request.dietary,
        cuisine: request.cuisine,
        excludeIngredients: request.excludeIngredients,
      }
    );
  }
}
