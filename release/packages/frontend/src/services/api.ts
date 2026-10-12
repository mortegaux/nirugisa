import axios from 'axios';
import type {
  Recipe,
  RecipeCreateDto,
  RecipeUpdateDto,
  MealPlan,
  MealPlanCreateDto,
  ShoppingList,
  ShoppingListCreateDto,
  AIConfigCreateDto,
  AIGenerateRecipeRequest,
  AISubstituteIngredientRequest,
  AIMealPlanRequest,
  User,
  UserDirectCreateDto,
  UserDirectCreateResponse,
  UsernameSuggestionsResponse,
  UserRole,
  UpdatePasswordDto,
  UpdateEmailDto,
  UpdateProfileDto,
  Taxonomy,
  TaxonomyCreateDto,
  TaxonomyUpdateDto,
  TaxonomyType,
} from '@nommable/shared';

const api = axios.create({
  baseURL: '/api',
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  registerWithInvite: (data: { token: string; username: string; password: string }) =>
    api.post('/auth/register/invite', data),
  login: (data: { username: string; password: string }) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// Recipe API
export const recipeApi = {
  getAll: (params?: any) => api.get<Recipe[]>('/recipes', { params }),
  getById: (id: string) => api.get<Recipe>(`/recipes/${id}`),
  create: (data: RecipeCreateDto) => api.post<Recipe>('/recipes', data),
  update: (id: string, data: RecipeUpdateDto) => api.put<Recipe>(`/recipes/${id}`, data),
  delete: (id: string) => api.delete(`/recipes/${id}`),
  importFromUrl: (url: string) => api.post<Recipe>('/recipes/import', { url }),
  generateWithAI: (data: AIGenerateRecipeRequest) => api.post<Recipe>('/recipes/generate', data),
  enhanceWithAI: (id: string, enhancementType: string) =>
    api.post(`/recipes/${id}/enhance`, { enhancementType }),
  extractFromImages: (files: File[]) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return api.post<RecipeCreateDto>('/recipes/extract-from-images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  detectIngredientsFromImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post<{ ingredients: string[] }>('/recipes/detect-ingredients', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadImage: (file: File, recipeId?: string) => {
    const formData = new FormData();
    formData.append('image', file);
    const url = recipeId ? `/recipes/${recipeId}/upload-image` : '/recipes/upload-image';
    return api.post<{ imageUrl: string; recipe?: Recipe }>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  bulkDelete: (ids: string[]) => api.post<{ deletedCount: number; message: string }>('/recipes/bulk-delete', { ids }),
  bulkUpdate: (ids: string[], updates: { tags?: string[]; categories?: string[] }) =>
    api.post<{ updatedCount: number; message: string }>('/recipes/bulk-update', { ids, ...updates }),
};

// AI API
export const aiApi = {
  getStatus: () => api.get<{ isConfigured: boolean; isEnabled: boolean; provider: string | null }>('/ai/status'),
  getConfig: () => api.get('/ai/config'),
  createConfig: (data: AIConfigCreateDto) => api.post('/ai/config', data),
  updateConfig: (data: Partial<AIConfigCreateDto>) => api.put('/ai/config', data),
  testConnection: () => api.post<{ success: boolean; message: string }>('/ai/config/test'),
  substituteIngredient: (data: AISubstituteIngredientRequest) =>
    api.post('/ai/substitute-ingredient', data),
};

// Meal Plan API
export const mealPlanApi = {
  getAll: () => api.get<MealPlan[]>('/meal-plans'),
  getById: (id: string) => api.get<MealPlan>(`/meal-plans/${id}`),
  create: (data: MealPlanCreateDto) => api.post<MealPlan>('/meal-plans', data),
  update: (id: string, data: Partial<MealPlanCreateDto>) =>
    api.put<MealPlan>(`/meal-plans/${id}`, data),
  delete: (id: string) => api.delete(`/meal-plans/${id}`),
  bulkDelete: (ids: string[]) => api.post<{ deletedCount: number; message: string }>('/meal-plans/bulk-delete', { ids }),
  generateWithAI: (data: AIMealPlanRequest) => api.post('/meal-plans/generate', data),
  addMeal: (id: string, meal: any) => api.post(`/meal-plans/${id}/meals`, meal),
  removeMeal: (id: string, mealId: string) => api.delete(`/meal-plans/${id}/meals/${mealId}`),
  exportToCalendar: async (id: string) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/meal-plans/${id}/export/ics`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to export calendar');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meal-plan.ics';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  // Intelligent meal plan generation
  generatePreview: (data: any) => api.post('/meal-plans/preview', data),
  replaceMeal: (data: any) => api.post('/meal-plans/preview/replace-meal', data),
  commitPreview: (data: any) => api.post('/meal-plans/commit', data),
  // Shopping list integration
  getMissingIngredients: (id: string) => api.get(`/meal-plans/${id}/missing-ingredients`),
  addToShoppingList: (id: string, shoppingListId?: string) =>
    api.post(`/meal-plans/${id}/add-to-shopping-list`, { shoppingListId }),
};

// Meal Plan Template API
export const mealPlanTemplateApi = {
  getAll: () => api.get('/meal-plan-templates'),
  getById: (id: string) => api.get(`/meal-plan-templates/${id}`),
  create: (data: any) => api.post('/meal-plan-templates', data),
  createFromMealPlan: (data: { mealPlanId: string; name: string; description?: string; tags?: string[] }) =>
    api.post('/meal-plan-templates/from-meal-plan', data),
  delete: (id: string) => api.delete(`/meal-plan-templates/${id}`),
  apply: (id: string, data: { startDate: string; name?: string; description?: string }) =>
    api.post(`/meal-plan-templates/${id}/apply`, data),
};

// Shopping List API
export const shoppingListApi = {
  getAll: () => api.get<ShoppingList[]>('/shopping-lists'),
  getById: (id: string) => api.get<ShoppingList>(`/shopping-lists/${id}`),
  create: (data: ShoppingListCreateDto) => api.post<ShoppingList>('/shopping-lists', data),
  createFromMealPlan: (mealPlanId: string) =>
    api.post<ShoppingList>('/shopping-lists/from-meal-plan', { mealPlanId }),
  update: (id: string, data: Partial<ShoppingListCreateDto>) =>
    api.put<ShoppingList>(`/shopping-lists/${id}`, data),
  delete: (id: string) => api.delete(`/shopping-lists/${id}`),
  toggleItem: (listId: string, itemId: string) =>
    api.patch(`/shopping-lists/${listId}/items/${itemId}/toggle`),
};

// Invitation API
export const invitationApi = {
  create: (data: { email: string; role: 'admin' | 'user' }) => api.post('/invitations', data),
  getAll: () => api.get('/invitations'),
  validate: (token: string) => api.get(`/invitations/validate/${token}`),
  revoke: (id: string) => api.delete(`/invitations/${id}`),
};

// User API
export const userApi = {
  getAll: () => api.get<{ users: User[] }>('/users'),
  getUsernameSuggestions: (firstName: string, lastName: string) =>
    api.get<UsernameSuggestionsResponse>('/users/username-suggestions', {
      params: { firstName, lastName },
    }),
  create: (data: UserDirectCreateDto) => api.post<UserDirectCreateResponse>('/users', data),
  updateRole: (userId: string, role: UserRole) =>
    api.patch<{ user: User }>(`/users/${userId}/role`, { role }),
  delete: (userId: string) => api.delete(`/users/${userId}`),
  // Profile management
  updatePassword: (data: UpdatePasswordDto) => api.put('/users/profile/password', data),
  updateEmail: (data: UpdateEmailDto) => api.put<{ user: User }>('/users/profile/email', data),
  updateProfile: (data: UpdateProfileDto) => api.put<{ user: User }>('/users/profile', data),
  uploadProfilePhoto: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return api.post<{ profilePhotoUrl: string; user: User }>('/users/profile/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Settings API
export const settingsApi = {
  clearData: () => api.delete('/settings/data/clear'),
};

// Pantry API
export const pantryApi = {
  getAll: () => api.get('/pantry'),
  getById: (id: string) => api.get(`/pantry/${id}`),
  create: (data: any) => api.post('/pantry', data),
  update: (id: string, data: any) => api.put(`/pantry/${id}`, data),
  delete: (id: string) => api.delete(`/pantry/${id}`),
  getExpiring: (days?: number) => api.get(`/pantry/expiring${days ? `?days=${days}` : ''}`),
  getLowStock: () => api.get('/pantry/low-stock'),
  updateQuantity: (id: string, quantityChange: number) =>
    api.patch(`/pantry/${id}/quantity`, { quantityChange }),
  toggleLowStock: (id: string) => api.patch(`/pantry/${id}/toggle-low-stock`),
};

// Analytics API
export const analyticsApi = {
  getSummary: () => api.get('/analytics/summary'),
  getHistory: (limit?: number) => api.get('/analytics/history', { params: { limit } }),
};

// Preferences API
export const preferencesApi = {
  getPreferences: () => api.get('/preferences'),
  updatePreferences: (data: any) => api.put('/preferences', data),
  deletePreferences: () => api.delete('/preferences'),
  checkCompatibility: (data: { recipeTags: string[]; recipeIngredients: string[] }) =>
    api.post('/preferences/check-compatibility', data),
};

// Batch Cooking API
export const batchCookingApi = {
  getAll: () => api.get('/batch-cooking'),
  getById: (id: string) => api.get(`/batch-cooking/${id}`),
  create: (data: any) => api.post('/batch-cooking', data),
  update: (id: string, data: any) => api.put(`/batch-cooking/${id}`, data),
  delete: (id: string) => api.delete(`/batch-cooking/${id}`),
  updateStatus: (id: string, status: string) => api.patch(`/batch-cooking/${id}/status`, { status }),
  updateChecklist: (id: string, checklist: any) => api.patch(`/batch-cooking/${id}/checklist`, { checklist }),
  getSuggestions: () => api.get('/batch-cooking/suggestions'),
  createShoppingList: (id: string) => api.post(`/batch-cooking/${id}/shopping-list`),
  getAnalytics: () => api.get('/batch-cooking/analytics'),
};

// Gamification API
export const gamificationApi = {
  getStats: () => api.get('/gamification/stats'),
  getAchievements: () => api.get('/gamification/achievements'),
  getAchievementProgress: () => api.get('/gamification/achievements/progress'),
  getAllAchievements: () => api.get('/gamification/achievements/all'),
  getLeaderboard: (limit?: number) => api.get('/gamification/leaderboard', { params: { limit } }),
  recordMeal: () => api.post('/gamification/record-meal'),
};

// Taxonomy API
export const taxonomyApi = {
  getAll: (type?: TaxonomyType) =>
    api.get<Taxonomy[]>('/taxonomies', { params: type ? { type } : {} }),
  create: (data: TaxonomyCreateDto) => api.post<Taxonomy>('/taxonomies', data),
  update: (id: string, data: TaxonomyUpdateDto) => api.put<Taxonomy>(`/taxonomies/${id}`, data),
  delete: (id: string) => api.delete(`/taxonomies/${id}`),
  reorder: (ids: string[]) => api.post('/taxonomies/reorder', { ids }),
};

export default api;
