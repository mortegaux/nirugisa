import { AppDataSource } from '../../db/data-source';
import {
  Ingredient,
  ShoppingListItem,
  ShoppingList,
  MealPlanRecipe,
  MealPlan,
  TemplateMeal,
  MealPlanTemplate,
  RecipeCollectionItem,
  RecipeCollection,
  RecipeRating,
  RecipeView,
  BatchCookingPlan,
  Recipe,
  PantryItem,
  AIConfig,
  Taxonomy,
  UserPreferences,
  UserAchievement,
  UserStats,
} from '../../db/entities';

export class SeederService {
  static async clearUserData(userId: string): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      // Delete children before parents to avoid FK constraint violations

      // Get IDs of user's parent entities for child deletion
      const userRecipeIds = await manager
        .createQueryBuilder(Recipe, 'r')
        .select('r.id')
        .where('r.userId = :userId', { userId })
        .getMany();
      const recipeIds = userRecipeIds.map((r) => r.id);

      const userMealPlanIds = await manager
        .createQueryBuilder(MealPlan, 'mp')
        .select('mp.id')
        .where('mp.userId = :userId', { userId })
        .getMany();
      const mealPlanIds = userMealPlanIds.map((mp) => mp.id);

      const userTemplateIds = await manager
        .createQueryBuilder(MealPlanTemplate, 'mpt')
        .select('mpt.id')
        .where('mpt.userId = :userId', { userId })
        .getMany();
      const templateIds = userTemplateIds.map((t) => t.id);

      const userShoppingListIds = await manager
        .createQueryBuilder(ShoppingList, 'sl')
        .select('sl.id')
        .where('sl.userId = :userId', { userId })
        .getMany();
      const shoppingListIds = userShoppingListIds.map((sl) => sl.id);

      const userCollectionIds = await manager
        .createQueryBuilder(RecipeCollection, 'rc')
        .select('rc.id')
        .where('rc.userId = :userId', { userId })
        .getMany();
      const collectionIds = userCollectionIds.map((c) => c.id);

      // Delete child records using parent IDs
      if (recipeIds.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(Ingredient)
          .where('recipe_id IN (:...recipeIds)', { recipeIds })
          .execute();
      }

      // RecipeRating and RecipeView have userId directly
      await manager.delete(RecipeRating, { userId });
      await manager.delete(RecipeView, { userId });

      if (collectionIds.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(RecipeCollectionItem)
          .where('collection_id IN (:...collectionIds)', { collectionIds })
          .execute();
      }
      await manager.delete(RecipeCollection, { userId });

      if (mealPlanIds.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(MealPlanRecipe)
          .where('meal_plan_id IN (:...mealPlanIds)', { mealPlanIds })
          .execute();
      }
      await manager.delete(MealPlan, { userId });

      if (templateIds.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(TemplateMeal)
          .where('template_id IN (:...templateIds)', { templateIds })
          .execute();
      }
      await manager.delete(MealPlanTemplate, { userId });

      if (shoppingListIds.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(ShoppingListItem)
          .where('shopping_list_id IN (:...shoppingListIds)', { shoppingListIds })
          .execute();
      }
      await manager.delete(ShoppingList, { userId });

      // Batch cooking plans (has userId directly)
      await manager.delete(BatchCookingPlan, { userId });

      // Recipes (after all FK references removed)
      await manager.delete(Recipe, { userId });

      // Standalone user-owned entities
      await manager.delete(PantryItem, { userId });
      await manager.delete(Taxonomy, { userId });
      await manager.delete(AIConfig, { userId });
      await manager.delete(UserPreferences, { userId });
      await manager.delete(UserAchievement, { userId });
      await manager.delete(UserStats, { userId });
    });

    console.log(`✓ Cleared all data for user ${userId}`);
  }
}
