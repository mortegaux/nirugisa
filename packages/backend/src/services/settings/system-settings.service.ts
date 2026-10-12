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

export class SystemSettingsService {
  private static tableInitialized = false;
  private static cachedSettings: SystemSettingsData | null = null;

  static async initialize(): Promise<void> {
    if (this.tableInitialized || !AppDataSource.isInitialized) return;
    try {
      await AppDataSource.query(`
        CREATE TABLE IF NOT EXISTS "system_settings" (
          "id" varchar(32) PRIMARY KEY DEFAULT 'default',
          "shared_recipes" boolean NOT NULL DEFAULT true,
          "show_recipe_author" boolean NOT NULL DEFAULT true,
          "shared_collections" boolean NOT NULL DEFAULT true,
          "shared_meal_plans" boolean NOT NULL DEFAULT true,
          "shared_shopping_lists" boolean NOT NULL DEFAULT true,
          "shared_pantry" boolean NOT NULL DEFAULT true,
          "shared_batch_cooking" boolean NOT NULL DEFAULT true,
          "updated_at" timestamp NOT NULL DEFAULT now()
        )
      `);
      await AppDataSource.query(`
        ALTER TABLE "system_settings"
          ADD COLUMN IF NOT EXISTS "show_recipe_author" boolean NOT NULL DEFAULT true,
          ADD COLUMN IF NOT EXISTS "shared_collections" boolean NOT NULL DEFAULT true,
          ADD COLUMN IF NOT EXISTS "shared_meal_plans" boolean NOT NULL DEFAULT true,
          ADD COLUMN IF NOT EXISTS "shared_shopping_lists" boolean NOT NULL DEFAULT true,
          ADD COLUMN IF NOT EXISTS "shared_pantry" boolean NOT NULL DEFAULT true,
          ADD COLUMN IF NOT EXISTS "shared_batch_cooking" boolean NOT NULL DEFAULT true
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
        VALUES ('default', true, true, true, true, true, true, true, now())
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
            sharedRecipes: r.shared_recipes !== false,
            showRecipeAuthor: r.show_recipe_author !== false,
            sharedCollections: r.shared_collections !== false,
            sharedMealPlans: r.shared_meal_plans !== false,
            sharedShoppingLists: r.shared_shopping_lists !== false,
            sharedPantry: r.shared_pantry !== false,
            sharedBatchCooking: r.shared_batch_cooking !== false,
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
         VALUES ('default', $1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT ("id") DO UPDATE SET
           "shared_recipes" = EXCLUDED."shared_recipes",
           "show_recipe_author" = EXCLUDED."show_recipe_author",
           "shared_collections" = EXCLUDED."shared_collections",
           "shared_meal_plans" = EXCLUDED."shared_meal_plans",
           "shared_shopping_lists" = EXCLUDED."shared_shopping_lists",
           "shared_pantry" = EXCLUDED."shared_pantry",
           "shared_batch_cooking" = EXCLUDED."shared_batch_cooking",
           "updated_at" = now()`,
        [
          next.sharedRecipes,
          next.showRecipeAuthor,
          next.sharedCollections,
          next.sharedMealPlans,
          next.sharedShoppingLists,
          next.sharedPantry,
          next.sharedBatchCooking,
        ]
      );
    }

    this.cachedSettings = next;
    return this.cachedSettings;
  }
}
