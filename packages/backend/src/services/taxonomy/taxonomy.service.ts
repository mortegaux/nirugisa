import { AppDataSource } from '../../db/data-source';
import { Taxonomy } from '../../db/entities';
import { Recipe } from '../../db/entities';
import { User } from '../../db/entities';
import type { TaxonomyCreateDto, TaxonomyUpdateDto, TaxonomyType } from '@nommable/shared';

const COMMON_CATEGORIES = [
  'Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Appetizer', 'Side Dish', 'Beverage', 'Main Course',
  'Vegan', 'Vegetarian', 'Gluten-Free', 'Keto', 'Paleo', 'Dairy-Free',
  'Baking', 'Grilling', 'Slow Cooker', 'Instant Pot', 'Air Fryer', 'Stir Fry', 'No Cook',
  'Quick & Easy', 'Long Cook',
  'Italian', 'Mexican', 'Chinese', 'Indian', 'Japanese', 'Thai', 'French', 'Mediterranean', 'American',
];

const COMMON_TAGS = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Low-Carb', 'Keto', 'Paleo',
  'Healthy', 'Comfort Food', 'Quick', 'Easy', 'One Pot', 'Meal Prep',
  'Family Friendly', 'Party Food', 'Budget Friendly', 'Kid-Friendly',
  '15 Minutes or Less', '30 Minutes or Less', 'Easy Prep',
  'Freezer-Friendly', 'Summer', 'Winter', 'Spring', 'Fall',
];

export class TaxonomyService {
  private taxonomyRepo = AppDataSource.getRepository(Taxonomy);
  private recipeRepo = AppDataSource.getRepository(Recipe);
  private userRepo = AppDataSource.getRepository(User);

  async getAll(userId: string, type?: TaxonomyType): Promise<Taxonomy[]> {
    const where = type ? { userId, type } : { userId };
    return this.taxonomyRepo.find({ where, order: { type: 'ASC', sortOrder: 'ASC', name: 'ASC' } });
  }

  async create(userId: string, dto: TaxonomyCreateDto): Promise<Taxonomy> {
    // Auto-assign next sortOrder within this user's set
    const maxResult = await this.taxonomyRepo
      .createQueryBuilder('t')
      .select('COALESCE(MAX(t.sort_order), -1)', 'max')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type = :type', { type: dto.type })
      .getRawOne();
    const nextOrder = (maxResult?.max ?? -1) + 1;

    const taxonomy = this.taxonomyRepo.create({
      userId,
      name: dto.name,
      type: dto.type,
      color: dto.color,
      sortOrder: nextOrder,
    });
    return this.taxonomyRepo.save(taxonomy);
  }

  async update(userId: string, id: string, dto: TaxonomyUpdateDto): Promise<Taxonomy> {
    const taxonomy = await this.taxonomyRepo.findOneBy({ id, userId });
    if (!taxonomy) throw new Error('Taxonomy not found');

    const oldName = taxonomy.name;
    const nameChanged = dto.name && dto.name !== oldName;

    Object.assign(taxonomy, dto);
    const saved = await this.taxonomyRepo.save(taxonomy);

    // Propagate rename to this user's recipes in background (don't block response)
    if (nameChanged) {
      const column = taxonomy.type === 'category' ? 'categories' : 'tags';
      this.propagateRename(userId, column, oldName, dto.name!).catch((err) => {
        console.error(`Failed to propagate taxonomy rename "${oldName}" → "${dto.name}" to recipes:`, err);
      });
    }

    return saved;
  }

  async delete(userId: string, id: string): Promise<void> {
    const taxonomy = await this.taxonomyRepo.findOneBy({ id, userId });
    if (!taxonomy) throw new Error('Taxonomy not found');

    const name = taxonomy.name;
    const column = taxonomy.type === 'category' ? 'categories' : 'tags';

    // Delete the taxonomy entity first so the UI updates immediately
    await this.taxonomyRepo.delete({ id, userId });

    // Propagate removal from this user's recipes in background (don't block response)
    this.propagateRemoval(userId, column, name).catch((err) => {
      console.error(`Failed to propagate taxonomy deletion "${name}" to recipes:`, err);
    });
  }

