export interface MealPlanTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  duration: number; // Number of days
  meals: TemplateMeal[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateMeal {
  dayOffset: number; // Day 0, 1, 2, etc. relative to start
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipeId: string;
  recipe?: any; // Populated recipe
  servings?: number;
  notes?: string;
}

export interface MealPlanTemplateCreateDto {
  name: string;
  description?: string;
  duration: number;
  meals: TemplateMealCreateDto[];
  tags?: string[];
}

export interface TemplateMealCreateDto {
  dayOffset: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipeId: string;
  servings?: number;
  notes?: string;
}

export interface ApplyTemplateRequest {
  templateId: string;
  startDate: string; // ISO date
  name?: string;
  description?: string;
}
