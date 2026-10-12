import { AppDataSource } from '../../db/data-source';
import { ShoppingList, ShoppingListItem, Recipe, PantryItem } from '../../db/entities';

export interface MissingIngredient {
  name: string;
  quantity?: number;
  unit?: string;
  recipeTitle: string;
  recipeId: string;
}

export class ShoppingListIntegrationService {
  /**
   * Calculate missing ingredients for a meal plan
   * Checks what's in pantry and returns what needs to be bought
   */
  static async calculateMissingIngredients(
    recipeIds: string[]
  ): Promise<MissingIngredient[]> {
    const recipeRepo = AppDataSource.getRepository(Recipe);
    const pantryRepo = AppDataSource.getRepository(PantryItem);

    // Get all pantry items (normalized lowercase)
    const pantryItems = await pantryRepo.find();
    const pantryIngredients = new Set(
      pantryItems.map((item) => item.name.toLowerCase().trim())
    );

    // Get all recipes with ingredients
    const recipes = await recipeRepo.find({
      where: recipeIds.map((id) => ({ id })),
      relations: ['ingredients'],
    });

    const missingIngredients: MissingIngredient[] = [];

    for (const recipe of recipes) {
      if (!recipe.ingredients) continue;

      for (const ingredient of recipe.ingredients) {
        const ingredientName = ingredient.name.toLowerCase().trim();

        // Check if ingredient is in pantry (fuzzy match)
        const inPantry = Array.from(pantryIngredients).some(
          (pantryItem) =>
            pantryItem.includes(ingredientName) || ingredientName.includes(pantryItem)
        );

        if (!inPantry) {
          missingIngredients.push({
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            recipeTitle: recipe.title,
            recipeId: recipe.id,
          });
        }
      }
    }

    return missingIngredients;
  }

  /**
   * Add missing ingredients to shopping list
   * Groups duplicates and creates a single shopping list
   */
  static async addMissingIngredientsToShoppingList(
    userId: string,
    recipeIds: string[],
    shoppingListId?: string
  ): Promise<{ shoppingList: ShoppingList; addedCount: number }> {
    const shoppingListRepo = AppDataSource.getRepository(ShoppingList);
    const shoppingListItemRepo = AppDataSource.getRepository(ShoppingListItem);

    // Calculate missing ingredients
    const missingIngredients = await this.calculateMissingIngredients(recipeIds);

    // Group ingredients by name (case-insensitive)
    const groupedIngredients = new Map<string, MissingIngredient[]>();
    for (const ingredient of missingIngredients) {
      const key = ingredient.name.toLowerCase();
      if (!groupedIngredients.has(key)) {
        groupedIngredients.set(key, []);
      }
      groupedIngredients.get(key)!.push(ingredient);
    }

    // Get or create shopping list
    let shoppingList: ShoppingList;
    if (shoppingListId) {
      const existing = await shoppingListRepo.findOne({
        where: { id: shoppingListId },
      });
      if (!existing) {
        throw new Error('Shopping list not found');
      }
      shoppingList = existing;
    } else {
      // Find or create "Meal Plan Ingredients" list
      let existing = await shoppingListRepo.findOne({
        where: { name: 'Meal Plan Ingredients' },
      });

      if (!existing) {
        existing = shoppingListRepo.create({
          userId,
          name: 'Meal Plan Ingredients',
        });
        await shoppingListRepo.save(existing);
      }

      shoppingList = existing;
    }

    // Add grouped ingredients to shopping list
    let addedCount = 0;
    for (const [ingredientName, instances] of groupedIngredients) {
      // Sum quantities if units match
      const firstInstance = instances[0];
      let totalQuantity = 0;
      let unit = firstInstance.unit || '';

      for (const instance of instances) {
        if (instance.unit === firstInstance.unit && instance.quantity) {
          totalQuantity += instance.quantity;
        }
      }

      // Build name with quantity/unit if available
      let itemName = firstInstance.name;
      if (totalQuantity > 0) {
        itemName = `${totalQuantity}${unit ? ' ' + unit : ''} ${firstInstance.name}`;
      }

      // Add notes about which recipes need this
      const recipeNames = [...new Set(instances.map((i) => i.recipeTitle))];
      const notes = `For: ${recipeNames.join(', ')}`;

      // Check if item already exists (avoid duplicates)
      const existingItem = await shoppingListItemRepo
        .createQueryBuilder('item')
        .where('item.shopping_list_id = :listId', { listId: shoppingList.id })
        .andWhere('LOWER(item.name) = LOWER(:name)', { name: itemName })
        .getOne();

      if (!existingItem) {
        const item = shoppingListItemRepo.create({
          shoppingListId: shoppingList.id,
          name: itemName,
          category: this.categorizeIngredient(firstInstance.name),
          notes,
          checked: false,
        });
        await shoppingListItemRepo.save(item);
        addedCount++;
      }
    }

    return { shoppingList, addedCount };
  }

  /**
   * Simple ingredient categorization
   */
  private static categorizeIngredient(ingredientName: string): string {
    const name = ingredientName.toLowerCase();

    if (
      name.includes('chicken') ||
      name.includes('beef') ||
      name.includes('pork') ||
      name.includes('fish') ||
      name.includes('salmon') ||
      name.includes('shrimp')
    ) {
      return 'Meat & Seafood';
    }

    if (
      name.includes('milk') ||
      name.includes('cheese') ||
      name.includes('yogurt') ||
      name.includes('butter') ||
      name.includes('cream')
    ) {
      return 'Dairy';
    }

    if (
      name.includes('lettuce') ||
      name.includes('tomato') ||
      name.includes('onion') ||
      name.includes('pepper') ||
      name.includes('carrot') ||
      name.includes('broccoli') ||
      name.includes('spinach') ||
      name.includes('cucumber')
    ) {
      return 'Produce';
    }

    if (name.includes('bread') || name.includes('bun') || name.includes('roll')) {
      return 'Bakery';
    }

    if (
      name.includes('pasta') ||
      name.includes('rice') ||
      name.includes('flour') ||
      name.includes('cereal')
    ) {
      return 'Pantry';
    }

    if (name.includes('can') || name.includes('jar')) {
      return 'Canned Goods';
    }

    return 'Other';
  }
}
