/**
 * Home Assistant-friendly read-only summary endpoints (slice of issue #34).
 *
 * These summaries are for automation consumers (e.g. a Home Assistant REST
 * sensor) that need tonight's dinner, low stock, expiring items, and active
 * shopping lists without scraping the web UI. Read-only: no mutations.
 *
 * DERIVATION RULES: the filtering/sorting below intentionally mirrors the
 * Kitchen Today frontend rules in
 * `packages/frontend/src/features/kitchen-today/kitchenToday.ts`
 * (local-calendar-day math, 7-day expiry window, dinner-preferred tonight,
 * `[HH:MM]` notes prefix, unknown meal type falls back to dinner) so the
 * API summaries and the Kitchen Today screen agree. The logic is ported
 * rather than imported because the frontend rules live in the frontend
 * package; if either side changes, the other side's tests should be updated
 * to match. Auth is the existing session auth (see the routes file) — no
 * new auth surface. Personal API tokens, webhooks, and the iCal feed are
 * separate pieces of #34 and are NOT part of this slice.
 */
import type { PantryItem, ShoppingList } from '@nommable/shared';
import { PantryService } from '../pantry/pantry.service';
import { MealPlanService } from '../meal-plan/meal-plan.service';
import { ShoppingListService } from '../shopping-list/shopping-list.service';

// ---------------------------------------------------------------------------
// Date helpers (local calendar days) — mirror frontend kitchenToday.ts
// ---------------------------------------------------------------------------

/** Parse a date-only string, ISO string, or Date as a local calendar day. Null when unparseable. */
export function parseLocalDay(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/** Format a Date as 'YYYY-MM-DD' from local parts (no UTC round-trip). */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/** Whole calendar days from today until `value` (negative = past). Null when unparseable. */
export function daysUntil(
  value: string | Date | undefined | null,
  today: Date = new Date()
): number | null {
  const target = parseLocalDay(value);
  if (!target) return null;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Meal helpers — mirror frontend mealPlanEntry.ts (time prefix + meal fallback)
// ---------------------------------------------------------------------------

const TIME_PREFIX_RE = /^\[(\d{2}:\d{2})\]\s*/;

function decodeEntryNotes(notes?: string): { time?: string; notes?: string } {
  if (!notes) return {};
  const match = TIME_PREFIX_RE.exec(notes);
  if (!match) return { notes };
  const rest = notes.slice(match[0].length).trim();
  return { time: match[1], notes: rest || undefined };
}

function resolveMealType(raw: unknown): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  return raw === 'breakfast' || raw === 'lunch' || raw === 'dinner' || raw === 'snack'
    ? raw
    : 'dinner';
}

// ---------------------------------------------------------------------------
// Summary payload shapes (minimal — names, quantities, dates, counts)
// ---------------------------------------------------------------------------

export interface TonightsDinnerMeal {
  planId: string;
  planName: string;
  mealId: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipeId?: string;
  recipeTitle?: string;
  time?: string;
  notes?: string;
}

export interface TonightsDinnerSummary {
  date: string;
  meals: TonightsDinnerMeal[];
  count: number;
}

export interface LowStockItemSummary {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  location?: string;
}

export interface LowStockSummary {
  items: LowStockItemSummary[];
  count: number;
}

export interface ExpiringItemSummary {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  location?: string;
  expirationDate: string;
  daysUntilExpiry: number;
}

export interface ExpiringSummary {
  windowDays: number;
  items: ExpiringItemSummary[];
  count: number;
}

export interface ShoppingListSummaryItem {
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
}

export interface ShoppingListSummary {
  id: string;
  name: string;
  uncheckedCount: number;
  totalCount: number;
  items: ShoppingListSummaryItem[];
}

export interface ShoppingListsSummary {
  lists: ShoppingListSummary[];
  count: number;
  totalUnchecked: number;
}

// ---------------------------------------------------------------------------
// Derivation — mirror frontend kitchenToday.ts
// ---------------------------------------------------------------------------

const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 } as const;

/**
 * Structural meal-plan input for the derivation. Deliberately looser than
 * the shared `MealPlan` type: the backend services return TypeORM entities
 * whose nested types (e.g. recipe difficulty) don't match the shared DTO
 * unions, so the derivation only requires the fields it actually reads.
 */
export interface MealPlanInput {
  id: string;
  name: string;
  meals?: Array<{
    id: string;
    mealType: string;
    date: string | Date;
    notes?: string;
    recipeId: string;
    recipe?: { title?: string };
  }>;
}

