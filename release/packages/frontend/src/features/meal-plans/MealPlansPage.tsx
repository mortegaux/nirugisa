import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { mealPlanApi } from '@/services/api';
import { AIMealPlanGenerateModal } from './AIMealPlanGenerateModal';
import { IntelligentMealPlanModal } from './IntelligentMealPlanModal';
import { MealPlanPreviewModal } from './MealPlanPreviewModal';
import { TemplatesModal } from './TemplatesModal';
import { AutoAwesomeIcon } from '@/components/icons/MaterialIcon';
import { AIConfigAlert } from '@/components/AIConfigAlert';
import { checkAIConfiguration } from '@/utils/aiValidation';
import type { MealPlan, MealPlanPreview } from '@nommable/shared';

export default function MealPlansPage() {
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [showIntelligentGenerate, setShowIntelligentGenerate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [preview, setPreview] = useState<MealPlanPreview | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showAIConfigAlert, setShowAIConfigAlert] = useState(false);
  const [selectedMealPlans, setSelectedMealPlans] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMealPlans();
  }, []);

  const loadMealPlans = async () => {
    try {
      const response = await mealPlanApi.getAll();
      setMealPlans(response.data);
    } catch (error) {
      console.error('Failed to load meal plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCalendar = async (mealPlanId: string) => {
    try {
      await mealPlanApi.exportToCalendar(mealPlanId);
    } catch (error) {
      console.error('Failed to export calendar:', error);
      alert('Failed to export calendar. Please try again.');
    }
  };

  const handleGenerateIntelligent = async (request: any) => {
    setGenerating(true);
    try {
      const response = await mealPlanApi.generatePreview(request);
      setPreview(response.data);
      setShowIntelligentGenerate(false);
    } catch (error) {
      console.error('Failed to generate meal plan:', error);
      alert('Failed to generate meal plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleReplaceMeal = async (date: string, mealType: string) => {
    if (!preview) return;

    try {
      const response = await mealPlanApi.replaceMeal({
        date,
        mealType,
        dietary: [], // Can optionally pass filters here
        cuisine: [],
        excludeIngredients: [],
      });

      // Update the preview with the new meal suggestion
      const updatedSuggestions = preview.mealSuggestions.map((meal) =>
        meal.date === date && meal.mealType === mealType ? response.data : meal
      );

      setPreview({
        ...preview,
        mealSuggestions: updatedSuggestions,
      });
    } catch (error) {
      console.error('Failed to replace meal:', error);
      alert('Failed to replace meal. Please try again.');
    }
  };

  const handleSmartGenerateClick = async () => {
    const aiStatus = await checkAIConfiguration();

    if (!aiStatus.isConfigured || !aiStatus.isEnabled) {
      setShowAIConfigAlert(true);
      return;
    }

    setShowIntelligentGenerate(true);
  };

  const toggleMealPlanSelection = (id: string) => {
    const newSelection = new Set(selectedMealPlans);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedMealPlans(newSelection);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedMealPlans.size} meal plan(s)?`)) {
      return;
    }

    try {
      await mealPlanApi.bulkDelete(Array.from(selectedMealPlans));
      setSelectedMealPlans(new Set());
      loadMealPlans();
    } catch (error) {
      console.error('Failed to delete meal plans:', error);
      alert('Failed to delete meal plans. Please try again.');
    }
  };

  if (loading) {
    return <div>Loading meal plans...</div>;
  }

  return (
    <>
      <div>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-foreground">Meal Plans</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplates(true)}
              className="rounded-lg border border-border bg-background px-4 py-2 font-medium text-foreground hover:bg-accent shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 inline-flex items-center gap-2"
              aria-label="View templates"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              Templates
            </button>
            <button
              onClick={handleSmartGenerateClick}
              className="rounded-lg border border-border bg-background px-4 py-2 font-medium text-foreground hover:bg-accent shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 inline-flex items-center gap-2"
              aria-label="Generate intelligent meal plan"
            >
              <AutoAwesomeIcon size={18} />
              Smart Generate
            </button>
            <Link
              to="/meal-plans/new"
              className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 inline-flex items-center gap-2"
              aria-label="Create new meal plan"
            >
              Create Meal Plan
            </Link>
          </div>
        </div>

        {/* Selection toolbar */}
        {selectedMealPlans.size > 0 && (
          <div className="mb-4 bg-primary/10 border border-primary/30 rounded-lg p-4 flex items-center justify-between">
            <span className="text-foreground font-medium">
              {selectedMealPlans.size} meal plan(s) selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedMealPlans(new Set())}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Clear Selection
              </button>
              <button
                onClick={handleBulkDelete}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Delete Selected
              </button>
            </div>
          </div>
        )}

        {mealPlans.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">No meal plans yet. Create your first meal plan!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {mealPlans.map((plan) => (
              <div key={plan.id} className="relative">
                <input
                  type="checkbox"
                  checked={selectedMealPlans.has(plan.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleMealPlanSelection(plan.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-5 h-5 absolute top-3 left-3 z-10 cursor-pointer accent-primary"
                  aria-label={`Select ${plan.name}`}
                />
                <Link
                  to={`/meal-plans/${plan.id}`}
                  className="block rounded-lg border border-border bg-card p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  <h3 className="mb-2 text-xl font-semibold text-foreground pl-8">{plan.name}</h3>
                {plan.description && (
                  <p className="mb-4 text-muted-foreground">{plan.description}</p>
                )}
                <div className="text-sm text-muted-foreground">
                  {new Date(plan.startDate).toLocaleDateString()} -{' '}
                  {new Date(plan.endDate).toLocaleDateString()}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {plan.isAiGenerated && (
                    <span className="inline-block rounded bg-accent/20 px-2 py-1 text-xs font-medium text-accent-foreground">
                      AI Generated
                    </span>
                  )}
                  <button
                    onClick={() => handleExportCalendar(plan.id)}
                    className="inline-flex items-center gap-1 rounded bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-secondary"
                    title="Export to Calendar"
                    aria-label={`Export ${plan.name} to calendar`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Export to Calendar
                  </button>
                </div>
              </Link>
            </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Config Alert */}
      {showAIConfigAlert && (
        <AIConfigAlert onClose={() => setShowAIConfigAlert(false)} />
      )}

      {/* Legacy AI Generate Modal */}
      {showAIGenerate && (
        <AIMealPlanGenerateModal onClose={() => setShowAIGenerate(false)} />
      )}

      {/* Intelligent Meal Plan Generation Modal */}
      {showIntelligentGenerate && (
        <IntelligentMealPlanModal
          onClose={() => setShowIntelligentGenerate(false)}
          onGenerate={handleGenerateIntelligent}
        />
      )}

      {/* Meal Plan Preview Modal */}
      {preview && (
        <MealPlanPreviewModal
          preview={preview}
          onClose={() => setPreview(null)}
          onReplaceMeal={handleReplaceMeal}
        />
      )}

      {/* Templates Modal */}
      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} />}

      {/* Loading overlay during generation */}
      {generating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-8 shadow-2xl flex flex-col items-center gap-4">
            <svg className="animate-spin h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-foreground font-medium">Generating intelligent meal plan...</p>
            <p className="text-sm text-muted-foreground">
              Analyzing your recipes, pantry, and preferences
            </p>
          </div>
        </div>
      )}
    </>
  );
}
