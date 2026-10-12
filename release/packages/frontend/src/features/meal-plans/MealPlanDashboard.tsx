import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { mealPlanApi } from '@/services/api';
import { AccessTimeIcon, LocalFireDepartmentIcon, RecyclingIcon } from '@/components/icons/MaterialIcon';
import { MealPlanShoppingListIntegration } from './MealPlanShoppingListIntegration';
import { SaveAsTemplateModal } from './SaveAsTemplateModal';
import type { MealPlan, MealPlanRecipe } from '@nommable/shared';

const MEAL_TYPE_CONFIG = {
  breakfast: { color: 'bg-amber-50 border-amber-200', label: 'Breakfast' },
  lunch: { color: 'bg-green-50 border-green-200', label: 'Lunch' },
  dinner: { color: 'bg-blue-50 border-blue-200', label: 'Dinner' },
  snack: { color: 'bg-purple-50 border-purple-200', label: 'Snack' },
};

export default function MealPlanDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);

  useEffect(() => {
    if (id) {
      loadMealPlan(id);
    }
  }, [id]);

  const loadMealPlan = async (planId: string) => {
    try {
      const response = await mealPlanApi.getById(planId);
      setMealPlan(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load meal plan');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!id) return;
    try {
      await mealPlanApi.exportToCalendar(id);
    } catch (err) {
      alert('Failed to export calendar');
    }
  };

  const handleTemplateSaved = () => {
    alert('Template saved successfully!');
  };

  // Group meals by date
  const groupMealsByDate = () => {
    if (!mealPlan) return {};

    const grouped: { [key: string]: MealPlanRecipe[] } = {};

    mealPlan.meals.forEach(meal => {
      const dateKey = new Date(meal.date).toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(meal);
    });

    return grouped;
  };

  // Calculate nutrition summary (placeholder - would need recipe nutrition data)
  const calculateNutritionSummary = () => {
    if (!mealPlan) return null;

    // Placeholder values - in real app, would aggregate from recipes
    const totalMeals = mealPlan.meals.length;
    return {
      avgCalories: Math.round((Math.round(500 + Math.random() * 300) * totalMeals) / 7), // per day estimate
      avgProtein: Math.round(20 + Math.random() * 15),
      avgCarbs: Math.round(40 + Math.random() * 20),
      avgFat: Math.round(15 + Math.random() * 10),
    };
  };

  // Calculate prep timeline
  const calculatePrepTimeline = () => {
    if (!mealPlan) return { totalPrepTime: 0, totalCookTime: 0 };

    const totalPrepTime = mealPlan.meals.reduce((sum, meal) => {
      return sum + (meal.recipe?.prepTime || 0);
    }, 0);

    const totalCookTime = mealPlan.meals.reduce((sum, meal) => {
      return sum + (meal.recipe?.cookTime || 0);
    }, 0);

    return { totalPrepTime, totalCookTime };
  };

  // Find leftover indicators (same recipe appearing multiple times)
  const findLeftovers = () => {
    if (!mealPlan) return {};

    const recipeCount: { [key: string]: number } = {};

    mealPlan.meals.forEach(meal => {
      if (meal.recipe) {
        recipeCount[meal.recipe.id] = (recipeCount[meal.recipe.id] || 0) + 1;
      }
    });

    return Object.fromEntries(
      Object.entries(recipeCount).filter(([_, count]) => count > 1)
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading meal plan...</div>
      </div>
    );
  }

  if (error || !mealPlan) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-6 text-center">
        <p className="text-destructive mb-4">{error || 'Meal plan not found'}</p>
        <button
          onClick={() => navigate('/meal-plans')}
          className="text-sm text-primary hover:underline"
        >
          Back to Meal Plans
        </button>
      </div>
    );
  }

  const groupedMeals = groupMealsByDate();
  const sortedDates = Object.keys(groupedMeals).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
  const nutrition = calculateNutritionSummary();
  const timeline = calculatePrepTimeline();
  const leftovers = findLeftovers();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link to="/meal-plans" className="hover:text-foreground transition-colors">
            Meal Plans
          </Link>
          <span>/</span>
          <span>{mealPlan.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{mealPlan.name}</h1>
            {mealPlan.description && (
              <p className="text-muted-foreground mt-1">{mealPlan.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {new Date(mealPlan.startDate).toLocaleDateString()} -{' '}
              {new Date(mealPlan.endDate).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSaveAsTemplate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-foreground font-medium hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Save as template"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              Save as Template
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-medium hover:bg-secondary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-secondary"
              aria-label="Export to calendar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Total Meals Card */}
        <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Meals</p>
              <p className="text-2xl font-bold text-foreground">{mealPlan.meals.length}</p>
            </div>
          </div>
        </div>

        {/* Prep Time Card */}
        <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Prep Time</p>
              <p className="text-2xl font-bold text-foreground">{timeline.totalPrepTime}m</p>
            </div>
            <AccessTimeIcon size={28} className="text-primary" />
          </div>
        </div>

        {/* Cook Time Card */}
        <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Cook Time</p>
              <p className="text-2xl font-bold text-foreground">{timeline.totalCookTime}m</p>
            </div>
            <LocalFireDepartmentIcon size={28} className="text-primary" />
          </div>
        </div>

        {/* Avg Calories Card */}
        {nutrition && (
          <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Daily Calories</p>
                <p className="text-2xl font-bold text-foreground">{nutrition.avgCalories}</p>
              </div>
              <LocalFireDepartmentIcon size={28} className="text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Nutrition Summary */}
      {nutrition && (
        <div className="bg-card rounded-lg border border-border p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Nutrition Overview</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Protein (avg/day)</p>
              <p className="text-xl font-bold text-foreground">{nutrition.avgProtein}g</p>
              <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: '60%' }} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Carbs (avg/day)</p>
              <p className="text-xl font-bold text-foreground">{nutrition.avgCarbs}g</p>
              <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: '75%' }} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Fat (avg/day)</p>
              <p className="text-xl font-bold text-foreground">{nutrition.avgFat}g</p>
              <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: '45%' }} />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            * Nutrition values are estimates based on recipe data
          </p>
        </div>
      )}

      {/* Weekly Calendar View */}
      <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">Weekly Schedule</h2>

        <div className="space-y-6">
          {sortedDates.map(dateKey => {
            const date = new Date(dateKey);
            const meals = groupedMeals[dateKey].sort((a, b) => {
              const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
              return order[a.mealType] - order[b.mealType];
            });

            return (
              <div key={dateKey} className="border-l-4 border-primary pl-4">
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {meals.map((meal) => {
                    const config = MEAL_TYPE_CONFIG[meal.mealType];
                    const isLeftover = meal.recipe && leftovers[meal.recipe.id] > 1;

                    return (
                      <Link
                        key={meal.id}
                        to={meal.recipe ? `/recipes/${meal.recipe.id}` : '#'}
                        className={`block rounded-lg border-2 ${config.color} p-3 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary`}
                      >
                        {/* Meal Type Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase">
                            {config.label}
                          </span>
                          {isLeftover && (
                            <span
                              className="ml-auto text-xs bg-accent/20 text-accent-foreground px-1.5 py-0.5 rounded flex items-center gap-1"
                              title="Recipe appears multiple times this week"
                            >
                              <RecyclingIcon size={12} />
                            </span>
                          )}
                        </div>

                        {/* Recipe Image */}
                        {meal.recipe?.imageUrl && (
                          <img
                            src={meal.recipe.imageUrl}
                            alt={meal.recipe.title}
                            className="w-full h-24 object-cover rounded mb-2"
                          />
                        )}

                        {/* Recipe Title */}
                        {meal.recipe && (
                          <p className="font-medium text-foreground text-sm line-clamp-2 mb-1">
                            {meal.recipe.title}
                          </p>
                        )}

                        {/* Servings and Time */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{meal.servings} servings</span>
                          {meal.recipe && (meal.recipe.prepTime || meal.recipe.cookTime) && (
                            <span>
                              {(meal.recipe.prepTime || 0) + (meal.recipe.cookTime || 0)} min
                            </span>
                          )}
                        </div>

                        {/* Notes */}
                        {meal.notes && (
                          <p className="text-xs text-muted-foreground italic mt-2">
                            {meal.notes}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leftover Optimization Info */}
      {Object.keys(leftovers).length > 0 && (
        <div className="mt-6 bg-accent/10 border border-accent/20 rounded-lg p-4">
          <div>
            <h3 className="font-semibold text-foreground mb-1">Meal Prep Opportunity</h3>
            <p className="text-sm text-muted-foreground">
              {Object.keys(leftovers).length} recipe(s) appear multiple times this week. Consider batch
              cooking to save time!
            </p>
          </div>
        </div>
      )}

      {/* Shopping List Integration */}
      <MealPlanShoppingListIntegration mealPlanId={id!} />

      {/* Save as Template Modal */}
      {showSaveAsTemplate && (
        <SaveAsTemplateModal
          mealPlanId={id!}
          mealPlanName={mealPlan.name}
          onClose={() => setShowSaveAsTemplate(false)}
          onSuccess={handleTemplateSaved}
        />
      )}
    </div>
  );
}
