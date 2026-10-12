import { AIProvider, AIGeneratedRecipe, AISubstitutionSuggestion } from '@nommable/shared';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface IAIProvider {
  testConnection(): Promise<{ success: boolean; message: string }>;
  generateRecipe(prompt: string, options?: RecipeGenerationOptions): Promise<AIGeneratedRecipe>;
  enhanceRecipe(recipe: any, enhancementType: string): Promise<string>;
  substituteIngredient(
    ingredient: string,
    reason?: string,
    context?: string
  ): Promise<AISubstitutionSuggestion[]>;
  generateMealPlan(options: MealPlanGenerationOptions): Promise<MealPlanSuggestion>;
  extractRecipeFromImages(images: ImageInput[]): Promise<AIGeneratedRecipe>;
  extractRecipeFromText?(text: string): Promise<AIGeneratedRecipe>;
  extractIngredientsFromImage(image: ImageInput): Promise<string[]>;
  generateImage?(prompt: string, model?: string): Promise<{ buffer: Buffer; mimeType: string }>;
}

export interface ImageInput {
  data: Buffer | string; // Buffer for binary data, string for base64
  mimeType: string; // e.g., 'image/png', 'image/jpeg'
}

export interface RecipeGenerationOptions {
  ingredients?: string[];
  dietary?: string[];
  cuisine?: string;
  servings?: number;
}

export interface MealPlanGenerationOptions {
  days: number;
  servings: number;
  dietary?: string[];
  cuisine?: string[];
  excludeIngredients?: string[];
  budget?: 'low' | 'medium' | 'high';
}

export interface MealPlanSuggestion {
  days: Array<{
    date: string;
    meals: Array<{
      mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
      recipeSuggestion: {
        title: string;
        description: string;
        estimatedTime: number;
      };
    }>;
  }>;
}