function flattenMeals(plans: MealPlanInput[]): Array<TonightsDinnerMeal & { dateKey: string }> {
  return plans.flatMap((plan) =>
    (plan.meals ?? []).map((meal) => {
      const { time, notes } = decodeEntryNotes(meal.notes);
      const date = parseLocalDay(meal.date as unknown as string | Date);
      return {
        planId: plan.id,
        planName: plan.name,
        mealId: meal.id,
        mealType: resolveMealType(meal.mealType),
        recipeId: meal.recipeId,
        recipeTitle: meal.recipe?.title,
        time,
        notes,
        dateKey: date ? toDateKey(date) : '',
      };
    })
  );
}

/**
 * Tonight's plan: today's dinner meals when one is planned, otherwise all of
 * today's meals. Empty when nothing is planned today.
 */
export function getTonightsMeals(
  plans: MealPlanInput[],
  today: Date = new Date()
): TonightsDinnerMeal[] {
  const todayKeyValue = toDateKey(today);
  const todays = flattenMeals(plans)
    .filter((meal) => meal.dateKey === todayKeyValue)
    .map(({ dateKey: _dateKey, ...meal }) => meal);
  const dinners = todays.filter((meal) => meal.mealType === 'dinner');
  const picked = dinners.length > 0 ? dinners : todays;
  return picked.sort((a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType]);
}

/**
 * Pantry items expiring within `windowDays` (default 7), including already
 * expired items, soonest first. Items without an expiration date are excluded.
 */
export function getExpiringItems(
  items: PantryItem[],
  windowDays = 7,
  today: Date = new Date()
): Array<{ item: PantryItem; daysUntilExpiry: number }> {
  return items
    .map((item) => ({ item, daysUntilExpiry: daysUntil(item.expirationDate, today) }))
    .filter(
      (entry): entry is { item: PantryItem; daysUntilExpiry: number } =>
        entry.daysUntilExpiry !== null && entry.daysUntilExpiry <= windowDays
    )
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

/** Pantry items flagged low stock. */
export function getLowStockItems(items: PantryItem[]): PantryItem[] {
  return items.filter((item) => item.isLowStock);
}

/** Shopping lists with unchecked items left. */
export function getActiveShoppingLists(lists: ShoppingList[]): ShoppingList[] {
  return lists.filter((list) => (list.items ?? []).some((item) => !item.checked));
}

// ---------------------------------------------------------------------------
// Shaping (minimal summaries, never whole entities)
// ---------------------------------------------------------------------------

function shapeLowStockItem(item: PantryItem): LowStockItemSummary {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    location: item.location,
  };
}

function shapeExpiringItem(entry: {
  item: PantryItem;
  daysUntilExpiry: number;
}): ExpiringItemSummary {
  const parsed = parseLocalDay(entry.item.expirationDate);
  return {
    ...shapeLowStockItem(entry.item),
    expirationDate: parsed ? toDateKey(parsed) : '',
    daysUntilExpiry: entry.daysUntilExpiry,
  };
}

function shapeShoppingList(list: ShoppingList): ShoppingListSummary {
  const unchecked = (list.items ?? []).filter((item) => !item.checked);
  return {
    id: list.id,
    name: list.name,
    uncheckedCount: unchecked.length,
    totalCount: (list.items ?? []).length,
    items: unchecked.map((item) => ({
      name: item.name,
      ...(item.quantity != null ? { quantity: item.quantity } : {}),
      ...(item.unit ? { unit: item.unit } : {}),
      ...(item.category ? { category: item.category } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class HomeAssistantService {
  private pantryService = new PantryService();
  private mealPlanService = new MealPlanService();
  private shoppingListService = new ShoppingListService();

  async getTonightsDinner(userId: string): Promise<TonightsDinnerSummary> {
    const today = new Date();
    const { data: plans } = await this.mealPlanService.findAll(userId, { page: 1, pageSize: 100 });
    const meals = getTonightsMeals(plans, today);
    return { date: toDateKey(today), meals, count: meals.length };
  }

  async getLowStock(userId: string): Promise<LowStockSummary> {
    const items = await this.pantryService.getAllItems(userId);
    const lowStock = getLowStockItems(items).map(shapeLowStockItem);
    return { items: lowStock, count: lowStock.length };
  }

  async getExpiring(userId: string, windowDays = 7): Promise<ExpiringSummary> {
    const items = await this.pantryService.getAllItems(userId);
    const expiring = getExpiringItems(items, windowDays).map(shapeExpiringItem);
    return { windowDays, items: expiring, count: expiring.length };
  }

  async getShoppingLists(userId: string): Promise<ShoppingListsSummary> {
    const { data: lists } = await this.shoppingListService.findAll(userId, {
      page: 1,
      pageSize: 100,
    });
    const active = getActiveShoppingLists(lists).map(shapeShoppingList);
    return {
      lists: active,
      count: active.length,
      totalUnchecked: active.reduce((sum, list) => sum + list.uncheckedCount, 0),
    };
  }
}
