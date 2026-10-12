import { PaginatedRequest } from './pagination';

export interface ShoppingList {
  id: string;
  userId: string;
  name: string;
  mealPlanId?: string;
  items: ShoppingListItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ShoppingListItem {
  id: string;
  shoppingListId: string;
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  checked: boolean;
  notes?: string;
  recipeId?: string;
  order: number;
}

export interface ShoppingListCreateDto {
  name: string;
  mealPlanId?: string;
  items?: ShoppingListItemCreateDto[];
}

export interface ShoppingListItemCreateDto {
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  checked?: boolean;
  notes?: string;
  recipeId?: string;
  order: number;
}

export interface ShoppingListUpdateDto extends Partial<ShoppingListCreateDto> {
  id: string;
}

export interface ShoppingListItemUpdateDto extends Partial<ShoppingListItemCreateDto> {
  id: string;
}

export interface ShoppingListSearchQuery extends PaginatedRequest {
  query?: string;
}
