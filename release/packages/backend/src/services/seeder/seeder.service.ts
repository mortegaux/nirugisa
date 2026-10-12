import { AppDataSource } from '../../db/data-source';

export class SeederService {
  static async clearUserData(): Promise<void> {
    await AppDataSource.query(`
      TRUNCATE TABLE ingredients, meal_plan_recipes, template_meals, batch_cooking_plans,
        shopping_list_items, shopping_lists, meal_plan_templates, meal_plans, recipes,
        pantry_items, ai_configs, user_preferences, user_achievements, user_stats,
        user_invitations, taxonomies
      CASCADE
    `);

    console.log('✓ Cleared all data');
  }
}
