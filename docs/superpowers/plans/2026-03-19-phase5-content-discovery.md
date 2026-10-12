# Phase 5: Content & Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add personal recipe ratings, recipe collections (with built-in Favorites), automatic view history tracking with "Recently Viewed" on the recipes page, and pantry-based recipe suggestions.

**Architecture:** Four new entities (RecipeRating, RecipeCollection, RecipeCollectionItem, RecipeView) following existing TypeORM patterns. Ratings and view tracking integrate into the recipe controller. Collections get their own route module. Suggestions are computed on-demand by matching pantry items against recipe ingredients. Frontend adds star rating component, heart/collection controls, and two new sections on RecipesPage (Recently Viewed, Suggested For You).

**Tech Stack:** TypeORM entities, Express routes/controllers, React components, Zustand-compatible patterns

**Spec:** `docs/superpowers/specs/2026-03-19-phase5-content-discovery-design.md`

---

## File Structure

### New files
- `packages/shared/src/types/rating.ts` — Rating type + DTO
- `packages/shared/src/types/collection.ts` — Collection, CollectionItem types + DTOs
- `packages/backend/src/db/entities/RecipeRating.ts` — Rating entity
- `packages/backend/src/db/entities/RecipeCollection.ts` — Collection entity
- `packages/backend/src/db/entities/RecipeCollectionItem.ts` — Collection-Recipe join entity
- `packages/backend/src/db/entities/RecipeView.ts` — View tracking entity
- `packages/backend/src/services/rating/rating.service.ts` — Rate/unrate/get ratings
- `packages/backend/src/services/collection/collection.service.ts` — Collection CRUD + add/remove recipes
- `packages/backend/src/services/suggestion/suggestion.service.ts` — Pantry-based recipe matching
- `packages/backend/src/api/controllers/collection.controller.ts` — Collection endpoints
- `packages/backend/src/api/routes/collection.routes.ts` — Collection route definitions
- `packages/frontend/src/components/StarRating.tsx` — Reusable star rating component
- `packages/frontend/src/features/collections/CollectionsPage.tsx` — Collections list page
- `packages/frontend/src/features/collections/CollectionDetailPage.tsx` — Single collection view

### Modified files
- `packages/shared/src/index.ts` — Export new types
- `packages/backend/src/db/entities/index.ts` — Export new entities
- `packages/backend/src/api/controllers/recipe.controller.ts` — Add rate/unrate handlers, attach rating to findById, record view
- `packages/backend/src/api/routes/recipe.routes.ts` — Add rate, recent, suggestions routes (before /:id)
- `packages/backend/src/api/routes/index.ts` — Register collection routes
- `packages/frontend/src/services/api.ts` — Add rating, collection, recent, suggestions API methods
- `packages/frontend/src/features/recipes/RecipesPage.tsx` — Add Recently Viewed row, Suggestions row
- `packages/frontend/src/features/recipes/RecipeDetailPage.tsx` — Add star rating, heart/collection controls
- `packages/frontend/src/App.tsx` — Add collection routes
- `packages/frontend/src/features/layout/DashboardLayout.tsx` — Add Collections nav item

---

## Task 1: Shared Types

**Files:**
- Create: `packages/shared/src/types/rating.ts`
- Create: `packages/shared/src/types/collection.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create rating types**

Create `packages/shared/src/types/rating.ts`:

```typescript
export interface RecipeRating {
  id: string;
  userId: string;
  recipeId: string;
  rating: number; // 1-5
  createdAt: string;
  updatedAt: string;
}

export interface RateRecipeDto {
  rating: number; // 1-5
}
```

- [ ] **Step 2: Create collection types**

Create `packages/shared/src/types/collection.ts`:

```typescript
import type { Recipe } from './recipe';
import type { PaginatedRequest } from './pagination';

export interface RecipeCollection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isFavorites: boolean;
  recipeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeCollectionItem {
  id: string;
  collectionId: string;
  recipeId: string;
  recipe?: Recipe;
  addedAt: string;
}

export interface CreateCollectionDto {
  name: string;
  description?: string;
}

export interface UpdateCollectionDto {
  name?: string;
  description?: string;
}

export interface CollectionRecipesQuery extends PaginatedRequest {
  // Extends pagination for fetching recipes within a collection
}

