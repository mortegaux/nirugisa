# Phase 1: Pagination + Test Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side pagination to all list endpoints (recipes, meal plans, shopping lists), move filtering server-side, set up test frameworks for backend (Jest) and frontend (Vitest), and write initial tests for pagination.

**Architecture:** Shared pagination types flow from `@nommable/shared` into backend services (TypeORM skip/take with getManyAndCount) and frontend API client. Frontend list pages switch from client-side filtering to server-side query params, with a hybrid UI: page numbers on desktop, "load more" on mobile. Test frameworks are Jest (backend, with a dedicated test PostgreSQL database) and Vitest (frontend, with jsdom).

**Tech Stack:** TypeORM query builder, Jest + supertest, Vitest + @testing-library/react, Zustand-compatible hooks

**Spec:** `docs/superpowers/specs/2026-03-19-phased-improvements-design.md`

---

## File Structure

### New files
- `packages/shared/src/types/pagination.ts` — Generic PaginatedRequest/PaginatedResponse types
- `packages/backend/src/app.ts` — Express app factory (extracted from index.ts for testability)
- `packages/backend/jest.config.ts` — Jest configuration
- `packages/backend/src/__tests__/envSetup.ts` — Sets DATABASE_NAME env var before any modules load (via Jest setupFiles)
- `packages/backend/src/__tests__/setup.ts` — Test DB connection setup/teardown
- `packages/backend/src/__tests__/helpers/auth.ts` — JWT token factory for tests
- `packages/backend/src/__tests__/helpers/fixtures.ts` — Test data factories
- `packages/backend/src/__tests__/services/recipe.service.test.ts` — Recipe service pagination tests
- `packages/backend/src/__tests__/routes/recipe.routes.test.ts` — Recipe API integration tests
- `packages/frontend/vitest.config.ts` — Vitest configuration
- `packages/frontend/src/__tests__/setup.ts` — Test setup (jsdom, cleanup)
- `packages/frontend/src/__tests__/smoke.test.ts` — Smoke test
- `packages/frontend/src/hooks/useIsMobile.ts` — Breakpoint detection hook
- `packages/frontend/src/components/Pagination.tsx` — Reusable pagination component (desktop pages + mobile load-more)

### Modified files
- `packages/shared/src/types/recipe.ts` — Extend RecipeSearchQuery with pagination fields
- `packages/shared/src/types/meal-plan.ts` — Add MealPlanSearchQuery with pagination
- `packages/shared/src/types/shopping-list.ts` — Add ShoppingListSearchQuery with pagination
- `packages/shared/src/index.ts` — Export new pagination types
- `packages/backend/src/services/recipe/recipe.service.ts:63-97` — Rewrite findAll with pagination + userId
- `packages/backend/src/services/meal-plan/meal-plan.service.ts:50-55` — Rewrite findAll with pagination + userId
- `packages/backend/src/services/shopping-list/shopping-list.service.ts:118-123` — Rewrite findAll with pagination + userId
- `packages/backend/src/api/controllers/recipe.controller.ts:45-52` — Parse pagination query params
- `packages/backend/src/api/controllers/meal-plan.controller.ts` — Parse pagination query params
- `packages/backend/src/api/controllers/shopping-list.controller.ts` — Parse pagination query params
- `packages/backend/src/index.ts` — Refactor to use createApp() from app.ts
- `packages/backend/package.json` — Add Jest dependencies and test script
- `packages/frontend/package.json` — Add Vitest dependencies and test script
- `packages/frontend/src/services/api.ts:50-55` — Update API methods to accept/return pagination
- `packages/frontend/src/features/recipes/RecipesPage.tsx` — Server-side filtering + pagination UI
- `packages/frontend/src/features/meal-plans/MealPlansPage.tsx` — Pagination UI
- `packages/frontend/src/features/shopping-lists/ShoppingListsPage.tsx` — Pagination UI
- `package.json` — Add root test script

---

## Task 1: Shared Pagination Types

**Files:**
- Create: `packages/shared/src/types/pagination.ts`
- Modify: `packages/shared/src/types/recipe.ts:78-85`
- Modify: `packages/shared/src/types/meal-plan.ts` (append)
- Modify: `packages/shared/src/types/shopping-list.ts` (append)
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create pagination types**

Create `packages/shared/src/types/pagination.ts`:

```typescript
export interface PaginatedRequest {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const PAGINATION_DEFAULTS = {
  page: 1,
  pageSize: 20,
  maxPageSize: 100,
} as const;
```

- [ ] **Step 2: Extend RecipeSearchQuery**

In `packages/shared/src/types/recipe.ts`, replace the `RecipeSearchQuery` interface (lines 78-85) with:

```typescript
export interface RecipeSearchQuery extends PaginatedRequest {
  query?: string;
  categories?: string[];
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  maxPrepTime?: number;
  maxCookTime?: number;
}
```

