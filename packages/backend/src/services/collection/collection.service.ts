import { AppDataSource } from '../../db/data-source';
import { RecipeCollection } from '../../db/entities/RecipeCollection';
import { RecipeCollectionItem } from '../../db/entities/RecipeCollectionItem';
import { AppError } from '../../api/middleware';
import { SystemSettingsService } from '../settings/system-settings.service';
import { RecipeService } from '../recipe/recipe.service';

export interface CreateCollectionDto {
  name: string;
  description?: string;
}

export interface UpdateCollectionDto {
  name?: string;
  description?: string;
}

export class CollectionService {
  private get collectionRepo() {
    return AppDataSource.getRepository(RecipeCollection);
  }

  private get itemRepo() {
    return AppDataSource.getRepository(RecipeCollectionItem);
  }

  /**
   * When sharedCollections is enabled, consolidates multiple per-user Favorites
   * collections into a single shared Favorites collection so users see one unified
   * Favorites list without losing any favorited recipes.
   */
  private async getOrConsolidateSharedFavorites(userId?: string): Promise<RecipeCollection | null> {
    const allFavorites = await this.collectionRepo.find({
      where: { isFavorites: true },
      order: { createdAt: 'ASC' },
    });

    if (allFavorites.length === 0) {
      if (!userId) return null;
      const created = this.collectionRepo.create({
        userId,
        name: 'Favorites',
        isFavorites: true,
      });
      return this.collectionRepo.save(created);
    }

    const primary = allFavorites[0];
    if (allFavorites.length > 1) {
      const primaryItems = await this.itemRepo.find({ where: { collectionId: primary.id } });
      const seenRecipeIds = new Set(primaryItems.map((i) => i.recipeId));

      for (const extra of allFavorites.slice(1)) {
        const extraItems = await this.itemRepo.find({ where: { collectionId: extra.id } });
        for (const item of extraItems) {
          if (!seenRecipeIds.has(item.recipeId)) {
            seenRecipeIds.add(item.recipeId);
            await this.itemRepo.save(
              this.itemRepo.create({
                collectionId: primary.id,
                recipeId: item.recipeId,
              })
            );
          }
        }
        await this.collectionRepo.remove(extra);
      }
    }

    return primary;
  }

  async findAll(userId: string): Promise<(RecipeCollection & { recipeCount: number })[]> {
    const sharedCollections = await SystemSettingsService.isSharedCollectionsEnabled();

    if (sharedCollections) {
      await this.getOrConsolidateSharedFavorites();
    }

    const collections = await this.collectionRepo.find({
      where: sharedCollections ? undefined : { userId },
      order: { isFavorites: 'DESC', createdAt: 'DESC' },
    });

    const counts = await this.itemRepo
      .createQueryBuilder('item')
      .select('item.collectionId', 'collectionId')
      .addSelect('COUNT(item.id)', 'count')
      .where('item.collectionId IN (:...ids)', {
        ids: collections.length > 0 ? collections.map((c) => c.id) : ['00000000-0000-0000-0000-000000000000'],
      })
      .groupBy('item.collectionId')
      .getRawMany<{ collectionId: string; count: string }>();

    const countMap = counts.reduce<Record<string, number>>((acc, row) => {
      acc[row.collectionId] = parseInt(row.count, 10);
      return acc;
    }, {});

    return collections.map((c) => Object.assign(c, { recipeCount: countMap[c.id] ?? 0 }));
  }

  async findById(userId: string, collectionId: string): Promise<RecipeCollection> {
    const sharedCollections = await SystemSettingsService.isSharedCollectionsEnabled();
    const showAuthor = await SystemSettingsService.isShowRecipeAuthorEnabled();

    const collection = await this.collectionRepo.findOne({
      where: { id: collectionId },
      relations: showAuthor
        ? ['items', 'items.recipe', 'items.recipe.ingredients', 'items.recipe.user']
        : ['items', 'items.recipe', 'items.recipe.ingredients'],
    });

    if (!collection) {
      throw new AppError(404, 'Collection not found');
    }

    if (!sharedCollections && collection.userId !== userId) {
      throw new AppError(404, 'Collection not found');
    }

    if (collection.items?.length) {
      for (const item of collection.items) {
        if (item.recipe) {
          RecipeService.formatRecipeWithAuthor(item.recipe, showAuthor);
        }
      }
    }

    return collection;
  }

  async create(userId: string, dto: CreateCollectionDto): Promise<RecipeCollection> {
    const collection = this.collectionRepo.create({
      userId,
      name: dto.name,
      description: dto.description,
      isFavorites: false,
    });
    return this.collectionRepo.save(collection);
  }

