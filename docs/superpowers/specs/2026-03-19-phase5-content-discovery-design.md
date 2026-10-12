# Phase 5: Content & Discovery — Ratings, Collections, History, Suggestions

## Decisions

| Feature | Decision |
|---|---|
| Ratings | Personal 1-5 stars per user per recipe (no public average, no reviews) |
| Collections | Built-in "Favorites" + custom named collections |
| History | Automatic view tracking, "Recently Viewed" row on RecipesPage |
| Suggestions | Pantry ingredient match + dietary preference filtering, no AI |

## Ratings

### Data Model

New `RecipeRating` entity:
- `id` (UUID, PK)
- `userId` (UUID, FK to User)
- `recipeId` (UUID, FK to Recipe)
- `rating` (integer, 1-5)
- `createdAt`, `updatedAt` (timestamps)
- Unique constraint on `(userId, recipeId)` — one rating per user per recipe

### API

- `PUT /api/recipes/:id/rate` — set/update rating (`{ rating: number }`). Upserts.
- `DELETE /api/recipes/:id/rate` — clear rating
- Rating included in recipe detail response (when fetching `GET /api/recipes/:id`, attach the current user's rating if it exists)

### Frontend

- Star rating component on `RecipeDetailPage` below the title. Click to set, click same star to clear.
- Small star indicators on recipe cards in list view showing the user's rating.

---

## Collections

### Data Model

New `RecipeCollection` entity:
- `id` (UUID, PK)
- `userId` (UUID, FK to User)
- `name` (varchar)
- `description` (text, nullable)
- `isFavorites` (boolean, default false) — marks the auto-created Favorites collection
- `createdAt`, `updatedAt` (timestamps)

New `RecipeCollectionItem` join entity:
- `id` (UUID, PK)
- `collectionId` (UUID, FK to RecipeCollection)
- `recipeId` (UUID, FK to Recipe)
- `addedAt` (timestamp)
- Unique constraint on `(collectionId, recipeId)`

**Ownership enforcement:** `RecipeCollectionItem` has no `userId` column — ownership is enforced by always joining through `RecipeCollection` to verify `collection.userId = requestingUserId`. All service methods that touch collection items must load the parent collection first and verify ownership. Never query `RecipeCollectionItem` directly without the collection ownership check.

### API

- `GET /api/collections` — list user's collections with recipe counts
- `POST /api/collections` — create collection (`{ name, description? }`)
- `PUT /api/collections/:id` — update name/description (blocked for Favorites)
- `DELETE /api/collections/:id` — delete collection (blocked for Favorites)
- `GET /api/collections/:id` — get collection with its recipes (paginated)
- `POST /api/collections/:id/recipes` — add recipe (`{ recipeId }`)
- `DELETE /api/collections/:id/recipes/:recipeId` — remove recipe

"Favorites" is auto-created on first favorite toggle. It's a normal collection with `isFavorites: true` that can't be renamed or deleted.

### Frontend

- Heart icon on recipe cards and detail page — toggles Favorites collection membership
- "Collections" section accessible from recipes page (or nav)
- "Add to collection" dropdown menu on recipe cards listing available collections
- Collection detail view showing its recipes with the standard recipe card grid

---

## History (Recently Viewed)

### Data Model

New `RecipeView` entity:
- `id` (UUID, PK)
- `userId` (UUID, FK to User)
- `recipeId` (UUID, FK to Recipe)
- `viewedAt` (timestamp)
- Unique constraint on `(userId, recipeId)` — one row per user-recipe pair, `viewedAt` updated on each view

### API

- `GET /api/recipes/recent?limit=10` — returns user's most recently viewed recipes, ordered by `viewedAt` DESC
- View tracking happens automatically inside the recipe controller's `findById` HTTP handler (not the service method) — this ensures internal calls like AI enhancement don't trigger view records. No separate endpoint needed.

**Important:** Register `GET /api/recipes/recent` BEFORE `GET /api/recipes/:id` in the route file to prevent Express matching "recent" as an `:id` parameter. Note: the existing route file already has a pre-existing ordering issue where several POST routes (`/import`, `/generate`, `/extract-from-images`, etc.) are registered after `GET /:id`. While POST routes don't conflict with GET `:id`, any new GET routes with static paths MUST go before `GET /:id`. Group all static-path GET routes (`/categories`, `/recent`, `/suggestions`) together before the `/:id` route.

**Upsert mechanism:** Since there's a unique constraint on `(userId, recipeId)`, use TypeORM's `save()` with a prior `findOne()` to check for an existing row. If found, update `viewedAt`; if not, create a new row. Do NOT use a plain `insert()` as it will throw a constraint violation on repeat views.

### Frontend

- "Recently Viewed" horizontal scroll row on `RecipesPage`, above the main recipe grid
- Shows recipe cards (thumbnail, title, rating if exists)
- Only appears if the user has viewed at least one recipe
- Limited to 10 most recent

---

## Suggestions

### Service Logic

New `SuggestionService` with pure data matching (no AI):

1. **Pantry match:** Query user's recipes, join ingredients, compare against pantry items using `ILIKE` name matching. Score = `(matched ingredients / total ingredients) * 100`. Only include recipes with score > 0.

2. **Preference filter:** Read user's `UserPreferences` fields:
   - `allergies` (string[]) — **safety-critical**: exclude recipes whose ingredients match any allergy name (ILIKE match against `Ingredient.name`). This is an ingredient-level filter, not a tag filter.
   - `dislikes` (string[]) — exclude recipes whose ingredients match disliked items (same ILIKE match). Soft filter — can be lower priority than allergies but still excluded.
   - `dietaryRestrictions` (string[]) — these are tags like "Vegetarian", "Vegan", "Gluten-Free". Exclude recipes that have ingredients conflicting with the restriction. Do NOT simply filter by tag presence (a recipe can be naturally vegetarian without being tagged as such). Instead, deprioritize recipes that have known conflicting ingredients (e.g., meat ingredients for a vegetarian restriction). This is best-effort, not guaranteed.
   - `preferredCuisines` (string[]) — soft boost: recipes whose categories match preferred cuisines get +10 to matchScore.
   - `favorites` (string[]) — note: this is "favorite foods/ingredients" from UserPreferences, NOT the Favorites recipe collection. Recipes containing favorite ingredients get a small boost (+5 per match).

   The `UserPreferences.favorites` field (favorite foods) is distinct from the recipe "Favorites" collection — they share a name but are different concepts.

3. **Return:** List of recipes sorted by `matchScore` DESC, each with `matchScore` (0-100) and `matchReason` string (e.g., "You have 6 of 8 ingredients").

### API

- `GET /api/recipes/suggestions?limit=6` — returns scored/ranked suggestions

**Important:** Register this route BEFORE `GET /api/recipes/:id` in the route file.

### Frontend

- "Suggested For You" section on `RecipesPage`, below "Recently Viewed" and above the main recipe grid
- Recipe cards with match reason as subtitle
- Only appears if user has pantry items
- Collapsible

---

## Files Affected

### New files
- `packages/backend/src/db/entities/RecipeRating.ts`
- `packages/backend/src/db/entities/RecipeCollection.ts`
- `packages/backend/src/db/entities/RecipeCollectionItem.ts`
- `packages/backend/src/db/entities/RecipeView.ts`
- `packages/backend/src/services/rating/rating.service.ts`
- `packages/backend/src/services/collection/collection.service.ts`
- `packages/backend/src/services/suggestion/suggestion.service.ts`
- `packages/backend/src/api/controllers/collection.controller.ts`
- `packages/backend/src/api/routes/collection.routes.ts`
- `packages/shared/src/types/collection.ts`
- `packages/shared/src/types/rating.ts`
- `packages/frontend/src/components/StarRating.tsx`
- `packages/frontend/src/features/collections/CollectionsPage.tsx`
- `packages/frontend/src/features/collections/CollectionDetailPage.tsx`

### Modified files
- `packages/backend/src/db/entities/index.ts` — export new entities
- `packages/backend/src/api/controllers/recipe.controller.ts` — attach rating to findById, record view, add `rate()` and `unrate()` handler methods for rating endpoints
- `packages/backend/src/api/routes/recipe.routes.ts` — add rate, recent, suggestions routes
- `packages/backend/src/api/routes/index.ts` — register collection routes
- `packages/shared/src/index.ts` — export new types
- `packages/frontend/src/services/api.ts` — add rating, collection, recent, suggestions API methods
- `packages/frontend/src/features/recipes/RecipesPage.tsx` — add Recently Viewed row, Suggestions row
- `packages/frontend/src/features/recipes/RecipeDetailPage.tsx` — add star rating, heart/collection buttons
- `packages/frontend/src/App.tsx` — add collection routes
- `packages/frontend/src/features/layout/DashboardLayout.tsx` — add Collections nav item