Add the import at the top of the file:

```typescript
import { PaginatedRequest } from './pagination';
```

- [ ] **Step 3: Add MealPlanSearchQuery**

Append to `packages/shared/src/types/meal-plan.ts`:

```typescript
import { PaginatedRequest } from './pagination';

export interface MealPlanSearchQuery extends PaginatedRequest {
  query?: string;
}
```

- [ ] **Step 4: Add ShoppingListSearchQuery**

Append to `packages/shared/src/types/shopping-list.ts`:

```typescript
import { PaginatedRequest } from './pagination';

export interface ShoppingListSearchQuery extends PaginatedRequest {
  query?: string;
}
```

- [ ] **Step 5: Export from index**

In `packages/shared/src/index.ts`, add:

```typescript
export * from './types/pagination';
```

- [ ] **Step 6: Build shared package and verify**

Run: `npm run build -w packages/shared`
Expected: Clean build, no errors

- [ ] **Step 7: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared pagination types and extend search queries"
```

---

## Task 2: Backend Test Framework Setup

**Files:**
- Modify: `packages/backend/package.json`
- Create: `packages/backend/jest.config.ts`
- Create: `packages/backend/src/__tests__/setup.ts`
- Create: `packages/backend/src/__tests__/helpers/auth.ts`
- Create: `packages/backend/src/__tests__/helpers/fixtures.ts`

- [ ] **Step 1: Install Jest dependencies**

Run from repo root:
```bash
npm install -D jest ts-jest @types/jest supertest @types/supertest -w packages/backend
```
Expected: Packages added to `packages/backend/package.json` devDependencies

- [ ] **Step 2: Create Jest config**

Create `packages/backend/jest.config.ts`:

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__'],
  moduleNameMapper: {
    '^@nommable/shared$': '<rootDir>/../shared/src/index',
  },
  setupFiles: ['<rootDir>/src/__tests__/envSetup.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 15000,
  verbose: true,
};

export default config;
```

- [ ] **Step 3: Create test setup file**

Create `packages/backend/src/__tests__/envSetup.ts`:

The `AppDataSource` in `src/db/data-source.ts` is constructed at module load time using config values from `process.env`. We need the test database name set **before any modules load**. Jest's `setupFiles` runs in the worker process before any test module is evaluated — unlike `globalSetup` which runs in a separate process and whose env mutations are invisible to workers.

```typescript
// setupFiles runs in the worker process before any module loads.
// Check packages/backend/src/config/index.ts for the exact env var name.
process.env.DATABASE_NAME = 'nommable_test';
```

**Important:** Read `packages/backend/src/config/index.ts` to verify the env var name. It may be `DATABASE_NAME`, `DB_NAME`, or `POSTGRES_DB`. Match it exactly.

**Prerequisite:** The `nommable_test` database must exist in PostgreSQL. Create it once:
```bash
createdb nommable_test
```
Or via psql: `CREATE DATABASE nommable_test;`

Now create `packages/backend/src/__tests__/setup.ts`:

This file runs after the test framework loads (via `setupFilesAfterEnv`). By this point, `envSetup.ts` has already set `process.env.DATABASE_NAME`, so `AppDataSource` will connect to the test database.

```typescript
import { AppDataSource } from '../db/data-source';

beforeAll(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  // Drop and re-sync schema for a clean slate each test run
  await AppDataSource.synchronize(true);
});

afterEach(async () => {
  // Clear all tables between tests for isolation
  const entities = AppDataSource.entityMetadatas;
  for (const entity of entities) {
    const repo = AppDataSource.getRepository(entity.name);
    await repo.clear();
  }
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});
```

**Note on test isolation:** The `afterEach` hook clears all tables between tests. Tests that need data must seed it in their own `beforeAll` or `beforeEach` blocks.

- [ ] **Step 4: Create auth helper**

Create `packages/backend/src/__tests__/helpers/auth.ts`:

```typescript
import jwt from 'jsonwebtoken';

const TEST_SECRET = process.env.JWT_SECRET || 'test-secret';

export function createTestToken(userId: string): string {
  return jwt.sign({ userId, role: 'user' }, TEST_SECRET, { expiresIn: '1h' });
}
```

- [ ] **Step 5: Create fixtures helper**

Create `packages/backend/src/__tests__/helpers/fixtures.ts`:

