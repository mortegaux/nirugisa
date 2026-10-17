import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import KitchenTodayPage from './KitchenTodayPage';
import { mealPlanApi, pantryApi, batchCookingApi, shoppingListApi } from '@/services/api';

vi.mock('@/services/api', () => ({
  mealPlanApi: { getAll: vi.fn() },
  pantryApi: { getAll: vi.fn() },
  batchCookingApi: { getAll: vi.fn() },
  shoppingListApi: { getAll: vi.fn() },
}));

const mockedMealPlanApi = vi.mocked(mealPlanApi);
const mockedPantryApi = vi.mocked(pantryApi);
const mockedBatchCookingApi = vi.mocked(batchCookingApi);
const mockedShoppingListApi = vi.mocked(shoppingListApi);

function renderPage() {
  return render(
    <MemoryRouter>
      <KitchenTodayPage />
    </MemoryRouter>
  );
}

describe('KitchenTodayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the next action and every section from fetched data', async () => {
    mockedPantryApi.getAll.mockResolvedValue({
      data: [
        {
          id: 'i1',
          name: 'Milk',
          quantity: 1,
          unit: 'gallon',
          category: 'Dairy',
          expirationDate: new Date().toISOString(),
          isLowStock: true,
        },
      ],
    } as never);
    mockedMealPlanApi.getAll.mockResolvedValue({
      data: [
        {
          id: 'p1',
          name: 'This Week',
          meals: [
            {
              id: 'm1',
              mealPlanId: 'p1',
              recipeId: 'r1',
              date: new Date().toISOString(),
              mealType: 'dinner',
              servings: 2,
              recipe: { title: 'Tacos' },
            },
          ],
        },
      ],
    } as never);
    mockedBatchCookingApi.getAll.mockResolvedValue({
      data: [
        {
          id: 'b1',
          name: 'Chili Batch',
          cookingDate: new Date().toISOString().split('T')[0],
          status: 'in-progress',
          storageMethod: 'refrigerate',
          storageDuration: 4,
          prepChecklist: [{ task: 'Dice onions', completed: false, order: 1 }],
          recipe: { id: 'r2', title: 'Chili' },
        },
      ],
    } as never);
    mockedShoppingListApi.getAll.mockResolvedValue({ data: [] } as never);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Kitchen Today')).toBeInTheDocument();
    });
    // Expiring today outranks dinner in the next-action priority.
    expect(screen.getByText(/Use up the expiring item/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Tonight's plan/ })).toBeInTheDocument();
    expect(screen.getByText('Tacos')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Expiring soon/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Prep due/ })).toBeInTheDocument();
    expect(screen.getByText('Dice onions')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Low stock/ })).toBeInTheDocument();
    expect(screen.getByText(/Read-only view/)).toBeInTheDocument();
  });

  it('renders correct empty states when there is nothing to show', async () => {
    mockedPantryApi.getAll.mockResolvedValue({ data: [] } as never);
    mockedMealPlanApi.getAll.mockResolvedValue({ data: [] } as never);
    mockedBatchCookingApi.getAll.mockResolvedValue({ data: [] } as never);
    mockedShoppingListApi.getAll.mockResolvedValue({ data: [] } as never);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Kitchen Today')).toBeInTheDocument();
    });
    expect(screen.getByText('Plan this week’s meals')).toBeInTheDocument();
    expect(screen.getByText(/Nothing expiring in the next 7 days/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing flagged low stock/)).toBeInTheDocument();
  });

  it('shows a retry state when every data source fails', async () => {
    mockedPantryApi.getAll.mockRejectedValue(new Error('down'));
    mockedMealPlanApi.getAll.mockRejectedValue(new Error('down'));
    mockedBatchCookingApi.getAll.mockRejectedValue(new Error('down'));
    mockedShoppingListApi.getAll.mockRejectedValue(new Error('down'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Could not load today’s kitchen/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
