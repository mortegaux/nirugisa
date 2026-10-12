import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { recipeApi } from '@/services/api';
import { formatQuantity } from '@/utils/fractions';
import { CookingMode } from './CookingMode';
import { AIEnhanceRecipeModal } from './AIEnhanceRecipeModal';
import { AIConfigAlert } from '@/components/AIConfigAlert';
import { checkAIConfiguration } from '@/utils/aiValidation';
import {
  AccessTimeIcon,
  AutoAwesomeIcon,
  GroupIcon,
  RestaurantIcon,
  KitchenIcon,
  LocalFireDepartmentIcon,
  ListIcon,
  DescriptionIcon
} from '@/components/icons/MaterialIcon';
import type { Recipe } from '@nommable/shared';

const DIETARY_BADGES = {
  'Vegetarian': { color: 'bg-green-100 text-green-800 border-green-200' },
  'Vegan': { color: 'bg-green-100 text-green-800 border-green-200' },
  'Gluten-Free': { color: 'bg-amber-100 text-amber-800 border-amber-200' },
  'Dairy-Free': { color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'Low-Carb': { color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'Keto': { color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'Paleo': { color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'Quick': { color: 'bg-red-100 text-red-800 border-red-200' },
  'One-Pot': { color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'Freezer-Friendly': { color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  'Kid-Friendly': { color: 'bg-pink-100 text-pink-800 border-pink-200' },
  'Healthy': { color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: 'text-green-700 bg-green-50 border-green-200' },
  medium: { label: 'Medium', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  hard: { label: 'Hard', color: 'text-red-700 bg-red-50 border-red-200' },
};

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [servingMultiplier, setServingMultiplier] = useState(1);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [cookingMode, setCookingMode] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);
  const [enhancementType, setEnhancementType] = useState<'improve_instructions' | 'add_tips' | 'optimize_ingredients'>('improve_instructions');
  const [showAIConfigAlert, setShowAIConfigAlert] = useState(false);

  useEffect(() => {
    if (id) {
      loadRecipe(id);
    }
  }, [id]);

  const loadRecipe = async (recipeId: string) => {
    try {
      const response = await recipeApi.getById(recipeId);
      setRecipe(response.data);
    } catch (error) {
      console.error('Failed to load recipe:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this recipe?')) return;

    try {
      await recipeApi.delete(id);
      navigate('/recipes');
    } catch (error) {
      console.error('Failed to delete recipe:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    if (!recipe) return;

    // Create a clean export without IDs and timestamps
    const exportData = {
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      difficulty: recipe.difficulty,
      imageUrl: recipe.imageUrl,
      sourceUrl: recipe.sourceUrl,
      notes: recipe.notes,
      ingredients: recipe.ingredients?.map(ing => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        notes: ing.notes,
        section: ing.section,
      })),
      instructions: recipe.instructions,
      categories: recipe.categories,
      tags: recipe.tags,
      nutrition: recipe.nutrition,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recipe.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareLink = () => {
    const shareLink = `${window.location.origin}/recipes/${id}`;
    navigator.clipboard.writeText(shareLink);
    alert('Share link copied to clipboard!');
  };

  const toggleIngredient = (ingredientId: string) => {
    setCheckedIngredients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ingredientId)) {
        newSet.delete(ingredientId);
      } else {
        newSet.add(ingredientId);
      }
      return newSet;
    });
  };

  const toggleStep = (stepIndex: number) => {
    setCheckedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepIndex)) {
        newSet.delete(stepIndex);
      } else {
        newSet.add(stepIndex);
      }
      return newSet;
    });
  };

  const handleAIEnhanceClick = async (type: 'improve_instructions' | 'add_tips' | 'optimize_ingredients') => {
    const aiStatus = await checkAIConfiguration();

    if (!aiStatus.isConfigured || !aiStatus.isEnabled) {
      setShowAIConfigAlert(true);
      setShowMenu(false);
      return;
    }

    setEnhancementType(type);
    setShowEnhanceModal(true);
    setShowMenu(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading recipe...</div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-destructive mb-4">Recipe not found</p>
        <Link to="/recipes" className="text-primary hover:underline">
          Back to Recipes
        </Link>
      </div>
    );
  }

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  const difficulty = recipe.difficulty ? DIFFICULTY_CONFIG[recipe.difficulty] : null;
  const dietaryTags = (recipe.tags || []).filter(tag => Object.keys(DIETARY_BADGES).includes(tag));
  const adjustedServings = (recipe.servings || 1) * servingMultiplier;

  // Render cooking mode if active
  if (cookingMode) {
    return (
      <CookingMode
        recipe={recipe}
        servingMultiplier={servingMultiplier}
        onExit={() => setCookingMode(false)}
      />
    );
  }

  return (
    <>
      {/* AI Config Alert */}
      {showAIConfigAlert && (
        <AIConfigAlert onClose={() => setShowAIConfigAlert(false)} />
      )}

      {/* AI Enhancement Modal */}
      {showEnhanceModal && recipe && (
        <AIEnhanceRecipeModal
          recipeId={recipe.id}
          recipeTitle={recipe.title}
          enhancementType={enhancementType}
          onClose={() => setShowEnhanceModal(false)}
          onSuccess={() => {
            // Reload recipe to see changes
            if (id) loadRecipe(id);
          }}
        />
      )}

      <div className="max-w-6xl mx-auto pb-12">
      {/* Breadcrumb & Actions */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          to="/recipes"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Recipes
        </Link>

        <div className="flex gap-2">
          <button
            onClick={() => setCookingMode(true)}
            className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-accent transition-colors flex items-center gap-2"
            aria-label="Enter cooking mode"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Cook
          </button>
          <button
            onClick={handleShareLink}
            className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-accent transition-colors flex items-center gap-2"
            aria-label="Copy share link"
            title="Copy share link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>

          {/* Kebab Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-accent transition-colors flex items-center"
              aria-label="More actions"
              aria-expanded={showMenu}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {showMenu && (
              <>
                {/* Backdrop to close menu when clicking outside */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />

                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg border border-border shadow-lg z-20 overflow-hidden">
                  <button
                    onClick={() => {
                      navigate(`/recipes/${id}/edit`);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left text-foreground hover:bg-accent transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Recipe
                  </button>

                  <button
                    onClick={() => {
                      handleExportJson();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left text-foreground hover:bg-accent transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Export as JSON
                  </button>

                  <button
                    onClick={() => {
                      handlePrint();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left text-foreground hover:bg-accent transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print Recipe
                  </button>

                  <div className="border-t border-border"></div>

                  {/* AI Enhancement Options */}
                  <div className="px-4 py-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <AutoAwesomeIcon size={12} />
                      AI Enhancements
                    </div>
                  </div>

                  <button
                    onClick={() => handleAIEnhanceClick('improve_instructions')}
                    className="w-full px-4 py-3 text-left text-foreground hover:bg-accent transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Improve Instructions
                  </button>

                  <button
                    onClick={() => handleAIEnhanceClick('add_tips')}
                    className="w-full px-4 py-3 text-left text-foreground hover:bg-accent transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Add Cooking Tips
                  </button>

                  <button
                    onClick={() => handleAIEnhanceClick('optimize_ingredients')}
                    className="w-full px-4 py-3 text-left text-foreground hover:bg-accent transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Optimize Ingredients
                  </button>

                  <div className="border-t border-border"></div>

                  <button
                    onClick={() => {
                      handleDelete();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Recipe
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Print-only compact header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">{recipe.title}</h1>
        {recipe.description && (
          <p className="text-sm text-muted-foreground mt-1">{recipe.description}</p>
        )}
        <div className="text-sm mt-1 text-muted-foreground">
          {recipe.servings && <span>Serves {adjustedServings}</span>}
          {recipe.prepTime && recipe.prepTime > 0 && <span> | Prep {recipe.prepTime}m</span>}
          {recipe.cookTime && recipe.cookTime > 0 && <span> | Cook {recipe.cookTime}m</span>}
          {totalTime > 0 && <span> | Total {totalTime}m</span>}
          {difficulty && <span> | {difficulty.label}</span>}
        </div>
      </div>

      {/* Hero Image */}
      {recipe.imageUrl && (
        <div className="recipe-hero relative w-full h-96 rounded-2xl overflow-hidden shadow-xl mb-8 print:hidden">
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Title overlay on image */}
          <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
            <h1 className="text-5xl font-bold mb-2 drop-shadow-lg">{recipe.title}</h1>
            {recipe.description && (
              <p className="text-lg text-white/90 drop-shadow max-w-3xl">{recipe.description}</p>
            )}
          </div>

          {/* AI Badge */}
          {recipe.isAiGenerated && (
            <div className="absolute top-4 right-4 bg-accent/95 backdrop-blur-sm text-accent-foreground px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg flex items-center gap-2">
              <AutoAwesomeIcon size={16} />
              AI Generated
            </div>
          )}
        </div>
      )}

      {/* Title if no image */}
      {!recipe.imageUrl && (
        <div className="mb-8 print:hidden">
          <h1 className="text-5xl font-bold text-foreground mb-3">{recipe.title}</h1>
          {recipe.description && (
            <p className="text-xl text-muted-foreground">{recipe.description}</p>
          )}
        </div>
      )}

      {/* Meta Info Cards */}
      <div className="recipe-meta-cards grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 print:hidden">
        {recipe.servings && (
          <div className="bg-card rounded-xl border border-border p-4 text-center hover:shadow-md transition-shadow">
            <div className="mb-2 flex justify-center">
              <GroupIcon size={32} className="text-primary" />
            </div>
            <div className="text-2xl font-bold text-foreground">{recipe.servings}</div>
            <div className="text-sm text-muted-foreground">Servings</div>
          </div>
        )}
        {recipe.prepTime && recipe.prepTime > 0 && (
          <div className="bg-card rounded-xl border border-border p-4 text-center hover:shadow-md transition-shadow">
            <div className="mb-2 flex justify-center">
              <KitchenIcon size={32} className="text-primary" />
            </div>
            <div className="text-2xl font-bold text-foreground">{recipe.prepTime}m</div>
            <div className="text-sm text-muted-foreground">Prep Time</div>
          </div>
        )}
        {recipe.cookTime && recipe.cookTime > 0 && (
          <div className="bg-card rounded-xl border border-border p-4 text-center hover:shadow-md transition-shadow">
            <div className="mb-2 flex justify-center">
              <LocalFireDepartmentIcon size={32} className="text-primary" />
            </div>
            <div className="text-2xl font-bold text-foreground">{recipe.cookTime}m</div>
            <div className="text-sm text-muted-foreground">Cook Time</div>
          </div>
        )}
        {totalTime > 0 && (
          <div className="bg-primary/5 rounded-xl border-2 border-primary/20 p-4 text-center hover:shadow-md transition-shadow">
            <div className="mb-2 flex justify-center">
              <AccessTimeIcon size={32} className="text-primary" />
            </div>
            <div className="text-2xl font-bold text-primary">{totalTime}m</div>
            <div className="text-sm text-muted-foreground">Total Time</div>
          </div>
        )}
      </div>

      {/* Tags & Difficulty */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {difficulty && (
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border-2 ${difficulty.color}`}>
            {difficulty.label}
          </span>
        )}
        {dietaryTags.map(tag => {
          const badge = DIETARY_BADGES[tag as keyof typeof DIETARY_BADGES];
          return (
            <span
              key={tag}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border ${badge.color}`}
            >
              {tag}
            </span>
          );
        })}
        {recipe.categories?.map(cat => (
          <span
            key={cat}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-secondary/10 text-secondary border border-secondary/20"
          >
            {cat}
          </span>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Ingredients Section */}
        <div className="lg:col-span-1">
          <div className="recipe-ingredients bg-card rounded-2xl border border-border p-6 shadow-sm sticky top-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <RestaurantIcon size={24} />
                Ingredients
              </h2>
              {recipe.servings && (
                <div className="recipe-serving-controls flex items-center gap-2">
                  <button
                    onClick={() => setServingMultiplier(Math.max(0.5, servingMultiplier - 0.5))}
                    className="w-8 h-8 rounded-full bg-background border border-border hover:bg-accent transition-colors flex items-center justify-center"
                    aria-label="Decrease servings"
                  >
                    −
                  </button>
                  <span className="text-sm font-medium min-w-[3rem] text-center">
                    ×{servingMultiplier}
                  </span>
                  <button
                    onClick={() => setServingMultiplier(servingMultiplier + 0.5)}
                    className="w-8 h-8 rounded-full bg-background border border-border hover:bg-accent transition-colors flex items-center justify-center"
                    aria-label="Increase servings"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            {adjustedServings !== recipe.servings && (
              <p className="text-sm text-muted-foreground mb-4 pb-4 border-b border-border">
                Adjusted for <span className="font-semibold text-foreground">{adjustedServings}</span> servings
              </p>
            )}

            <ul className="space-y-3">
              {recipe.ingredients?.map((ing) => {
                const adjustedQuantity = ing.quantity ? ing.quantity * servingMultiplier : undefined;
                const isChecked = checkedIngredients.has(ing.id);

                return (
                  <li key={ing.id}>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleIngredient(ing.id)}
                        className="mt-1 w-5 h-5 rounded border-2 border-border cursor-pointer focus:ring-2 focus:ring-primary"
                      />
                      <span className={`flex-1 ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        <span className="font-semibold text-primary">
                          {formatQuantity(adjustedQuantity, ing.unit)}
                          {adjustedQuantity && ' '}
                          {ing.unit && `${ing.unit} `}
                        </span>
                        <span className="font-medium">{ing.name}</span>
                        {ing.notes && (
                          <span className="block text-sm text-muted-foreground italic mt-0.5">
                            {ing.notes}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Instructions Section */}
        <div className="lg:col-span-2">
          <div className="recipe-instructions bg-card rounded-2xl border border-border p-6 md:p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
              <ListIcon size={24} />
              Instructions
            </h2>

            <ol className="space-y-6">
              {recipe.instructions?.map((instruction, index) => {
                const isChecked = checkedSteps.has(index);

                return (
                  <li key={index} className="flex gap-4 group">
                    <div className="flex-shrink-0">
                      <span className="step-number-print hidden font-bold mr-1">{index + 1}.</span>
                      <button
                        onClick={() => toggleStep(index)}
                        className={`step-circle w-10 h-10 rounded-full font-bold text-lg flex items-center justify-center transition-all ${
                          isChecked
                            ? 'bg-secondary text-secondary-foreground'
                            : 'bg-primary text-primary-foreground hover:shadow-lg'
                        }`}
                        aria-label={`Mark step ${index + 1} as ${isChecked ? 'incomplete' : 'complete'}`}
                      >
                        {isChecked ? '✓' : index + 1}
                      </button>
                    </div>
                    <div className="flex-1 pt-1.5">
                      <p className={`text-base leading-relaxed ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {instruction}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Additional Info */}
          {(recipe.notes || recipe.sourceUrl) && (
            <div className="mt-6 bg-accent/10 rounded-2xl border border-accent/20 p-6">
              {recipe.notes && (
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <DescriptionIcon size={20} />
                    Notes
                  </h3>
                  <p className="text-muted-foreground">{recipe.notes}</p>
                </div>
              )}
              {recipe.sourceUrl && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Source</h3>
                  <a
                    href={recipe.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    {recipe.sourceUrl}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
