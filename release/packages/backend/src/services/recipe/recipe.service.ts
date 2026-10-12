import { Repository, In } from 'typeorm';
import { AppDataSource } from '../../db/data-source';
import { Recipe, Ingredient } from '../../db/entities';
import { RecipeCreateDto, RecipeUpdateDto, RecipeSearchQuery } from '@nommable/shared';
import { AppError } from '../../api/middleware';
import { GamificationService } from '../gamification/gamification.service';

export class RecipeService {
  private recipeRepo: Repository<Recipe>;
  private ingredientRepo: Repository<Ingredient>;
  private gamificationService: GamificationService;

  constructor() {
    this.recipeRepo = AppDataSource.getRepository(Recipe);
    this.ingredientRepo = AppDataSource.getRepository(Ingredient);
    this.gamificationService = new GamificationService();
  }

  async create(userId: string, dto: RecipeCreateDto, isAiGenerated = false): Promise<Recipe> {
    const recipe = this.recipeRepo.create({
      userId,
      title: dto.title,
      description: dto.description,
      servings: dto.servings,
      prepTime: dto.prepTime,
      cookTime: dto.cookTime,
      totalTime: (dto.prepTime || 0) + (dto.cookTime || 0),
      difficulty: dto.difficulty,
      imageUrl: dto.imageUrl,
      sourceUrl: dto.sourceUrl,
      notes: dto.notes,
      instructions: dto.instructions,
      categories: dto.categories,
      tags: dto.tags,
      nutrition: dto.nutrition,
      isAiGenerated,
    });

    await this.recipeRepo.save(recipe);

    // Create ingredients
    if (dto.ingredients?.length) {
      const ingredients = dto.ingredients.map((ing) =>
        this.ingredientRepo.create({
          recipeId: recipe.id,
          quantity: ing.quantity,
          unit: ing.unit,
          name: ing.name,
          notes: ing.notes,
          section: ing.section,
          order: ing.order,
        })
      );
      await this.ingredientRepo.save(ingredients);
    }

    // Track recipe creation for achievements (includes manual, AI-generated, and imported recipes)
    await this.gamificationService.recordRecipeCreated(userId);

    return this.findById(recipe.id);
  }

  async findAll(query?: RecipeSearchQuery): Promise<Recipe[]> {
    const qb = this.recipeRepo
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.ingredients', 'ingredients')
      .orderBy('recipe.createdAt', 'DESC');

    if (query?.query) {
      qb.andWhere(
        '(recipe.title ILIKE :search OR recipe.description ILIKE :search OR recipe.tags::text ILIKE :search)',
        { search: `%${query.query}%` }
      );
    }

    if (query?.difficulty) {
      qb.andWhere('recipe.difficulty = :difficulty', { difficulty: query.difficulty });
    }

    if (query?.maxPrepTime) {
      qb.andWhere('recipe.prepTime <= :maxPrepTime', { maxPrepTime: query.maxPrepTime });
    }

    if (query?.maxCookTime) {
      qb.andWhere('recipe.cookTime <= :maxCookTime', { maxCookTime: query.maxCookTime });
    }

    if (query?.categories?.length) {
      qb.andWhere('recipe.categories && :categories', { categories: query.categories });
    }

    if (query?.tags?.length) {
      qb.andWhere('recipe.tags && :tags', { tags: query.tags });
    }

    return qb.getMany();
  }

  async findById(id: string): Promise<Recipe> {
    const recipe = await this.recipeRepo.findOne({
      where: { id },
      relations: ['ingredients'],
      order: { ingredients: { order: 'ASC' } },
    });

    if (!recipe) {
      throw new AppError(404, 'Recipe not found');
    }

    return recipe;
  }

  async update(id: string, dto: RecipeUpdateDto): Promise<Recipe> {
    const recipe = await this.findById(id);

    // Update recipe fields
    if (dto.title !== undefined) recipe.title = dto.title;
    if (dto.description !== undefined) recipe.description = dto.description;
    if (dto.servings !== undefined) recipe.servings = dto.servings;
    if (dto.prepTime !== undefined) recipe.prepTime = dto.prepTime;
    if (dto.cookTime !== undefined) recipe.cookTime = dto.cookTime;
    if (dto.difficulty !== undefined) recipe.difficulty = dto.difficulty;
    if (dto.imageUrl !== undefined) recipe.imageUrl = dto.imageUrl;
    if (dto.sourceUrl !== undefined) recipe.sourceUrl = dto.sourceUrl;
    if (dto.notes !== undefined) recipe.notes = dto.notes;
    if (dto.instructions !== undefined) recipe.instructions = dto.instructions;
    if (dto.categories !== undefined) recipe.categories = dto.categories;
    if (dto.tags !== undefined) recipe.tags = dto.tags;
    if (dto.nutrition !== undefined) recipe.nutrition = dto.nutrition;

    if (dto.prepTime !== undefined || dto.cookTime !== undefined) {
      recipe.totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
    }

    await this.recipeRepo.save(recipe);

    // Update ingredients if provided
    if (dto.ingredients !== undefined) {
      // Delete old ingredients
      await this.ingredientRepo.delete({ recipeId: id });

      // Create new ingredients
      if (dto.ingredients.length) {
        const ingredients = dto.ingredients.map((ing) =>
          this.ingredientRepo.create({
            recipeId: id,
            quantity: ing.quantity,
            unit: ing.unit,
            name: ing.name,
            notes: ing.notes,
            section: ing.section,
            order: ing.order,
          })
        );
        await this.ingredientRepo.save(ingredients);
      }
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const recipe = await this.findById(id);
    await this.recipeRepo.remove(recipe);
  }

  async bulkDelete(ids: string[]): Promise<number> {
    const recipes = await this.recipeRepo.find({
      where: {
        id: In(ids),
      },
    });

    if (recipes.length === 0) {
      return 0;
    }

    await this.recipeRepo.remove(recipes);
    return recipes.length;
  }

  async bulkUpdate(ids: string[], updates: { tags?: string[]; categories?: string[] }): Promise<number> {
    const recipes = await this.recipeRepo.find({
      where: {
        id: In(ids),
      },
    });

    if (recipes.length === 0) {
      return 0;
    }

    // Update each recipe
    recipes.forEach(recipe => {
      if (updates.tags !== undefined) {
        // Merge tags (add new ones, keep existing)
        const existingTags = recipe.tags || [];
        recipe.tags = Array.from(new Set([...existingTags, ...updates.tags]));
      }
      if (updates.categories !== undefined) {
        // Merge categories (add new ones, keep existing)
        const existingCategories = recipe.categories || [];
        recipe.categories = Array.from(new Set([...existingCategories, ...updates.categories]));
      }
    });

    await this.recipeRepo.save(recipes);
    return recipes.length;
  }
}
