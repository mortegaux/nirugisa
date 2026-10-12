# Phase 3: Dark Mode + Advanced Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dark mode toggle with system preference detection and localStorage persistence, and extend recipe search with ingredient-based, nutritional, source, and cuisine/category filters.

**Architecture:** Dark mode uses a Zustand store that toggles `.dark` class on `<html>` — the CSS variables are already defined. Advanced search extends the existing `RecipeSearchQuery` type and backend query builder with new filter fields, and adds a collapsible filter panel to RecipesPage.

**Tech Stack:** Zustand, CSS custom properties, TypeORM query builder, PostgreSQL JSONB operators

**Spec:** `docs/superpowers/specs/2026-03-19-phased-improvements-design.md` (Phase 3 section)

---

## File Structure

### New files
- `packages/frontend/src/store/theme.store.ts` — Zustand theme store with localStorage persistence

### Modified files
- `packages/frontend/src/features/layout/DashboardLayout.tsx` — Theme toggle button in header
- `packages/shared/src/types/recipe.ts` — Extend RecipeSearchQuery with new filter fields
- `packages/backend/src/services/recipe/recipe.service.ts` — Add new filter conditions to findAll query builder
- `packages/backend/src/api/controllers/recipe.controller.ts` — Parse new query params
- `packages/frontend/src/features/recipes/RecipesPage.tsx` — Collapsible advanced filter panel
- `packages/frontend/src/services/api.ts` — No changes needed (params already pass through)

---

## Task 1: Dark Mode Theme Store + Toggle

**Files:**
- Create: `packages/frontend/src/store/theme.store.ts`
- Modify: `packages/frontend/src/features/layout/DashboardLayout.tsx`

- [ ] **Step 1: Create theme store**

Create `packages/frontend/src/store/theme.store.ts` following the same Zustand pattern as `auth.store.ts`:

```typescript
import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyTheme(theme: Theme) {
  const effective = getEffectiveTheme(theme);
  document.documentElement.classList.toggle('dark', effective === 'dark');
}

export const useThemeStore = create<ThemeState>((set) => {
  const stored = (localStorage.getItem('nommable-theme') as Theme) || 'system';

  // Apply on load
  applyTheme(stored);

  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = localStorage.getItem('nommable-theme') as Theme || 'system';
    if (current === 'system') {
      applyTheme('system');
    }
  });

  return {
    theme: stored,
    setTheme: (theme: Theme) => {
      localStorage.setItem('nommable-theme', theme);
      applyTheme(theme);
      set({ theme });
    },
  };
});
```

- [ ] **Step 2: Read DashboardLayout.tsx**

Read `packages/frontend/src/features/layout/DashboardLayout.tsx` to find the header section and UserDropdown placement.

- [ ] **Step 3: Add theme toggle to header**

Add a theme cycle button next to `<UserDropdown />` in the header. Clicking cycles through: system → light → dark → system.

```tsx
import { useThemeStore } from '@/store/theme.store';
import { Sun, Moon, Monitor } from 'lucide-react';

// Inside the header, before or after UserDropdown:
const ThemeToggle = () => {
  const { theme, setTheme } = useThemeStore();
  const next = { system: 'light', light: 'dark', dark: 'system' } as const;
  const icons = { system: Monitor, light: Sun, dark: Moon };
  const Icon = icons[theme];

  return (
    <button
      onClick={() => setTheme(next[theme])}
      className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
      title={`Theme: ${theme}`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
};
```

Add `<ThemeToggle />` in the header flex container.

- [ ] **Step 4: Audit dark mode appearance**

