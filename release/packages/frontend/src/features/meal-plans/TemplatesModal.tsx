import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mealPlanTemplateApi } from '@/services/api';

interface Template {
  id: string;
  name: string;
  description?: string;
  duration: number;
  tags?: string[];
  meals: any[];
  createdAt: Date;
  updatedAt: Date;
}

interface TemplatesModalProps {
  onClose: () => void;
}

export function TemplatesModal({ onClose }: TemplatesModalProps) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [planName, setPlanName] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await mealPlanTemplateApi.getAll();
      setTemplates(response.data);
    } catch (err: any) {
      console.error('Failed to load templates:', err);
      setError(err.response?.data?.error || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await mealPlanTemplateApi.delete(templateId);
      setTemplates(templates.filter((t) => t.id !== templateId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete template');
    }
  };

  const handleApplyTemplate = async () => {
    if (!applyingTemplateId || !startDate) {
      alert('Please select a start date');
      return;
    }

    try {
      const response = await mealPlanTemplateApi.apply(applyingTemplateId, {
        startDate,
        name: planName.trim() || undefined,
      });

      const mealPlanId = response.data.id;
      onClose();
      navigate(`/meal-plans/${mealPlanId}`);
    } catch (err: any) {
      console.error('Failed to apply template:', err);
      alert(err.response?.data?.error || 'Failed to create meal plan from template');
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-card rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 text-center">
            <div className="text-muted-foreground">Loading templates...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Meal Plan Templates</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Reusable meal plans you can apply to any date
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive mb-4">
              {error}
            </div>
          )}

          {templates.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 mx-auto text-muted-foreground mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Templates Yet</h3>
              <p className="text-muted-foreground">
                Save a meal plan as a template to reuse it later.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="bg-accent/10 rounded-lg border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        {template.name}
                      </h3>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{template.duration} days</span>
                        <span>{template.meals.length} meals</span>
                        {template.tags && template.tags.length > 0 && (
                          <div className="flex gap-1">
                            {template.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setApplyingTemplateId(template.id);
                          setPlanName(template.name);
                          setStartDate(getTodayDate());
                        }}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Apply Template Form */}
                  {applyingTemplateId === template.id && (
                    <div className="mt-4 pt-4 border-t border-border space-y-3">
                      <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-foreground mb-2">
                          Start Date
                        </label>
                        <input
                          id="startDate"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          min={getTodayDate()}
                          className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="planName" className="block text-sm font-medium text-foreground mb-2">
                          Meal Plan Name (Optional)
                        </label>
                        <input
                          id="planName"
                          type="text"
                          value={planName}
                          onChange={(e) => setPlanName(e.target.value)}
                          placeholder={template.name}
                          className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setApplyingTemplateId(null)}
                          className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-accent transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleApplyTemplate}
                          disabled={!startDate}
                          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Create Meal Plan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
