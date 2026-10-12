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
