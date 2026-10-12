# Phased Improvements Design

A three-phase plan to add pagination, recipe scaling, image upload UI, dark mode, tests, print/PDF enhancements, and advanced search filters to Nommable.

## Decisions

| Feature | Decision |
|---|---|
| Pagination style | Hybrid: page numbers on desktop, "load more" on mobile |
| Recipe scaling UI | Dropdown select with preset multipliers (0.5x, 1x, 1.5x, 2x, 3x) |
| Image upload scope | Recipe form (create/edit) + recipe detail page |
| Dark mode default | Follow system preference, user can override |
| Test priority | Backend-first (services + API), then frontend |
| PDF export | Browser-native — enhance print CSS, no server-side generation |
| Advanced search | All filters: ingredient-based, nutritional, source + cuisine |

## Current State

Several features are partially implemented:

- **Pagination:** Nothing exists. All list endpoints return all records.
- **Recipe scaling:** Frontend state (`servingMultiplier`, `formatQuantity`) exists but no UI controls.
- **Image upload:** Backend fully built (multer, routes, controllers). Frontend UI not wired.
- **Dark mode:** CSS variables + `.dark` class defined. No toggle, no persistence.
- **Tests:** Zero — no framework, no files, no dependencies.
- **Print/PDF:** Print CSS is solid, `window.print()` button exists. No PDF generation.
- **Advanced search:** Backend supports category, tag, difficulty, prep/cook time. Missing: nutrition, ingredients, source, cuisine.

---

## Phase 1: Foundation — Pagination + Test Framework

### Pagination

**Shared types** (`packages/shared/src/types/`):

Add generic pagination types:

