import { AppDataSource } from '../../db/data-source';
import { PantryItem } from '../../db/entities';
import type { PantryItemCreateDto, PantryItemUpdateDto } from '@nommable/shared';

export class PantryService {
  private pantryRepo = AppDataSource.getRepository(PantryItem);

  async getAllItems(): Promise<PantryItem[]> {
    return this.pantryRepo.find({
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  async getItemById(id: string): Promise<PantryItem | null> {
    return this.pantryRepo.findOne({
      where: { id },
    });
  }

  async createItem(userId: string, data: PantryItemCreateDto): Promise<PantryItem> {
    const item = this.pantryRepo.create({
      ...data,
      userId,
    });

    return this.pantryRepo.save(item);
  }

  async updateItem(id: string, data: PantryItemUpdateDto): Promise<PantryItem> {
    const item = await this.getItemById(id);
    if (!item) {
      throw new Error('Pantry item not found');
    }

    Object.assign(item, data);
    return this.pantryRepo.save(item);
  }

  async deleteItem(id: string): Promise<void> {
    const result = await this.pantryRepo.delete({ id });
    if (result.affected === 0) {
      throw new Error('Pantry item not found');
    }
  }

  async getExpiringItems(daysAhead: number = 7): Promise<PantryItem[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.pantryRepo
      .createQueryBuilder('pantry_item')
      .where('pantry_item.expiration_date IS NOT NULL')
      .andWhere('pantry_item.expiration_date <= :futureDate', { futureDate })
      .orderBy('pantry_item.expiration_date', 'ASC')
      .getMany();
  }

  async getLowStockItems(): Promise<PantryItem[]> {
    return this.pantryRepo.find({
      where: { isLowStock: true },
      order: { name: 'ASC' },
    });
  }

  async updateQuantity(id: string, quantityChange: number): Promise<PantryItem> {
    const item = await this.getItemById(id);
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

  async toggleLowStock(id: string): Promise<PantryItem> {
    const item = await this.getItemById(id);
    if (!item) {
      throw new Error('Pantry item not found');
    }

    item.isLowStock = !item.isLowStock;
    return this.pantryRepo.save(item);
  }
}