  /**
   * Remove a value from a JSONB string array column across one user's recipes.
   * Uses row-by-row updates to avoid correlated subquery locking issues.
   */
  private async propagateRemoval(userId: string, column: string, value: string): Promise<void> {
    // Find affected recipe IDs first (lightweight query)
    const affected: { id: string }[] = await AppDataSource.query(
      `SELECT id FROM recipes
       WHERE "user_id" = $1
         AND "${column}" IS NOT NULL
         AND jsonb_typeof("${column}") = 'array'
         AND "${column}" @> $2::jsonb`,
      [userId, JSON.stringify([value])]
    );

    if (affected.length === 0) return;

    // Update each recipe individually to avoid long-held locks
    for (const row of affected) {
      try {
        const recipe = await this.recipeRepo.findOneBy({ id: row.id });
        if (!recipe) continue;
        const arr: string[] = (recipe as any)[column] || [];
        (recipe as any)[column] = arr.filter((v) => v !== value);
        await this.recipeRepo.save(recipe);
      } catch (err) {
        console.error(`Failed to remove "${value}" from recipe ${row.id}:`, err);
      }
    }
  }

  /**
   * Rename a value in a JSONB string array column across one user's recipes.
   * Uses row-by-row updates to avoid correlated subquery locking issues.
   */
  private async propagateRename(userId: string, column: string, oldName: string, newName: string): Promise<void> {
    const affected: { id: string }[] = await AppDataSource.query(
      `SELECT id FROM recipes
       WHERE "user_id" = $1
         AND "${column}" IS NOT NULL
         AND jsonb_typeof("${column}") = 'array'
         AND "${column}" @> $2::jsonb`,
      [userId, JSON.stringify([oldName])]
    );

    if (affected.length === 0) return;

    for (const row of affected) {
      try {
        const recipe = await this.recipeRepo.findOneBy({ id: row.id });
        if (!recipe) continue;
        const arr: string[] = (recipe as any)[column] || [];
        (recipe as any)[column] = arr.map((v) => (v === oldName ? newName : v));
        await this.recipeRepo.save(recipe);
      } catch (err) {
        console.error(`Failed to rename "${oldName}" → "${newName}" in recipe ${row.id}:`, err);
      }
    }
  }

  async reorder(userId: string, ids: string[]): Promise<void> {
    const updates = ids.map((id, index) =>
      this.taxonomyRepo.update({ id, userId }, { sortOrder: index })
    );
    await Promise.all(updates);
  }

  /**
   * Seed the curated default categories/tags for one user, plus any unique
   * values already present on that user's recipes. Idempotent: existing
   * (user_id, name, type) rows are skipped via orIgnore.
   */
  async seedForUser(userId: string): Promise<void> {
    // Seed default categories
    for (let i = 0; i < COMMON_CATEGORIES.length; i++) {
      await this.taxonomyRepo
        .createQueryBuilder()
        .insert()
        .into(Taxonomy)
        .values({ userId, name: COMMON_CATEGORIES[i], type: 'category', sortOrder: i })
        .orIgnore()
        .execute();
    }

    // Seed default tags
    for (let i = 0; i < COMMON_TAGS.length; i++) {
      await this.taxonomyRepo
        .createQueryBuilder()
        .insert()
        .into(Taxonomy)
        .values({ userId, name: COMMON_TAGS[i], type: 'tag', sortOrder: i })
        .orIgnore()
        .execute();
    }

    // Also seed any unique values from this user's recipes
    const recipes = await this.recipeRepo.find({ where: { userId }, select: ['categories', 'tags'] });
    const existingCategories = new Set<string>();
    const existingTags = new Set<string>();

    for (const recipe of recipes) {
      (recipe.categories || []).forEach((c) => existingCategories.add(c));
      (recipe.tags || []).forEach((t) => existingTags.add(t));
    }

    const currentMax = await this.taxonomyRepo
      .createQueryBuilder('t')
      .select('t.type', 'type')
      .addSelect('COALESCE(MAX(t.sort_order), -1)', 'max')
      .where('t.userId = :userId', { userId })
      .groupBy('t.type')
      .getRawMany();

    const maxByType: Record<string, number> = {};
    for (const row of currentMax) {
      maxByType[row.type] = row.max;
    }

    let catOrder = (maxByType['category'] ?? -1) + 1;
    for (const name of existingCategories) {
      await this.taxonomyRepo
        .createQueryBuilder()
        .insert()
        .into(Taxonomy)
        .values({ userId, name, type: 'category', sortOrder: catOrder++ })
        .orIgnore()
        .execute();
    }

    let tagOrder = (maxByType['tag'] ?? -1) + 1;
    for (const name of existingTags) {
      await this.taxonomyRepo
        .createQueryBuilder()
        .insert()
        .into(Taxonomy)
        .values({ userId, name, type: 'tag', sortOrder: tagOrder++ })
        .orIgnore()
        .execute();
    }
  }

  /**
   * Seed taxonomy data for every user. Runs once at startup (and is safe to
   * re-run: seedForUser is idempotent).
   */
  async seedForAllUsers(): Promise<void> {
    const users = await this.userRepo.find({ select: ['id'] });
    for (const user of users) {
      await this.seedForUser(user.id);
    }
  }
}
