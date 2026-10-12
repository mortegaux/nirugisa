import { AppDataSource } from '../../db/data-source';
import { RecipeRating } from '../../db/entities/RecipeRating';

export class RatingService {
  private get repo() {
    return AppDataSource.getRepository(RecipeRating);
  }

  async rate(userId: string, recipeId: string, rating: number): Promise<RecipeRating> {
    const existing = await this.repo.findOne({ where: { userId, recipeId } });

    if (existing) {
      existing.rating = rating;
      return this.repo.save(existing);
    }

    const newRating = this.repo.create({ userId, recipeId, rating });
    return this.repo.save(newRating);
  }

  async unrate(userId: string, recipeId: string): Promise<void> {
    await this.repo.delete({ userId, recipeId });
  }

  async getUserRating(userId: string, recipeId: string): Promise<number | null> {
    const existing = await this.repo.findOne({ where: { userId, recipeId } });
    return existing ? existing.rating : null;
  }

  async getUserRatingsForRecipes(userId: string, recipeIds: string[]): Promise<Record<string, number>> {
    if (recipeIds.length === 0) return {};

    const ratings = await this.repo
      .createQueryBuilder('r')
      .where('r.userId = :userId', { userId })
      .andWhere('r.recipeId IN (:...recipeIds)', { recipeIds })
      .getMany();

    return ratings.reduce<Record<string, number>>((acc, r) => {
      acc[r.recipeId] = r.rating;
      return acc;
    }, {});
  }
}
