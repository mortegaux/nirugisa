import request from 'supertest';
import { createApp } from '../../app';
import { createTestToken } from '../helpers/auth';
import { buildRecipeDto } from '../helpers/fixtures';
import { AppDataSource } from '../../db/data-source';
import { User } from '../../db/entities';
import { UserRole } from '@nommable/shared';

const app = createApp();

const TEST_USER_ID = 'cccccccc-3333-3333-3333-000000000077';
const LUNCH_ONLY_USER_ID = 'dddddddd-4444-4444-4444-000000000077';

async function createTestUser(id: string): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);
  await userRepo
    .createQueryBuilder()
    .insert()
    .into(User)
    .values({
      id,
      email: `ha-test-${id.slice(0, 8)}@test.com`,
      username: `ha-user-${id.slice(0, 8)}`,
      role: UserRole.USER,
    })
    .orIgnore()
    .execute();
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function seedPantry(token: string): Promise<void> {
  const items = [
    {
      name: 'Milk',
      quantity: 1,
      unit: 'carton',
      category: 'Dairy',
      expirationDate: daysFromNow(3).toISOString(),
    },
    {
      name: 'Yogurt',
      quantity: 2,
      unit: 'cups',
      category: 'Dairy',
      expirationDate: daysFromNow(-1).toISOString(),
    },
    { name: 'Rice', quantity: 1, unit: 'bag', category: 'Grains', isLowStock: true },
    {
      name: 'Cheese',
      quantity: 1,
      unit: 'block',
      category: 'Dairy',
      expirationDate: daysFromNow(30).toISOString(),
    },
  ];
  for (const item of items) {
    await request(app)
      .post('/api/pantry')
      .set('Authorization', `Bearer ${token}`)
      .send(item)
      .expect(201);
  }
}

async function seedMealPlan(token: string, meals: Array<Record<string, unknown>>): Promise<void> {
  const recipeRes = await request(app)
    .post('/api/recipes')
    .set('Authorization', `Bearer ${token}`)
    .send(buildRecipeDto({ title: 'Tacos' }))
    .expect(201);
  const recipeId = recipeRes.body.id;
  await request(app)
    .post('/api/meal-plans')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'This Week',
      startDate: toDateKey(new Date()),
      endDate: toDateKey(daysFromNow(7)),
      meals: meals.map((meal) => ({ ...meal, recipeId })),
    })
    .expect(201);
}

async function seedShoppingList(token: string): Promise<void> {
  await request(app)
    .post('/api/shopping-lists')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Groceries',
      items: [
        { name: 'Milk', quantity: 1, unit: 'carton', checked: false, order: 0 },
        { name: 'Eggs', quantity: 12, unit: 'count', checked: true, order: 1 },
      ],
    })
    .expect(201);
}