export interface RecipeSuggestion {
  recipe: Recipe;
  matchScore: number;
  matchReason: string;
}
```

- [ ] **Step 3: Export from index**

In `packages/shared/src/index.ts`, add:
```typescript
export * from './types/rating';
export * from './types/collection';
```

- [ ] **Step 4: Build shared package**

Run: `npm run build -w packages/shared`

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types for ratings, collections, and suggestions"
```

---

## Task 2: Backend Entities

**Files:**
- Create: `packages/backend/src/db/entities/RecipeRating.ts`
- Create: `packages/backend/src/db/entities/RecipeCollection.ts`
- Create: `packages/backend/src/db/entities/RecipeCollectionItem.ts`
- Create: `packages/backend/src/db/entities/RecipeView.ts`
- Modify: `packages/backend/src/db/entities/index.ts`

- [ ] **Step 1: Create RecipeRating entity**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { User } from './User';
import { Recipe } from './Recipe';

@Entity('recipe_ratings')
@Unique(['userId', 'recipeId'])
export class RecipeRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('uuid', { name: 'recipe_id' })
  recipeId: string;

  @Column('integer')
  rating: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Create RecipeCollection entity**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User';
import { RecipeCollectionItem } from './RecipeCollectionItem';

@Entity('recipe_collections')
export class RecipeCollection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('varchar')
  name: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('boolean', { name: 'is_favorites', default: false })
  isFavorites: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => RecipeCollectionItem, (item) => item.collection, { cascade: true })
  items: RecipeCollectionItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 3: Create RecipeCollectionItem entity**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm';
import { RecipeCollection } from './RecipeCollection';
import { Recipe } from './Recipe';

@Entity('recipe_collection_items')
@Unique(['collectionId', 'recipeId'])
export class RecipeCollectionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'collection_id' })
  collectionId: string;

  @Column('uuid', { name: 'recipe_id' })
  recipeId: string;

  @ManyToOne(() => RecipeCollection, (c) => c.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection: RecipeCollection;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;
}
```

- [ ] **Step 4: Create RecipeView entity**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, UpdateDateColumn, Index } from 'typeorm';
import { User } from './User';
import { Recipe } from './Recipe';

@Entity('recipe_views')
@Unique(['userId', 'recipeId'])
@Index(['userId', 'viewedAt'])
export class RecipeView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('uuid', { name: 'recipe_id' })
  recipeId: string;

  @UpdateDateColumn({ name: 'viewed_at' })
  viewedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;
}
```

- [ ] **Step 5: Export all new entities**

In `packages/backend/src/db/entities/index.ts`, add:
```typescript
export { RecipeRating } from './RecipeRating';
export { RecipeCollection } from './RecipeCollection';
export { RecipeCollectionItem } from './RecipeCollectionItem';
export { RecipeView } from './RecipeView';
```

- [ ] **Step 6: Build to verify**

Run: `npx tsc --noEmit -p packages/backend/tsconfig.json`

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/db/entities/
git commit -m "feat: add entities for ratings, collections, and view history"
```

---

## Task 3: Rating Service + Controller + Routes

**Files:**
- Create: `packages/backend/src/services/rating/rating.service.ts`
- Modify: `packages/backend/src/api/controllers/recipe.controller.ts`
- Modify: `packages/backend/src/api/routes/recipe.routes.ts`

- [ ] **Step 1: Create RatingService**

Create `packages/backend/src/services/rating/rating.service.ts`:

```typescript
import { AppDataSource } from '../../db/data-source';
import { RecipeRating } from '../../db/entities/RecipeRating';

export class RatingService {
  private ratingRepo = AppDataSource.getRepository(RecipeRating);

  async rate(userId: string, recipeId: string, rating: number): Promise<RecipeRating> {
    let existing = await this.ratingRepo.findOne({ where: { userId, recipeId } });
    if (existing) {
      existing.rating = rating;
      return this.ratingRepo.save(existing);
    }
    return this.ratingRepo.save(this.ratingRepo.create({ userId, recipeId, rating }));
  }

  async unrate(userId: string, recipeId: string): Promise<void> {
    await this.ratingRepo.delete({ userId, recipeId });
  }

