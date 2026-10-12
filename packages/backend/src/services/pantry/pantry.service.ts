import { AppDataSource } from '../../db/data-source';
import { PantryItem } from '../../db/entities';
import type { PantryItemCreateDto, PantryItemUpdateDto } from '@nommable/shared';
import { SystemSettingsService } from '../settings/system-settings.service';

export class PantryService {
  private pantryRepo = AppDataSource.getRepository(PantryItem);

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

    Object.assign(item, data);
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
}
