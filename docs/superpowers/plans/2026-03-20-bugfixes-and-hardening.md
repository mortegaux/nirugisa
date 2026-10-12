# Bugfixes & Hardening Implementation Plan

> **Status: ✅ COMPLETE** — all 15 tasks implemented and committed on branch `fix/bugfixes-and-hardening`, plus 3 additional ownership fixes discovered during implementation. Build passes across all packages (`npm run build`). Merged to `main` on 2026-08-28.
>
> **Note:** The backend Jest runner cannot start in this environment because `ts-node` (required to parse `jest.config.ts`) is not installed — a pre-existing gap that also affected `main`. Task 15 fixed the jest/ts-jest version incompatibility; installing `ts-node` as a devDependency remains a follow-up to make the suite runnable.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all identified security vulnerabilities, logic bugs, and code quality issues across backend, frontend, and infrastructure.

**Architecture:** Backend fixes add `userId` parameters to service methods and filter queries accordingly. Controllers pass `req.userId!` to every service call. Frontend fixes address stale closures, missing state initialization, and timer drift. Infrastructure fixes gate dangerous defaults behind environment checks.

**Tech Stack:** TypeORM (backend services), React hooks (frontend), Docker Compose (infra)

---

## File Structure

### Modified files — Backend (Priority 1: Security)
- `packages/backend/src/services/recipe/recipe.service.ts` — Add userId to findById, update, delete, bulkDelete, bulkUpdate
- `packages/backend/src/api/controllers/recipe.controller.ts` — Pass req.userId! to all service calls
- `packages/backend/src/services/meal-plan/meal-plan.service.ts` — Add userId to findById, update, delete, bulkDelete, addMeal, removeMeal
- `packages/backend/src/api/controllers/meal-plan.controller.ts` — Pass req.userId! to all service calls
- `packages/backend/src/services/shopping-list/shopping-list.service.ts` — Add userId to findById, update, delete, toggleItem
- `packages/backend/src/api/controllers/shopping-list.controller.ts` — Pass req.userId! to all service calls
- `packages/backend/src/services/pantry/pantry.service.ts` — Add userId to all methods
- `packages/backend/src/api/controllers/pantry.controller.ts` — Pass req.userId! to all service calls
- `packages/backend/src/services/analytics/analytics.service.ts` — Add userId to all query methods
- `packages/backend/src/api/controllers/analytics.controller.ts` — Pass req.userId! to service calls
- `packages/backend/src/services/meal-plan/shopping-list-integration.service.ts` — Add userId to lookups
- `packages/backend/src/services/calendar/calendar-export.service.ts` — Add userId param

### Modified files — Backend (Priority 2: Critical bugs)
- `packages/backend/src/services/scraper/scraper.service.ts` — Fix shell injection (line 74), fix JSON-LD @type matching (line 207)
- `packages/backend/src/api/routes/settings.routes.ts` — Add requireAdmin + scope to user
- `packages/backend/src/services/seeder/seeder.service.ts` — Scope clear to single user
- `packages/backend/src/api/controllers/settings.controller.ts` — Pass userId
- `packages/backend/src/api/middleware/validation.ts` — Assign parse result to req.body/req.query
- `packages/backend/src/api/middleware/upload.ts` — Derive extension from MIME type

### Modified files — Frontend (Priority 3)
- `packages/frontend/src/features/meal-plans/MealPlanDashboard.tsx` — Remove Math.random(), fix date sorting
- `packages/frontend/src/features/recipes/RecipeDetailPage.tsx` — Initialize isFavorite from API
- `packages/frontend/src/components/Timer.tsx` — Use functional state updates in setInterval
- `packages/frontend/src/features/recipes/RecipesPage.tsx` — Fix stale page in handleBulkUpdate
- `packages/frontend/src/features/collections/CollectionDetailPage.tsx` — Add AbortController
- `packages/frontend/src/features/settings/AccountSettings.tsx` — Clean up setTimeout on unmount
- `packages/frontend/src/features/preferences/PreferencesPage.tsx` — Clean up setTimeout on unmount

### Modified files — Infrastructure (Priority 4)
- `packages/backend/src/db/data-source.ts` — Gate synchronize on env, fix migrations glob
- `packages/backend/package.json` — Fix ts-jest/jest version incompatibility
- `packages/shared/src/types/meal-plan.ts` — Type recipe field properly
- `packages/shared/src/types/meal-plan-template.ts` — Type recipe field properly
- `release/docker-compose.yml` — Change CORS_ORIGIN default

---

## Task 1: Recipe Service — Add Ownership Checks