  async update(userId: string, collectionId: string, dto: UpdateCollectionDto): Promise<RecipeCollection> {
    const sharedCollections = await SystemSettingsService.isSharedCollectionsEnabled();
    const collection = await this.collectionRepo.findOne({ where: { id: collectionId } });

    if (!collection) {
      throw new AppError(404, 'Collection not found');
    }

    if (!sharedCollections && collection.userId !== userId) {
      throw new AppError(404, 'Collection not found');
    }

    if (collection.isFavorites) {
      throw new AppError(400, 'Cannot modify the Favorites collection');
    }

    if (dto.name !== undefined) collection.name = dto.name;
    if (dto.description !== undefined) collection.description = dto.description;

    return this.collectionRepo.save(collection);
  }

  async delete(userId: string, collectionId: string): Promise<void> {
    const sharedCollections = await SystemSettingsService.isSharedCollectionsEnabled();
    const collection = await this.collectionRepo.findOne({ where: { id: collectionId } });

    if (!collection) {
      throw new AppError(404, 'Collection not found');
    }

    if (!sharedCollections && collection.userId !== userId) {
      throw new AppError(404, 'Collection not found');
    }

    if (collection.isFavorites) {
      throw new AppError(400, 'Cannot delete the Favorites collection');
    }

    await this.collectionRepo.remove(collection);
  }

  async addRecipe(userId: string, collectionId: string, recipeId: string): Promise<RecipeCollectionItem> {
    const sharedCollections = await SystemSettingsService.isSharedCollectionsEnabled();
    const collection = await this.collectionRepo.findOne({ where: { id: collectionId } });

    if (!collection) {
      throw new AppError(404, 'Collection not found');
    }

    if (!sharedCollections && collection.userId !== userId) {
      throw new AppError(404, 'Collection not found');
    }

    const existing = await this.itemRepo.findOne({ where: { collectionId, recipeId } });
    if (existing) {
      return existing;
    }

    const item = this.itemRepo.create({ collectionId, recipeId });
    return this.itemRepo.save(item);
  }

  async removeRecipe(userId: string, collectionId: string, recipeId: string): Promise<void> {
    const sharedCollections = await SystemSettingsService.isSharedCollectionsEnabled();
    const collection = await this.collectionRepo.findOne({ where: { id: collectionId } });

    if (!collection) {
      throw new AppError(404, 'Collection not found');
    }

    if (!sharedCollections && collection.userId !== userId) {
      throw new AppError(404, 'Collection not found');
    }

    await this.itemRepo.delete({ collectionId, recipeId });
  }

  async getOrCreateFavorites(userId: string): Promise<RecipeCollection> {
    const sharedCollections = await SystemSettingsService.isSharedCollectionsEnabled();
    if (sharedCollections) {
      const sharedFav = await this.getOrConsolidateSharedFavorites(userId);
      if (sharedFav) return sharedFav;
    }

    const existing = await this.collectionRepo.findOne({ where: { userId, isFavorites: true } });

    if (existing) {
      return existing;
    }

    const favorites = this.collectionRepo.create({
      userId,
      name: 'Favorites',
      isFavorites: true,
    });
    return this.collectionRepo.save(favorites);
  }

  async toggleFavorite(userId: string, recipeId: string): Promise<{ isFavorite: boolean }> {
    const favorites = await this.getOrCreateFavorites(userId);

    const existing = await this.itemRepo.findOne({ where: { collectionId: favorites.id, recipeId } });

    if (existing) {
      await this.itemRepo.remove(existing);
      return { isFavorite: false };
    }

    const item = this.itemRepo.create({ collectionId: favorites.id, recipeId });
    await this.itemRepo.save(item);
    return { isFavorite: true };
  }

  async isFavorite(userId: string, recipeId: string): Promise<boolean> {
    const sharedCollections = await SystemSettingsService.isSharedCollectionsEnabled();
    if (sharedCollections) {
      const favorites = await this.getOrConsolidateSharedFavorites();
      if (!favorites) return false;
      const item = await this.itemRepo.findOne({ where: { collectionId: favorites.id, recipeId } });
      return item !== null;
    }

    const favorites = await this.collectionRepo.findOne({ where: { userId, isFavorites: true } });

    if (!favorites) {
      return false;
    }

    const item = await this.itemRepo.findOne({ where: { collectionId: favorites.id, recipeId } });
    return item !== null;
  }
}
