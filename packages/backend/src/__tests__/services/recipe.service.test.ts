import { RecipeService } from '../../services/recipe/recipe.service';
import { AppDataSource } from '../../db/data-source';
import { User } from '../../db/entities';
import { UserRole } from '@nommable/shared';
import { buildRecipeDto, buildRecipeDtos } from '../helpers/fixtures';
import type { PaginatedResponse } from '@nommable/shared';
import type { Recipe } from '../../db/entities';

const TEST_USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';

async function createTestUser(id: string): Promise<User> {
  const userRepo = AppDataSource.getRepository(User);
  await userRepo
    .createQueryBuilder()
    .insert()
    .into(User)
    .values({
      id,
      email: `${id}@test.com`,
      username: `user-${id.slice(0, 8)}`,
      role: UserRole.USER,

    })
    .orIgnore()
    .execute();
  return userRepo.findOneByOrFail({ id });
}

describe('RecipeService', () => {
  let service: RecipeService;

  beforeAll(() => {
    service = new RecipeService();
  });

  describe('findAll', () => {
    beforeEach(async () => {
      await createTestUser(TEST_USER_ID);
      await createTestUser(OTHER_USER_ID);
      const dtos = buildRecipeDtos(25);
      for (const dto of dtos) {
        await service.create(TEST_USER_ID, dto);
      }
    });

    it('returns paginated results with defaults (page 1, pageSize 20)', async () => {
      const result: PaginatedResponse<Recipe> = await service.findAll(TEST_USER_ID, {});
      expect(result.data).toHaveLength(20);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(2);
    });

    it('returns second page with remaining results', async () => {
      const result = await service.findAll(TEST_USER_ID, { page: 2 });
      expect(result.data).toHaveLength(5);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
    });

    it('respects custom pageSize', async () => {
      const result = await service.findAll(TEST_USER_ID, { pageSize: 5 });
      expect(result.data).toHaveLength(5);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(5);
    });

    it('clamps pageSize to max 100', async () => {
      const result = await service.findAll(TEST_USER_ID, { pageSize: 200 });
      expect(result.pageSize).toBeLessThanOrEqual(100);
    });

    it('filters by search query', async () => {
      const result = await service.findAll(TEST_USER_ID, { query: 'Recipe 1' });
      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((r: any) => {
        expect(r.title).toContain('Recipe 1');
      });
      expect(result.total).toBe(result.data.length);
    });

    it('filters by category', async () => {
      const result = await service.findAll(TEST_USER_ID, { categories: ['Italian'] });
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('filters by difficulty', async () => {
      const result = await service.findAll(TEST_USER_ID, { difficulty: 'easy' });
      result.data.forEach((r: any) => {
        expect(r.difficulty).toBe('easy');
      });
    });

    it('returns empty data for out-of-range page', async () => {
      const result = await service.findAll(TEST_USER_ID, { page: 999 });
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(25);
    });

    it('does not return recipes from other users when sharedRecipes is disabled', async () => {
      const { SystemSettingsService } = await import('../../services/settings/system-settings.service');
      await SystemSettingsService.updateSettings({ sharedRecipes: false });
      try {
        await service.create(OTHER_USER_ID, buildRecipeDto({ title: 'Other User Recipe' }));
        const result = await service.findAll(TEST_USER_ID, { pageSize: 100 });
        result.data.forEach((r: any) => {
          expect(r.title).not.toBe('Other User Recipe');
        });
      } finally {
        await SystemSettingsService.updateSettings({ sharedRecipes: true });
      }
    });
  });

  describe('advanced filters', () => {
    const testUserId = TEST_USER_ID;

    beforeEach(async () => {
      await createTestUser(testUserId);

      await service.create(testUserId, {
        title: 'Chicken Rice Bowl',
        description: 'A hearty chicken dish',
        servings: 4,
        prepTime: 15,
        cookTime: 30,
        difficulty: 'easy',
        instructions: ['Cook rice', 'Grill chicken'],
        ingredients: [
          { name: 'Chicken breast', quantity: 2, unit: 'pieces', order: 0 },
          { name: 'White rice', quantity: 1, unit: 'cup', order: 1 },
        ],
        categories: ['Asian'],
        tags: [],
      });

      await service.create(testUserId, {
        title: 'Vegan Salad',
        description: 'Fresh garden salad',
        servings: 2,
        prepTime: 10,
        cookTime: 0,
        difficulty: 'easy',
        instructions: ['Chop vegetables', 'Toss with dressing'],
        ingredients: [
          { name: 'Lettuce', quantity: 1, unit: 'head', order: 0 },
          { name: 'Tomatoes', quantity: 3, unit: 'pieces', order: 1 },
        ],
        categories: ['Healthy'],
        tags: ['vegan'],
        sourceUrl: 'https://example.com/salad',
      });
    });

    it('filters by included ingredients', async () => {
      const result = await service.findAll(testUserId, { includeIngredients: ['chicken'] });
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe('Chicken Rice Bowl');
    });

    it('filters by excluded ingredients', async () => {
      const result = await service.findAll(testUserId, { excludeIngredients: ['chicken'] });
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe('Vegan Salad');
    });

    it('filters by source (imported)', async () => {
      const result = await service.findAll(testUserId, { source: ['imported'] });
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe('Vegan Salad');
    });

    it('filters by source (manual)', async () => {
      const result = await service.findAll(testUserId, { source: ['manual'] });
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe('Chicken Rice Bowl');
    });

    it('combines include and exclude filters', async () => {
      const result = await service.findAll(testUserId, {
        includeIngredients: ['rice'],
        excludeIngredients: ['tomato'],
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe('Chicken Rice Bowl');
    });
  });
});
