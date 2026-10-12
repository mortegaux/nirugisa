import type { Recipe } from './recipe';
import type { PaginatedRequest } from './pagination';

export interface RecipeCollection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isFavorites: boolean;
  recipeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeCollectionItem {
  id: string;
  collectionId: string;
  recipeId: string;
  recipe?: Recipe;
  addedAt: string;
}

export interface CreateCollectionDto {
  name: string;
  description?: string;
}

export interface UpdateCollectionDto {
  name?: string;
  description?: string;
}

export interface CollectionRecipesQuery extends PaginatedRequest {}

export interface ContentRecipeSuggestion {
  recipe: Recipe;
  matchScore: number;
  matchReason: string;
}