```typescript
import type { RecipeCreateDto } from '@nommable/shared';

export function buildRecipeDto(overrides: Partial<RecipeCreateDto> = {}): RecipeCreateDto {
  return {
    title: 'Test Recipe',
    description: 'A test recipe',
    servings: 4,
    prepTime: 15,
    cookTime: 30,
    difficulty: 'easy',
    instructions: ['Step 1', 'Step 2'],
    ingredients: [
      { name: 'Salt', quantity: 1, unit: 'tsp', order: 0 },
      { name: 'Pepper', quantity: 0.5, unit: 'tsp', order: 1 },
    ],
    categories: ['Test'],
    tags: ['test'],
    ...overrides,
  };
}

export function buildRecipeDtos(count: number): RecipeCreateDto[] {
  return Array.from({ length: count }, (_, i) =>
    buildRecipeDto({
      title: `Test Recipe ${i + 1}`,
      categories: [i % 2 === 0 ? 'Italian' : 'Mexican'],
      difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard',
      prepTime: 10 + i * 5,
    })
  );
}
```

- [ ] **Step 6: Add test script to backend package.json**

In `packages/backend/package.json`, add to `"scripts"`:

```json
"test": "jest --runInBand"
```

`--runInBand` ensures tests run serially since they share a database.

- [ ] **Step 7: Add root test script**

In root `package.json`, add to `"scripts"`:

```json
"test": "npm run test --workspaces --if-present"
```

- [ ] **Step 8: Commit**

```bash
git add packages/backend/jest.config.ts packages/backend/src/__tests__/ packages/backend/package.json package.json package-lock.json
git commit -m "feat: set up Jest test framework for backend with test DB and helpers"
```

---

## Task 3: Frontend Test Framework Setup

**Files:**
- Modify: `packages/frontend/package.json`
- Create: `packages/frontend/vitest.config.ts`
- Create: `packages/frontend/src/__tests__/setup.ts`
- Create: `packages/frontend/src/__tests__/smoke.test.ts`

- [ ] **Step 1: Install Vitest dependencies**

Run from repo root:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom -w packages/frontend
```

- [ ] **Step 2: Create Vitest config**

Create `packages/frontend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@nommable/shared': path.resolve(__dirname, '../shared/src/index'),
    },
  },
});
```

- [ ] **Step 3: Create test setup**

Create `packages/frontend/src/__tests__/setup.ts`:

```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 4: Create smoke test**

Create `packages/frontend/src/__tests__/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Vitest setup', () => {
  it('runs a basic test', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Add test script**

In `packages/frontend/package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 6: Run smoke test**

Run: `npm run test -w packages/frontend`
Expected: 1 test passes

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/vitest.config.ts packages/frontend/src/__tests__/ packages/frontend/package.json package-lock.json
git commit -m "feat: set up Vitest test framework for frontend with smoke test"
```

---

## Task 4: Backend RecipeService Pagination

**Files:**
- Modify: `packages/backend/src/services/recipe/recipe.service.ts:63-97`
- Test: `packages/backend/src/__tests__/services/recipe.service.test.ts`

- [ ] **Step 1: Write failing pagination tests**

Create `packages/backend/src/__tests__/services/recipe.service.test.ts`:

```typescript
import { RecipeService } from '../../services/recipe/recipe.service';
import { buildRecipeDto, buildRecipeDtos } from '../helpers/fixtures';
import type { PaginatedResponse, Recipe } from '@nommable/shared';