The existing `.dark` CSS variables use a blue/slate palette. Per the spec, consider adjusting to a warm dark palette for consistency with the warm light theme. Read the current `.dark` variables in `index.css` (lines 47-67) and evaluate. If the blue/slate looks acceptable, keep it. If it clashes, adjust the hue values toward warm tones (brown/charcoal instead of blue).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/store/theme.store.ts packages/frontend/src/features/layout/DashboardLayout.tsx
git commit -m "feat: add dark mode with theme toggle and system preference detection"
```

---

## Task 2: Extend Search Query Types

**Files:**
- Modify: `packages/shared/src/types/recipe.ts`

- [ ] **Step 1: Read current RecipeSearchQuery**

Read `packages/shared/src/types/recipe.ts` to see the current interface.

- [ ] **Step 2: Extend RecipeSearchQuery with new fields**

Add these fields to the interface:

```typescript
export interface RecipeSearchQuery extends PaginatedRequest {
  // Existing
  query?: string;
  categories?: string[];
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  maxPrepTime?: number;
  maxCookTime?: number;

  // New: ingredient-based
  includeIngredients?: string[];
  excludeIngredients?: string[];

  // New: nutritional
  minCalories?: number;
  maxCalories?: number;
  minProtein?: number;
  maxProtein?: number;
  minCarbohydrates?: number;
  maxCarbohydrates?: number;
  minFat?: number;
  maxFat?: number;

  // New: source (derived from isAiGenerated + sourceUrl)
  source?: ('manual' | 'imported' | 'ai-generated')[];
}
```

Note: Per the spec, `cuisineType` is not a separate field — cuisine filtering uses the existing `categories` array. A `/api/recipes/categories` endpoint returns all distinct categories. We don't add a cuisineType field here.

- [ ] **Step 3: Build shared package**

Run: `npm run build -w packages/shared`

- [ ] **Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat: extend RecipeSearchQuery with ingredient, nutrition, and source filters"
```

---

## Task 3: Backend Advanced Search Filters

**Files:**
- Modify: `packages/backend/src/services/recipe/recipe.service.ts`
- Modify: `packages/backend/src/api/controllers/recipe.controller.ts`
- Modify: `packages/backend/src/api/routes/recipe.routes.ts` (add categories endpoint)

- [ ] **Step 1: Read the current findAll query builder**

Read `packages/backend/src/services/recipe/recipe.service.ts` — the findAll method's filter section.

- [ ] **Step 2: Add ingredient filters to findAll**

After the existing tag filter, add:

```typescript
if (query.includeIngredients?.length) {
  // Recipe must have at least one ingredient matching each included name
  for (let i = 0; i < query.includeIngredients.length; i++) {
    const paramName = `includeIng${i}`;
    qb.andWhere(
      `EXISTS (SELECT 1 FROM ingredient ing WHERE ing."recipeId" = recipe.id AND ing.name ILIKE :${paramName})`,
      { [paramName]: `%${query.includeIngredients[i]}%` }
    );
  }
}

if (query.excludeIngredients?.length) {
  for (let i = 0; i < query.excludeIngredients.length; i++) {
    const paramName = `excludeIng${i}`;
    qb.andWhere(
      `NOT EXISTS (SELECT 1 FROM ingredient ing WHERE ing."recipeId" = recipe.id AND ing.name ILIKE :${paramName})`,
      { [paramName]: `%${query.excludeIngredients[i]}%` }
    );
  }
}
```

- [ ] **Step 3: Add nutritional filters**

