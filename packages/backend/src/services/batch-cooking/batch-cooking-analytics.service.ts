import { Repository } from 'typeorm';
import { AppDataSource } from '../../db/data-source';
import { BatchCookingPlan } from '../../db/entities';
import { SystemSettingsService } from '../settings/system-settings.service';

export interface BatchCookingStats {
  totalPlans: number;
  completedPlans: number;
  totalBatches: number;
  totalServings: number;
  mostBatchedRecipes: Array<{
    recipeId: string;
    recipeTitle: string;
    timesCooked: number;
    totalBatches: number;
  }>;
  storageMethodBreakdown: {
    refrigerate: number;
    freeze: number;
    pantry: number;
  };
  estimatedMoneySaved: number;
  estimatedTimeSaved: number; // in hours
}

export class BatchCookingAnalyticsService {
  private batchCookingRepo: Repository<BatchCookingPlan>;

  constructor() {
    this.batchCookingRepo = AppDataSource.getRepository(BatchCookingPlan);
  }

  async getStats(userId: string): Promise<BatchCookingStats> {
    const sharedBatchCooking = await SystemSettingsService.isSharedBatchCookingEnabled();
    const plans = await this.batchCookingRepo.find({
      where: sharedBatchCooking ? undefined : { userId },
      relations: ['recipe'],
    });

    const completedPlans = plans.filter(p => p.status === 'completed');

    // Calculate total batches and servings
    const totalBatches = plans.reduce((sum, p) => sum + p.batches, 0);
    const totalServings = plans.reduce((sum, p) => sum + (p.batches * p.servingsPerBatch), 0);

    // Calculate most batched recipes
    const recipeStats = new Map<string, {
      recipeId: string;
      recipeTitle: string;
      timesCooked: number;
      totalBatches: number;
    }>();

    plans.forEach(plan => {
      const existing = recipeStats.get(plan.recipeId);
      if (existing) {
        existing.timesCooked += 1;
        existing.totalBatches += plan.batches;
      } else {
        recipeStats.set(plan.recipeId, {
          recipeId: plan.recipeId,
          recipeTitle: plan.recipe.title,
          timesCooked: 1,
          totalBatches: plan.batches,
        });
      }
    });

    const mostBatchedRecipes = Array.from(recipeStats.values())
      .sort((a, b) => b.timesCooked - a.timesCooked)
      .slice(0, 5);

    // Calculate storage method breakdown
    const storageMethodBreakdown = {
      refrigerate: plans.filter(p => p.storageMethod === 'refrigerate').length,
      freeze: plans.filter(p => p.storageMethod === 'freeze').length,
      pantry: plans.filter(p => p.storageMethod === 'pantry').length,
    };

    // Estimate money saved (assuming $8 savings per serving vs restaurant/takeout)
    const estimatedMoneySaved = Math.round(totalServings * 8);

    // Estimate time saved (assuming batch cooking saves 30% time per additional batch)
    // Each batch after the first saves ~0.3 hours
    const estimatedTimeSaved = Math.round((totalBatches - plans.length) * 0.3 * 10) / 10;

    return {
      totalPlans: plans.length,
      completedPlans: completedPlans.length,
      totalBatches,
      totalServings,
      mostBatchedRecipes,
      storageMethodBreakdown,
      estimatedMoneySaved,
      estimatedTimeSaved,
    };
  }
}
