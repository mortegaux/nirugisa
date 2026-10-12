import { PaginatedRequest } from './pagination';

export interface RecipeAuthor {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profilePhotoUrl?: string;
}

export interface Recipe {
  id: string;
  userId: string;
  author?: RecipeAuthor;
  title: string;
  description?: string;
  servings?: number;
  prepTime?: number; // minutes
  cookTime?: number; // minutes
  totalTime?: number; // minutes
  difficulty?: 'easy' | 'medium' | 'hard';
  imageUrl?: string;
  sourceUrl?: string;
  notes?: string;
  ingredients: Ingredient[];
  instructions: string[];
  categories?: string[];
  tags?: string[];
  nutrition?: NutritionInfo;
  createdAt: Date;
  updatedAt: Date;
  isAiGenerated?: boolean;
}

export interface Ingredient {
  id: string;
  recipeId: string;
  quantity?: number;
  unit?: string;
  name: string;
  notes?: string;
  section?: string; // e.g., "For the sauce", "For the topping"
  order: number;
}

export interface NutritionInfo {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export interface RecipeCreateDto {
  title: string;
  description?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  imageUrl?: string;
  sourceUrl?: string;
  notes?: string;
  ingredients: IngredientCreateDto[];
  instructions: string[];
  categories?: string[];
  tags?: string[];
  nutrition?: NutritionInfo;
}

export interface IngredientCreateDto {
  quantity?: number;
  unit?: string;
  name: string;
  notes?: string;
  section?: string;
  order: number;
}

// Update DTO is just partial create DTO - id is passed separately in the route
export type RecipeUpdateDto = Partial<RecipeCreateDto>;

export interface RecipeImportDto {
  url: string;
}

export interface RecipeSearchQuery extends PaginatedRequest {
  query?: string;
  categories?: string[];
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  maxPrepTime?: number;
  maxCookTime?: number;

  // Ingredient-based
  includeIngredients?: string[];
  excludeIngredients?: string[];

  // Nutritional
  minCalories?: number;
  maxCalories?: number;
  minProtein?: number;
  maxProtein?: number;
  minCarbohydrates?: number;
  maxCarbohydrates?: number;
  minFat?: number;
  maxFat?: number;

  // Source (derived from isAiGenerated + sourceUrl)
  source?: ('manual' | 'imported' | 'ai-generated')[];
}
