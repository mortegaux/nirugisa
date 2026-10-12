import { createEvents, EventAttributes, DateArray } from 'ics';
import { AppDataSource } from '../../db/data-source';
import { MealPlan, MealPlanRecipe, Recipe } from '../../db/entities';

export class CalendarExportService {
  static async exportMealPlanToICS(mealPlanId: string): Promise<string> {
    const mealPlanRepo = AppDataSource.getRepository(MealPlan);
    const mealPlanRecipeRepo = AppDataSource.getRepository(MealPlanRecipe);

    // Get meal plan
    const mealPlan = await mealPlanRepo.findOne({
      where: { id: mealPlanId },
    });

    if (!mealPlan) {
      throw new Error('Meal plan not found');
    }

    // Get all meal plan recipes with recipe details
    const mealPlanRecipes = await mealPlanRecipeRepo.find({
      where: { mealPlanId },
      relations: ['recipe', 'recipe.ingredients'],
      order: { date: 'ASC' },
    });

    // Convert meal plan recipes to calendar events
    const events: EventAttributes[] = mealPlanRecipes.map((mpr) => {
      const recipe = mpr.recipe;
      const date = new Date(mpr.date);

      // Set time based on meal type
      let hour: number;
      switch (mpr.mealType) {
        case 'breakfast':
          hour = 8;
          break;
        case 'lunch':
          hour = 12;
          break;
        case 'dinner':
          hour = 18;
          break;
        case 'snack':
          hour = 15;
          break;
        default:
          hour = 12;
      }

      const startDate = new Date(date);
      startDate.setHours(hour, 0, 0, 0);

      // Calculate duration (prep time + cook time, default 30 minutes)
      const durationMinutes = (recipe.prepTime || 0) + (recipe.cookTime || 0) || 30;

      // Format start date as DateArray [year, month, day, hour, minute]
      const start: DateArray = [
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        startDate.getDate(),
        startDate.getHours(),
        startDate.getMinutes(),
      ];

      // Build description
      let description = recipe.description || '';
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        description += '\n\nIngredients:\n';
        description += recipe.ingredients
          .map((ing) => `- ${ing.quantity} ${ing.unit} ${ing.name}`)
          .join('\n');
      }

      return {
        start,
        duration: { minutes: durationMinutes },
        title: `${this.capitalize(mpr.mealType)}: ${recipe.title}`,
        description,
        location: 'Kitchen',
        categories: recipe.tags || [],
        status: 'CONFIRMED' as const,
        busyStatus: 'FREE' as const,
      };
    });

    // Create ICS file
    const { error, value } = createEvents(events);

    if (error) {
      throw new Error(`Failed to create calendar: ${error.message}`);
    }

    return value || '';
  }

  private static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