**Files:**
- Modify: `packages/backend/src/services/recipe/recipe.service.ts`
- Modify: `packages/backend/src/api/controllers/recipe.controller.ts`

- [ ] **Step 1: Update `findById` to require userId**

In `recipe.service.ts`, change the `findById` method (line 177):

```typescript
// BEFORE:
async findById(id: string): Promise<Recipe> {
  const recipe = await this.recipeRepo.findOne({
    where: { id },

// AFTER:
async findById(id: string, userId: string): Promise<Recipe> {
  const recipe = await this.recipeRepo.findOne({
    where: { id, userId },
```

- [ ] **Step 2: Update `update` to require userId**

In `recipe.service.ts`, change the `update` method (line 191):

```typescript
// BEFORE:
async update(id: string, dto: RecipeUpdateDto): Promise<Recipe> {
  const recipe = await this.findById(id);

// AFTER:
async update(id: string, userId: string, dto: RecipeUpdateDto): Promise<Recipe> {
  const recipe = await this.findById(id, userId);
```

- [ ] **Step 3: Update `delete` to require userId**

In `recipe.service.ts`, change the `delete` method (line 240):

```typescript
// BEFORE:
async delete(id: string): Promise<void> {
  const recipe = await this.findById(id);

// AFTER:
async delete(id: string, userId: string): Promise<void> {
  const recipe = await this.findById(id, userId);
```

- [ ] **Step 4: Update `bulkDelete` to require userId**

In `recipe.service.ts`, change `bulkDelete` (line 245). This method uses `find + remove` (not a direct `delete`), so add userId to the find query:

```typescript
// BEFORE:
async bulkDelete(ids: string[]): Promise<number> {
  const recipes = await this.recipeRepo.find({
    where: { id: In(ids) },
  });

// AFTER:
async bulkDelete(ids: string[], userId: string): Promise<number> {
  const recipes = await this.recipeRepo.find({
    where: { id: In(ids), userId },
  });
```

- [ ] **Step 5: Update `bulkUpdate` to require userId**

In `recipe.service.ts`, change `bulkUpdate` (line 270). Like bulkDelete, this uses `find + save`, so add userId to the find query:

```typescript
// BEFORE:
async bulkUpdate(ids: string[], updates: { tags?: string[]; categories?: string[] }): Promise<number> {
  const recipes = await this.recipeRepo.find({
    where: { id: In(ids) },
  });

// AFTER:
async bulkUpdate(ids: string[], userId: string, updates: { tags?: string[]; categories?: string[] }): Promise<number> {
  const recipes = await this.recipeRepo.find({
    where: { id: In(ids), userId },
  });
```

- [ ] **Step 6: Update recipe controller to pass userId**

In `recipe.controller.ts`, update all calls that don't pass userId:

```typescript
// findById (line 129): change
this.recipeService.findById(req.params.id)
// to
this.recipeService.findById(req.params.id, req.userId!)

// update (line 200): change
this.recipeService.update(req.params.id, recipeData)
// to
this.recipeService.update(req.params.id, req.userId!, recipeData)

// delete (line 209): change
this.recipeService.delete(req.params.id)
// to
this.recipeService.delete(req.params.id, req.userId!)

// enhanceWithAI (line 280): change
this.recipeService.findById(req.params.id)
// to
this.recipeService.findById(req.params.id, req.userId!)

// uploadImage (line 328): change
this.recipeService.update(req.params.id, { imageUrl, })
// to
this.recipeService.update(req.params.id, req.userId!, { imageUrl, })

// bulkDelete (line 472): change
this.recipeService.bulkDelete(ids)
// to
this.recipeService.bulkDelete(ids, req.userId!)

// bulkUpdate (line 492): change
this.recipeService.bulkUpdate(ids, { tags, categories })
// to
this.recipeService.bulkUpdate(ids, req.userId!, { tags, categories })
```

- [ ] **Step 7: Verify build passes**

