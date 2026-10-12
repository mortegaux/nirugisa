export interface RecipeRating {
  id: string;
  userId: string;
  recipeId: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface RateRecipeDto {
  rating: number;
}