describe('Home Assistant summary endpoints (issue #34 slice)', () => {
  describe('auth', () => {
    it('requires a session on every endpoint', async () => {
      for (const path of [
        '/api/home-assistant/tonights-dinner',
        '/api/home-assistant/low-stock',
        '/api/home-assistant/expiring',
        '/api/home-assistant/shopping-lists',
      ]) {
        await request(app).get(path).expect(401);
      }
    });
  });

  describe('empty states', () => {
    it('returns empty summaries for a user with no data', async () => {
      await createTestUser(TEST_USER_ID);
      const token = createTestToken(TEST_USER_ID);
      const dinner = await request(app)
        .get('/api/home-assistant/tonights-dinner')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(dinner.body).toEqual({ date: toDateKey(new Date()), meals: [], count: 0 });
      for (const path of ['/api/home-assistant/low-stock', '/api/home-assistant/expiring']) {
        const res = await request(app)
          .get(path)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(res.body.count).toBe(0);
        expect(res.body.items).toEqual([]);
      }
      const lists = await request(app)
        .get('/api/home-assistant/shopping-lists')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(lists.body).toEqual({ lists: [], count: 0, totalUnchecked: 0 });
    });
  });

  describe('seeded data', () => {
    let token: string;

    beforeEach(async () => {
      await createTestUser(TEST_USER_ID);
      token = createTestToken(TEST_USER_ID);
      await seedPantry(token);
      await seedMealPlan(token, [
        {
          date: toDateKey(new Date()),
          mealType: 'dinner',
          servings: 2,
          notes: '[18:30] serve with salsa',
        },
        { date: toDateKey(new Date()), mealType: 'lunch', servings: 2 },
        { date: toDateKey(daysFromNow(1)), mealType: 'dinner', servings: 2 },
      ]);
      await seedShoppingList(token);
    });

    it('returns tonight\u2019s dinner (dinner preferred), decoding the [HH:MM] notes prefix', async () => {
      const res = await request(app)
        .get('/api/home-assistant/tonights-dinner')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.date).toBe(toDateKey(new Date()));
      expect(res.body.count).toBe(1);
      expect(res.body.meals).toHaveLength(1);
      const meal = res.body.meals[0];
      expect(meal.mealType).toBe('dinner');
      expect(meal.recipeTitle).toBe('Tacos');
      expect(meal.time).toBe('18:30');
      expect(meal.notes).toBe('serve with salsa');
    });

    it('returns expiring items within the default 7-day window, soonest first', async () => {
      const res = await request(app)
        .get('/api/home-assistant/expiring')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.windowDays).toBe(7);
      expect(res.body.count).toBe(2);
      expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(['Yogurt', 'Milk']);
      expect(res.body.items[0].daysUntilExpiry).toBe(-1);
      expect(res.body.items[1].daysUntilExpiry).toBe(3);
      expect(res.body.items[1].expirationDate).toBe(toDateKey(daysFromNow(3)));
      // No whole-entity dump: summaries carry only the documented fields.
      expect(Object.keys(res.body.items[0]).sort()).toEqual(
        [
          'category',
          'daysUntilExpiry',
          'expirationDate',
          'id',
          'location',
          'name',
          'quantity',
          'unit',
        ].sort()
      );
    });

    it('honors the days window and falls back to 7 for garbage input', async () => {
      const oneDay = await request(app)
        .get('/api/home-assistant/expiring?days=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(oneDay.body.windowDays).toBe(1);
      expect(oneDay.body.items.map((i: { name: string }) => i.name)).toEqual(['Yogurt']);
      const garbage = await request(app)
        .get('/api/home-assistant/expiring?days=banana')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(garbage.body.windowDays).toBe(7);
    });

    it('returns low-stock items only', async () => {
      const res = await request(app)
        .get('/api/home-assistant/low-stock')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.count).toBe(1);
      expect(res.body.items[0].name).toBe('Rice');
      expect(res.body.items[0]).not.toHaveProperty('expirationDate');
    });

    it('returns active shopping lists with unchecked items only', async () => {
      const res = await request(app)
        .get('/api/home-assistant/shopping-lists')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.count).toBe(1);
      expect(res.body.totalUnchecked).toBe(1);
      const list = res.body.lists[0];
      expect(list.name).toBe('Groceries');
      expect(list.uncheckedCount).toBe(1);
      expect(list.totalCount).toBe(2);
      expect(list.items).toEqual([{ name: 'Milk', quantity: 1, unit: 'carton' }]);
    });
  });

  describe('no dinner planned', () => {
    // Sibling block, NOT nested in 'seeded data': meal plans are shared by
    // default, so a lunch-only board must be seeded in isolation from the
    // dinner test data (the outer beforeEach would otherwise seed dinner).
    it('returns all of today\u2019s meals when no dinner is planned', async () => {
      await createTestUser(LUNCH_ONLY_USER_ID);
      const lunchToken = createTestToken(LUNCH_ONLY_USER_ID);
      await seedMealPlan(lunchToken, [
        { date: toDateKey(new Date()), mealType: 'lunch', servings: 1 },
      ]);
      const res = await request(app)
        .get('/api/home-assistant/tonights-dinner')
        .set('Authorization', `Bearer ${lunchToken}`)
        .expect(200);
      expect(res.body.count).toBe(1);
      expect(res.body.meals[0].mealType).toBe('lunch');
    });
  });
});
