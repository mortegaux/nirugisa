import { Repository } from 'typeorm';
import { AppDataSource } from '../../db/data-source';
import { UserStats, UserAchievement, Recipe, MealPlan, MealPlanRecipe } from '../../db/entities';

export interface AchievementDefinition {
  key: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  category: 'cooking' | 'recipes' | 'streaks' | 'social' | 'milestones';
  target: number;
}

// Predefined achievements
export const ACHIEVEMENTS: Record<string, AchievementDefinition> = {
  first_recipe: {
    key: 'first_recipe',
    name: 'First Recipe',
    description: 'Create your first recipe',
    icon: '📝',
    points: 10,
    category: 'recipes',
    target: 1,
  },
  recipe_collector_5: {
    key: 'recipe_collector_5',
    name: 'Recipe Collector',
    description: 'Create 5 recipes',
    icon: '📚',
    points: 25,
    category: 'recipes',
    target: 5,
  },
  recipe_master_25: {
    key: 'recipe_master_25',
    name: 'Recipe Master',
    description: 'Create 25 recipes',
    icon: '👨‍🍳',
    points: 100,
    category: 'recipes',
    target: 25,
  },
  first_meal_plan: {
    key: 'first_meal_plan',
    name: 'Meal Planner',
    description: 'Create your first meal plan',
    icon: '📅',
    points: 15,
    category: 'cooking',
    target: 1,
  },
  week_planner: {
    key: 'week_planner',
    name: 'Week Planner',
    description: 'Plan a full week of meals',
    icon: '🗓️',
    points: 30,
    category: 'cooking',
    target: 21, // 7 days × 3 meals
  },
  cooking_streak_3: {
    key: 'cooking_streak_3',
    name: '3-Day Streak',
    description: 'Cook for 3 days in a row',
    icon: '🔥',
    points: 20,
    category: 'streaks',
    target: 3,
  },
  cooking_streak_7: {
    key: 'cooking_streak_7',
    name: 'Week Warrior',
    description: 'Cook for 7 days in a row',
    icon: '⚡',
    points: 50,
    category: 'streaks',
    target: 7,
  },
  cooking_streak_30: {
    key: 'cooking_streak_30',
    name: 'Month Master',
    description: 'Cook for 30 days in a row',
    icon: '🏆',
    points: 200,
    category: 'streaks',
    target: 30,
  },
  meals_cooked_10: {
    key: 'meals_cooked_10',
    name: 'Getting Started',
    description: 'Cook 10 meals',
    icon: '🍳',
    points: 20,
    category: 'cooking',
    target: 10,
  },
  meals_cooked_50: {
    key: 'meals_cooked_50',
    name: 'Home Chef',
    description: 'Cook 50 meals',
    icon: '👩‍🍳',
    points: 75,
    category: 'cooking',
    target: 50,
  },
  meals_cooked_100: {
    key: 'meals_cooked_100',
    name: 'Culinary Expert',
    description: 'Cook 100 meals',
    icon: '🌟',
    points: 150,
    category: 'cooking',
    target: 100,
  },
  batch_cooker: {
    key: 'batch_cooker',
    name: 'Batch Cooker',
    description: 'Complete a batch cooking plan',
    icon: '🥘',
    points: 40,
    category: 'cooking',
    target: 1,
  },
  variety_chef: {
    key: 'variety_chef',
    name: 'Variety Chef',
    description: 'Cook 10 different recipes',
    icon: '🎨',
    points: 50,
    category: 'recipes',
    target: 10,
  },
  level_5: {
    key: 'level_5',
    name: 'Rising Star',
    description: 'Reach level 5',
    icon: '⭐',
    points: 25,
    category: 'milestones',
    target: 5,
  },
  level_10: {
    key: 'level_10',
    name: 'Experienced Cook',
    description: 'Reach level 10',
    icon: '🌟',
    points: 50,
    category: 'milestones',
    target: 10,
  },
  level_25: {
    key: 'level_25',
    name: 'Master Chef',
    description: 'Reach level 25',
    icon: '👑',
    points: 150,
    category: 'milestones',
    target: 25,
  },
};

export class GamificationService {
  private userStatsRepo: Repository<UserStats>;
  private userAchievementRepo: Repository<UserAchievement>;
  private recipeRepo: Repository<Recipe>;
  private mealPlanRepo: Repository<MealPlan>;
  private mealPlanRecipeRepo: Repository<MealPlanRecipe>;