```typescript
if (query.minCalories !== undefined) {
  qb.andWhere("(recipe.nutrition->>'calories')::numeric >= :minCalories", { minCalories: query.minCalories });
}
if (query.maxCalories !== undefined) {
  qb.andWhere("(recipe.nutrition->>'calories')::numeric <= :maxCalories", { maxCalories: query.maxCalories });
}
if (query.minProtein !== undefined) {
  qb.andWhere("(recipe.nutrition->>'protein')::numeric >= :minProtein", { minProtein: query.minProtein });
}
if (query.maxProtein !== undefined) {
  qb.andWhere("(recipe.nutrition->>'protein')::numeric <= :maxProtein", { maxProtein: query.maxProtein });
}
if (query.minCarbohydrates !== undefined) {
  qb.andWhere("(recipe.nutrition->>'carbohydrates')::numeric >= :minCarbohydrates", { minCarbohydrates: query.minCarbohydrates });
}
if (query.maxCarbohydrates !== undefined) {
  qb.andWhere("(recipe.nutrition->>'carbohydrates')::numeric <= :maxCarbohydrates", { maxCarbohydrates: query.maxCarbohydrates });
}
if (query.minFat !== undefined) {
  qb.andWhere("(recipe.nutrition->>'fat')::numeric >= :minFat", { minFat: query.minFat });
}
if (query.maxFat !== undefined) {
  qb.andWhere("(recipe.nutrition->>'fat')::numeric <= :maxFat", { maxFat: query.maxFat });
}
```

- [ ] **Step 4: Add source filter**

Derive source from `isAiGenerated` and `sourceUrl`:

```typescript
if (query.source?.length) {
  const sourceConditions: string[] = [];
  if (query.source.includes('ai-generated')) {
    sourceConditions.push('recipe.isAiGenerated = true');
  }
  if (query.source.includes('imported')) {
    sourceConditions.push('(recipe.isAiGenerated = false AND recipe.sourceUrl IS NOT NULL)');
  }
  if (query.source.includes('manual')) {
    sourceConditions.push('(recipe.isAiGenerated = false AND recipe.sourceUrl IS NULL)');
  }
  if (sourceConditions.length > 0) {
    qb.andWhere(`(${sourceConditions.join(' OR ')})`);
  }
}
```

- [ ] **Step 5: Update recipe controller to parse new query params**

Add parsing for the new params in the controller's findAll method:

```typescript
// Add to the query object construction:
includeIngredients: req.query.includeIngredients
  ? (req.query.includeIngredients as string).split(',')
  : undefined,
excludeIngredients: req.query.excludeIngredients
  ? (req.query.excludeIngredients as string).split(',')
  : undefined,
minCalories: req.query.minCalories ? parseFloat(req.query.minCalories as string) : undefined,
maxCalories: req.query.maxCalories ? parseFloat(req.query.maxCalories as string) : undefined,
minProtein: req.query.minProtein ? parseFloat(req.query.minProtein as string) : undefined,
maxProtein: req.query.maxProtein ? parseFloat(req.query.maxProtein as string) : undefined,
minCarbohydrates: req.query.minCarbohydrates ? parseFloat(req.query.minCarbohydrates as string) : undefined,
maxCarbohydrates: req.query.maxCarbohydrates ? parseFloat(req.query.maxCarbohydrates as string) : undefined,
minFat: req.query.minFat ? parseFloat(req.query.minFat as string) : undefined,
maxFat: req.query.maxFat ? parseFloat(req.query.maxFat as string) : undefined,
source: req.query.source ? (req.query.source as string).split(',') as any : undefined,
```

- [ ] **Step 6: Add GET /api/recipes/categories endpoint**

Add a new route and controller method that returns all distinct categories from the user's recipes:

Controller method:
```typescript
async getCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await this.recipeService.getDistinctCategories(req.userId!);
    res.json(categories);
  } catch (error) {
    next(error);
  }
}
```

Service method:
```typescript
async getDistinctCategories(userId: string): Promise<string[]> {
  const result = await this.recipeRepo
    .createQueryBuilder('recipe')
    .select("DISTINCT jsonb_array_elements_text(recipe.categories)", 'category')
    .where('recipe.userId = :userId', { userId })
    .andWhere('recipe.categories IS NOT NULL')
    .getRawMany();
  return result.map(r => r.category).sort();
}
```

Register the route in `recipe.routes.ts` — **IMPORTANT:** Add `GET /categories` BEFORE the `GET /:id` route to prevent Express matching "categories" as an id parameter.

- [ ] **Step 7: Build and verify**

