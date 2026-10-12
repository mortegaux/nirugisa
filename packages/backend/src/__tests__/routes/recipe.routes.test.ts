import request from 'supertest';
import { createApp } from '../../app';
import { createTestToken } from '../helpers/auth';
import { buildRecipeDtos } from '../helpers/fixtures';
import { AppDataSource } from '../../db/data-source';
import { User } from '../../db/entities';
import { UserRole } from '@nommable/shared';

const app = createApp();

const TEST_USER_ID = 'aaaaaaaa-1111-1111-1111-000000000099';

async function createTestUser(id: string): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);
  await userRepo
    .createQueryBuilder()
    .insert()
    .into(User)
    .values({
      id,
      email: `route-test-${id.slice(0, 8)}@test.com`,
      username: `route-user-${id.slice(0, 8)}`,
      role: UserRole.USER,

    })
    .orIgnore()
    .execute();
}

async function seedRecipes(token: string, count: number): Promise<void> {
  for (const dto of buildRecipeDtos(count)) {
    await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(201);
  }
}

describe('GET /api/recipes', () => {
  let token: string;

  beforeEach(async () => {
    await createTestUser(TEST_USER_ID);
    token = createTestToken(TEST_USER_ID);
    await seedRecipes(token, 5);
  });

  it('returns paginated response with default params', async () => {
    const res = await request(app)
      .get('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('pageSize', 20);
    expect(res.body).toHaveProperty('totalPages');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('respects page and pageSize query params', async () => {
    const res = await request(app)
      .get('/api/recipes?page=1&pageSize=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pageSize).toBe(2);
  });

  it('filters by search query', async () => {
    const res = await request(app)
      .get('/api/recipes?query=Test+Recipe+1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('returns 401 without auth token', async () => {
    await request(app).get('/api/recipes').expect(401);
  });
});
