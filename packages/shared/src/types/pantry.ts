export interface PantryItem {
  id: string;
  userId: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  location?: string; // e.g., "Pantry", "Fridge", "Freezer"
  expirationDate?: Date;
  purchaseDate?: Date;
  notes?: string;
  isLowStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PantryItemCreateDto {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  location?: string;
  expirationDate?: Date;
  purchaseDate?: Date;
  notes?: string;
  isLowStock?: boolean;
}

export interface PantryItemUpdateDto extends Partial<PantryItemCreateDto> {
  id: string;
}

/**
 * One candidate item detected by AI vision from a pantry/fridge photo.
 * Returned by the scan endpoint for user review — never written to the
 * pantry directly. The user confirms / edits / removes each candidate
 * in the review step before anything is added.
 */
export interface ScannedPantryItem {
  /** Product name as read from the photo (e.g. "Ketchup", "Milk"). */
  name: string;
  /** Best-guess quantity visible in the photo (e.g. 1 bottle, 2 cans). */
  quantity: number;
  /** Unit for the quantity (e.g. "bottle", "can", "box", "item"). */
  unit: string;
  /** Pantry category, one of PANTRY_CATEGORIES. */
  category: string;
  /** Model self-reported confidence, 0-1. Absent when the provider doesn't report one. */
  confidence?: number;
}

export const PANTRY_CATEGORIES = [
  'Spices & Seasonings',
  'Grains & Pasta',
  'Canned Goods',
  'Baking',
  'Oils & Vinegars',
  'Condiments',
  'Snacks',
  'Beverages',
  'Dairy',
  'Meat & Seafood',
  'Produce',
  'Frozen',
  'Other',
] as const;

export const PANTRY_LOCATIONS = [
  'Pantry',
  'Refrigerator',
  'Freezer',
  'Spice Rack',
  'Cabinet',
  'Other',
] as const;

export interface PantryLocationInfo {
  id: string;
  name: string;
  isDefault: boolean;
  itemCount: number;
}

export interface CreatePantryLocationDto {
  name: string;
}

export interface UpdatePantryLocationDto {
  name: string;
}
