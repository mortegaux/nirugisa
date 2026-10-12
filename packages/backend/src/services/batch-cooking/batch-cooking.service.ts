import { Repository } from 'typeorm';
import { AppDataSource } from '../../db/data-source';
import { BatchCookingPlan, Recipe } from '../../db/entities';
import { SystemSettingsService } from '../settings/system-settings.service';

export interface BatchCookingPlanCreateDto {
  recipeId: string;
  name: string;
  description?: string;
  cookingDate: Date;
  batches: number;
  servingsPerBatch: number;
  storageMethod?: 'refrigerate' | 'freeze' | 'pantry';
  storageDuration?: number;
  reheatingInstructions?: string;
  prepNotes?: string;
}

export interface BatchCookingSuggestion {
  recipe: Recipe;
  batchFriendlyScore: number;
  reasons: string[];
  suggestedBatches: number;
  storageRecommendation: 'refrigerate' | 'freeze' | 'pantry';
  storageDuration: number;
}

export class BatchCookingService {
  private batchCookingRepo: Repository<BatchCookingPlan>;
  private recipeRepo: Repository<Recipe>;

  constructor() {
    this.batchCookingRepo = AppDataSource.getRepository(BatchCookingPlan);
    this.recipeRepo = AppDataSource.getRepository(Recipe);
  }

  async create(userId: string, dto: BatchCookingPlanCreateDto): Promise<BatchCookingPlan> {
    const sharedRecipes = await SystemSettingsService.isSharedRecipesEnabled();
    // Get recipe to generate prep checklist (shared catalog or scoped to user)
    const recipe = await this.recipeRepo.findOne({
      where: sharedRecipes ? { id: dto.recipeId } : { id: dto.recipeId, userId },
      relations: ['ingredients'],
    });

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Generate prep checklist from recipe
    const prepChecklist = this.generatePrepChecklist(recipe, dto.batches);

    // Generate reheating instructions if not provided
    const reheatingInstructions = dto.reheatingInstructions ||
      this.generateReheatingInstructions(recipe, dto.storageMethod);

    const plan = this.batchCookingRepo.create({
      userId,
      ...dto,
      prepChecklist,
      reheatingInstructions,
      status: 'planned',
    });

    await this.batchCookingRepo.save(plan);

    return this.getById(plan.id, userId);
  }

  async getAll(userId: string): Promise<BatchCookingPlan[]> {
    const sharedBatchCooking = await SystemSettingsService.isSharedBatchCookingEnabled();
    const plans = await this.batchCookingRepo.find({
      where: sharedBatchCooking ? undefined : { userId },
      relations: ['recipe', 'recipe.ingredients'],
      order: { cookingDate: 'ASC' },
    });

    return plans;
  }

  async getById(id: string, userId: string): Promise<BatchCookingPlan> {
    const sharedBatchCooking = await SystemSettingsService.isSharedBatchCookingEnabled();
    const plan = await this.batchCookingRepo.findOne({
      where: sharedBatchCooking ? { id } : { id, userId },
      relations: ['recipe', 'recipe.ingredients'],
    });

    if (!plan) {
      throw new Error('Batch cooking plan not found');
    }

    return plan;
  }

  async update(
    id: string,
    userId: string,
    dto: Partial<BatchCookingPlanCreateDto>
  ): Promise<BatchCookingPlan> {
    const plan = await this.getById(id, userId);

    Object.assign(plan, dto);
    await this.batchCookingRepo.save(plan);

    return this.getById(id, userId);
  }

  async updateStatus(
    id: string,
    userId: string,
    status: 'planned' | 'in-progress' | 'completed'
  ): Promise<BatchCookingPlan> {
    const plan = await this.getById(id, userId);

    plan.status = status;
    await this.batchCookingRepo.save(plan);

    return this.getById(id, userId);
  }