  async getUserRating(userId: string, recipeId: string): Promise<number | null> {
    const rating = await this.ratingRepo.findOne({ where: { userId, recipeId } });
    return rating?.rating ?? null;
  }

  async getUserRatingsForRecipes(userId: string, recipeIds: string[]): Promise<Record<string, number>> {
    if (!recipeIds.length) return {};
    const ratings = await this.ratingRepo
      .createQueryBuilder('r')
      .where('r.userId = :userId', { userId })
      .andWhere('r.recipeId IN (:...recipeIds)', { recipeIds })
      .getMany();
    const map: Record<string, number> = {};
    for (const r of ratings) map[r.recipeId] = r.rating;
    return map;
  }
}
```

- [ ] **Step 2: Add rate/unrate handlers to recipe controller**

Read `packages/backend/src/api/controllers/recipe.controller.ts`. Add a `ratingService` property and two new methods:

```typescript
private ratingService = new RatingService();

async rate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    const result = await this.ratingService.rate(req.userId!, req.params.id, rating);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async unrate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await this.ratingService.unrate(req.userId!, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
```

Also modify `findById` to attach the user's rating to the response:

```typescript
async findById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const recipe = await this.recipeService.findById(req.params.id);
    const userRating = await this.ratingService.getUserRating(req.userId!, req.params.id);
    res.json({ ...recipe, userRating });
  } catch (error) {
    next(error);
  }
}
```

Import `RatingService` at the top.

- [ ] **Step 3: Add rating routes**

In `packages/backend/src/api/routes/recipe.routes.ts`, add the rating routes. `PUT /:id/rate` and `DELETE /:id/rate` have sub-paths so they won't conflict with `GET /:id` — they can go AFTER `/:id`:

```typescript
router.put('/:id/rate', controller.rate.bind(controller));
router.delete('/:id/rate', controller.unrate.bind(controller));
```

Place these alongside the existing `PUT /:id` and `DELETE /:id` routes.

- [ ] **Step 4: Build and verify**

Run: `npx tsc --noEmit -p packages/backend/tsconfig.json`

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/services/rating/ packages/backend/src/api/controllers/recipe.controller.ts packages/backend/src/api/routes/recipe.routes.ts
git commit -m "feat: add recipe rating service with rate/unrate endpoints"
```

---

## Task 4: View History Service + Integration

**Files:**
- Modify: `packages/backend/src/api/controllers/recipe.controller.ts`
- Modify: `packages/backend/src/api/routes/recipe.routes.ts`

- [ ] **Step 1: Add view tracking to the controller**

In `recipe.controller.ts`, add a `viewRepo` property and view tracking methods:

```typescript
private viewRepo = AppDataSource.getRepository(RecipeView);

private async recordView(userId: string, recipeId: string): Promise<void> {
  let existing = await this.viewRepo.findOne({ where: { userId, recipeId } });
  if (existing) {
    existing.viewedAt = new Date();
    await this.viewRepo.save(existing);
  } else {
    await this.viewRepo.save(this.viewRepo.create({ userId, recipeId }));
  }
}

async getRecentlyViewed(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const views = await this.viewRepo.find({
      where: { userId: req.userId! },
      relations: ['recipe', 'recipe.ingredients'],
      order: { viewedAt: 'DESC' },
      take: Math.min(limit, 20),
    });
    const recipes = views.map(v => v.recipe).filter(Boolean);
    res.json(recipes);
  } catch (error) {
    next(error);
  }
}
```