Run: `npx tsc --noEmit -p packages/backend/tsconfig.json`

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/ packages/shared/
git commit -m "feat: add ingredient, nutrition, source filters and categories endpoint"
```

---

## Task 4: Frontend Advanced Filter Panel

**Files:**
- Modify: `packages/frontend/src/features/recipes/RecipesPage.tsx`
- Modify: `packages/frontend/src/services/api.ts` (add categories API method)

- [ ] **Step 1: Read RecipesPage.tsx fully**

Understand current filter state, loadRecipes function, and filter UI structure.

- [ ] **Step 2: Add categories API method**

In `api.ts`, add to `recipeApi`:
```typescript
getCategories: async (): Promise<string[]> => {
  const { data } = await api.get<string[]>('/recipes/categories');
  return data;
},
```

- [ ] **Step 3: Add advanced filter state**

Add state for new filters:
```typescript
const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
const [includeIngredients, setIncludeIngredients] = useState('');
const [excludeIngredients, setExcludeIngredients] = useState('');
const [minCalories, setMinCalories] = useState('');
const [maxCalories, setMaxCalories] = useState('');
const [minProtein, setMinProtein] = useState('');
const [maxProtein, setMaxProtein] = useState('');
const [selectedSource, setSelectedSource] = useState<Set<string>>(new Set());
```

- [ ] **Step 4: Update loadRecipes to include new params**

Extend the params object in loadRecipes:
```typescript
const params: RecipeSearchQuery = {
  // ... existing params
  includeIngredients: includeIngredients ? includeIngredients.split(',').map(s => s.trim()).filter(Boolean) : undefined,
  excludeIngredients: excludeIngredients ? excludeIngredients.split(',').map(s => s.trim()).filter(Boolean) : undefined,
  minCalories: minCalories ? parseFloat(minCalories) : undefined,
  maxCalories: maxCalories ? parseFloat(maxCalories) : undefined,
  minProtein: minProtein ? parseFloat(minProtein) : undefined,
  maxProtein: maxProtein ? parseFloat(maxProtein) : undefined,
  source: selectedSource.size > 0 ? Array.from(selectedSource) as any : undefined,
};
```

Add the new state variables to the useCallback dependency array.

- [ ] **Step 5: Add collapsible filter panel UI**

Below the existing search bar and category/tag dropdowns, add a toggleable "Advanced Filters" section:

```tsx
<button
  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
  className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
