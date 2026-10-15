import request from 'supertest';
import { createApp } from '../../app';
import { createTestToken } from '../helpers/auth';
import { AppDataSource } from '../../db/data-source';
import { User } from '../../db/entities';
import { UserRole } from '@nommable/shared';

const app = createApp();
const TEST_USER_ID = 'bbbbbbbb-2222-2222-2222-000000000088';

async function createTestUser(id: string): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);
  await userRepo
    .createQueryBuilder()
    .insert()
    .into(User)
    .values({
      id,
      email: `pantry-test-${id.slice(0, 8)}@test.com`,
      username: `pantry-user-${id.slice(0, 8)}`,
      role: UserRole.USER,
    })
    .orIgnore()
    .execute();
}

describe('Pantry API Routes', () => {
  let token: string;

  beforeEach(async () => {
    await createTestUser(TEST_USER_ID);
    token = createTestToken(TEST_USER_ID);
  });

  describe('Pantry Items CRUD & Edit (#32)', () => {
    it('creates, retrieves, edits, and toggles low-stock on pantry items', async () => {
      // 1. Create item
      const createRes = await request(app)
        .post('/api/pantry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Olive Oil',
          quantity: 2,
          unit: 'bottles',
          category: 'Oils & Vinegars',
          location: 'Pantry',
          notes: 'Extra virgin',
          isLowStock: false,
        })
        .expect(201);

      const itemId = createRes.body.id;
      expect(itemId).toBeDefined();
      expect(createRes.body.name).toBe('Olive Oil');
      expect(createRes.body.quantity).toBe(2);

      // 2. Edit item (#32)
      const updateRes = await request(app)
        .put(`/api/pantry/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Premium Olive Oil',
          quantity: 1.5,
          unit: 'liters',
          category: 'Oils & Vinegars',
          location: 'Cabinet',
          notes: 'Cold pressed',
          isLowStock: true,
        })
        .expect(200);

      expect(updateRes.body.name).toBe('Premium Olive Oil');
      expect(updateRes.body.quantity).toBe(1.5);
      expect(updateRes.body.unit).toBe('liters');
      expect(updateRes.body.location).toBe('Cabinet');
      expect(updateRes.body.isLowStock).toBe(true);

      // 3. Toggle low stock (#31)
      const toggleRes = await request(app)
        .patch(`/api/pantry/${itemId}/toggle-low-stock`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(toggleRes.body.isLowStock).toBe(false);

      // 4. Delete item
      await request(app)
        .delete(`/api/pantry/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });
  });

  describe('Configurable Storage Locations (#33)', () => {
    it('lists default locations and tracks item counts', async () => {
      const res = await request(app)
        .get('/api/pantry/locations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const names = res.body.map((l: any) => l.name);
      expect(names).toContain('Pantry');
      expect(names).toContain('Refrigerator');
      expect(names).toContain('Freezer');
    });

    it('creates, renames, and deletes custom locations with item transfer', async () => {
      // 1. Create custom location
      const createRes = await request(app)
        .post('/api/pantry/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Cellar' })
        .expect(201);

      expect(createRes.body.name).toBe('Cellar');
      expect(createRes.body.isDefault).toBe(false);

      // 2. Add an item into 'Cellar'
      const itemRes = await request(app)
        .post('/api/pantry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Aged Wine',
          quantity: 6,
          unit: 'bottles',
          category: 'Beverages',
          location: 'Cellar',
        })
        .expect(201);

      const itemId = itemRes.body.id;

      // 3. Verify location list shows 1 item in Cellar
      const listRes1 = await request(app)
        .get('/api/pantry/locations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const cellarLoc1 = listRes1.body.find((l: any) => l.name === 'Cellar');
      expect(cellarLoc1).toBeDefined();
      expect(cellarLoc1.itemCount).toBe(1);

      // 4. Rename location from 'Cellar' to 'Wine Cellar'
      await request(app)
        .put('/api/pantry/locations/Cellar')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Wine Cellar' })
        .expect(200);

      // Verify item location was propagated
      const getItemsRes = await request(app)
        .get('/api/pantry')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const updatedItem = getItemsRes.body.find((i: any) => i.id === itemId);
      expect(updatedItem.location).toBe('Wine Cellar');

      // 5. Delete location with transfer to 'Pantry'
      await request(app)
        .delete('/api/pantry/locations/Wine%20Cellar?transferTo=Pantry')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify item now has location 'Pantry'
      const getItemsRes2 = await request(app)
        .get('/api/pantry')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const transferredItem = getItemsRes2.body.find((i: any) => i.id === itemId);
      expect(transferredItem.location).toBe('Pantry');

      // Cleanup
      await request(app)
        .delete(`/api/pantry/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });
  });
});
