import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mealPlanApi, recipeApi } from '@/services/api';
import type { Recipe, MealPlanRecipeCreateDto } from '@nommable/shared';

interface MealSlot {
  date: Date;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipe?: Recipe;
  servings: number;
  notes?: string;
}

const MEAL_TYPES = [
  { type: 'breakfast', label: 'Breakfast', color: 'bg-amber-100 border-amber-300 text-amber-900' },
  { type: 'lunch', label: 'Lunch', color: 'bg-green-100 border-green-300 text-green-900' },
  { type: 'dinner', label: 'Dinner', color: 'bg-blue-100 border-blue-300 text-blue-900' },
  { type: 'snack', label: 'Snack', color: 'bg-purple-100 border-purple-300 text-purple-900' },
] as const;

export default function MealPlanBuilder() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Meal plan metadata
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  // Calendar state
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [meals, setMeals] = useState<MealSlot[]>([]);

  // Recipe selection
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; mealType: string } | null>(null);
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);

  // Initialize week dates
  useEffect(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    setWeekDates(dates);
  }, [startDate]);

  // Load recipes
  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const response = await recipeApi.getAll();
      setRecipes(response.data);
    } catch (error) {
      console.error('Failed to load recipes:', error);
    }
  };

  const getMealSlot = (date: Date, mealType: string): MealSlot | undefined => {
    return meals.find(
      (m) =>
        m.date.toDateString() === date.toDateString() &&
        m.mealType === mealType
    );
  };

  const handleAddRecipe = (recipe: Recipe) => {
    if (!selectedSlot) return;

    const existingIndex = meals.findIndex(
      (m) =>
        m.date.toDateString() === selectedSlot.date.toDateString() &&
        m.mealType === selectedSlot.mealType
    );

    if (existingIndex >= 0) {
      // Replace existing meal
      const updated = [...meals];
      updated[existingIndex] = {
        date: selectedSlot.date,
        mealType: selectedSlot.mealType as any,
        recipe,
        servings: recipe.servings || 1,
      };
      setMeals(updated);
    } else {
      // Add new meal
      setMeals([
        ...meals,
        {
          date: selectedSlot.date,
          mealType: selectedSlot.mealType as any,
          recipe,
          servings: recipe.servings || 1,
        },
      ]);
    }

    setShowRecipeSelector(false);
    setSelectedSlot(null);
    setSearchQuery('');
  };

  const handleRemoveRecipe = (date: Date, mealType: string) => {
    setMeals(meals.filter(
      (m) =>
        !(m.date.toDateString() === date.toDateString() && m.mealType === mealType)
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter a meal plan name');
      return;
    }

    if (meals.length === 0) {
      setError('Please add at least one meal to your plan');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const endDate = new Date(weekDates[weekDates.length - 1]);

      const mealData: MealPlanRecipeCreateDto[] = meals.map((meal) => ({
        recipeId: meal.recipe!.id,
        date: meal.date,
        mealType: meal.mealType,
        servings: meal.servings,
        notes: meal.notes,
      }));

      await mealPlanApi.create({
        name,
        description,
        startDate,
        endDate,
        meals: mealData,
      });

      navigate('/meal-plans');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create meal plan');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipes = recipes.filter(
    (recipe) =>
      recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSlotClick = (date: Date, mealType: string) => {
    setSelectedSlot({ date, mealType });
    setShowRecipeSelector(true);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Create Meal Plan</h1>
          <p className="text-muted-foreground mt-1">Plan your meals for the week</p>
        </div>
        <button
          onClick={() => navigate('/meal-plans')}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Cancel and return to meal plans"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div
          className="mb-6 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Meal Plan Info Form */}
      <div className="mb-6 bg-card rounded-lg border border-border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">Meal Plan Details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
              Plan Name <span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., Weekly Meal Plan"
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-foreground mb-1">
              Start Date
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate.toISOString().split('T')[0]}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Optional notes about this meal plan"
            />
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="mb-6 bg-card rounded-lg border border-border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">Weekly Calendar</h2>

        {/* Days header */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {weekDates.map((date, index) => (
            <div key={index} className="text-center">
              <div className="font-semibold text-foreground">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-sm text-muted-foreground">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          ))}
        </div>

        {/* Meal slots */}
        {MEAL_TYPES.map((mealTypeConfig) => (
          <div key={mealTypeConfig.type} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-foreground">{mealTypeConfig.label}</span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((date, dayIndex) => {
                const slot = getMealSlot(date, mealTypeConfig.type);
                return (
                  <div
                    key={`${dayIndex}-${mealTypeConfig.type}`}
                    className={`min-h-[80px] rounded-lg border-2 border-dashed p-2 transition-all cursor-pointer hover:border-solid hover:shadow-md ${
                      slot
                        ? `${mealTypeConfig.color} border-solid`
                        : 'border-border bg-background hover:border-primary/30 hover:bg-accent/5'
                    }`}
                    onClick={() => handleSlotClick(date, mealTypeConfig.type)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${slot ? `Edit ${slot.recipe?.title} for` : 'Add recipe for'} ${mealTypeConfig.label} on ${date.toLocaleDateString()}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleSlotClick(date, mealTypeConfig.type);
                      }
                    }}
                  >
                    {slot ? (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRecipe(date, mealTypeConfig.type);
                          }}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive"
                          aria-label={`Remove ${slot.recipe?.title}`}
                        >
                          ×
                        </button>
                        <div className="text-xs font-medium line-clamp-2" title={slot.recipe?.title}>
                          {slot.recipe?.title}
                        </div>
                        <div className="text-xs opacity-75 mt-1">
                          {slot.servings} servings
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                        + Add
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Recipe Selector Modal */}
      {showRecipeSelector && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowRecipeSelector(false);
            setSelectedSlot(null);
            setSearchQuery('');
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="recipe-selector-title"
        >
          <div
            className="bg-card rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border">
              <h3 id="recipe-selector-title" className="text-lg font-semibold text-foreground mb-4">
                Select a Recipe
              </h3>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipes..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                aria-label="Search recipes"
              />
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4">
              {filteredRecipes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recipes found. Try a different search term.
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredRecipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      onClick={() => handleAddRecipe(recipe)}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background hover:bg-accent hover:border-primary/30 transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {recipe.imageUrl && (
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.title}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{recipe.title}</div>
                        {recipe.description && (
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            {recipe.description}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {recipe.prepTime && <span>{recipe.prepTime}m prep</span>}
                          {recipe.cookTime && <span>{recipe.cookTime}m cook</span>}
                          {recipe.difficulty && (
                            <span className="capitalize">{recipe.difficulty}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate('/meal-plans')}
          className="px-6 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !name.trim() || meals.length === 0}
          className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {loading ? 'Creating...' : 'Create Meal Plan'}
        </button>
      </div>
    </div>
  );
}