Modify `findById` to also call `recordView` (fire-and-forget, don't block the response):

```typescript
async findById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const recipe = await this.recipeService.findById(req.params.id);
    const userRating = await this.ratingService.getUserRating(req.userId!, req.params.id);

    // Record view in background (don't block response)
    this.recordView(req.userId!, req.params.id).catch(() => {});

    res.json({ ...recipe, userRating });
  } catch (error) {
    next(error);
  }
}
```

Import `RecipeView` from entities.

- [ ] **Step 2: Add recent route**

In `recipe.routes.ts`, add in the static-path GET block (alongside `GET /categories`, BEFORE `GET /:id`):

```typescript
router.get('/recent', controller.getRecentlyViewed.bind(controller));
```

**CRITICAL:** This MUST go before `router.get('/:id', ...)` or Express will match "recent" as an `:id` parameter. Insert it right after the existing `router.get('/categories', ...)` line (currently line 25) and before `router.get('/:id', ...)` (currently line 26).

- [ ] **Step 3: Build and verify**

Run: `npx tsc --noEmit -p packages/backend/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/api/controllers/recipe.controller.ts packages/backend/src/api/routes/recipe.routes.ts
git commit -m "feat: add automatic view history tracking and GET /recipes/recent endpoint"
```

---

## Task 5: Collection Service + Controller + Routes

**Files:**
- Create: `packages/backend/src/services/collection/collection.service.ts`
- Create: `packages/backend/src/api/controllers/collection.controller.ts`
- Create: `packages/backend/src/api/routes/collection.routes.ts`
- Modify: `packages/backend/src/api/routes/index.ts`

- [ ] **Step 1: Create CollectionService**

Create `packages/backend/src/services/collection/collection.service.ts`:

Key methods:
- `findAll(userId)` — returns collections with recipe counts
- `findById(userId, collectionId)` — returns collection with recipes (verifies ownership)
- `create(userId, dto)` — creates new collection
- `update(userId, collectionId, dto)` — updates (blocks Favorites rename)
- `delete(userId, collectionId)` — deletes (blocks Favorites deletion)
- `addRecipe(userId, collectionId, recipeId)` — adds recipe to collection
- `removeRecipe(userId, collectionId, recipeId)` — removes recipe from collection
- `getOrCreateFavorites(userId)` — finds or creates the Favorites collection
- `toggleFavorite(userId, recipeId)` — toggles recipe in Favorites, returns `{ isFavorite: boolean }`
- `isFavorite(userId, recipeId)` — checks if recipe is in Favorites

All methods that access `RecipeCollectionItem` must first verify collection ownership by checking `collection.userId === userId`. Use the repository pattern matching existing services.

- [ ] **Step 2: Create CollectionController**

Create `packages/backend/src/api/controllers/collection.controller.ts` with methods for each endpoint:
- `findAll`, `findById`, `create`, `update`, `delete`, `addRecipe`, `removeRecipe`, `toggleFavorite`

Follow the pattern in existing controllers (try/catch with next(error)).

- [ ] **Step 3: Create collection routes**

Create `packages/backend/src/api/routes/collection.routes.ts`:

```typescript
import { Router } from 'express';
import { CollectionController } from '../controllers/collection.controller';
import { authMiddleware } from '../middleware';

const router = Router();
const controller = new CollectionController();

router.use(authMiddleware);

router.get('/', controller.findAll.bind(controller));
router.post('/', controller.create.bind(controller));
// Convenience endpoint not in spec — simplifies the frontend favorite toggle to one call
// instead of requiring the client to manage getOrCreateFavorites + add/remove
router.post('/toggle-favorite', controller.toggleFavorite.bind(controller));
router.get('/:id', controller.findById.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));
router.post('/:id/recipes', controller.addRecipe.bind(controller));
router.delete('/:id/recipes/:recipeId', controller.removeRecipe.bind(controller));

export default router;
```

- [ ] **Step 4: Register collection routes**

In `packages/backend/src/api/routes/index.ts`, add:

```typescript
import collectionRoutes from './collection.routes';
router.use('/collections', collectionRoutes);
```

- [ ] **Step 5: Build and verify**

Run: `npx tsc --noEmit -p packages/backend/tsconfig.json`

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/services/collection/ packages/backend/src/api/controllers/collection.controller.ts packages/backend/src/api/routes/collection.routes.ts packages/backend/src/api/routes/index.ts
git commit -m "feat: add collection service with CRUD, favorites toggle, and routes"
```

---

## Task 6: Suggestion Service + Route

**Files:**
- Create: `packages/backend/src/services/suggestion/suggestion.service.ts`
- Modify: `packages/backend/src/api/controllers/recipe.controller.ts`
- Modify: `packages/backend/src/api/routes/recipe.routes.ts`

- [ ] **Step 1: Create SuggestionService**

Create `packages/backend/src/services/suggestion/suggestion.service.ts`:

Key logic:
1. Load user's pantry items (names)
2. Load user's preferences (allergies, dislikes, favorites, preferredCuisines)
3. Query user's recipes with ingredients
4. For each recipe, compute match score:
   - Base score: `(pantry-matched ingredients / total ingredients) * 100`
   - Allergy exclusion: if any ingredient ILIKE-matches an allergy, exclude the recipe entirely
   - Dislike exclusion: if any ingredient ILIKE-matches a dislike, exclude
   - Cuisine boost: if recipe categories overlap with preferredCuisines, +10
   - Favorite ingredient boost: if recipe ingredients ILIKE-match a favorite food, +5 per match (cap at +15)
5. Filter recipes with score > 0, sort DESC, limit
6. Return array of `{ recipe, matchScore, matchReason }` where matchReason is a human-readable string like "You have 5 of 7 ingredients"

Use raw SQL or query builder for the pantry-ingredient ILIKE matching for performance. The service should accept `userId` and `limit` parameters.

**WARNING:** `UserPreferences` entity uses a non-standard `@JoinColumn({ name: 'userId' })` (camelCase, no underscore) unlike all other entities which use `user_id`. When writing raw SQL against `user_preferences`, the FK column is `userId`, not `user_id`. Use TypeORM repository methods (not raw SQL) for preferences lookup to avoid this pitfall.

- [ ] **Step 2: Add suggestions endpoint to recipe controller**

Add to `recipe.controller.ts`:

```typescript
private suggestionService = new SuggestionService();

async getSuggestions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(req.query.limit as string) || 6;
    const suggestions = await this.suggestionService.getSuggestions(req.userId!, limit);
    res.json(suggestions);
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 3: Add suggestions route**

In `recipe.routes.ts`, add in the static-path GET block (alongside `/categories` and `/recent`, BEFORE `GET /:id`):

```typescript
router.get('/suggestions', controller.getSuggestions.bind(controller));
```

- [ ] **Step 4: Build and verify**

Run: `npx tsc --noEmit -p packages/backend/tsconfig.json`

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/services/suggestion/ packages/backend/src/api/controllers/recipe.controller.ts packages/backend/src/api/routes/recipe.routes.ts
git commit -m "feat: add pantry-based recipe suggestion service and endpoint"
```

---

## Task 7: Frontend API Client + StarRating Component

**Files:**
- Modify: `packages/frontend/src/services/api.ts`
- Create: `packages/frontend/src/components/StarRating.tsx`

- [ ] **Step 1: Add API methods**

In `packages/frontend/src/services/api.ts`, add:

```typescript
// Rating
export const ratingApi = {
  rate: (recipeId: string, rating: number) =>
    api.put(`/recipes/${recipeId}/rate`, { rating }),
  unrate: (recipeId: string) =>
    api.delete(`/recipes/${recipeId}/rate`),
};

// Collections
export const collectionApi = {
  getAll: async () => {
    const { data } = await api.get<RecipeCollection[]>('/collections');
    return data;
  },
  getById: (id: string) => api.get<RecipeCollection>(`/collections/${id}`),
  create: (data: CreateCollectionDto) => api.post<RecipeCollection>('/collections', data),
  update: (id: string, data: UpdateCollectionDto) => api.put<RecipeCollection>(`/collections/${id}`, data),
  delete: (id: string) => api.delete(`/collections/${id}`),
  addRecipe: (id: string, recipeId: string) => api.post(`/collections/${id}/recipes`, { recipeId }),
  removeRecipe: (id: string, recipeId: string) => api.delete(`/collections/${id}/recipes/${recipeId}`),
  toggleFavorite: async (recipeId: string) => {
    const { data } = await api.post<{ isFavorite: boolean }>('/collections/toggle-favorite', { recipeId });
    return data;
  },
};

// Recently viewed
export const historyApi = {
  getRecent: async (limit = 10) => {
    const { data } = await api.get<Recipe[]>(`/recipes/recent?limit=${limit}`);
    return data;
  },
};

// Suggestions
export const suggestionApi = {
  get: async (limit = 6) => {
    const { data } = await api.get<RecipeSuggestion[]>(`/recipes/suggestions?limit=${limit}`);
    return data;
  },
};
```

Add necessary imports from `@nommable/shared` at the top.

- [ ] **Step 2: Create StarRating component**

Create `packages/frontend/src/components/StarRating.tsx`:

```tsx
import { useState } from 'react';

interface StarRatingProps {
  rating: number | null;
  onChange: (rating: number | null) => void;
  size?: 'sm' | 'md';
  readonly?: boolean;
}

export function StarRating({ rating, onChange, size = 'md', readonly = false }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const starSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange(rating === star ? null : star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className={`${starSize} ${readonly ? 'cursor-default' : 'cursor-pointer'} transition-colors`}
        >
          <svg
            viewBox="0 0 24 24"
            fill={(hovered || rating || 0) >= star ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={2}
            className={(hovered || rating || 0) >= star ? 'text-yellow-400' : 'text-muted-foreground/40'}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/services/api.ts packages/frontend/src/components/StarRating.tsx
git commit -m "feat: add frontend API methods for ratings, collections, history, suggestions and StarRating component"
```

---

## Task 8: Frontend — RecipeDetailPage (Ratings + Collections)

**Files:**
- Modify: `packages/frontend/src/features/recipes/RecipeDetailPage.tsx`

- [ ] **Step 1: Read RecipeDetailPage.tsx**

Read the full file to understand the structure, state, and render layout.

- [ ] **Step 2: Add rating state and handler**

Add state for the user's rating (it comes from the API response as `userRating`):

```typescript
const [userRating, setUserRating] = useState<number | null>(null);
```

In `loadRecipe`, after setting the recipe, also set the rating:
```typescript
setUserRating(data.userRating ?? null);
```

Add a rating change handler:
```typescript
const handleRatingChange = async (rating: number | null) => {
  if (!recipe) return;
  const previous = userRating; // capture before optimistic update
  setUserRating(rating);
  try {
    if (rating) {
      await ratingApi.rate(recipe.id, rating);
    } else {
      await ratingApi.unrate(recipe.id);
    }
  } catch (error) {
    console.error('Failed to update rating:', error);
    setUserRating(previous); // revert to captured value
  }
};
```

- [ ] **Step 3: Add favorite state and handler**

```typescript
const [isFavorite, setIsFavorite] = useState(false);

const handleToggleFavorite = async () => {
  if (!recipe) return;
  try {
    const result = await collectionApi.toggleFavorite(recipe.id);
    setIsFavorite(result.isFavorite);
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
  }
};
```

Load favorite status when recipe loads (can check via collections API or add a dedicated endpoint — simplest is to fetch user's favorites collection and check if recipe is in it).

- [ ] **Step 4: Render rating and favorite controls**

Add `<StarRating>` component below the recipe title. Add a heart icon button near the title for favorite toggle. Import StarRating, ratingApi, collectionApi.

The heart icon should be filled when `isFavorite` is true. Use a Heart icon from lucide-react.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/features/recipes/RecipeDetailPage.tsx
git commit -m "feat: add star rating and favorite toggle to recipe detail page"
```

---

## Task 9: Frontend — RecipesPage (Recently Viewed + Suggestions)

**Files:**
- Modify: `packages/frontend/src/features/recipes/RecipesPage.tsx`

- [ ] **Step 1: Read RecipesPage.tsx**

Read the full file, especially the render structure where the recipe grid starts.

- [ ] **Step 2: Add state and data loading**

```typescript
const [recentRecipes, setRecentRecipes] = useState<Recipe[]>([]);
const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
const [showSuggestions, setShowSuggestions] = useState(true);
```

Add a useEffect to load recent and suggestions on mount:

```typescript
useEffect(() => {
  historyApi.getRecent(10).then(setRecentRecipes).catch(() => {});
  suggestionApi.get(6).then(setSuggestions).catch(() => {});
}, []);
```

- [ ] **Step 3: Render Recently Viewed row**

ABOVE the main recipe grid, add a "Recently Viewed" horizontal scroll section:

```tsx
{recentRecipes.length > 0 && (
  <div className="mb-6">
    <h2 className="text-lg font-semibold mb-3">Recently Viewed</h2>
    <div className="flex gap-4 overflow-x-auto pb-2">
      {recentRecipes.map(recipe => (
        <Link key={recipe.id} to={`/recipes/${recipe.id}`} className="flex-shrink-0 w-48">
          <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            {recipe.imageUrl && (
              <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-28 object-cover" />
            )}
            <div className="p-2">
              <p className="text-sm font-medium truncate">{recipe.title}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 4: Render Suggestions row**

Below Recently Viewed, above the main grid:

```tsx
{suggestions.length > 0 && showSuggestions && (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-semibold">Suggested For You</h2>
      <button
        onClick={() => setShowSuggestions(false)}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Hide
      </button>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {suggestions.map(({ recipe, matchScore, matchReason }) => (
        <Link key={recipe.id} to={`/recipes/${recipe.id}`}>
          <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            {recipe.imageUrl && (
              <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-36 object-cover" />
            )}
            <div className="p-3">
              <p className="font-medium truncate">{recipe.title}</p>
              <p className="text-sm text-muted-foreground">{matchReason}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  </div>
)}
```

Import `historyApi`, `suggestionApi`, `ratingApi` from api.ts and `RecipeSuggestion` from shared types.

- [ ] **Step 5: Add star rating indicators to recipe cards in the main grid**

The spec requires small star indicators on recipe cards showing the user's rating. After loading recipes, batch-fetch the user's ratings for the current page:

```typescript
// After loadRecipes sets recipes, fetch ratings for those recipe IDs
const ratingMap = await ratingApi.getBatch(recipes.map(r => r.id));
// Store in state: Record<string, number>
```

This requires adding a `getBatch` method to `ratingApi` in api.ts:
```typescript
getBatch: async (recipeIds: string[]): Promise<Record<string, number>> => {
  const { data } = await api.post<Record<string, number>>('/recipes/ratings/batch', { recipeIds });
  return data;
},
```

And a corresponding backend endpoint. Alternatively, if the recipe list response already includes `userRating` from the findAll query, no extra call is needed. Read the current findAll response to check.

In each recipe card in the grid, render a small readonly StarRating:
```tsx
{ratingMap[recipe.id] && (
  <StarRating rating={ratingMap[recipe.id]} onChange={() => {}} size="sm" readonly />
)}
```

If adding a batch endpoint feels too heavy, defer this to a follow-up and just show ratings on the detail page for now.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/features/recipes/RecipesPage.tsx
git commit -m "feat: add Recently Viewed and Suggested For You sections to recipes page"
```

---

## Task 10: Frontend — Collections Pages + Navigation

**Files:**
- Create: `packages/frontend/src/features/collections/CollectionsPage.tsx`
- Create: `packages/frontend/src/features/collections/CollectionDetailPage.tsx`
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/features/layout/DashboardLayout.tsx`

- [ ] **Step 1: Create CollectionsPage**

A page listing the user's collections as cards (name, recipe count, description). Include a "Create Collection" button/modal. The Favorites collection appears first with a heart icon.

Follow the pattern of existing list pages (e.g., MealPlansPage).

- [ ] **Step 2: Create CollectionDetailPage**

Shows the recipes in a collection as a standard recipe card grid. Includes the collection name as heading, description below, and a "Remove" button on each recipe card. For non-Favorites collections, include edit/delete buttons for the collection itself.

- [ ] **Step 3: Add routes to App.tsx**

In `packages/frontend/src/App.tsx`, add inside the protected routes:

```tsx
<Route path="collections" element={<CollectionsPage />} />
<Route path="collections/:id" element={<CollectionDetailPage />} />
```

Import the two new components.

- [ ] **Step 4: Add Collections to navigation**

In `packages/frontend/src/features/layout/DashboardLayout.tsx`, add to the `navItems` array:

```typescript
{ path: '/collections', label: 'Collections' },
```

Place it after "Recipes" in the list.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/features/collections/ packages/frontend/src/App.tsx packages/frontend/src/features/layout/DashboardLayout.tsx
git commit -m "feat: add collections pages and navigation"
```

---

## Task 11: Final Verification

- [ ] **Step 1:** Run `npm run build` — clean build
- [ ] **Step 2:** Run `npm run lint` — fix any new errors
- [ ] **Step 3:** Run `npm run test` — all tests pass
- [ ] **Step 4:** `git status` — working tree clean
- [ ] **Step 5:** `git log --oneline` — show all commits