```typescript
interface PaginatedRequest {
  page?: number;      // default 1
  pageSize?: number;  // default 20, max 100
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

Extend `RecipeSearchQuery`, and add equivalent query types for meal plans and shopping lists, to include `PaginatedRequest` fields.

**Backend** (`packages/backend/src/services/`):

Update `RecipeService.findAll()`, `MealPlanService.findAll()`, and `ShoppingListService.findAll()`:
- Accept `userId` parameter and enforce ownership with `WHERE recipe.userId = :userId` (fix pre-existing missing ownership filter while we're overhauling these methods)
- Accept pagination params
- Use TypeORM `.skip((page - 1) * pageSize)` and `.take(pageSize)`
- Use `.getManyAndCount()` instead of `.getMany()` to get total
- Return `PaginatedResponse` wrapper
- Default pageSize=20, max=100, default page=1

Controllers parse pagination from query string params and pass through.

**Move filtering server-side:** Currently `RecipesPage.tsx` fetches all recipes and filters client-side (lines 269–284). This must change: all filter state (search query, categories, tags, difficulty, prep/cook time) moves to query params passed through `recipeApi.getAll()`. The backend handles filtering AND pagination together so that `total` and `totalPages` reflect the filtered result set. Client-side filtering is removed entirely from list pages.

On filter or search change: reset to page 1 and fetch fresh results. For mobile "load more" mode: clear the accumulated list and start from page 1 on any filter change.

**Frontend API** (`packages/frontend/src/services/api.ts`):

Update `recipeApi.getAll()`, `mealPlanApi.getAll()`, `shoppingListApi.getAll()` to accept and forward pagination + filter params. Return typed `PaginatedResponse`.

**Frontend UI**:

Desktop (viewport >= 768px):
- Page number bar at the bottom of list pages
- Shows: `< 1 2 3 ... N >` with prev/next arrows
- Current page highlighted

Mobile (viewport < 768px):
- "Load more" button at the bottom
- Appends results to existing list (tracks internal page counter)
- Button disappears when all pages loaded
- Shows "Showing X of Y recipes" count

Detection via a shared `useIsMobile()` hook (breakpoint at 768px).

### Test Framework Setup

**Backend (Jest)**:
- Install: `jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`
- Add `jest.config.ts` to `packages/backend/`
- Add `test` script to `packages/backend/package.json`
- Create `packages/backend/src/__tests__/` directory
- Test utilities: auth token factory for generating valid JWTs in tests
- Test database strategy: use a dedicated `nommable_test` PostgreSQL database with TypeORM `synchronize: true`. Tests connect to this DB, run in transactions that roll back after each test for isolation. The test DB can be spun up via `docker-compose` alongside the dev DB on a different port, or reuse the dev Postgres instance with a separate database name.
- Initial tests: `recipe.service.test.ts` (pagination unit tests against test DB), `recipe.routes.test.ts` (integration with supertest against test DB)

**Frontend (Vitest)**:
- Install: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- Add separate `vitest.config.ts` in `packages/frontend/` (avoid merging with Vite build config)
- Add `test` script to `packages/frontend/package.json`
- Single smoke test to confirm framework runs
- No component tests yet — that comes in Phase 3

**Root**: Add `npm run test` script that runs tests across all workspaces.

---

## Phase 2: Recipe Experience — Scaling + Image Upload + Print/PDF

### Recipe Scaling

No backend changes. Frontend only on `RecipeDetailPage.tsx`:

- Replace the existing +/- increment buttons (lines 516–535) with a dropdown select next to servings display
- Options: 0.5x, 1x, 1.5x, 2x, 3x
- On change, update existing `servingMultiplier` state
- Ingredient list renders `formatQuantity(quantity * servingMultiplier)` for each ingredient
- Adjusted servings count updates: `(recipe.servings || 1) * servingMultiplier`
- Print view reflects the currently selected multiplier

### Image Upload Frontend

Backend is complete. Frontend wiring needed in two places:

**Recipe form (create/edit)**:
- Add tabbed input: "Upload" | "URL"
- Upload tab: file input with drop zone, accepts JPEG/PNG/GIF/WebP/HEIC (matching backend filter)
- On file select: call `recipeApi.uploadImage(file)`, receive `imageUrl`, set into form state
- Show thumbnail preview after successful upload
- URL tab: existing text input (unchanged)

**Recipe detail page**:
- Camera/edit icon overlay on hero image (visible on hover desktop, always visible mobile)
- Click opens native file picker
- Uploads via `recipeApi.uploadImage(file, recipeId)`
- During upload: show a loading spinner overlay on the image area, disable the upload trigger
- On success: refresh the displayed image
- On error: show a toast notification with the error message, revert to previous image
- On mobile, triggers native photo picker (leverages recent gallery/camera work)

### Print/PDF Enhancement

Enhance existing `window.print()` approach:

- Rename existing "Print Recipe" button or add a second "Save as PDF" button that calls `window.print()` with a tooltip: "Use your browser's Save as PDF option"
- Ensure scaled servings/quantities from the multiplier appear in print output
- Add recipe source URL and print date to the print footer
- Force light-mode colors in `@media print` block (prevent dark mode styles leaking)
- Test print output across Chrome, Safari, Firefox

### Phase 2 Tests

Backend:
- `recipe.service.test.ts`: recipe CRUD operations (create, update, findById)
- `recipe.routes.test.ts`: image upload endpoint integration test

---

## Phase 3: Polish — Dark Mode + Advanced Search

### Dark Mode

**Theme store** (`packages/frontend/src/store/theme.store.ts`):

Zustand store with:
- State: `theme: 'light' | 'dark' | 'system'`
- On init: read from `localStorage('nommable-theme')`, fall back to `'system'`
- When `'system'`: listen to `window.matchMedia('(prefers-color-scheme: dark)')` change events
- Side effect: apply/remove `.dark` class on `document.documentElement`
- Persist choice to `localStorage` on change

**Toggle UI**:
- Add theme toggle to user dropdown menu
- Icon: sun (light), moon (dark), monitor (system)
- Three-way cycle on click, or small submenu with all three options

**Dark mode audit**:
- Review existing `.dark` CSS variables — current blue/slate palette doesn't match the warm light theme
- Adjust to a warm dark palette (dark charcoal/brown tones) for visual consistency
- Test all Radix UI components in dark mode
- Ensure custom component styles respect dark mode

**Print safety**: `@media print` forces light colors regardless of theme.

### Advanced Search Filters

Extend the existing filter system in three areas:

**Ingredient-based search**:

Backend:
- New query params: `includeIngredients: string[]`, `excludeIngredients: string[]`
- Join `ingredients` table
- `includeIngredients`: WHERE EXISTS subquery matching `ingredient.name ILIKE ANY(...)`
- `excludeIngredients`: WHERE NOT EXISTS subquery

Frontend:
- Two tag-input fields: "Must include" and "Exclude"
- Autocomplete from known ingredient names across user's recipes (new endpoint or client-side from loaded data)

**Nutritional filters**:

Backend:
- Query params: `minCalories`, `maxCalories`, `minProtein`, `maxProtein`, `minCarbohydrates`, `maxCarbohydrates`, `minFat`, `maxFat`
- Note: param names use `carbohydrates` to match the `NutritionInfo.carbohydrates` field in the stored JSON. Frontend labels can display "Carbs" but the API param and JSON key must be `carbohydrates`.
- Filter on recipe's `nutrition` JSON field using PostgreSQL JSON operators: `(nutrition->>'calories')::numeric >= :minCalories`

Frontend:
- Collapsible "Nutrition" filter section
- Min/max number inputs for calories, protein, carbohydrates (labeled "Carbs" in UI), fat

**Source filter**:

The Recipe entity has no `source` column. Instead of adding one, derive source from existing fields:
- `isAiGenerated === true` → "AI Generated"
- `sourceUrl != null && !isAiGenerated` → "Imported"
- `sourceUrl == null && !isAiGenerated` → "Manual"

Backend:
- Query param: `source: ('manual' | 'imported' | 'ai-generated')[]`
- Build WHERE conditions using the derivation logic above (no schema change needed)

Frontend:
- Checkbox group for source type (Manual, Imported, AI Generated)

**Cuisine filter**:

There is no dedicated `cuisineType` field on recipes. Cuisine is stored within the `categories` array (e.g., "Italian", "Mexican"). Rather than adding a new column, treat cuisine as a subset of categories.

Backend:
- Query param: `cuisineType: string[]`
- Filter using the same `categories && ARRAY[...]` operator already used for category filtering
- The `categories` array is free-form and mixes cuisines, dietary labels, meal types, etc. Rather than trying to separate them, provide a `/api/recipes/categories` endpoint that returns all distinct categories from the user's recipes. The frontend presents these in the cuisine dropdown as-is — users filter by whatever categories they've used. This is pragmatic and avoids maintaining an allowlist. If finer categorization is wanted later, a dedicated `cuisineType` column can be added in a future iteration.

Frontend:
- Multi-select dropdown for cuisine type, populated from the cuisine-types endpoint

**Filter UI organization**:
- Collapsible filter panel below search bar
- Sections: Categories (existing), Dietary (existing), Cuisine (new), Nutrition (new), Ingredients (new), Source (new)
- Active filter count badge on the filter toggle button
- "Clear all filters" button

### Phase 3 Tests

Backend:
- `recipe.service.test.ts`: advanced search query builder tests (each filter type individually and combined)
- Integration tests for search endpoint with filter combinations

Frontend:
- Theme toggle component test (cycles correctly, persists)
- Filter panel component tests (add/remove filters, clear all)
- Recipe list page test (renders paginated results, applies filters)

---

## Phase Summary

| Phase | Features | Estimated Scope |
|---|---|---|
| 1 — Foundation | Pagination (all lists) + test framework setup + initial tests | Backend: 3 services + shared types. Frontend: 3 list pages + hooks. Tests: framework + pagination tests |
| 2 — Recipe Experience | Recipe scaling UI + image upload frontend + print enhancement | Frontend-heavy: RecipeDetailPage, RecipeForm. Backend tests for recipe service |
| 3 — Polish | Dark mode + advanced search filters | Frontend: theme store + filter panel. Backend: search query builder extensions. Full test suite |

## Files Affected (Key)

**Phase 1:**
- `packages/shared/src/types/recipe.ts` (+ meal-plan.ts, shopping-list.ts)
- `packages/backend/src/services/recipe/recipe.service.ts` (+ meal-plan, shopping-list services)
- `packages/backend/src/api/controllers/recipe.controller.ts` (+ others)
- `packages/frontend/src/services/api.ts`
- `packages/frontend/src/features/recipes/RecipesPage.tsx` (+ meal-plans, shopping-lists list pages)
- New: `packages/backend/jest.config.ts`, `packages/backend/src/__tests__/`
- New: `packages/frontend/vitest.config.ts`

**Phase 2:**
- `packages/frontend/src/features/recipes/RecipeDetailPage.tsx`
- `packages/frontend/src/features/recipes/RecipeForm.tsx` (or equivalent)
- `packages/frontend/src/index.css` (print styles)

**Phase 3:**
- New: `packages/frontend/src/store/theme.store.ts`
- `packages/frontend/src/index.css` (dark mode variables)
- `packages/frontend/src/features/layout/` (toggle in dropdown)
- `packages/shared/src/types/recipe.ts` (extended search query)
- `packages/backend/src/services/recipe/recipe.service.ts` (extended query builder)
- `packages/frontend/src/features/recipes/RecipesPage.tsx` (filter panel)
