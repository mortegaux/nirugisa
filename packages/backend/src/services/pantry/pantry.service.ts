import crypto from 'crypto';
import { AppDataSource } from '../../db/data-source';
import { PantryItem } from '../../db/entities';
import type {
  PantryItemCreateDto,
  PantryItemUpdateDto,
  PantryLocationInfo,
} from '@nommable/shared';
import { SystemSettingsService } from '../settings/system-settings.service';

const DEFAULT_LOCATIONS = [
  'Pantry',
  'Refrigerator',
  'Freezer',
  'Spice Rack',
  'Cabinet',
  'Other',
];

export class PantryService {
  private pantryRepo = AppDataSource.getRepository(PantryItem);
  private static locationsInitialized = false;

  async initializeLocations(): Promise<void> {
    if (PantryService.locationsInitialized || !AppDataSource.isInitialized) return;
    try {
      await AppDataSource.query(`
        CREATE TABLE IF NOT EXISTS "pantry_locations" (
          "id" varchar(36) PRIMARY KEY,
          "user_id" varchar(36),
          "name" varchar(100) NOT NULL,
          "is_default" boolean NOT NULL DEFAULT 0,
          "sort_order" integer NOT NULL DEFAULT 0,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
        )
      `);

      const countRows = await AppDataSource.query(`SELECT COUNT(*) as cnt FROM "pantry_locations"`);
      const count = countRows?.[0]?.cnt ?? 0;
      if (Number(count) === 0) {
        for (let i = 0; i < DEFAULT_LOCATIONS.length; i++) {
          await AppDataSource.query(
            `INSERT INTO "pantry_locations" ("id", "user_id", "name", "is_default", "sort_order", "created_at", "updated_at")
             VALUES (?, NULL, ?, 1, ?, datetime('now'), datetime('now'))`,
            [crypto.randomUUID(), DEFAULT_LOCATIONS[i], i]
          );
        }
      }
      PantryService.locationsInitialized = true;
    } catch (err) {
      console.warn('[PantryService] Failed to ensure pantry_locations table:', err);
    }
  }

