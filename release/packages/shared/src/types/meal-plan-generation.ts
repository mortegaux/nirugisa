export interface MealPlanGenerateRequest {
  // Flexible day/meal selection
  mealSelections: MealSelection[];

  // Optional preferences
  dietary?: string[];
  cuisine?: string[];
  excludeIngredients?: string[];
  budget?: 'low' | 'medium' | 'high';

  // AI behavior preferences
  preferExistingRecipes?: boolean; // Default: true
  minDaysSinceLastUse?: number; // Default: 14
  minIngredientMatchScore?: number; // Default: 0.3 (30% match)
}

export interface MealSelection {
  date: string; // ISO date string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface MealPlanPreview {
  previewId: string;
  mealSuggestions: MealSuggestion[];
  context: MealPlanContext;
}

export interface MealSuggestion {
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  suggestion: RecipeSuggestion;
}

export interface RecipeSuggestion {
  type: 'existing' | 'new';
  recipeId?: string; // Present if type='existing'
  recipe: {
    id?: string;
    title: string;
    description: string;
    servings?: number;
    prepTime?: number;
    cookTime?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    tags?: string[];
    ingredients?: Array<{
      name: string;
      quantity?: number;
      unit?: string;
    }>;
  };
  matchScore?: number; // 0-1, how well it matches available ingredients
  daysSinceLastUsed?: number | null;
}

export interface MealPlanContext {
  totalRecipesAvailable: number;
  recentlyUsedCount: number;
  pantryIngredientCount: number;
  shoppingListItemCount: number;
}

export interface MealPlanCommitRequest {
  previewId: string;
  name: string;
  description?: string;
  // Can optionally override specific meals before committing
  overrides?: MealOverride[];
}

export interface MealOverride {
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipeId: string; // Replace with this recipe ID
}

export interface ReplaceMealRequest {
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dietary?: string[];
  cuisine?: string[];
  excludeIngredients?: string[];
}
