export type AIProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'none';

export interface AIConfig {
  id: string;
  userId: string;
  provider: AIProvider;
  apiKey?: string; // Encrypted in database
  model?: string;
  baseUrl?: string; // For Ollama
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIConfigCreateDto {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface AIConfigUpdateDto extends Partial<AIConfigCreateDto> {
  id: string;
}

export interface AIGenerateRecipeRequest {
  prompt: string;
  ingredients?: string[];
  dietary?: string[];
  cuisine?: string;
  servings?: number;
}

export interface AIEnhanceRecipeRequest {
  recipeId: string;
  enhancementType: 'improve_instructions' | 'add_tips' | 'optimize_ingredients';
}

export interface AISubstituteIngredientRequest {
  ingredient: string;
  reason?: string;
  recipeContext?: string;
}

export interface AIMealPlanRequest {
  days: number;
  servings: number;
  dietary?: string[];
  cuisine?: string[];
  excludeIngredients?: string[];
  budget?: 'low' | 'medium' | 'high';
}

export interface AIGeneratedRecipe {
  title: string;
  description: string;
  servings: number;
  prepTime: number;
  cookTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  ingredients: {
    quantity?: number;
    unit?: string;
    name: string;
    notes?: string;
    section?: string;
  }[];
  instructions: string[];
  tags: string[];
  categories?: string[];
  nutrition?: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
  };
}

export interface AISubstitutionSuggestion {
  original: string;
  substitute: string;
  ratio?: string;
  notes?: string;
}

export interface AIProviderCapabilities {
  generateRecipe: boolean;
  enhanceRecipe: boolean;
  substituteIngredient: boolean;
  generateMealPlan: boolean;
}