>
  {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
  {activeFilterCount > 0 && (
    <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5">
      {activeFilterCount}
    </span>
  )}
</button>

{showAdvancedFilters && (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg bg-card">
    {/* Ingredients */}
    <div>
      <label className="text-sm font-medium">Must Include Ingredients</label>
      <input
        type="text"
        placeholder="chicken, rice (comma-separated)"
        value={includeIngredients}
        onChange={(e) => setIncludeIngredients(e.target.value)}
        className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
      />
    </div>
    <div>
      <label className="text-sm font-medium">Exclude Ingredients</label>
      <input
        type="text"
        placeholder="nuts, dairy (comma-separated)"
        value={excludeIngredients}
        onChange={(e) => setExcludeIngredients(e.target.value)}
        className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
      />
    </div>

    {/* Nutrition */}
    <div>
      <label className="text-sm font-medium">Calories</label>
      <div className="flex gap-2 mt-1">
        <input type="number" placeholder="Min" value={minCalories} onChange={(e) => setMinCalories(e.target.value)} className="w-full px-2 py-2 border rounded-md text-sm" />
        <input type="number" placeholder="Max" value={maxCalories} onChange={(e) => setMaxCalories(e.target.value)} className="w-full px-2 py-2 border rounded-md text-sm" />
      </div>
    </div>
    <div>
      <label className="text-sm font-medium">Protein (g)</label>
      <div className="flex gap-2 mt-1">
        <input type="number" placeholder="Min" value={minProtein} onChange={(e) => setMinProtein(e.target.value)} className="w-full px-2 py-2 border rounded-md text-sm" />
        <input type="number" placeholder="Max" value={maxProtein} onChange={(e) => setMaxProtein(e.target.value)} className="w-full px-2 py-2 border rounded-md text-sm" />
      </div>
    </div>

    {/* Source */}
    <div>
      <label className="text-sm font-medium">Source</label>
      <div className="flex flex-wrap gap-2 mt-1">
        {['manual', 'imported', 'ai-generated'].map(s => (
          <label key={s} className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={selectedSource.has(s)}
              onChange={() => {
                const next = new Set(selectedSource);
                next.has(s) ? next.delete(s) : next.add(s);
                setSelectedSource(next);
              }}
            />
            {s === 'ai-generated' ? 'AI Generated' : s.charAt(0).toUpperCase() + s.slice(1)}
          </label>
        ))}
      </div>
    </div>

    {/* Clear all */}
    <div className="flex items-end">
      <button
        onClick={() => {
          setIncludeIngredients('');
          setExcludeIngredients('');
          setMinCalories('');
          setMaxCalories('');
          setMinProtein('');
          setMaxProtein('');
          setSelectedSource(new Set());
        }}
        className="text-sm text-destructive hover:text-destructive/80"
      >
        Clear All Filters
      </button>
    </div>
  </div>
)}
```

Compute `activeFilterCount` from all non-empty advanced filter values.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/features/recipes/RecipesPage.tsx packages/frontend/src/services/api.ts
git commit -m "feat: add advanced search filter panel with ingredients, nutrition, and source filters"
```

---

## Task 5: Backend Tests for Advanced Search

**Files:**
- Modify: `packages/backend/src/__tests__/services/recipe.service.test.ts`

- [ ] **Step 1: Add tests for new filters**

Add a new describe block for advanced search tests:

```typescript
describe('advanced filters', () => {
  beforeAll(async () => {
    // Seed recipes with varied data for filter testing
    await service.create(testUserId, buildRecipeDto({
      title: 'Chicken Rice Bowl',
      ingredients: [
        { name: 'Chicken breast', quantity: 2, unit: 'pieces', order: 0 },
        { name: 'White rice', quantity: 1, unit: 'cup', order: 1 },
      ],
      categories: ['Asian'],
      isAiGenerated: false,
    }));
    await service.create(testUserId, buildRecipeDto({
      title: 'Vegan Salad',
      ingredients: [
        { name: 'Lettuce', quantity: 1, unit: 'head', order: 0 },
        { name: 'Tomatoes', quantity: 3, unit: 'pieces', order: 1 },
      ],
      categories: ['Healthy'],
      sourceUrl: 'https://example.com/salad',
    }));
  });

  it('filters by included ingredients', async () => {
    const result = await service.findAll(testUserId, { includeIngredients: ['chicken'] });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every(r => r.title.includes('Chicken'))).toBe(true);
  });

  it('filters by excluded ingredients', async () => {
    const result = await service.findAll(testUserId, { excludeIngredients: ['chicken'] });
    result.data.forEach(r => {
      expect(r.title).not.toContain('Chicken');
    });
  });

  it('filters by source (imported)', async () => {
    const result = await service.findAll(testUserId, { source: ['imported'] });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('filters by source (manual)', async () => {
    const result = await service.findAll(testUserId, { source: ['manual'] });
    expect(result.data.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm run test -w packages/backend
```

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/__tests__/
git commit -m "test: add tests for advanced search filters"
```

---

## Task 6: Final Verification

- [ ] **Step 1:** Run `npm run build` — clean build
- [ ] **Step 2:** Run `npm run lint` — fix any new errors
- [ ] **Step 3:** Run `npm run test` — all tests pass
- [ ] **Step 4:** `git status` — working tree clean
- [ ] **Step 5:** `git log --oneline` — show all commits
