import { AppDataSource } from '../../db/data-source';

export interface SystemSettingsData {
  sharedRecipes: boolean;
  showRecipeAuthor: boolean;
  sharedCollections: boolean;
  sharedMealPlans: boolean;
  sharedShoppingLists: boolean;
  sharedPantry: boolean;
  sharedBatchCooking: boolean;
}

const DEFAULT_SETTINGS: SystemSettingsData = {
  sharedRecipes: true,
  showRecipeAuthor: true,
  sharedCollections: true,
  sharedMealPlans: true,
  sharedShoppingLists: true,
  sharedPantry: true,
  sharedBatchCooking: true,
};

function toBool(val: unknown, fallback = true): boolean {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') return val !== '0' && val.toLowerCase() !== 'false';
  return Boolean(val);
}

export class SystemSettingsService {
  private static tableInitialized = false;
  private static cachedSettings: SystemSettingsData | null = null;

  static async initialize(): Promise<void> {
    if (this.tableInitialized || !AppDataSource.isInitialized) return;
    try {
      await AppDataSource.query(`
        CREATE TABLE IF NOT EXISTS "system_settings" (
          "id" varchar(32) PRIMARY KEY DEFAULT 'default',
          "shared_recipes" boolean NOT NULL DEFAULT 1,
          "show_recipe_author" boolean NOT NULL DEFAULT 1,
          "shared_collections" boolean NOT NULL DEFAULT 1,
          "shared_meal_plans" boolean NOT NULL DEFAULT 1,
          "shared_shopping_lists" boolean NOT NULL DEFAULT 1,
          "shared_pantry" boolean NOT NULL DEFAULT 1,
          "shared_batch_cooking" boolean NOT NULL DEFAULT 1,
          "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
        )
      `);
      await AppDataSource.query(`
        INSERT INTO "system_settings" (
          "id",
          "shared_recipes",
          "show_recipe_author",
          "shared_collections",
          "shared_meal_plans",
          "shared_shopping_lists",
          "shared_pantry",
          "shared_batch_cooking",
          "updated_at"
        )
        VALUES ('default', 1, 1, 1, 1, 1, 1, 1, datetime('now'))
        ON CONFLICT ("id") DO NOTHING
      `);
      this.tableInitialized = true;
      await this.getSettings();
    } catch (err) {
      console.warn('[SystemSettingsService] Failed to ensure system_settings table:', err);
    }
  }

  static async getSettings(): Promise<SystemSettingsData> {
    if (!this.tableInitialized) {
      await this.initialize();
    }

    if (AppDataSource.isInitialized) {
      try {
        const rows = await AppDataSource.query(
          `SELECT
             "shared_recipes",
             "show_recipe_author",
             "shared_collections",
             "shared_meal_plans",
             "shared_shopping_lists",
             "shared_pantry",
             "shared_batch_cooking"
           FROM "system_settings"
           WHERE "id" = 'default'
           LIMIT 1`
        );
        if (rows && rows.length > 0) {
          const r = rows[0];
          this.cachedSettings = {
            sharedRecipes: toBool(r.shared_recipes, true),
            showRecipeAuthor: toBool(r.show_recipe_author, true),
            sharedCollections: toBool(r.shared_collections, true),
            sharedMealPlans: toBool(r.shared_meal_plans, true),
            sharedShoppingLists: toBool(r.shared_shopping_lists, true),
            sharedPantry: toBool(r.shared_pantry, true),
            sharedBatchCooking: toBool(r.shared_batch_cooking, true),
          };
          return this.cachedSettings;
        }
      } catch (err) {
        console.warn('[SystemSettingsService] Failed to read system_settings:', err);
      }
    }

    return this.cachedSettings ?? { ...DEFAULT_SETTINGS };
  }

  static async isSharedRecipesEnabled(): Promise<boolean> {
    const settings = this.cachedSettings ?? (await this.getSettings());
    return settings.sharedRecipes;
  }

  static async isShowRecipeAuthorEnabled(): Promise<boolean> {
    const settings = this.cachedSettings ?? (await this.getSettings());
    return settings.sharedRecipes && settings.showRecipeAuthor;
  }

  static async isSharedCollectionsEnabled(): Promise<boolean> {
    const settings = this.cachedSettings ?? (await this.getSettings());
    return settings.sharedCollections;
  }

  static async isSharedMealPlansEnabled(): Promise<boolean> {
    const settings = this.cachedSettings ?? (await this.getSettings());
    return settings.sharedMealPlans;
  }

  static async isSharedShoppingListsEnabled(): Promise<boolean> {
    const settings = this.cachedSettings ?? (await this.getSettings());
    return settings.sharedShoppingLists;
  }

  static async isSharedPantryEnabled(): Promise<boolean> {
    const settings = this.cachedSettings ?? (await this.getSettings());
    return settings.sharedPantry;
  }

  static async isSharedBatchCookingEnabled(): Promise<boolean> {
    const settings = this.cachedSettings ?? (await this.getSettings());
    return settings.sharedBatchCooking;
  }

  static async updateSettings(input: Partial<SystemSettingsData>): Promise<SystemSettingsData> {
    await this.initialize();
    const current = await this.getSettings();
    const next: SystemSettingsData = {
      sharedRecipes:
        input.sharedRecipes !== undefined ? Boolean(input.sharedRecipes) : current.sharedRecipes,
      showRecipeAuthor:
        input.showRecipeAuthor !== undefined
          ? Boolean(input.showRecipeAuthor)
          : current.showRecipeAuthor,
      sharedCollections:
        input.sharedCollections !== undefined
          ? Boolean(input.sharedCollections)
          : current.sharedCollections,
      sharedMealPlans:
        input.sharedMealPlans !== undefined
          ? Boolean(input.sharedMealPlans)
          : current.sharedMealPlans,
      sharedShoppingLists:
        input.sharedShoppingLists !== undefined
          ? Boolean(input.sharedShoppingLists)
          : current.sharedShoppingLists,
      sharedPantry:
        input.sharedPantry !== undefined ? Boolean(input.sharedPantry) : current.sharedPantry,
      sharedBatchCooking:
        input.sharedBatchCooking !== undefined
          ? Boolean(input.sharedBatchCooking)
          : current.sharedBatchCooking,
    };

    if (AppDataSource.isInitialized) {
      await AppDataSource.query(
        `INSERT INTO "system_settings" (
           "id",
           "shared_recipes",
           "show_recipe_author",
           "shared_collections",
           "shared_meal_plans",
           "shared_shopping_lists",
           "shared_pantry",
           "shared_batch_cooking",
           "updated_at"
         )
         VALUES ('default', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT ("id") DO UPDATE SET
           "shared_recipes" = EXCLUDED."shared_recipes",
           "show_recipe_author" = EXCLUDED."show_recipe_author",
           "shared_collections" = EXCLUDED."shared_collections",
           "shared_meal_plans" = EXCLUDED."shared_meal_plans",
           "shared_shopping_lists" = EXCLUDED."shared_shopping_lists",
           "shared_pantry" = EXCLUDED."shared_pantry",
           "shared_batch_cooking" = EXCLUDED."shared_batch_cooking",
           "updated_at" = datetime('now')`,
        [
          next.sharedRecipes ? 1 : 0,
          next.showRecipeAuthor ? 1 : 0,
          next.sharedCollections ? 1 : 0,
          next.sharedMealPlans ? 1 : 0,
          next.sharedShoppingLists ? 1 : 0,
          next.sharedPantry ? 1 : 0,
          next.sharedBatchCooking ? 1 : 0,
        ]
      );
    }

    this.cachedSettings = next;
    return this.cachedSettings;
  }
}