  constructor() {
    this.userStatsRepo = AppDataSource.getRepository(UserStats);
    this.userAchievementRepo = AppDataSource.getRepository(UserAchievement);
    this.recipeRepo = AppDataSource.getRepository(Recipe);
    this.mealPlanRepo = AppDataSource.getRepository(MealPlan);
    this.mealPlanRecipeRepo = AppDataSource.getRepository(MealPlanRecipe);
  }

  async getUserStats(userId: string): Promise<UserStats> {
    let stats = await this.userStatsRepo.findOne({ where: { userId } });

    if (!stats) {
      stats = this.userStatsRepo.create({
        userId,
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        recipesCreated: 0,
        mealsCooked: 0,
        mealPlansCreated: 0,
        cookingModeUsed: 0,
        recipesShared: 0,
        level: 1,
      });
      await this.userStatsRepo.save(stats);
    }

    return stats;
  }

  async getUserAchievements(): Promise<UserAchievement[]> {
    return await this.userAchievementRepo.find({
      order: { completedAt: 'DESC' },
    });
  }

  async getAchievementProgress(): Promise<{
    completed: UserAchievement[];
    inProgress: UserAchievement[];
    available: AchievementDefinition[];
  }> {
    const userAchievements = await this.getUserAchievements();

    const completed = userAchievements.filter((a) => a.completed);
    const inProgress = userAchievements.filter((a) => !a.completed && a.progress > 0);

    const completedKeys = new Set(completed.map((a) => a.achievementKey));
    const inProgressKeys = new Set(inProgress.map((a) => a.achievementKey));

    const available = Object.values(ACHIEVEMENTS).filter(
      (def) => !completedKeys.has(def.key) && !inProgressKeys.has(def.key)
    );

    return { completed, inProgress, available };
  }

  async recordRecipeCreated(userId: string): Promise<UserAchievement[]> {
    const stats = await this.getUserStats(userId);
    stats.recipesCreated += 1;
    await this.userStatsRepo.save(stats);

    const newAchievements: UserAchievement[] = [];

    // Check recipe-related achievements
    if (stats.recipesCreated >= 1) {
      const achievement = await this.checkAndAwardAchievement(userId, 'first_recipe', stats.recipesCreated);
      if (achievement) newAchievements.push(achievement);
    }
    if (stats.recipesCreated >= 5) {
      const achievement = await this.checkAndAwardAchievement(userId, 'recipe_collector_5', stats.recipesCreated);
      if (achievement) newAchievements.push(achievement);
    }
    if (stats.recipesCreated >= 25) {
      const achievement = await this.checkAndAwardAchievement(userId, 'recipe_master_25', stats.recipesCreated);
      if (achievement) newAchievements.push(achievement);
    }

    return newAchievements;
  }

  async recordMealPlanCreated(userId: string, mealCount: number): Promise<UserAchievement[]> {
    const stats = await this.getUserStats(userId);
    stats.mealPlansCreated += 1;
    await this.userStatsRepo.save(stats);

    const newAchievements: UserAchievement[] = [];

    // First meal plan
    if (stats.mealPlansCreated >= 1) {
      const achievement = await this.checkAndAwardAchievement(userId, 'first_meal_plan', stats.mealPlansCreated);
      if (achievement) newAchievements.push(achievement);
    }

    // Week planner (21+ meals)
    if (mealCount >= 21) {
      const achievement = await this.checkAndAwardAchievement(userId, 'week_planner', mealCount);
      if (achievement) newAchievements.push(achievement);
    }

    return newAchievements;
  }

