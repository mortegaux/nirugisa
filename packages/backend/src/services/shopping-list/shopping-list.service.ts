import { Repository, In } from 'typeorm';
import { AppDataSource } from '../../db/data-source';
import { ShoppingList, ShoppingListItem, MealPlan } from '../../db/entities';
import {
  ShoppingListCreateDto,
  ShoppingListUpdateDto,
  ShoppingListSearchQuery,
  PaginatedResponse,
  PAGINATION_DEFAULTS,
} from '@nommable/shared';
import { AppError } from '../../api/middleware';
import { SystemSettingsService } from '../settings/system-settings.service';

export class ShoppingListService {
  private shoppingListRepo: Repository<ShoppingList>;
  private shoppingListItemRepo: Repository<ShoppingListItem>;
  private mealPlanRepo: Repository<MealPlan>;

  constructor() {
    this.shoppingListRepo = AppDataSource.getRepository(ShoppingList);
    this.shoppingListItemRepo = AppDataSource.getRepository(ShoppingListItem);
    this.mealPlanRepo = AppDataSource.getRepository(MealPlan);
  }

  async create(userId: string, dto: ShoppingListCreateDto): Promise<ShoppingList> {
    const shoppingList = this.shoppingListRepo.create({
      userId,
      name: dto.name,
      mealPlanId: dto.mealPlanId,
    });

    await this.shoppingListRepo.save(shoppingList);

    // Create items
    if (dto.items?.length) {
      const items = dto.items.map((item) =>
        this.shoppingListItemRepo.create({
          shoppingListId: shoppingList.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          checked: item.checked || false,
          notes: item.notes,
          recipeId: item.recipeId,
          order: item.order,
        })
      );
      await this.shoppingListItemRepo.save(items);
    }

    return this.findById(shoppingList.id, userId);
  }

  async createFromMealPlan(userId: string, mealPlanId: string): Promise<ShoppingList> {
    const sharedMealPlans = await SystemSettingsService.isSharedMealPlansEnabled();
    // Verify meal plan exists
    const mealPlan = await this.mealPlanRepo.findOne({
      where: sharedMealPlans ? { id: mealPlanId } : { id: mealPlanId, userId },
      relations: ['meals', 'meals.recipe', 'meals.recipe.ingredients'],
    });

    if (!mealPlan) {
      throw new AppError(404, 'Meal plan not found');
    }

    // Create shopping list
    const shoppingList = this.shoppingListRepo.create({
      userId,
      name: `Shopping List for ${mealPlan.name}`,
      mealPlanId,
    });

    await this.shoppingListRepo.save(shoppingList);

    // Aggregate ingredients from all recipes in the meal plan
    const ingredientMap = new Map<string, { quantity: number; unit: string; recipeId: string }>();

    for (const meal of mealPlan.meals) {
      if (!meal.recipe?.ingredients) continue;

      const servingMultiplier = meal.servings / (meal.recipe.servings || 1);

      for (const ing of meal.recipe.ingredients) {
        const key = `${ing.name.toLowerCase()}-${ing.unit || ''}`;
        const existing = ingredientMap.get(key);

        if (existing && existing.unit === ing.unit) {
          existing.quantity += (ing.quantity || 0) * servingMultiplier;
        } else {
          ingredientMap.set(key, {
            quantity: (ing.quantity || 0) * servingMultiplier,
            unit: ing.unit || '',
            recipeId: meal.recipe.id,
          });
        }
      }
    }

    // Create shopping list items
    const items: ShoppingListItem[] = [];
    let order = 0;

    for (const [key, data] of ingredientMap.entries()) {
      const name = key.split('-')[0];
      items.push(
        this.shoppingListItemRepo.create({
          shoppingListId: shoppingList.id,
          name,
          quantity: Math.round(data.quantity * 100) / 100, // Round to 2 decimals
          unit: data.unit,
          checked: false,
          recipeId: data.recipeId,
          order: order++,
        })
      );
    }

    if (items.length) {
      await this.shoppingListItemRepo.save(items);
    }

    return this.findById(shoppingList.id, userId);
  }

  async findAll(
    userId: string,
    query: ShoppingListSearchQuery = {}
  ): Promise<PaginatedResponse<ShoppingList>> {
    const page = Math.max(1, query.page ?? PAGINATION_DEFAULTS.page);
    const pageSize = Math.min(
      query.pageSize ?? PAGINATION_DEFAULTS.pageSize,
      PAGINATION_DEFAULTS.maxPageSize
    );
    const skip = (page - 1) * pageSize;
    const sharedShoppingLists = await SystemSettingsService.isSharedShoppingListsEnabled();

    const qb = this.shoppingListRepo
      .createQueryBuilder('shoppingList')
      .select('shoppingList.id')
      .orderBy('shoppingList.createdAt', 'DESC');

    if (!sharedShoppingLists) {
      qb.where('shoppingList.userId = :userId', { userId });
    }

    if (query.query) {
      qb.andWhere('LOWER(shoppingList.name) LIKE LOWER(:search)', { search: `%${query.query}%` });
    }

    const [idResults, total] = await qb.skip(skip).take(pageSize).getManyAndCount();
    const ids = idResults.map((sl) => sl.id);

    if (ids.length === 0) {
      return { data: [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    const data = await this.shoppingListRepo.find({
      where: { id: In(ids) },
      relations: ['items', 'mealPlan'],
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(id: string, userId: string): Promise<ShoppingList> {
    const sharedShoppingLists = await SystemSettingsService.isSharedShoppingListsEnabled();
    const shoppingList = await this.shoppingListRepo.findOne({
      where: sharedShoppingLists ? { id } : { id, userId },
      relations: ['items', 'mealPlan'],
      order: { items: { order: 'ASC' } },
    });

    if (!shoppingList) {
      throw new AppError(404, 'Shopping list not found');
    }

    return shoppingList;
  }

  async update(id: string, userId: string, dto: ShoppingListUpdateDto): Promise<ShoppingList> {
    const shoppingList = await this.findById(id, userId);

    if (dto.name !== undefined) shoppingList.name = dto.name;
    if (dto.mealPlanId !== undefined) shoppingList.mealPlanId = dto.mealPlanId;

    await this.shoppingListRepo.save(shoppingList);

    // Update items if provided
    if (dto.items !== undefined) {
      // Delete old items
      await this.shoppingListItemRepo.delete({ shoppingListId: id });

      // Create new items
      if (dto.items.length) {
        const items = dto.items.map((item) =>
          this.shoppingListItemRepo.create({
            shoppingListId: id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category,
            checked: item.checked || false,
            notes: item.notes,
            recipeId: item.recipeId,
            order: item.order,
          })
        );
        await this.shoppingListItemRepo.save(items);
      }
    }

    return this.findById(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const shoppingList = await this.findById(id, userId);
    await this.shoppingListRepo.remove(shoppingList);
  }

  async toggleItem(listId: string, userId: string, itemId: string): Promise<ShoppingList> {
    await this.findById(listId, userId);

    const item = await this.shoppingListItemRepo.findOne({
      where: { id: itemId, shoppingListId: listId },
    });

    if (!item) {
      throw new AppError(404, 'Item not found');
    }

    item.checked = !item.checked;
    await this.shoppingListItemRepo.save(item);

    return this.findById(listId, userId);
  }
}