describe('RecipeService', () => {
  let service: RecipeService;
  const testUserId = 'test-user-id';

  beforeAll(() => {
    service = new RecipeService();
  });

  describe('findAll', () => {
    beforeAll(async () => {
      // Seed 25 recipes for pagination tests
      const dtos = buildRecipeDtos(25);
      for (const dto of dtos) {
        await service.create(testUserId, dto);
      }
    });

    it('returns paginated results with defaults (page 1, pageSize 20)', async () => {
      const result = await service.findAll(testUserId, {});
      expect(result.data).toHaveLength(20);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(2);
    });

    it('returns second page with remaining results', async () => {
      const result = await service.findAll(testUserId, { page: 2 });
      expect(result.data).toHaveLength(5);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
    });

    it('respects custom pageSize', async () => {
      const result = await service.findAll(testUserId, { pageSize: 5 });
      expect(result.data).toHaveLength(5);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(5);
    });

    it('clamps pageSize to max 100', async () => {
      const result = await service.findAll(testUserId, { pageSize: 200 });
      expect(result.pageSize).toBeLessThanOrEqual(100);
    });

    it('filters by search query', async () => {
      const result = await service.findAll(testUserId, { query: 'Recipe 1' });
      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((r: Recipe) => {
        expect(r.title).toContain('Recipe 1');
      });
      expect(result.total).toBe(result.data.length);
    });

    it('filters by category', async () => {
      const result = await service.findAll(testUserId, { categories: ['Italian'] });
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('filters by difficulty', async () => {
      const result = await service.findAll(testUserId, { difficulty: 'easy' });
      result.data.forEach((r: Recipe) => {
        expect(r.difficulty).toBe('easy');
      });
    });

    it('returns empty data for out-of-range page', async () => {
      const result = await service.findAll(testUserId, { page: 999 });
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(25);
    });

    it('does not return recipes from other users', async () => {
      await service.create('other-user-id', buildRecipeDto({ title: 'Other User Recipe' }));
      const result = await service.findAll(testUserId, { pageSize: 100 });
      result.data.forEach((r: Recipe) => {
        expect(r.title).not.toBe('Other User Recipe');
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w packages/backend -- --testPathPattern=recipe.service`
Expected: FAIL — `findAll` does not accept `userId` as first arg and does not return PaginatedResponse

- [ ] **Step 3: Rewrite RecipeService.findAll()**

In `packages/backend/src/services/recipe/recipe.service.ts`, replace the `findAll` method (lines 63-97) with:

```typescript
async findAll(
  userId: string,
  query: RecipeSearchQuery = {}
): Promise<PaginatedResponse<Recipe>> {
  const {
    page = PAGINATION_DEFAULTS.page,
    pageSize: rawPageSize = PAGINATION_DEFAULTS.pageSize,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    query: search,
    categories,
    tags,
    difficulty,
    maxPrepTime,
    maxCookTime,
  } = query;

  const pageSize = Math.min(rawPageSize, PAGINATION_DEFAULTS.maxPageSize);

  const qb = this.recipeRepo
    .createQueryBuilder('recipe')
    .leftJoinAndSelect('recipe.ingredients', 'ingredient')
    .where('recipe.userId = :userId', { userId });

  if (search) {
    qb.andWhere(
      '(recipe.title ILIKE :search OR recipe.description ILIKE :search OR recipe.tags::text ILIKE :search)',
      { search: `%${search}%` }
    );
  }

  if (difficulty) {
    qb.andWhere('recipe.difficulty = :difficulty', { difficulty });
  }

  if (maxPrepTime) {
    qb.andWhere('recipe.prepTime <= :maxPrepTime', { maxPrepTime });
  }

  if (maxCookTime) {
    qb.andWhere('recipe.cookTime <= :maxCookTime', { maxCookTime });
  }

  if (categories?.length) {
    qb.andWhere('recipe.categories && :categories', {
      categories,
    });
  }

  if (tags?.length) {
    qb.andWhere('recipe.tags && :tags', {
      tags,
    });
  }

  qb.orderBy(`recipe.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
    .skip((page - 1) * pageSize)
    .take(pageSize);

  const [data, total] = await qb.getManyAndCount();

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
```

Add imports at the top of the file:

```typescript
import { PaginatedResponse, RecipeSearchQuery, PAGINATION_DEFAULTS } from '@nommable/shared';
```

- [ ] **Step 4: Update recipe controller findAll**

In `packages/backend/src/api/controllers/recipe.controller.ts`, update the `findAll` method (lines 45-52) to pass `userId` and parse query params:

```typescript
async findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const query: RecipeSearchQuery = {
      query: req.query.query as string,
      categories: req.query.categories
        ? (req.query.categories as string).split(',')
        : undefined,
      tags: req.query.tags
        ? (req.query.tags as string).split(',')
        : undefined,
      difficulty: req.query.difficulty as 'easy' | 'medium' | 'hard' | undefined,
      maxPrepTime: req.query.maxPrepTime
        ? parseInt(req.query.maxPrepTime as string, 10)
        : undefined,
      maxCookTime: req.query.maxCookTime
        ? parseInt(req.query.maxCookTime as string, 10)
        : undefined,
      page: req.query.page
        ? parseInt(req.query.page as string, 10)
        : undefined,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize as string, 10)
        : undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };

    const result = await this.recipeService.findAll(req.userId!, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
```

Note: `req.userId` comes from the auth middleware. Verify the property name by reading `packages/backend/src/api/middleware/auth.ts`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -w packages/backend -- --testPathPattern=recipe.service`
Expected: All 9 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/services/recipe/recipe.service.ts packages/backend/src/api/controllers/recipe.controller.ts packages/backend/src/__tests__/services/recipe.service.test.ts
git commit -m "feat: add server-side pagination and userId filter to recipe findAll"
```

---

## Task 5: Backend MealPlan + ShoppingList Pagination

**Files:**
- Modify: `packages/backend/src/services/meal-plan/meal-plan.service.ts:50-55`
- Modify: `packages/backend/src/services/shopping-list/shopping-list.service.ts:118-123`
- Modify: `packages/backend/src/api/controllers/meal-plan.controller.ts`
- Modify: `packages/backend/src/api/controllers/shopping-list.controller.ts`

- [ ] **Step 1: Update MealPlanService.findAll()**

In `packages/backend/src/services/meal-plan/meal-plan.service.ts`, replace the `findAll` method (lines 50-55) with:

```typescript
async findAll(
  userId: string,
  query: MealPlanSearchQuery = {}
): Promise<PaginatedResponse<MealPlan>> {
  const {
    page = PAGINATION_DEFAULTS.page,
    pageSize: rawPageSize = PAGINATION_DEFAULTS.pageSize,
    sortBy = 'startDate',
    sortOrder = 'desc',
    query: search,
  } = query;

  const pageSize = Math.min(rawPageSize, PAGINATION_DEFAULTS.maxPageSize);

  // Two-query approach: TypeORM's skip/take with leftJoinAndSelect on
  // collection relations (meals) produces incorrect counts and offsets.
  // First query: get paginated parent IDs only.
  // Second query: load full entities with relations for those IDs.
  const idsQb = this.mealPlanRepo
    .createQueryBuilder('mealPlan')
    .select('mealPlan.id')
    .where('mealPlan.userId = :userId', { userId });

  if (search) {
    idsQb.andWhere(
      '(mealPlan.name ILIKE :search OR mealPlan.description ILIKE :search)',
      { search: `%${search}%` }
    );
  }

  idsQb.orderBy(`mealPlan.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
    .skip((page - 1) * pageSize)
    .take(pageSize);

  const [idRows, total] = await idsQb.getManyAndCount();
  const ids = idRows.map(r => r.id);

  let data: MealPlan[] = [];
  if (ids.length > 0) {
    data = await this.mealPlanRepo
      .createQueryBuilder('mealPlan')
      .leftJoinAndSelect('mealPlan.meals', 'meal')
      .leftJoinAndSelect('meal.recipe', 'recipe')
      .whereInIds(ids)
      .orderBy(`mealPlan.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .getMany();
  }

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
```

Add imports: `PaginatedResponse`, `MealPlanSearchQuery`, `PAGINATION_DEFAULTS` from `@nommable/shared`.

- [ ] **Step 2: Update ShoppingListService.findAll()**

In `packages/backend/src/services/shopping-list/shopping-list.service.ts`, replace the `findAll` method (lines 118-123) with:

```typescript
async findAll(
  userId: string,
  query: ShoppingListSearchQuery = {}
): Promise<PaginatedResponse<ShoppingList>> {
  const {
    page = PAGINATION_DEFAULTS.page,
    pageSize: rawPageSize = PAGINATION_DEFAULTS.pageSize,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    query: search,
  } = query;

  const pageSize = Math.min(rawPageSize, PAGINATION_DEFAULTS.maxPageSize);

  // Two-query approach (same as MealPlan — see note there)
  const idsQb = this.shoppingListRepo
    .createQueryBuilder('shoppingList')
    .select('shoppingList.id')
    .where('shoppingList.userId = :userId', { userId });

  if (search) {
    idsQb.andWhere('shoppingList.name ILIKE :search', { search: `%${search}%` });
  }

  idsQb.orderBy(`shoppingList.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
    .skip((page - 1) * pageSize)
    .take(pageSize);

  const [idRows, total] = await idsQb.getManyAndCount();
  const ids = idRows.map(r => r.id);

  let data: ShoppingList[] = [];
  if (ids.length > 0) {
    data = await this.shoppingListRepo
      .createQueryBuilder('shoppingList')
      .leftJoinAndSelect('shoppingList.items', 'item')
      .leftJoinAndSelect('shoppingList.mealPlan', 'mealPlan')
      .whereInIds(ids)
      .orderBy(`shoppingList.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .getMany();
  }

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
```

Add imports: `PaginatedResponse`, `ShoppingListSearchQuery`, `PAGINATION_DEFAULTS` from `@nommable/shared`.

- [ ] **Step 3: Update meal plan controller findAll**

In the meal plan controller's `findAll` method, pass `req.userId` and parse query params (same pattern as recipe controller):

```typescript
async findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const query: MealPlanSearchQuery = {
      query: req.query.query as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };
    const result = await this.mealPlanService.findAll(req.userId!, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 4: Update shopping list controller findAll**

Same pattern for shopping list controller:

```typescript
async findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const query: ShoppingListSearchQuery = {
      query: req.query.query as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };
    const result = await this.shoppingListService.findAll(req.userId!, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 5: Find and update all other callers of the modified findAll methods**

Search the codebase for all callers of `recipeService.findAll`, `mealPlanService.findAll`, and `shoppingListService.findAll`. Each caller must now pass `userId` as the first argument. Common locations:
- Other controllers that call these services
- Any service-to-service calls

Run: `grep -rn "\.findAll(" packages/backend/src/ --include="*.ts"` to find all call sites.

Update each call site to pass the appropriate `userId`.

- [ ] **Step 6: Build backend to verify no compile errors**

Run: `npx tsc --noEmit -p packages/backend/tsconfig.json`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/services/ packages/backend/src/api/controllers/
git commit -m "feat: add pagination and userId filter to meal plan and shopping list findAll"
```

---

## Task 6: Frontend API Client Updates

**Files:**
- Modify: `packages/frontend/src/services/api.ts`

- [ ] **Step 1: Update recipeApi.getAll()**

In `packages/frontend/src/services/api.ts`, update the `getAll` method in `recipeApi` (around line 51):

```typescript
getAll: async (params?: RecipeSearchQuery): Promise<PaginatedResponse<Recipe>> => {
  const { data } = await api.get<PaginatedResponse<Recipe>>('/recipes', { params });
  return data;
},
```

Add import at top of file:

```typescript
import type { PaginatedResponse, RecipeSearchQuery, MealPlanSearchQuery, ShoppingListSearchQuery } from '@nommable/shared';
```

- [ ] **Step 2: Update mealPlanApi.getAll()**

```typescript
getAll: async (params?: MealPlanSearchQuery): Promise<PaginatedResponse<MealPlan>> => {
  const { data } = await api.get<PaginatedResponse<MealPlan>>('/meal-plans', { params });
  return data;
},
```

- [ ] **Step 3: Update shoppingListApi.getAll()**

```typescript
getAll: async (params?: ShoppingListSearchQuery): Promise<PaginatedResponse<ShoppingList>> => {
  const { data } = await api.get<PaginatedResponse<ShoppingList>>('/shopping-lists', { params });
  return data;
},
```

- [ ] **Step 4: Build frontend to check for type errors**

Run: `npx tsc --noEmit -p packages/frontend/tsconfig.json`
Expected: Type errors in RecipesPage, MealPlansPage, ShoppingListsPage where `.getAll()` return type changed from `T[]` to `PaginatedResponse<T>`. This is expected — we fix these in the next tasks.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/services/api.ts
git commit -m "feat: update frontend API client to accept pagination params and return PaginatedResponse"
```

---

## Task 7: useIsMobile Hook + Pagination Component

**Files:**
- Create: `packages/frontend/src/hooks/useIsMobile.ts`
- Create: `packages/frontend/src/components/Pagination.tsx`

- [ ] **Step 1: Create useIsMobile hook**

Create `packages/frontend/src/hooks/useIsMobile.ts`:

```typescript
import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
```

- [ ] **Step 2: Create Pagination component**

Create `packages/frontend/src/components/Pagination.tsx`:

```typescript
import { useIsMobile } from '@/hooks/useIsMobile';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  itemCount: number;
  onPageChange: (page: number) => void;
  /** For mobile load-more: called instead of onPageChange */
  onLoadMore?: () => void;
  isLoading?: boolean;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  itemCount,
  onPageChange,
  onLoadMore,
  isLoading,
}: PaginationProps) {
  const isMobile = useIsMobile();

  if (totalPages <= 1) return null;

  if (isMobile && onLoadMore) {
    const hasMore = page < totalPages;
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="text-sm text-muted-foreground">
          Showing {itemCount} of {total}
        </p>
        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        )}
      </div>
    );
  }

  // Desktop: page numbers
  const pages = getPageNumbers(page, totalPages);

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || isLoading}
        className="px-3 py-1 rounded border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        &lt;
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 py-1">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            disabled={isLoading}
            className={`px-3 py-1 rounded border ${
              p === page
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || isLoading}
        className="px-3 py-1 rounded border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        &gt;
      </button>
    </div>
  );
}

/** Generate page numbers with ellipsis: [1, 2, '...', 8, 9, 10] */
function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];

  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('...');

  pages.push(total);
  return pages;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/hooks/useIsMobile.ts packages/frontend/src/components/Pagination.tsx
git commit -m "feat: add useIsMobile hook and hybrid Pagination component"
```

---

## Task 8: Update RecipesPage — Server-Side Filtering + Pagination

**Files:**
- Modify: `packages/frontend/src/features/recipes/RecipesPage.tsx`

This is the largest frontend change. The page currently fetches all recipes and filters client-side. It must switch to passing filters as query params and using the Pagination component.

- [ ] **Step 1: Read the full RecipesPage.tsx**

Read `packages/frontend/src/features/recipes/RecipesPage.tsx` completely to understand:
- All state hooks and their usage
- The `loadRecipes` / fetch function
- Client-side filtering logic (lines 260-284)
- How categories/tags are populated
- The render structure

- [ ] **Step 2: Refactor state management**

Replace the client-side filter pattern with server-side query state. Key changes:

Add new state for pagination:
```typescript
const [page, setPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const [total, setTotal] = useState(0);
const [loadedRecipes, setLoadedRecipes] = useState<Recipe[]>([]); // for mobile load-more
```

- [ ] **Step 3: Refactor data fetching**

Replace the existing fetch function to pass all filters as query params:

```typescript
const loadRecipes = useCallback(async (pageNum: number, append = false) => {
  setLoading(true);
  try {
    const params: RecipeSearchQuery = {
      page: pageNum,
      pageSize: 20,
      query: searchQuery || undefined,
      categories: selectedCategories.size > 0 ? Array.from(selectedCategories) : undefined,
      tags: selectedDietaryTags.size > 0 ? Array.from(selectedDietaryTags) : undefined,
    };

    const result = await recipeApi.getAll(params);
    setTotal(result.total);
    setTotalPages(result.totalPages);
    setPage(result.page);

    if (append) {
      setLoadedRecipes(prev => [...prev, ...result.data]);
    } else {
      setLoadedRecipes(result.data);
    }
  } catch (error) {
    console.error('Failed to load recipes:', error);
  } finally {
    setLoading(false);
  }
}, [searchQuery, selectedCategories, selectedDietaryTags]);
```

Note: The current RecipesPage only has `searchQuery`, `selectedCategories`, and `selectedDietaryTags` as filter state — there are no `selectedDifficulty`, `maxPrepTime`, or `maxCookTime` state variables. The `RecipeSearchQuery` type supports these fields for future use, but don't reference state that doesn't exist. If you want to add difficulty/time filters, that's Phase 3 (Advanced Search) work.

- [ ] **Step 4: Remove client-side filtering and fix bulk select**

Remove the `filteredRecipes` computation (lines 260-284). Replace all references to `filteredRecipes` with `loadedRecipes` in the render.

**Bulk select-all:** The current `toggleSelectAll` uses `filteredRecipes` to select all visible recipes. With pagination, `loadedRecipes` only contains the current page. This is the correct behavior — "select all" means "select all on this page". Update the `toggleSelectAll` function to use `loadedRecipes` instead of `filteredRecipes`. The select-all checkbox label should clarify this: "Select all on page" or simply show the count like "Select 20".

- [ ] **Step 5: Re-fetch on filter change**

Add a useEffect that re-fetches when filters change:

```typescript
useEffect(() => {
  setPage(1);
  setLoadedRecipes([]);
  loadRecipes(1);
}, [loadRecipes]);
```

- [ ] **Step 6: Add Pagination component**

Import and add at the bottom of the recipe list:

```typescript
import { Pagination } from '@/components/Pagination';

// In the render, after the recipe grid:
<Pagination
  page={page}
  totalPages={totalPages}
  total={total}
  pageSize={20}
  itemCount={loadedRecipes.length}
  onPageChange={(p) => {
    setPage(p);
    loadRecipes(p);
  }}
  onLoadMore={() => loadRecipes(page + 1, true)}
  isLoading={loading}
/>
```

- [ ] **Step 7: Update recipe count display**

Change the recipe count header from `filteredRecipes.length` to use `total` from the paginated response:

```typescript
<span>{total} recipe{total !== 1 ? 's' : ''}</span>
```

- [ ] **Step 8: Test manually in browser**

Start the dev servers and verify:
1. Recipe list loads with pagination
2. Page numbers appear on desktop, "load more" on mobile (resize browser)
3. Filtering by search query fetches fresh results from server
4. Category/tag filters work
5. Page resets to 1 when filters change
6. "Showing X of Y" count is accurate on mobile

Run: `npm run dev`

- [ ] **Step 9: Commit**

```bash
git add packages/frontend/src/features/recipes/RecipesPage.tsx
git commit -m "feat: switch RecipesPage to server-side filtering with pagination"
```

---

## Task 9: Update MealPlansPage + ShoppingListsPage with Pagination

**Files:**
- Modify: `packages/frontend/src/features/meal-plans/MealPlansPage.tsx`
- Modify: `packages/frontend/src/features/shopping-lists/ShoppingListsPage.tsx`

- [ ] **Step 1: Read both page files fully**

Read `MealPlansPage.tsx` and `ShoppingListsPage.tsx` to understand their current data fetching and rendering patterns.

- [ ] **Step 2: Update MealPlansPage**

Apply the same pagination pattern as RecipesPage:

1. Add pagination state: `page`, `totalPages`, `total`, `loadedMealPlans`
2. Update `loadMealPlans` to pass query params and handle PaginatedResponse
3. Replace `mealPlans` references with `loadedMealPlans` (or rename appropriately)
4. Add `<Pagination>` component at the bottom of the list
5. Import Pagination and useCallback

- [ ] **Step 3: Update ShoppingListsPage**

Same pattern:

1. Add pagination state
2. Update the fetch function to pass query params and handle PaginatedResponse
3. Replace list references
4. Add `<Pagination>` component

Note: ShoppingListsPage has a master-detail layout (list + selected item detail). Pagination applies only to the list portion.

- [ ] **Step 4: Build and verify no type errors**

Run: `npx tsc --noEmit -p packages/frontend/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Test manually**

Start dev servers, verify pagination works on:
- `/meal-plans` — page numbers on desktop, load more on mobile
- `/shopping-lists` — same behavior, detail panel still works when selecting an item

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/features/meal-plans/MealPlansPage.tsx packages/frontend/src/features/shopping-lists/ShoppingListsPage.tsx
git commit -m "feat: add pagination to meal plans and shopping lists pages"
```

---

## Task 10: Extract Express App for Testability + Integration Tests

**Files:**
- Modify: `packages/backend/src/index.ts`
- Create: `packages/backend/src/app.ts`
- Create: `packages/backend/src/__tests__/routes/recipe.routes.test.ts`

The Express `app` is currently created inside `bootstrap()` in `index.ts` and never exported. Integration tests need to import the app without calling `.listen()`. This requires extracting app creation into a separate module.

- [ ] **Step 1: Extract createApp() into packages/backend/src/app.ts**

Create `packages/backend/src/app.ts` that contains the Express app setup (middleware, routes, error handler) without the database initialization or `.listen()` call:

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import routes from './api/routes';
import { errorHandler } from './api/middleware';
import { swaggerSpec } from './config/swagger';

export function createApp(): express.Express {
  const app = express();

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors({ origin: config.cors.origin, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Nommable API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  }));

  app.use('/api', routes);
  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 2: Refactor index.ts to use createApp()**

Update `packages/backend/src/index.ts` to import and use `createApp()`:

```typescript
import { config } from './config';
import { AppDataSource } from './db/data-source';
import { AdminInitService } from './services/admin/admin-init.service';
import { TaxonomyService } from './services/taxonomy/taxonomy.service';
import { createApp } from './app';

async function bootstrap() {
  // Database initialization with retry logic (keep existing code)
  const maxRetries = 5;
  let retries = 0;
  while (retries < maxRetries) {
    try {
      await AppDataSource.initialize();
      console.log('✓ Database connected');
      break;
    } catch (error) {
      retries++;
      console.error(`Failed to connect to database (attempt ${retries}/${maxRetries}):`, error);
      if (retries === maxRetries) {
        console.error('Max retries reached. Exiting...');
        process.exit(1);
      }
      console.log(`Retrying in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  await AdminInitService.initializeAdminAccount();

  const taxonomyService = new TaxonomyService();
  await taxonomyService.seed();
  console.log('✓ Taxonomy data seeded');

  const app = createApp();

  app.listen(config.port, config.host, () => {
    console.log(`✓ Server running on http://${config.host}:${config.port}`);
    console.log(`✓ Environment: ${config.env}`);
  });
}

bootstrap();
```

- [ ] **Step 3: Verify refactor didn't break anything**

Run: `npm run dev:backend`
Expected: Server starts normally, no errors

- [ ] **Step 4: Write route integration tests**

Create `packages/backend/src/__tests__/routes/recipe.routes.test.ts`:

```typescript
import request from 'supertest';
import { createApp } from '../../app';
import { createTestToken } from '../helpers/auth';
import { buildRecipeDtos } from '../helpers/fixtures';

const app = createApp();

describe('GET /api/recipes', () => {
  const userId = 'integration-test-user';
  let token: string;

  beforeAll(async () => {
    token = createTestToken(userId);
    // Seed recipes via API
    for (const dto of buildRecipeDtos(5)) {
      await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${token}`)
        .send(dto);
    }
  });

  it('returns paginated response with default params', async () => {
    const res = await request(app)
      .get('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('pageSize', 20);
    expect(res.body).toHaveProperty('totalPages');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('respects page and pageSize query params', async () => {
    const res = await request(app)
      .get('/api/recipes?page=1&pageSize=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pageSize).toBe(2);
  });

  it('filters by search query', async () => {
    const res = await request(app)
      .get('/api/recipes?query=Recipe+1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('returns 401 without auth token', async () => {
    await request(app).get('/api/recipes').expect(401);
  });
});
```

- [ ] **Step 5: Run integration tests**

Run: `npm run test -w packages/backend -- --testPathPattern=recipe.routes`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/app.ts packages/backend/src/index.ts packages/backend/src/__tests__/routes/recipe.routes.test.ts
git commit -m "refactor: extract createApp() for testability, add integration tests for paginated recipe endpoint"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run all backend tests**

Run: `npm run test -w packages/backend`
Expected: All tests pass

- [ ] **Step 2: Run all frontend tests**

Run: `npm run test -w packages/frontend`
Expected: Smoke test passes

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: Clean build across all packages

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: No new lint errors. Fix any that appear.

- [ ] **Step 5: Manual end-to-end test**

Run: `npm run dev`

Verify in browser:
- [ ] Recipe list paginates (desktop page numbers, mobile load more)
- [ ] Meal plan list paginates
- [ ] Shopping list paginates
- [ ] Search + category filters work on recipes (server-side, results update correctly)
- [ ] Page resets to 1 on filter change
- [ ] Empty states work (no recipes matching filter)
- [ ] "Showing X of Y" is accurate

- [ ] **Step 6: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: address lint and build issues from pagination implementation"
```