Run: `cd /Users/tuesday/projects/nommable && npm run build`

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/services/recipe/recipe.service.ts packages/backend/src/api/controllers/recipe.controller.ts
git commit -m "fix: add userId ownership checks to recipe service methods"
```

---

## Task 2: Meal Plan Service — Add Ownership Checks

**Files:**
- Modify: `packages/backend/src/services/meal-plan/meal-plan.service.ts`
- Modify: `packages/backend/src/api/controllers/meal-plan.controller.ts`
- Modify: `packages/backend/src/services/calendar/calendar-export.service.ts`

- [ ] **Step 1: Update `findById` to require userId**

In `meal-plan.service.ts` (line 99):

```typescript
// BEFORE:
async findById(id: string): Promise<MealPlan> {
  const mealPlan = await this.mealPlanRepo.findOne({
    where: { id },

// AFTER:
async findById(id: string, userId: string): Promise<MealPlan> {
  const mealPlan = await this.mealPlanRepo.findOne({
    where: { id, userId },
```

- [ ] **Step 2: Update `update`, `delete`, `bulkDelete` to require userId**

```typescript
// update (line 113):
async update(id: string, userId: string, dto: MealPlanUpdateDto): Promise<MealPlan> {
  const mealPlan = await this.findById(id, userId);

// delete (line 147):
async delete(id: string, userId: string): Promise<void> {
  const mealPlan = await this.findById(id, userId);

// bulkDelete (line 152) — uses find + remove pattern, add userId to find:
async bulkDelete(ids: string[], userId: string): Promise<number> {
  const mealPlans = await this.mealPlanRepo.find({ where: { id: In(ids), userId } });
```

- [ ] **Step 3: Update `addMeal` and `removeMeal` to require userId**

```typescript
// addMeal (line 167):
async addMeal(mealPlanId: string, userId: string, meal: {...}): Promise<MealPlan> {
  const mealPlan = await this.findById(mealPlanId, userId);

// removeMeal (line 190):
async removeMeal(mealPlanId: string, userId: string, mealId: string): Promise<MealPlan> {
  const mealPlan = await this.findById(mealPlanId, userId);
```

- [ ] **Step 4: Update CalendarExportService to require userId**

In `calendar-export.service.ts` (line 6):

```typescript
// BEFORE:
static async exportMealPlanToICS(mealPlanId: string): Promise<string> {

// AFTER:
static async exportMealPlanToICS(mealPlanId: string, userId: string): Promise<string> {
```

And update the meal plan lookup inside to use the MealPlanService with userId, or add a direct query with `{ id: mealPlanId, userId }`.

- [ ] **Step 5: Update meal plan controller to pass userId**

In `meal-plan.controller.ts`, update all calls:

```typescript
// findById (line 38):
this.mealPlanService.findById(req.params.id, req.userId!)

// update (line 47):
this.mealPlanService.update(req.params.id, req.userId!, req.body)

// delete (line 56):
this.mealPlanService.delete(req.params.id, req.userId!)

// bulkDelete (line 65):
this.mealPlanService.bulkDelete(ids, req.userId!)

// addMeal (line 78):
this.mealPlanService.addMeal(req.params.id, req.userId!, req.body)

// removeMeal (line 87):
this.mealPlanService.removeMeal(req.params.id, req.userId!, req.params.mealId)

// exportToCalendar (line 191):
CalendarExportService.exportMealPlanToICS(req.params.id, req.userId!)
```

- [ ] **Step 6: Verify build passes**

Run: `cd /Users/tuesday/projects/nommable && npm run build`

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/services/meal-plan/meal-plan.service.ts packages/backend/src/api/controllers/meal-plan.controller.ts packages/backend/src/services/calendar/calendar-export.service.ts
git commit -m "fix: add userId ownership checks to meal plan service methods"
```

---

## Task 3: Shopping List Service — Add Ownership Checks

**Files:**
- Modify: `packages/backend/src/services/shopping-list/shopping-list.service.ts`
- Modify: `packages/backend/src/api/controllers/shopping-list.controller.ts`
- Modify: `packages/backend/src/services/meal-plan/shopping-list-integration.service.ts`

- [ ] **Step 1: Update `findById`, `update`, `delete`, `toggleItem` to require userId**

In `shopping-list.service.ts`:

```typescript
// findById (line 167):
async findById(id: string, userId: string): Promise<ShoppingList> {
  const list = await this.shoppingListRepo.findOne({
    where: { id, userId },

// update (line 181):
async update(id: string, userId: string, dto: ShoppingListUpdateDto): Promise<ShoppingList> {
  const list = await this.findById(id, userId);

// delete (line 216):
async delete(id: string, userId: string): Promise<void> {
  const list = await this.findById(id, userId);

// toggleItem (line 221):
async toggleItem(listId: string, userId: string, itemId: string): Promise<ShoppingList> {
  const list = await this.findById(listId, userId);
```

- [ ] **Step 2: Update shopping list controller**

In `shopping-list.controller.ts`:

```typescript
// findById (line 46):
this.shoppingListService.findById(req.params.id, req.userId!)

// update (line 55):
this.shoppingListService.update(req.params.id, req.userId!, req.body)

// delete (line 67):
this.shoppingListService.delete(req.params.id, req.userId!)

// toggleItem (line 76):
this.shoppingListService.toggleItem(req.params.id, req.userId!, req.params.itemId)
```

- [ ] **Step 3: Update ShoppingListIntegrationService**

In `shopping-list-integration.service.ts`:

The `addMissingIngredientsToShoppingList` method (line 68) already takes `userId`. Fix the internal lookups:

```typescript
// Line 91-98: When shoppingListId is provided, add userId:
const existingList = await shoppingListRepo.findOne({
  where: { id: shoppingListId, userId },

// Line 101-113: When looking up by name, add userId:
const existingList = await shoppingListRepo.findOne({
  where: { name: 'Meal Plan Ingredients', userId },
```

- [ ] **Step 4: Verify build passes**

Run: `cd /Users/tuesday/projects/nommable && npm run build`

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/services/shopping-list/shopping-list.service.ts packages/backend/src/api/controllers/shopping-list.controller.ts packages/backend/src/services/meal-plan/shopping-list-integration.service.ts
git commit -m "fix: add userId ownership checks to shopping list service methods"
```

---

## Task 4: Pantry Service — Add Ownership Checks

**Files:**
- Modify: `packages/backend/src/services/pantry/pantry.service.ts`
- Modify: `packages/backend/src/api/controllers/pantry.controller.ts`

- [ ] **Step 1: Add userId to all pantry service methods**

In `pantry.service.ts`:

```typescript
// getAllItems (line 8) — preserve existing sort order:
async getAllItems(userId: string): Promise<PantryItem[]> {
  return this.pantryRepo.find({ where: { userId }, order: { category: 'ASC', name: 'ASC' } });

// getItemById (line 14):
async getItemById(id: string, userId: string): Promise<PantryItem | null> {
  return this.pantryRepo.findOne({ where: { id, userId } });

// updateItem (line 29) — currently throws Error, keep as Error for consistency:
async updateItem(id: string, userId: string, data: PantryItemUpdateDto): Promise<PantryItem> {
  const item = await this.getItemById(id, userId);
  if (!item) throw new Error('Pantry item not found');

// deleteItem (line 39) — currently uses direct delete + affected check, switch to
// find-first to enforce userId, then delete:
async deleteItem(id: string, userId: string): Promise<void> {
  const result = await this.pantryRepo.delete({ id, userId });
  if (result.affected === 0) throw new Error('Pantry item not found');

// getExpiringItems (line 46):
async getExpiringItems(userId: string, daysAhead: number = 7): Promise<PantryItem[]> {
  // Add .andWhere('pantry_item.userId = :userId', { userId }) to the query builder

// getLowStockItems (line 58) — preserve existing sort order:
async getLowStockItems(userId: string): Promise<PantryItem[]> {
  return this.pantryRepo.find({ where: { userId, isLowStock: true }, order: { name: 'ASC' } });

// updateQuantity (line 65):
async updateQuantity(id: string, userId: string, quantityChange: number): Promise<PantryItem> {
  const item = await this.getItemById(id, userId);
  if (!item) throw new Error('Pantry item not found');

// toggleLowStock (line 81):
async toggleLowStock(id: string, userId: string): Promise<PantryItem> {
  const item = await this.getItemById(id, userId);
  if (!item) throw new Error('Pantry item not found');
```

- [ ] **Step 2: Update pantry controller to pass userId**

In `pantry.controller.ts`:

```typescript
// getAll (line 8):
pantryService.getAllItems(req.userId!)

// getById (line 17):
pantryService.getItemById(req.params.id, req.userId!)

// update (line 38):
pantryService.updateItem(req.params.id, req.userId!, req.body)

// delete (line 47):
pantryService.deleteItem(req.params.id, req.userId!)

// getExpiring (line 56):
pantryService.getExpiringItems(req.userId!, daysAhead)

// getLowStock (line 66):
pantryService.getLowStockItems(req.userId!)

// updateQuantity (line 75):
pantryService.updateQuantity(req.params.id, req.userId!, quantityChange)

// toggleLowStock (line 85):
pantryService.toggleLowStock(req.params.id, req.userId!)
```

- [ ] **Step 3: Verify build passes**

Run: `cd /Users/tuesday/projects/nommable && npm run build`

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/services/pantry/pantry.service.ts packages/backend/src/api/controllers/pantry.controller.ts
git commit -m "fix: add userId ownership checks to pantry service methods"
```

---

## Task 5: Analytics Service — Add User Scoping

**Files:**
- Modify: `packages/backend/src/services/analytics/analytics.service.ts`
- Modify: `packages/backend/src/api/controllers/analytics.controller.ts`

- [ ] **Step 1: Add userId parameter to getAnalyticsSummary and all private methods**

In `analytics.service.ts`, every method that queries MealPlan/MealPlanRecipe needs userId:

```typescript
// getAnalyticsSummary (line 77):
async getAnalyticsSummary(userId: string): Promise<AnalyticsSummary> {

// getMealHistory (line 318):
async getMealHistory(userId: string, limit: number = 50): Promise<any[]> {
```

Every private method must accept userId and add `.where('mp.userId = :userId', { userId })` (or equivalent) to its query builder. This applies to:
- `getTotalMealPlans(userId)` — add `where: { userId }` to count
- `getTotalMeals(userId)` — add `.where('mp.userId = :userId', { userId })`
- `getDateRange(userId)` — same
- `getMostCookedRecipes(userId)` — same
- `getMealTypeDistribution(userId)` — same
- `getCookingFrequency(userId)` — same
- `getRecipeVariety(userId)` — same
- `getNutritionTrends(userId)` — same
- `getCategoryPopularity(userId)` — same
- `getAiGeneratedRatio(userId)` — same

- [ ] **Step 2: Update analytics controller**

In `analytics.controller.ts`:

```typescript
// getAnalyticsSummary (line 6):
const summary = await analyticsService.getAnalyticsSummary(req.userId!);

// getMealHistory (line 17):
const history = await analyticsService.getMealHistory(req.userId!, limit);
```

- [ ] **Step 3: Verify build passes**

Run: `cd /Users/tuesday/projects/nommable && npm run build`

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/services/analytics/analytics.service.ts packages/backend/src/api/controllers/analytics.controller.ts
git commit -m "fix: scope analytics queries to authenticated user"
```

---

## Task 6: Fix Shell Command Injection in Scraper

**Files:**
- Modify: `packages/backend/src/services/scraper/scraper.service.ts`

- [ ] **Step 1: Replace execAsync with execFile**

At the top of `scraper.service.ts`, add:

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
```

Then at line 74, replace:

```typescript
// BEFORE:
const { stdout, stderr } = await execAsync(`python "${scriptPath}" "${url}"`, {
  timeout: 30000,
});

// AFTER:
const { stdout, stderr } = await execFileAsync('python', [scriptPath, url], {
  timeout: 30000,
});
```

- [ ] **Step 2: Fix JSON-LD @type array matching**

At line 206-207, replace:

```typescript
// BEFORE:
const typeStr = Array.isArray(data['@type']) ? data['@type'].join(' ') : data['@type'];
if (typeStr === 'Recipe') return data;

// AFTER:
const types = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
if (types.includes('Recipe')) return data;
```

- [ ] **Step 3: Verify build passes**

Run: `cd /Users/tuesday/projects/nommable && npm run build`

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/services/scraper/scraper.service.ts
git commit -m "fix: prevent shell injection in scraper, fix JSON-LD @type array matching"
```

---

## Task 7: Fix Data Clear Endpoint — Require Admin + Scope to User

**Files:**
- Modify: `packages/backend/src/api/routes/settings.routes.ts`
- Modify: `packages/backend/src/services/seeder/seeder.service.ts`
- Modify: `packages/backend/src/api/controllers/settings.controller.ts`

- [ ] **Step 1: Add requireAdmin to settings route**

In `settings.routes.ts`:

```typescript
import { authMiddleware, requireAdmin } from '../middleware';

// Change line 11:
router.delete('/data/clear', requireAdmin, SettingsController.clearData);
```

- [ ] **Step 2: Scope SeederService.clearUserData to accept userId**

In `seeder.service.ts`, change `clearUserData` to delete only the requesting user's data instead of TRUNCATE CASCADE on all tables. Use TypeORM delete with userId filter on each table, or use a transaction with DELETE FROM ... WHERE userId = ?.

- [ ] **Step 3: Update settings controller to pass userId**

In `settings.controller.ts`:

```typescript
static async clearData(req: Request, res: Response) {
  await SeederService.clearUserData(req.userId!);
  // ...
}
```

- [ ] **Step 4: Verify build passes**

Run: `cd /Users/tuesday/projects/nommable && npm run build`

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/api/routes/settings.routes.ts packages/backend/src/services/seeder/seeder.service.ts packages/backend/src/api/controllers/settings.controller.ts
git commit -m "fix: require admin for data clear, scope deletion to requesting user"
```

---

## Task 8: Fix Validation Middleware — Assign Parse Results

**Files:**
- Modify: `packages/backend/src/api/middleware/validation.ts`

- [ ] **Step 1: Assign parse results to req.body and req.query**

```typescript
// BEFORE (line 8):
schema.parse(req.body);

// AFTER:
req.body = schema.parse(req.body);

// BEFORE (line 20):
schema.parse(req.query);

// AFTER:
req.query = schema.parse(req.query) as any;
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/api/middleware/validation.ts
git commit -m "fix: assign Zod parse results to req.body/req.query for transforms"
```

---

## Task 9: Fix File Upload Extension Derivation

**Files:**
- Modify: `packages/backend/src/api/middleware/upload.ts`

- [ ] **Step 1: Derive extension from MIME type instead of originalname**

Add a MIME-to-extension map and use it in the filename callback (lines 23-27 and the profile photo equivalent):

```typescript
const mimeToExt: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

// In filename callback:
const ext = mimeToExt[file.mimetype] || path.extname(file.originalname);
cb(null, `recipe-${uniqueSuffix}${ext}`);
```

Apply the same pattern to the profile photo upload storage.

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/api/middleware/upload.ts
git commit -m "fix: derive file extension from MIME type instead of user-supplied filename"
```

---

## Task 10: Fix MealPlanDashboard — Remove Math.random(), Fix Date Sorting

**Files:**
- Modify: `packages/frontend/src/features/meal-plans/MealPlanDashboard.tsx`

- [ ] **Step 1: Replace Math.random() with real nutrition aggregation**

Replace lines 78-81 with actual aggregation from recipe nutrition data:

Note: The `NutritionInfo` type in `packages/shared/src/types/recipe.ts` uses `carbohydrates` as the field name. The `meal.recipe` field is typed as `any` in the shared types (fix in Task 15), so verify at runtime which key the JSON column uses. The shared type says `carbohydrates`.

```typescript
const calculateNutritionSummary = () => {
  if (!mealPlan) return null;
  const totalMeals = mealPlan.meals.length;
  if (totalMeals === 0) return null;

  let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
  let mealsWithNutrition = 0;

  for (const meal of mealPlan.meals) {
    const nutrition = meal.recipe?.nutrition;
    if (nutrition) {
      mealsWithNutrition++;
      totalCalories += nutrition.calories || 0;
      totalProtein += nutrition.protein || 0;
      totalCarbs += nutrition.carbohydrates || 0;
      totalFat += nutrition.fat || 0;
    }
  }

  if (mealsWithNutrition === 0) return null;

  return {
    avgCalories: Math.round(totalCalories / mealsWithNutrition),
    avgProtein: Math.round(totalProtein / mealsWithNutrition),
    avgCarbs: Math.round(totalCarbs / mealsWithNutrition),
    avgFat: Math.round(totalFat / mealsWithNutrition),
  };
};
```

- [ ] **Step 2: Fix date grouping to use ISO strings**

Replace the `toDateString()` call used for grouping keys with an ISO date string:

```typescript
// BEFORE:
const dateKey = new Date(meal.date).toDateString();

// AFTER:
const dateKey = new Date(meal.date).toISOString().split('T')[0];
```

Update the rendering code that displays the date key to format it for display (e.g., `new Date(dateKey + 'T00:00:00').toLocaleDateString()`).

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/features/meal-plans/MealPlanDashboard.tsx
git commit -m "fix: use real nutrition data instead of random values, fix date sorting"
```

---

## Task 11: Fix RecipeDetailPage — Initialize isFavorite

**Files:**
- Modify: `packages/frontend/src/features/recipes/RecipeDetailPage.tsx`

- [ ] **Step 1: Initialize isFavorite from collection service on recipe load**

The recipe API does NOT return `isFavorite` — the backend has a separate `CollectionService.isFavorite(userId, recipeId)` method. The frontend has `collectionApi.toggleFavorite(recipeId)` but no dedicated "check favorite" endpoint. Two options:

**Option A (preferred — add backend support):** In `recipe.controller.ts` `findById`, call `collectionService.isFavorite(req.userId!, req.params.id)` and include it in the response alongside `userRating`:

```typescript
// In recipe.controller.ts findById:
const isFavorite = await this.collectionService.isFavorite(req.userId!, req.params.id);
res.json({ ...recipe, userRating, isFavorite });
```

Then in the frontend `loadRecipe`:
```typescript
setIsFavorite((response.data as any).isFavorite ?? false);
```

**Option B (frontend-only):** Add a `collectionApi.isFavorite(recipeId)` method that calls a new endpoint, and call it in `loadRecipe`. This requires adding a new route + controller method on the backend.

Use Option A — it's a single line change in the existing controller.

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/features/recipes/RecipeDetailPage.tsx
git commit -m "fix: initialize isFavorite state from API response on recipe load"
```

---

## Task 12: Fix Timer.tsx — Reduce Interval Churn

**Files:**
- Modify: `packages/frontend/src/components/Timer.tsx`

**Context:** The current timer works correctly — `minutes` and `seconds` are in the dependency array so the effect re-runs every tick with fresh values. There is no stale closure bug. However, clearing and recreating the interval every second is inefficient and can cause minor drift over long durations. The fix is to use a single `totalSeconds` state with a functional updater so the interval is stable.

- [ ] **Step 1: Refactor to single `totalSeconds` state**

Replace the separate `minutes`/`seconds` state with a single `totalSeconds`:

```typescript
const [totalSeconds, setTotalSeconds] = useState(initialMinutes * 60);
const [isRunning, setIsRunning] = useState(false);
const [isComplete, setIsComplete] = useState(false);
const audioRef = useRef<HTMLAudioElement | null>(null);

// Derive display values
const minutes = Math.floor(totalSeconds / 60);
const seconds = totalSeconds % 60;

useEffect(() => {
  if (!isRunning || isComplete) return;

  const interval = setInterval(() => {
    setTotalSeconds((prev) => {
      if (prev <= 1) {
        setIsRunning(false);
        setIsComplete(true);
        onComplete?.();
        if (audioRef.current) {
          audioRef.current.play();
        }
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Timer Complete!', {
            body: `${label} is done`,
            icon: '/favicon.ico',
          });
        }
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [isRunning, isComplete, label, onComplete]);
```

Update `toggleTimer`, `resetTimer`, `addMinute`, `removeMinute` to use `setTotalSeconds`:

```typescript
const toggleTimer = () => {
  if (isComplete) {
    setTotalSeconds(initialMinutes * 60);
    setIsComplete(false);
  } else {
    setIsRunning(!isRunning);
  }
};

const resetTimer = () => {
  setIsRunning(false);
  setTotalSeconds(initialMinutes * 60);
  setIsComplete(false);
};

const addMinute = () => {
  if (!isRunning) setTotalSeconds((prev) => prev + 60);
};

const removeMinute = () => {
  if (!isRunning) setTotalSeconds((prev) => Math.max(0, prev - 60));
};
```

Update the progress calculation:

```typescript
const progress = ((initialMinutes * 60 - totalSeconds) / (initialMinutes * 60)) * 100;
```

The `formatTime(minutes, seconds)` call and JSX remain unchanged since `minutes`/`seconds` are derived.

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/components/Timer.tsx
git commit -m "fix: use functional state updates in timer to prevent drift"
```

---

## Task 13: Fix RecipesPage — Stale Page in handleBulkUpdate

**Files:**
- Modify: `packages/frontend/src/features/recipes/RecipesPage.tsx`

- [ ] **Step 1: Fix handleBulkUpdate to always reload from page 1**

At line 323, change:

```typescript
// BEFORE:
loadRecipes(page);

// AFTER:
loadRecipes(1);
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/features/recipes/RecipesPage.tsx
git commit -m "fix: reload from page 1 after bulk update to avoid stale page reference"
```

---

## Task 14: Fix setTimeout Leaks in Settings Pages

**Files:**
- Modify: `packages/frontend/src/features/settings/AccountSettings.tsx`
- Modify: `packages/frontend/src/features/preferences/PreferencesPage.tsx`

- [ ] **Step 1: Add timeout cleanup ref to AccountSettings**

```typescript
// Add near top of component:
const successTimeoutRef = useRef<NodeJS.Timeout>();

// In showSuccess, replace setTimeout:
const showSuccess = (message: string) => {
  setSuccessMessage(message);
  setErrorMessage('');
  if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
  successTimeoutRef.current = setTimeout(() => setSuccessMessage(''), 5000);
};

// Add cleanup effect:
useEffect(() => {
  return () => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
  };
}, []);
```

- [ ] **Step 2: Add timeout cleanup ref to PreferencesPage**

Same pattern — add a ref, clear on unmount:

```typescript
const messageTimeoutRef = useRef<NodeJS.Timeout>();

// In handleSave, replace setTimeout:
if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
messageTimeoutRef.current = setTimeout(() => setMessage(''), 3000);

// Add cleanup effect:
useEffect(() => {
  return () => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
  };
}, []);
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/features/settings/AccountSettings.tsx packages/frontend/src/features/preferences/PreferencesPage.tsx
git commit -m "fix: clean up success message timeouts on component unmount"
```

---

## Task 15: Infrastructure Fixes

**Files:**
- Modify: `packages/backend/src/db/data-source.ts`
- Modify: `packages/backend/package.json`
- Modify: `packages/shared/src/types/meal-plan.ts`
- Modify: `packages/shared/src/types/meal-plan-template.ts`
- Modify: `release/docker-compose.yml`

- [ ] **Step 1: Gate synchronize on environment**

In `data-source.ts` (line 12):

```typescript
// BEFORE:
synchronize: true,

// AFTER:
synchronize: config.env !== 'production',
```

- [ ] **Step 2: Fix migrations glob for production**

In `data-source.ts` (line 15):

```typescript
// BEFORE:
migrations: ['src/db/migrations/*.ts'],

// AFTER:
migrations: [
  config.env === 'production'
    ? 'dist/db/migrations/*.js'
    : 'src/db/migrations/*.ts',
],
```

- [ ] **Step 3: Fix ts-jest/jest version incompatibility**

`ts-jest@30` does not exist yet. Downgrade jest to match ts-jest@29:

In `packages/backend/package.json`, change jest version:

```json
// BEFORE:
"jest": "^30.3.0",

// AFTER:
"jest": "^29.7.0",
```

Also update `@types/jest` if needed to match. Then run: `cd /Users/tuesday/projects/nommable && npm install`

- [ ] **Step 4: Type recipe fields in shared types**

In `packages/shared/src/types/meal-plan.ts` (line 20):

```typescript
// Add import at top:
import type { Recipe } from './recipe';

// Change line 20:
recipe?: Recipe;
```

In `packages/shared/src/types/meal-plan-template.ts` (line 17):

```typescript
// Add import at top:
import type { Recipe } from './recipe';

// Change line 17:
recipe?: Recipe;
```

- [ ] **Step 5: Fix release CORS default**

In `release/docker-compose.yml` (line 16):

```yaml
# BEFORE:
&cors_origin "*"

# AFTER:
&cors_origin "http://localhost:8765"
```

- [ ] **Step 6: Verify build passes**

Run: `cd /Users/tuesday/projects/nommable && npm run build`

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/db/data-source.ts packages/backend/package.json packages/shared/src/types/meal-plan.ts packages/shared/src/types/meal-plan-template.ts release/docker-compose.yml
git commit -m "fix: gate synchronize on env, fix jest compat, type recipe fields, restrict CORS default"
```

---

## Priority Order Summary

| Task | Priority | Category | Description | Status | Commit |
|------|----------|----------|-------------|--------|--------|
| 1 | Critical | Security | Recipe ownership checks | ✅ | `719ed11` |
| 2 | Critical | Security | Meal plan ownership checks | ✅ | `f705c64` |
| 3 | Critical | Security | Shopping list ownership checks | ✅ | `75cf127` |
| 4 | Critical | Security | Pantry ownership checks | ✅ | `cfd205b` |
| 5 | Critical | Security | Analytics user scoping | ✅ | `8f94952` |
| 6 | Critical | Security | Shell injection + JSON-LD fix | ✅ | `7e16e6e` |
| 7 | Critical | Security | Data clear endpoint lockdown | ✅ | `dc812cf` |
| 8 | Important | Backend bug | Validation middleware fix | ✅ | `66cf687` |
| 9 | Important | Security | Upload extension derivation | ✅ | `66cf687` |
| 10 | Important | Frontend bug | MealPlanDashboard random values + date sort | ✅ | `548b1cb` |
| 11 | Important | Frontend bug | RecipeDetailPage isFavorite init | ✅ | `527bcd6` |
| 12 | Important | Frontend bug | Timer drift fix | ✅ | `02d6378` |
| 13 | Minor | Frontend bug | RecipesPage stale page | ✅ | `1b1336c` |
| 14 | Minor | Frontend bug | setTimeout cleanup | ✅ | `53e5713` |
| 15 | Minor | Infrastructure | Env gating, versions, types, CORS | ✅ | `f8ad012` |

### Additional ownership fixes (discovered during implementation)

Beyond the original 15 tasks, three more cross-user data-leak gaps were found and closed:

| Task | Category | Description | Commit |
|------|----------|-------------|--------|
| A | Security | Batch cooking service ownership checks | `7522b48` |
| B | Security | Meal plan template service ownership checks | `8b8801f` |
| C | Security | Scope `createFromMealPlan` lookup to requesting user | `2dc64df` |
