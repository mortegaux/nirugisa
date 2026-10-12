import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { recipeApi, taxonomyApi } from '@/services/api';
import { RecipeImportExport } from './RecipeImportExport';
import { AIGenerateRecipeModal } from './AIGenerateRecipeModal';
import { AutoAwesomeIcon, RestaurantIcon } from '@/components/icons/MaterialIcon';
import { AIConfigAlert } from '@/components/AIConfigAlert';
import { checkAIConfiguration } from '@/utils/aiValidation';
import { useAuthStore } from '@/store/auth.store';
import type { Recipe, Taxonomy } from '@nommable/shared';

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    },
    []
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  const toggle = (item: string) => {
    const next = new Set(selected);
    if (next.has(item)) {
      next.delete(item);
    } else {
      next.add(item);
    }
    onChange(next);
  };

  const displayLabel = selected.size > 0 ? `${label} (${selected.size})` : label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background pl-3 pr-2 py-2 text-sm text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary whitespace-nowrap"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{displayLabel}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 min-w-[180px] rounded-md border border-border bg-card shadow-lg">
          <ul role="listbox" className="max-h-60 overflow-auto py-1">
            {options.map((item) => (
              <li key={item}>
                <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(item)}
                    onChange={() => toggle(item)}
                    className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-primary"
                  />
                  <span>{item}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const DIETARY_BADGES = {
  'Vegetarian': { color: 'bg-green-100 text-green-800' },
  'Vegan': { color: 'bg-green-100 text-green-800' },
  'Gluten-Free': { color: 'bg-amber-100 text-amber-800' },
  'Dairy-Free': { color: 'bg-blue-100 text-blue-800' },
  'Low-Carb': { color: 'bg-purple-100 text-purple-800' },
  'Keto': { color: 'bg-purple-100 text-purple-800' },
  'Paleo': { color: 'bg-orange-100 text-orange-800' },
  'Quick': { color: 'bg-red-100 text-red-800' },
  'One-Pot': { color: 'bg-indigo-100 text-indigo-800' },
  'Freezer-Friendly': { color: 'bg-cyan-100 text-cyan-800' },
  'Kid-Friendly': { color: 'bg-pink-100 text-pink-800' },
  'Healthy': { color: 'bg-emerald-100 text-emerald-800' },
};

const DIFFICULTY_DISPLAY = {
  'easy': { label: 'Easy', color: 'text-green-700', icon: '●' },
  'medium': { label: 'Medium', color: 'text-amber-700', icon: '●●' },
  'hard': { label: 'Hard', color: 'text-red-700', icon: '●●●' },
};

// Helper function to format time display
const formatTimeDisplay = (minutes: number): string => {
  if (minutes === 60) {
    return '1 hour';
  } else if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    return `${hours} hr ${remainingMinutes} min`;
  }
  return `${minutes} min`;
};

export default function RecipesPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const [searchParams, setSearchParams] = useSearchParams();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedDietaryTags, setSelectedDietaryTags] = useState<Set<string>>(new Set());
  const [showImportExport, setShowImportExport] = useState(false);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [showAIConfigAlert, setShowAIConfigAlert] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditTags, setBulkEditTags] = useState('');
  const [bulkEditCategories, setBulkEditCategories] = useState('');
  const [taxonomyCategories, setTaxonomyCategories] = useState<string[]>([]);
  const [taxonomyTags, setTaxonomyTags] = useState<string[]>([]);

  useEffect(() => {
    if (searchParams.get('import') === 'true') {
      setShowImportExport(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    loadRecipes();
    taxonomyApi.getAll().then((res) => {
      const items: Taxonomy[] = res.data;
      setTaxonomyCategories(items.filter((t) => t.type === 'category').map((t) => t.name));
      setTaxonomyTags(items.filter((t) => t.type === 'tag').map((t) => t.name));
    }).catch(() => {});
  }, []);

  const loadRecipes = async () => {
    try {
      const response = await recipeApi.getAll();
      setRecipes(response.data);
    } catch (error) {
      console.error('Failed to load recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAIGenerateClick = async () => {
    const aiStatus = await checkAIConfiguration();

    if (!aiStatus.isConfigured || !aiStatus.isEnabled) {
      setShowAIConfigAlert(true);
      return;
    }

    setShowAIGenerate(true);
  };

  const toggleRecipeSelection = (id: string) => {
    const newSelection = new Set(selectedRecipes);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRecipes(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedRecipes.size === filteredRecipes.length) {
      setSelectedRecipes(new Set());
    } else {
      setSelectedRecipes(new Set(filteredRecipes.map(r => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedRecipes.size} recipe(s)?`)) {
      return;
    }

    try {
      await recipeApi.bulkDelete(Array.from(selectedRecipes));
      setSelectedRecipes(new Set());
      loadRecipes();
    } catch (error) {
      console.error('Failed to delete recipes:', error);
      alert('Failed to delete recipes');
    }
  };

  const handleBulkUpdate = async () => {
    const tags = bulkEditTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    const categories = bulkEditCategories
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    if (tags.length === 0 && categories.length === 0) {
      alert('Please enter at least one tag or category');
      return;
    }

    try {
      await recipeApi.bulkUpdate(
        Array.from(selectedRecipes),
        { tags: tags.length > 0 ? tags : undefined, categories: categories.length > 0 ? categories : undefined }
      );
      setSelectedRecipes(new Set());
      setShowBulkEdit(false);
      setBulkEditTags('');
      setBulkEditCategories('');
      loadRecipes();
    } catch (error) {
      console.error('Failed to update recipes:', error);
      alert('Failed to update recipes');
    }
  };

  // Use taxonomy-sourced categories/tags, falling back to recipe-extracted values
  const allCategories = taxonomyCategories.length > 0
    ? taxonomyCategories
    : Array.from(new Set(recipes.flatMap(r => r.categories || [])));
  const allDietaryTags = taxonomyTags.length > 0
    ? taxonomyTags.filter(tag => Object.keys(DIETARY_BADGES).includes(tag))
    : Array.from(
        new Set(
          recipes.flatMap(r => r.tags || []).filter(tag => Object.keys(DIETARY_BADGES).includes(tag))
        )
      );

  // Filter recipes
  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch =
      !searchQuery ||
      recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategories.size === 0 ||
      (recipe.categories && recipe.categories.some((c) => selectedCategories.has(c)));

    const matchesDietary =
      selectedDietaryTags.size === 0 ||
      (recipe.tags && recipe.tags.some((t) => selectedDietaryTags.has(t)));

    return matchesSearch && matchesCategory && matchesDietary;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading recipes...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Recipes</h1>
          <p className="text-muted-foreground mt-1">{recipes.length} delicious recipes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAIGenerateClick}
            className="rounded-lg border border-border bg-background px-4 py-2 font-medium text-foreground hover:bg-accent shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 inline-flex items-center gap-2"
            aria-label="Generate recipe with AI"
          >
            <AutoAwesomeIcon size={18} />
            Generate with AI
          </button>
          <Link
            to="/recipes/new"
            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 inline-flex items-center gap-2"
            aria-label="Create new recipe"
          >
            Create Recipe
          </Link>
        </div>
      </div>

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-foreground mb-4">Add Tags and Categories</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add tags and categories to {selectedRecipes.size} selected recipe(s). These will be added to existing ones.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={bulkEditTags}
                  onChange={(e) => setBulkEditTags(e.target.value)}
                  placeholder="e.g. Vegetarian, Quick, Healthy"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Categories (comma-separated)
                </label>
                <input
                  type="text"
                  value={bulkEditCategories}
                  onChange={(e) => setBulkEditCategories(e.target.value)}
                  placeholder="e.g. Dinner, Italian"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowBulkEdit(false);
                  setBulkEditTags('');
                  setBulkEditCategories('');
                }}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 font-medium text-foreground hover:bg-accent transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdate}
                className="flex-1 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Apply to {selectedRecipes.size} recipes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Config Alert */}
      {showAIConfigAlert && (
        <AIConfigAlert onClose={() => setShowAIConfigAlert(false)} />
      )}

      {/* AI Generate Modal */}
      {showAIGenerate && (
        <AIGenerateRecipeModal onClose={() => setShowAIGenerate(false)} />
      )}

      {/* Import/Export Modal */}
      {showImportExport && (
        <RecipeImportExport onClose={() => setShowImportExport(false)} />
      )}

      {/* Search and Filters */}
      <div className="mb-6 bg-card rounded-lg border border-border p-4 shadow-sm space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            id="search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes..."
            className="w-full sm:flex-1 sm:min-w-0 rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Search recipes"
          />
          <div className="flex items-center gap-3 flex-wrap">
          {allCategories.length > 0 && (
            <MultiSelectDropdown
              label="All Categories"
              options={allCategories}
              selected={selectedCategories}
              onChange={setSelectedCategories}
            />
          )}
          {allDietaryTags.length > 0 && (
            <MultiSelectDropdown
              label="All Dietary"
              options={allDietaryTags}
              selected={selectedDietaryTags}
              onChange={setSelectedDietaryTags}
            />
          )}
          {filteredRecipes.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={selectedRecipes.size === filteredRecipes.length && filteredRecipes.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-primary"
              />
              <span className="text-sm text-muted-foreground">Select all</span>
            </label>
          )}
          {isAdmin && (
            <Link
              to="/settings/taxonomies"
              className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
              title="Edit categories & tags"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </Link>
          )}
          </div>
        </div>
        {(selectedCategories.size > 0 || selectedDietaryTags.size > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Active:</span>
            {[...selectedCategories].map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  setSelectedCategories((prev) => {
                    const next = new Set(prev);
                    next.delete(cat);
                    return next;
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 pl-2.5 pr-1.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <span>{cat}</span>
                <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-primary/20">&times;</span>
              </button>
            ))}
            {[...selectedDietaryTags].map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setSelectedDietaryTags((prev) => {
                    const next = new Set(prev);
                    next.delete(tag);
                    return next;
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 pl-2.5 pr-1.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/20 transition-colors"
              >
                <span>{tag}</span>
                <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-secondary/20">&times;</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recipe Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            {searchQuery || selectedCategories.size > 0 || selectedDietaryTags.size > 0
              ? 'No recipes match your filters. Try adjusting your search.'
              : 'No recipes yet. Create your first recipe!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.map((recipe) => {
            const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
            const difficulty = recipe.difficulty ? DIFFICULTY_DISPLAY[recipe.difficulty] : null;
            const dietaryTags = (recipe.tags || []).filter(tag =>
              Object.keys(DIETARY_BADGES).includes(tag)
            );
            const isSelected = selectedRecipes.has(recipe.id);

            return (
              <div
                key={recipe.id}
                className={`group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-lg ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                {/* Selection Checkbox */}
                <div className="absolute top-3 left-3 z-10">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleRecipeSelection(recipe.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 rounded border-2 border-white bg-white/90 text-primary shadow-md focus:ring-2 focus:ring-primary cursor-pointer"
                  />
                </div>

                <Link
                  to={`/recipes/${recipe.id}`}
                  className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  aria-label={`View recipe: ${recipe.title}`}
                >
                  {/* Hero Image */}
                  <div className="relative overflow-hidden bg-muted aspect-[16/10]">
                    {recipe.imageUrl ? (
                      <>
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {/* Gradient overlay for better text readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <RestaurantIcon size={64} className="text-muted-foreground" />
                      </div>
                    )}

                    {/* Time Badge - Overlay on image */}
                    {totalTime > 0 && (
                      <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {formatTimeDisplay(totalTime)}
                      </div>
                    )}

                    {/* AI Generated Badge */}
                    {recipe.isAiGenerated && (
                      <div className="absolute bottom-3 left-3 bg-accent/90 backdrop-blur-sm text-accent-foreground px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                        <AutoAwesomeIcon size={12} />
                        AI
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-4">
                    {/* Title */}
                    <h3 className="text-xl font-bold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {recipe.title}
                    </h3>

                    {/* Description */}
                    {recipe.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {recipe.description}
                      </p>
                    )}

                    {/* Categories */}
                    {recipe.categories && recipe.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {recipe.categories.slice(0, 2).map(category => (
                          <span
                            key={category}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                          >
                            {category}
                          </span>
                        ))}
                        {recipe.categories.length > 2 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                            +{recipe.categories.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Dietary Badges */}
                    {dietaryTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {dietaryTags.slice(0, 3).map(tag => {
                          const badge = DIETARY_BADGES[tag as keyof typeof DIETARY_BADGES];
                          return (
                            <span
                              key={tag}
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${badge.color}`}
                            >
                              {tag}
                            </span>
                          );
                        })}
                        {dietaryTags.length > 3 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                            +{dietaryTags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer: Time breakdown and difficulty */}
                    <div className="flex items-center justify-between pt-3 border-t border-border text-sm">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        {recipe.prepTime && (
                          <span className="flex items-center gap-1" title="Prep time">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                              />
                            </svg>
                            {recipe.prepTime}m
                          </span>
                        )}
                        {recipe.cookTime && (
                          <span className="flex items-center gap-1" title="Cook time">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                              />
                            </svg>
                            {recipe.cookTime}m
                          </span>
                        )}
                      </div>

                      {/* Difficulty */}
                      {difficulty && (
                        <div className={`flex items-center gap-1 font-medium ${difficulty.color}`}>
                          <span className="text-xs" aria-hidden="true">{difficulty.icon}</span>
                          <span className="text-xs">{difficulty.label}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedRecipes.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-primary/30 bg-card/95 backdrop-blur-sm shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground">
                {selectedRecipes.size} recipe(s) selected
              </span>
              <button
                onClick={() => setSelectedRecipes(new Set())}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Clear selection
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkEdit(true)}
                className="rounded-lg bg-background border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent shadow-sm transition-all"
              >
                Add Tags/Categories
              </button>
              <button
                onClick={handleBulkDelete}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 shadow-sm transition-all"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