  async getAllItems(userId: string): Promise<PantryItem[]> {
    const sharedPantry = await SystemSettingsService.isSharedPantryEnabled();
    return this.pantryRepo.find({
      where: sharedPantry ? undefined : { userId },
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  async getItemById(id: string, userId: string): Promise<PantryItem | null> {
    const sharedPantry = await SystemSettingsService.isSharedPantryEnabled();
    return this.pantryRepo.findOne({
      where: sharedPantry ? { id } : { id, userId },
    });
  }

  async createItem(userId: string, data: PantryItemCreateDto): Promise<PantryItem> {
    const item = this.pantryRepo.create({
      ...data,
      userId,
    });

    return this.pantryRepo.save(item);
  }

  async updateItem(id: string, userId: string, data: PantryItemUpdateDto): Promise<PantryItem> {
    const item = await this.getItemById(id, userId);
    if (!item) {
      throw new Error('Pantry item not found');
    }

    const { id: _ignoredId, userId: _ignoredUserId, ...updates } = data as any;
    Object.assign(item, updates);
    return this.pantryRepo.save(item);
  }

  async deleteItem(id: string, userId: string): Promise<void> {
    const sharedPantry = await SystemSettingsService.isSharedPantryEnabled();
    const result = await this.pantryRepo.delete(sharedPantry ? { id } : { id, userId });
    if (result.affected === 0) {
      throw new Error('Pantry item not found');
    }
  }

  async getExpiringItems(userId: string, daysAhead: number = 7): Promise<PantryItem[]> {
    const sharedPantry = await SystemSettingsService.isSharedPantryEnabled();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const qb = this.pantryRepo
      .createQueryBuilder('pantry_item')
      .where('pantry_item.expiration_date IS NOT NULL')
      .andWhere('pantry_item.expiration_date <= :futureDate', { futureDate })
      .orderBy('pantry_item.expiration_date', 'ASC');

    if (!sharedPantry) {
      qb.andWhere('pantry_item.userId = :userId', { userId });
    }

    return qb.getMany();
  }

  async getLowStockItems(userId: string): Promise<PantryItem[]> {
    const sharedPantry = await SystemSettingsService.isSharedPantryEnabled();
    return this.pantryRepo.find({
      where: sharedPantry ? { isLowStock: true } : { isLowStock: true, userId },
      order: { name: 'ASC' },
    });
  }

  async updateQuantity(id: string, userId: string, quantityChange: number): Promise<PantryItem> {
    const item = await this.getItemById(id, userId);
    if (!item) {
      throw new Error('Pantry item not found');
    }

    item.quantity = Math.max(0, item.quantity + quantityChange);

    // Auto-update low stock status if quantity is very low
    if (item.quantity <= 1) {
      item.isLowStock = true;
    }

    return this.pantryRepo.save(item);
  }

  async toggleLowStock(id: string, userId: string): Promise<PantryItem> {
    const item = await this.getItemById(id, userId);
    if (!item) {
      throw new Error('Pantry item not found');
    }

    item.isLowStock = !item.isLowStock;
    return this.pantryRepo.save(item);
  }

  // --- Location Management ---

  async getLocations(userId: string): Promise<PantryLocationInfo[]> {
    await this.initializeLocations();
    const sharedPantry = await SystemSettingsService.isSharedPantryEnabled();

    const locationRows: Array<{
      id: string;
      name: string;
      is_default: number;
      sort_order: number;
    }> = await AppDataSource.query(
      sharedPantry
        ? `SELECT "id", "name", "is_default", "sort_order" FROM "pantry_locations" ORDER BY "sort_order" ASC, "name" ASC`
        : `SELECT "id", "name", "is_default", "sort_order" FROM "pantry_locations" WHERE "user_id" IS NULL OR "user_id" = ? ORDER BY "sort_order" ASC, "name" ASC`,
      sharedPantry ? [] : [userId]
    );

    // Fetch counts from pantry_items
    const countRows: Array<{ location: string; cnt: number }> = await AppDataSource.query(
      sharedPantry
        ? `SELECT "location", COUNT(*) as cnt FROM "pantry_items" GROUP BY "location"`
        : `SELECT "location", COUNT(*) as cnt FROM "pantry_items" WHERE "user_id" = ? GROUP BY "location"`,
      sharedPantry ? [] : [userId]
    );
    const countMap = new Map<string, number>();
    for (const r of countRows) {
      if (r.location) {
        countMap.set(r.location.toLowerCase(), Number(r.cnt));
      }
    }

    return locationRows.map((row) => ({
      id: row.id,
      name: row.name,
      isDefault: Boolean(row.is_default),
      itemCount: countMap.get(row.name.toLowerCase()) || 0,
    }));
  }

  async createLocation(userId: string, rawName: string): Promise<PantryLocationInfo> {
    await this.initializeLocations();
    const name = rawName?.trim();
    if (!name || name.length > 50) {
      throw new Error('Location name must be between 1 and 50 characters');
    }

    const sharedPantry = await SystemSettingsService.isSharedPantryEnabled();
    const existing = await AppDataSource.query(
      sharedPantry
        ? `SELECT "id", "name", "is_default" FROM "pantry_locations" WHERE LOWER("name") = LOWER(?) LIMIT 1`
        : `SELECT "id", "name", "is_default" FROM "pantry_locations" WHERE LOWER("name") = LOWER(?) AND ("user_id" IS NULL OR "user_id" = ?) LIMIT 1`,
      sharedPantry ? [name] : [name, userId]
    );

    if (existing && existing.length > 0) {
      return {
        id: existing[0].id,
        name: existing[0].name,
        isDefault: Boolean(existing[0].is_default),
        itemCount: 0,
      };
    }

    const maxSort = await AppDataSource.query(
      `SELECT COALESCE(MAX("sort_order"), 0) as max_sort FROM "pantry_locations"`
    );
    const nextSort = Number(maxSort?.[0]?.max_sort || 0) + 1;
    const id = crypto.randomUUID();

    await AppDataSource.query(
      `INSERT INTO "pantry_locations" ("id", "user_id", "name", "is_default", "sort_order", "created_at", "updated_at")
       VALUES (?, ?, ?, 0, ?, datetime('now'), datetime('now'))`,
      [id, sharedPantry ? null : userId, name, nextSort]
    );

    return {
      id,
      name,
      isDefault: false,
      itemCount: 0,
    };
  }

  async updateLocation(
    userId: string,
    rawOldName: string,
    rawNewName: string
  ): Promise<{ success: boolean; name: string }> {
    await this.initializeLocations();
    const oldName = rawOldName?.trim();
    const newName = rawNewName?.trim();
    if (!oldName) throw new Error('Existing location name is required');
    if (!newName || newName.length > 50) {
      throw new Error('New location name must be between 1 and 50 characters');
    }

    const sharedPantry = await SystemSettingsService.isSharedPantryEnabled();

    await AppDataSource.query(
      sharedPantry
        ? `UPDATE "pantry_locations" SET "name" = ?, "updated_at" = datetime('now') WHERE LOWER("name") = LOWER(?)`
        : `UPDATE "pantry_locations" SET "name" = ?, "updated_at" = datetime('now') WHERE LOWER("name") = LOWER(?) AND ("user_id" IS NULL OR "user_id" = ?)`,
      sharedPantry ? [newName, oldName] : [newName, oldName, userId]
    );

    // Propagate rename to all existing pantry items
    await AppDataSource.query(
      sharedPantry
        ? `UPDATE "pantry_items" SET "location" = ? WHERE LOWER("location") = LOWER(?)`
        : `UPDATE "pantry_items" SET "location" = ? WHERE LOWER("location") = LOWER(?) AND "user_id" = ?`,
      sharedPantry ? [newName, oldName] : [newName, oldName, userId]
    );

    return { success: true, name: newName };
  }

  async deleteLocation(
    userId: string,
    rawName: string,
    rawTransferTo?: string
  ): Promise<{ success: boolean }> {
    await this.initializeLocations();
    const name = rawName?.trim();
    if (!name) throw new Error('Location name is required');

    const sharedPantry = await SystemSettingsService.isSharedPantryEnabled();
    const transferTo = rawTransferTo?.trim();

    if (transferTo && transferTo.toLowerCase() !== name.toLowerCase()) {
      // Re-assign items to transferTo location
      await AppDataSource.query(
        sharedPantry
          ? `UPDATE "pantry_items" SET "location" = ? WHERE LOWER("location") = LOWER(?)`
          : `UPDATE "pantry_items" SET "location" = ? WHERE LOWER("location") = LOWER(?) AND "user_id" = ?`,
        sharedPantry ? [transferTo, name] : [transferTo, name, userId]
      );
    }

    // Delete location record
    await AppDataSource.query(
      sharedPantry
        ? `DELETE FROM "pantry_locations" WHERE LOWER("name") = LOWER(?)`
        : `DELETE FROM "pantry_locations" WHERE LOWER("name") = LOWER(?) AND ("user_id" IS NULL OR "user_id" = ?)`,
      sharedPantry ? [name] : [name, userId]
    );

    return { success: true };
  }
}