  async recordMealCooked(userId: string): Promise<UserAchievement[]> {
    const stats = await this.getUserStats(userId);
    stats.mealsCooked += 1;

    // Update streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (stats.lastCookingDate) {
      const lastDate = new Date(stats.lastCookingDate);
      lastDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        // Consecutive day - increment streak
        stats.currentStreak += 1;
      } else if (daysDiff > 1) {
        // Streak broken - reset
        stats.currentStreak = 1;
      }
      // daysDiff === 0 means cooking again same day - don't change streak
    } else {
      // First cooking date
      stats.currentStreak = 1;
    }

    stats.lastCookingDate = today;

    if (stats.currentStreak > stats.longestStreak) {
      stats.longestStreak = stats.currentStreak;
    }

    await this.userStatsRepo.save(stats);

    const newAchievements: UserAchievement[] = [];

    // Check meal count achievements
    if (stats.mealsCooked >= 10) {
      const achievement = await this.checkAndAwardAchievement(userId, 'meals_cooked_10', stats.mealsCooked);
      if (achievement) newAchievements.push(achievement);
    }
    if (stats.mealsCooked >= 50) {
      const achievement = await this.checkAndAwardAchievement(userId, 'meals_cooked_50', stats.mealsCooked);
      if (achievement) newAchievements.push(achievement);
    }
    if (stats.mealsCooked >= 100) {
      const achievement = await this.checkAndAwardAchievement(userId, 'meals_cooked_100', stats.mealsCooked);
      if (achievement) newAchievements.push(achievement);
    }

    // Check streak achievements
    if (stats.currentStreak >= 3) {
      const achievement = await this.checkAndAwardAchievement(userId, 'cooking_streak_3', stats.currentStreak);
      if (achievement) newAchievements.push(achievement);
    }
    if (stats.currentStreak >= 7) {
      const achievement = await this.checkAndAwardAchievement(userId, 'cooking_streak_7', stats.currentStreak);
      if (achievement) newAchievements.push(achievement);
    }
    if (stats.currentStreak >= 30) {
      const achievement = await this.checkAndAwardAchievement(userId, 'cooking_streak_30', stats.currentStreak);
      if (achievement) newAchievements.push(achievement);
    }

    // Check variety achievement
    const uniqueRecipes = await this.mealPlanRecipeRepo
      .createQueryBuilder('mpr')
      .innerJoin('mpr.mealPlan', 'mp')
      .select('COUNT(DISTINCT mpr.recipeId)', 'count')
      .getRawOne();

    const uniqueCount = parseInt(uniqueRecipes?.count || '0', 10);
    if (uniqueCount >= 10) {
      const achievement = await this.checkAndAwardAchievement(userId, 'variety_chef', uniqueCount);
      if (achievement) newAchievements.push(achievement);
    }

    return newAchievements;
  }

  private async checkAndAwardAchievement(
    userId: string,
    achievementKey: string,
    currentProgress: number
  ): Promise<UserAchievement | null> {
    const definition = ACHIEVEMENTS[achievementKey];
    if (!definition) return null;

    // Check if already completed
    const existing = await this.userAchievementRepo.findOne({
      where: { userId, achievementKey },
    });

    if (existing?.completed) {
      return null; // Already earned
    }

    // Check if target reached
    if (currentProgress >= definition.target) {
      // Award achievement
      let achievement = existing;
      if (!achievement) {
        achievement = this.userAchievementRepo.create({
          userId,
          achievementKey,
          points: definition.points,
          progress: currentProgress,
          target: definition.target,
          completed: false,
        });
      }

      achievement.progress = currentProgress;
      achievement.completed = true;
      achievement.completedAt = new Date();

      await this.userAchievementRepo.save(achievement);

      // Award points and update level
      await this.awardPoints(userId, definition.points);

      return achievement;
    }

    // Update progress
    if (existing) {
      existing.progress = currentProgress;
      await this.userAchievementRepo.save(existing);
    } else {
      const newAchievement = this.userAchievementRepo.create({
        userId,
        achievementKey,
        points: definition.points,
        progress: currentProgress,
        target: definition.target,
        completed: false,
      });
      await this.userAchievementRepo.save(newAchievement);
    }

    return null;
  }

  private async awardPoints(userId: string, points: number): Promise<void> {
    const stats = await this.getUserStats(userId);
    stats.totalPoints += points;

    // Calculate level (100 points per level)
    const newLevel = Math.floor(stats.totalPoints / 100) + 1;
    const oldLevel = stats.level;
    stats.level = newLevel;

    await this.userStatsRepo.save(stats);

    // Check level milestones
    if (newLevel >= 5 && oldLevel < 5) {
      await this.checkAndAwardAchievement(userId, 'level_5', newLevel);
    }
    if (newLevel >= 10 && oldLevel < 10) {
      await this.checkAndAwardAchievement(userId, 'level_10', newLevel);
    }
    if (newLevel >= 25 && oldLevel < 25) {
      await this.checkAndAwardAchievement(userId, 'level_25', newLevel);
    }
  }

  async getLeaderboard(limit: number = 10): Promise<Array<{
    userId: string;
    level: number;
    totalPoints: number;
    currentStreak: number;
  }>> {
    const leaderboard = await this.userStatsRepo.find({
      order: { totalPoints: 'DESC' },
      take: limit,
    });

    return leaderboard.map((stats) => ({
      userId: stats.userId,
      level: stats.level,
      totalPoints: stats.totalPoints,
      currentStreak: stats.currentStreak,
    }));
  }
}