  async updateChecklist(
    id: string,
    userId: string,
    checklist: Array<{ task: string; completed: boolean; order: number }>
  ): Promise<BatchCookingPlan> {
    const plan = await this.getById(id, userId);

    plan.prepChecklist = checklist;
    await this.batchCookingRepo.save(plan);

    return this.getById(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const plan = await this.getById(id, userId);
    await this.batchCookingRepo.remove(plan);
  }

  async getBatchCookingSuggestions(userId: string): Promise<BatchCookingSuggestion[]> {
    const sharedRecipes = await SystemSettingsService.isSharedRecipesEnabled();
    const recipes = await this.recipeRepo.find({
      where: sharedRecipes ? undefined : { userId },
      relations: ['ingredients'],
    });

    const suggestions: BatchCookingSuggestion[] = [];

    for (const recipe of recipes) {
      const score = this.calculateBatchFriendlyScore(recipe);

      if (score >= 60) { // Only suggest recipes that score 60% or higher
        const reasons = this.getBatchFriendlyReasons(recipe);
        const storageRecommendation = this.getStorageRecommendation(recipe);
        const storageDuration = this.getStorageDuration(storageRecommendation);
        const suggestedBatches = this.getSuggestedBatches(recipe);

        suggestions.push({
          recipe,
          batchFriendlyScore: score,
          reasons,
          suggestedBatches,
          storageRecommendation,
          storageDuration,
        });
      }
    }

    // Sort by score descending
    suggestions.sort((a, b) => b.batchFriendlyScore - a.batchFriendlyScore);

    return suggestions;
  }

  private calculateBatchFriendlyScore(recipe: Recipe): number {
    let score = 0;

    // Check tags for batch-friendly indicators
    const tags = recipe.tags || [];
    const categories = recipe.categories || [];

    if (tags.includes('Freezer-Friendly')) score += 30;
    if (tags.includes('One-Pot')) score += 20;
    if (tags.includes('Make-Ahead')) score += 25;

    // Soups, stews, casseroles are great for batch cooking
    const batchFriendlyCategories = ['Soup', 'Stew', 'Casserole', 'Curry', 'Chili', 'Pasta Bake'];
    const matchingCategories = categories.filter(cat =>
      batchFriendlyCategories.some(friendly => cat.includes(friendly))
    );
    score += matchingCategories.length * 15;

    // Longer cook times often indicate batch-friendly recipes
    if (recipe.cookTime && recipe.cookTime > 30) score += 10;
    if (recipe.cookTime && recipe.cookTime > 60) score += 15;

    // Recipes with more servings are easier to batch
    if (recipe.servings && recipe.servings >= 6) score += 10;

    return Math.min(score, 100); // Cap at 100
  }

  private getBatchFriendlyReasons(recipe: Recipe): string[] {
    const reasons: string[] = [];
    const tags = recipe.tags || [];
    const categories = recipe.categories || [];

    if (tags.includes('Freezer-Friendly')) {
      reasons.push('Freezes well for long-term storage');
    }
    if (tags.includes('One-Pot')) {
      reasons.push('Easy one-pot cooking - minimal cleanup');
    }
    if (tags.includes('Make-Ahead')) {
      reasons.push('Designed to be made ahead of time');
    }

    const batchFriendlyCategories = ['Soup', 'Stew', 'Casserole', 'Curry', 'Chili'];
    const matchingCategories = categories.filter(cat =>
      batchFriendlyCategories.some(friendly => cat.includes(friendly))
    );
    if (matchingCategories.length > 0) {
      reasons.push(`${matchingCategories.join(', ')} recipes scale well`);
    }

    if (recipe.cookTime && recipe.cookTime > 60) {
      reasons.push('Long cooking time - efficient to make multiple batches');
    }

    return reasons;
  }

  private getStorageRecommendation(recipe: Recipe): 'refrigerate' | 'freeze' | 'pantry' {
    const tags = recipe.tags || [];
    const categories = recipe.categories || [];

    if (tags.includes('Freezer-Friendly')) {
      return 'freeze';
    }

    // Soups, stews, casseroles typically freeze well
    const freezableCat = ['Soup', 'Stew', 'Casserole', 'Curry', 'Chili', 'Sauce'];
    if (categories.some(cat => freezableCat.some(f => cat.includes(f)))) {
      return 'freeze';
    }

    // Salads, sandwiches typically refrigerate only
    const refrigerateCat = ['Salad', 'Sandwich'];
    if (categories.some(cat => refrigerateCat.some(r => cat.includes(r)))) {
      return 'refrigerate';
    }

    // Default to refrigerate
    return 'refrigerate';
  }

  private getStorageDuration(storageMethod: 'refrigerate' | 'freeze' | 'pantry'): number {
    switch (storageMethod) {
      case 'freeze':
        return 90; // 3 months
      case 'refrigerate':
        return 5; // 5 days
      case 'pantry':
        return 7; // 1 week
      default:
        return 5;
    }
  }

  private getSuggestedBatches(recipe: Recipe): number {
    // Suggest more batches for recipes that are time-consuming
    if (recipe.cookTime && recipe.cookTime > 90) {
      return 4; // 4 batches for very long recipes
    }
    if (recipe.cookTime && recipe.cookTime > 60) {
      return 3; // 3 batches for long recipes
    }
    return 2; // 2 batches by default
  }

  private generatePrepChecklist(recipe: Recipe, batches: number): Array<{
    task: string;
    completed: boolean;
    order: number;
  }> {
    const checklist: Array<{ task: string; completed: boolean; order: number }> = [];
    let order = 1;

    // Gather ingredients
    checklist.push({
      task: `Gather all ingredients (multiplied by ${batches})`,
      completed: false,
      order: order++,
    });

    // Prep containers
    checklist.push({
      task: `Prepare ${batches} storage containers`,
      completed: false,
      order: order++,
    });

    // Ingredient-specific prep
    const ingredients = recipe.ingredients || [];
    const vegIngredients = ingredients.filter(ing =>
      ['onion', 'garlic', 'carrot', 'celery', 'pepper'].some(v =>
        ing.name.toLowerCase().includes(v)
      )
    );

    if (vegIngredients.length > 0) {
      checklist.push({
        task: 'Chop and prepare vegetables',
        completed: false,
        order: order++,
      });
    }

    const meatIngredients = ingredients.filter(ing =>
      ['chicken', 'beef', 'pork', 'turkey', 'meat'].some(m =>
        ing.name.toLowerCase().includes(m)
      )
    );

    if (meatIngredients.length > 0) {
      checklist.push({
        task: 'Prepare and season meat',
        completed: false,
        order: order++,
      });
    }

    // Cooking steps
    checklist.push({
      task: `Cook ${batches} batches according to recipe`,
      completed: false,
      order: order++,
    });

    // Portioning
    checklist.push({
      task: 'Divide into portions and cool',
      completed: false,
      order: order++,
    });

    // Storage
    checklist.push({
      task: 'Label containers with date and reheating instructions',
      completed: false,
      order: order++,
    });

    checklist.push({
      task: 'Store appropriately (refrigerate or freeze)',
      completed: false,
      order: order++,
    });

    return checklist;
  }

  private generateReheatingInstructions(
    recipe: Recipe,
    storageMethod?: 'refrigerate' | 'freeze' | 'pantry'
  ): string {
    const categories = recipe.categories || [];
    let instructions = '';

    if (storageMethod === 'freeze') {
      instructions += 'From Frozen:\n';
      instructions += '• Thaw overnight in refrigerator for best results\n';
    }

    if (categories.some(cat => ['Soup', 'Stew', 'Chili', 'Curry'].some(c => cat.includes(c)))) {
      instructions += '• Stovetop: Heat over medium heat, stirring occasionally, until heated through (10-15 min)\n';
      instructions += '• Microwave: Heat on high for 3-5 minutes, stirring halfway through\n';
    } else if (categories.some(cat => cat.includes('Casserole'))) {
      instructions += '• Oven: Cover with foil and bake at 350°F for 25-30 minutes\n';
      instructions += '• Microwave: Heat on high for 4-6 minutes, checking and stirring halfway\n';
    } else if (categories.some(cat => ['Pasta', 'Rice'].some(c => cat.includes(c)))) {
      instructions += '• Stovetop: Heat in a pan with a splash of water or broth, stirring gently\n';
      instructions += '• Microwave: Add 1-2 tbsp water, cover, heat for 2-3 minutes\n';
    } else {
      // Generic instructions
      instructions += '• Microwave: Heat on high for 2-4 minutes, stirring halfway through\n';
      instructions += '• Oven: Cover and bake at 350°F for 15-20 minutes\n';
      instructions += '• Stovetop: Heat over medium heat until warmed through\n';
    }

    instructions += '\nTip: Ensure food reaches 165°F internal temperature for food safety.';

    return instructions;
  }

  async createShoppingListFromPlan(planId: string, userId: string): Promise<any> {
    const plan = await this.getById(planId, userId);

    const recipe = await this.recipeRepo.findOne({
      where: { id: plan.recipeId },
      relations: ['ingredients'],
    });

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Calculate with batch multiplier
    const totalServings = plan.batches * plan.servingsPerBatch;
    const servingMultiplier = totalServings / (recipe.servings || 1);

    const items = (recipe.ingredients || []).map((ing, index) => ({
      name: ing.name,
      quantity: (ing.quantity || 0) * servingMultiplier,
      unit: ing.unit || '',
      checked: false,
      recipeId: recipe.id,
      order: index,
      notes: `For ${plan.name}`,
    }));

    return {
      name: `Shopping List: ${plan.name}`,
      items,
      metadata: {
        batchCookingPlanId: plan.id,
        totalServings,
        servingMultiplier
      },
    };
  }
}
