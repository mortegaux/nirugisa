import { AppDataSource } from '../../db/data-source';
import { PantryItem } from '../../db/entities/PantryItem';
import { UserPreferences } from '../../db/entities/UserPreferences';
import { Recipe } from '../../db/entities/Recipe';
import { ContentRecipeSuggestion } from '@nommable/shared';
import { SystemSettingsService } from '../settings/system-settings.service';
import { RecipeService } from '../recipe/recipe.service';

export class SuggestionService {
  private pantryRepo = AppDataSource.getRepository(PantryItem);
  private prefsRepo = AppDataSource.getRepository(UserPreferences);
  private recipeRepo = AppDataSource.getRepository(Recipe);

  async getSuggestions(userId: string, limit: number): Promise<ContentRecipeSuggestion[]> {
    const settings = await SystemSettingsService.getSettings();
    const sharedRecipes = settings.sharedRecipes;
    const showAuthor = settings.sharedRecipes && settings.showRecipeAuthor;
    const sharedPantry = settings.sharedPantry;

    // 1. Load pantry items (shared or user-scoped)
    const pantryItems = await this.pantryRepo.find({
      where: sharedPantry ? undefined : { userId },
    });
    const pantryNames = pantryItems.map((item) => item.name.toLowerCase());

    // 2. Load user preferences
    const prefs = await this.prefsRepo.findOne({ where: { userId } });
    const allergies = (prefs?.allergies ?? []).map((a) => a.toLowerCase());
    const dislikes = (prefs?.dislikes ?? []).map((d) => d.toLowerCase());
    const favorites = (prefs?.favorites ?? []).map((f) => f.toLowerCase());
    const preferredCuisines = (prefs?.preferredCuisines ?? []).map((c) => c.toLowerCase());

    // 3. Load recipes with ingredients (shared catalog or user-scoped)
    const rawRecipes = await this.recipeRepo.find({
      where: sharedRecipes ? undefined : { userId },
      relations: showAuthor ? ['ingredients', 'user'] : ['ingredients'],
    });
    const recipes = rawRecipes.map((r) => RecipeService.formatRecipeWithAuthor(r, showAuthor));

    // Helper: check if an ingredient name matches a term (case-insensitive substring)
    const matches = (ingredientName: string, term: string): boolean =>
      ingredientName.toLowerCase().includes(term) || term.includes(ingredientName.toLowerCase());

    const results: ContentRecipeSuggestion[] = [];

    // 4. Score each recipe
    for (const recipe of recipes) {
      const ingredients = recipe.ingredients ?? [];
      if (ingredients.length === 0) continue;

      const ingredientNames = ingredients.map((ing) => ing.name.toLowerCase());

      // Allergy exclusion
      const hasAllergen = allergies.some((allergy) =>
        ingredientNames.some((ing) => matches(ing, allergy)),
      );
      if (hasAllergen) continue;

      // Dislike exclusion
      const hasDislike = dislikes.some((dislike) =>
        ingredientNames.some((ing) => matches(ing, dislike)),
      );
      if (hasDislike) continue;

      // Count pantry matches
      const matchedCount = ingredientNames.filter((ing) =>
        pantryNames.some((pantryName) => matches(ing, pantryName)),
      ).length;

      if (matchedCount === 0) continue;

      // Base score
      let score = (matchedCount / ingredients.length) * 100;

      // Cuisine boost
      const recipeCategories = (recipe.categories ?? []).map((c) => c.toLowerCase());
      const hasCuisineMatch = preferredCuisines.some((cuisine) =>
        recipeCategories.some((cat) => cat.includes(cuisine) || cuisine.includes(cat)),
      );
      if (hasCuisineMatch) score += 10;

      // Favorite ingredient boost (cap at +15)
      let favoriteBoost = 0;
      for (const fav of favorites) {
        const favMatches = ingredientNames.filter((ing) => matches(ing, fav)).length;
        favoriteBoost += favMatches * 5;
        if (favoriteBoost >= 15) {
          favoriteBoost = 15;
          break;
        }
      }
      score += favoriteBoost;

      const matchReason = `You have ${matchedCount} of ${ingredients.length} ingredient${ingredients.length !== 1 ? 's' : ''}`;

      results.push({ recipe: recipe as any, matchScore: Math.round(score * 10) / 10, matchReason });
    }

    // 5. Sort by matchScore DESC and take limit
    results.sort((a, b) => b.matchScore - a.matchScore);
    return results.slice(0, limit);
  }
}
