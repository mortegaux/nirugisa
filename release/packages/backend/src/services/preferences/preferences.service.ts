import { Repository } from 'typeorm';
import { AppDataSource } from '../../db/data-source';
import { UserPreferences } from '../../db/entities';

export interface UpdatePreferencesDto {
  dietaryRestrictions?: string[];
  allergies?: string[];
  dislikes?: string[];
  favorites?: string[];
  preferredCuisines?: string[];
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  maxCookingTime?: number;
  householdSize?: number;
  spiceTolerance?: 'none' | 'mild' | 'medium' | 'hot' | 'very-hot';
  budgetLevel?: 'budget' | 'moderate' | 'splurge';
}

export class PreferencesService {
  private preferencesRepo: Repository<UserPreferences>;

  constructor() {
    this.preferencesRepo = AppDataSource.getRepository(UserPreferences);
  }

  async getPreferences(): Promise<UserPreferences | null> {
    const preferences = await this.preferencesRepo.findOne({
      where: {},
    });

    return preferences;
  }

  async getOrCreatePreferences(userId: string): Promise<UserPreferences> {
    let preferences = await this.getPreferences();

    if (!preferences) {
      preferences = this.preferencesRepo.create({
        userId,
        dietaryRestrictions: [],
        allergies: [],
        dislikes: [],
        favorites: [],
        preferredCuisines: [],
      });
      await this.preferencesRepo.save(preferences);
    }

    return preferences;
  }

  async updatePreferences(
    dto: UpdatePreferencesDto
  ): Promise<UserPreferences> {
    let preferences = await this.getPreferences();

    if (!preferences) {
      preferences = this.preferencesRepo.create({
        ...dto,
      });
    } else {
      Object.assign(preferences, dto);
    }

    await this.preferencesRepo.save(preferences);

    return preferences;
  }

  async deletePreferences(): Promise<void> {
    const preferences = await this.getPreferences();
    if (preferences) {
      await this.preferencesRepo.remove(preferences);
    }
  }

  // Check if a recipe matches preferences
  async checkRecipeCompatibility(
    recipeTags: string[],
    recipeIngredients: string[]
  ): Promise<{
    isCompatible: boolean;
    warnings: string[];
    matches: string[];
  }> {
    const preferences = await this.getPreferences();

    if (!preferences) {
      return { isCompatible: true, warnings: [], matches: [] };
    }

    const warnings: string[] = [];
    const matches: string[] = [];

    // Check allergies (critical)
    if (preferences.allergies && preferences.allergies.length > 0) {
      const allergyMatches = preferences.allergies.filter((allergen) =>
        recipeIngredients.some((ing) =>
          ing.toLowerCase().includes(allergen.toLowerCase())
        )
      );

      if (allergyMatches.length > 0) {
        warnings.push(`⚠️ Contains allergens: ${allergyMatches.join(', ')}`);
      }
    }

    // Check dietary restrictions
    if (preferences.dietaryRestrictions && preferences.dietaryRestrictions.length > 0) {
      const restrictionMatches = preferences.dietaryRestrictions.filter(
        (restriction) =>
          recipeTags.some((tag) =>
            tag.toLowerCase().includes(restriction.toLowerCase())
          )
      );

      if (restrictionMatches.length > 0) {
        matches.push(`✓ Matches dietary needs: ${restrictionMatches.join(', ')}`);
      } else {
        // Recipe doesn't have tags indicating it meets restrictions
        const restrictionWarnings = preferences.dietaryRestrictions.filter(
          (restriction) =>
            !recipeTags.some((tag) =>
              tag.toLowerCase().includes(restriction.toLowerCase())
            )
        );
        if (restrictionWarnings.length > 0) {
          warnings.push(
            `May not meet dietary restrictions: ${restrictionWarnings.join(', ')}`
          );
        }
      }
    }

    // Check dislikes
    if (preferences.dislikes && preferences.dislikes.length > 0) {
      const dislikeMatches = preferences.dislikes.filter((dislike) =>
        recipeIngredients.some((ing) =>
          ing.toLowerCase().includes(dislike.toLowerCase())
        )
      );

      if (dislikeMatches.length > 0) {
        warnings.push(`Contains disliked ingredients: ${dislikeMatches.join(', ')}`);
      }
    }

    // Check favorites
    if (preferences.favorites && preferences.favorites.length > 0) {
      const favoriteMatches = preferences.favorites.filter((favorite) =>
        recipeIngredients.some((ing) =>
          ing.toLowerCase().includes(favorite.toLowerCase())
        )
      );

      if (favoriteMatches.length > 0) {
        matches.push(`❤️ Contains favorites: ${favoriteMatches.join(', ')}`);
      }
    }

    const isCompatible = warnings.length === 0 || !warnings.some((w) => w.includes('allergen'));

    return {
      isCompatible,
      warnings,
      matches,
    };
  }
}
