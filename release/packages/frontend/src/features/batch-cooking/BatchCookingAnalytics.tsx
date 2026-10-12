import { useState, useEffect } from 'react';
import { batchCookingApi } from '@/services/api';

interface BatchCookingStats {
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
  estimatedTimeSaved: number;
}

export function BatchCookingAnalytics() {
  const [stats, setStats] = useState<BatchCookingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await batchCookingApi.getAnalytics();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <div className="text-4xl font-bold text-primary mb-2">{stats.totalPlans}</div>
          <div className="text-sm text-muted-foreground">Total Plans</div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.completedPlans} completed
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <div className="text-4xl font-bold text-primary mb-2">{stats.totalBatches}</div>
          <div className="text-sm text-muted-foreground">Total Batches</div>
          <div className="text-xs text-muted-foreground mt-1">
            Cooked across all plans
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <div className="text-4xl font-bold text-secondary mb-2">
            ${stats.estimatedMoneySaved.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Money Saved</div>
          <div className="text-xs text-muted-foreground mt-1">
            vs. restaurant/takeout
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <div className="text-4xl font-bold text-secondary mb-2">
            {stats.estimatedTimeSaved}h
          </div>
          <div className="text-sm text-muted-foreground">Time Saved</div>
          <div className="text-xs text-muted-foreground mt-1">
            Through batch cooking
          </div>
        </div>
      </div>

      {/* Total Servings Card */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl border border-primary/20 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Total Servings Prepared
            </div>
            <div className="text-5xl font-bold text-foreground">
              {stats.totalServings.toLocaleString()}
            </div>
          </div>
          <div className="text-6xl">🍽️</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Most Batched Recipes */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">
            Most Batched Recipes
          </h3>
          {stats.mostBatchedRecipes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No recipes batched yet
            </p>
          ) : (
            <div className="space-y-3">
              {stats.mostBatchedRecipes.map((recipe, index) => (
                <div
                  key={recipe.recipeId}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">
                        {recipe.recipeTitle}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {recipe.totalBatches} batches
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">
                      {recipe.timesCooked}x
                    </div>
                    <div className="text-xs text-muted-foreground">cooked</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storage Method Breakdown */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">
            Storage Method Breakdown
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🧊</span>
                  <span className="text-sm font-medium text-foreground">Freeze</span>
                </div>
                <span className="text-sm font-bold text-foreground">
                  {stats.storageMethodBreakdown.freeze}
                </span>
              </div>
              <div className="w-full bg-accent rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      stats.totalPlans > 0
                        ? (stats.storageMethodBreakdown.freeze / stats.totalPlans) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">❄️</span>
                  <span className="text-sm font-medium text-foreground">Refrigerate</span>
                </div>
                <span className="text-sm font-bold text-foreground">
                  {stats.storageMethodBreakdown.refrigerate}
                </span>
              </div>
              <div className="w-full bg-accent rounded-full h-2">
                <div
                  className="bg-secondary h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      stats.totalPlans > 0
                        ? (stats.storageMethodBreakdown.refrigerate / stats.totalPlans) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📦</span>
                  <span className="text-sm font-medium text-foreground">Pantry</span>
                </div>
                <span className="text-sm font-bold text-foreground">
                  {stats.storageMethodBreakdown.pantry}
                </span>
              </div>
              <div className="w-full bg-accent rounded-full h-2">
                <div
                  className="bg-accent-foreground h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      stats.totalPlans > 0
                        ? (stats.storageMethodBreakdown.pantry / stats.totalPlans) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-lg bg-accent/5 border border-accent/20">
            <p className="text-xs text-muted-foreground text-center">
              Money saved estimate assumes $8/serving vs restaurant. Time saved assumes 30% efficiency gain per additional batch.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
