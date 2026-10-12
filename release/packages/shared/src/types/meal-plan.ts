export interface MealPlan {
  id: string;
  userId: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  meals: MealPlanRecipe[];
  createdAt: Date;
  updatedAt: Date;
  isAiGenerated?: boolean;
}

export interface MealPlanRecipe {
  id: string;
  mealPlanId: string;
  recipeId: string;
  recipe?: any; // Will be populated with Recipe type
  date: Date;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  notes?: string;
}

export interface MealPlanCreateDto {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  meals?: MealPlanRecipeCreateDto[];
}

export interface MealPlanRecipeCreateDto {
  recipeId: string;
  date: Date;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  notes?: string;
}

export interface MealPlanUpdateDto extends Partial<MealPlanCreateDto> {
  id: string;
}
