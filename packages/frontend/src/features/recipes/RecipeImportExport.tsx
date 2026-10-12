import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recipeApi } from '@/services/api';
import { AutoAwesomeIcon, WarningIcon } from '@/components/icons/MaterialIcon';
import { Dialog } from '@/components/Dialog';
import { compressImages } from '@/utils/compressImage';
import type { RecipeCreateDto } from '@nommable/shared';

interface RecipeImportExportProps {
  onClose: () => void;
}

export function RecipeImportExport({ onClose }: RecipeImportExportProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'import-url' | 'import-text' | 'import-image-pdf'>('import-url');
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Extracted recipe preview state (shared by Paste Text and Image/PDF extraction)
  const [files, setFiles] = useState<File[]>([]);
  const [extractedRecipe, setExtractedRecipe] = useState<RecipeCreateDto | null>(null);

  const handleImportUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a recipe URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await recipeApi.importFromUrl(url);
      navigate(`/recipes/${response.data.id}`);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to import recipe. Make sure the URL is valid.');
    } finally {
      setLoading(false);
    }
  };

  const handleExtractText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText.trim()) {
      setError('Please paste recipe text to extract');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await recipeApi.extractFromText(pastedText);
      setExtractedRecipe(response.data);
    } catch (err: any) {
      console.error('Failed to extract recipe from text:', err);
      setError(err.response?.data?.error || 'Failed to parse recipe text. Please check the text and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).slice(0, 5); // Max 5 files
      const compressed = await compressImages(selectedFiles);
      setFiles(compressed);
      setError('');
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0) {
      setError('Please select at least one image or PDF file');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await recipeApi.extractFromImages(files);
      setExtractedRecipe(response.data);
    } catch (err: any) {
      console.error('Failed to extract recipe:', err);
      setError(err.response?.data?.error || 'Failed to extract recipe. Please check your AI configuration and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!extractedRecipe) return;

    try {
      setLoading(true);
      const response = await recipeApi.create(extractedRecipe);
      const recipeId = response.data.id;

      // Close modal and navigate to the new recipe
      onClose();
      navigate(`/recipes/${recipeId}`);
    } catch (err: any) {
      console.error('Failed to save recipe:', err);
      setError(err.response?.data?.error || 'Failed to save recipe');
      setLoading(false);
    }
  };

  const handleBack = () => {
    setExtractedRecipe(null);
    if (activeTab === 'import-image-pdf') {
      setFiles([]);
    }
    setError('');
  };


  return (
    <Dialog title="Import Recipes" onClose={onClose} panelClassName="max-w-2xl">
      <div className="p-6">
          {/* Tabs */}
          <div className="flex gap-2 flex-wrap mb-6" role="tablist" aria-label="Import method">
            <button
              onClick={() => {
                setActiveTab('import-url');
                setExtractedRecipe(null);
                setError('');
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'import-url'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              Import from URL
            </button>
            <button
              onClick={() => {
                setActiveTab('import-text');
                setExtractedRecipe(null);
                setError('');
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'import-text'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              <AutoAwesomeIcon size={18} />
              Paste Text
            </button>
            <button
              onClick={() => {
                setActiveTab('import-image-pdf');
                setError('');
                setExtractedRecipe(null);
                setFiles([]);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'import-image-pdf'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              <AutoAwesomeIcon size={18} />
              Image Extract
            </button>
          </div>

          {/* Content */}
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
              {error}
            </div>
          )}

          {/* Import from URL */}
          {activeTab === 'import-url' && (
            <form onSubmit={handleImportUrl} className="space-y-4">
              <div>
                <p className="text-muted-foreground mb-4">
                  Import recipes from popular cooking websites. Just paste the recipe URL below.
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Supported sites:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• AllRecipes.com</li>
                    <li>• FoodNetwork.com</li>
                    <li>• BonAppetit.com</li>
                    <li>• SeriousEats.com</li>
                    <li>• ...and many more!</li>
                  </ul>
                </div>
              </div>

              <div>
                <label htmlFor="url" className="block text-sm font-medium text-foreground mb-2">
                  Recipe URL
                </label>
                <input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/recipes/chocolate-chip-cookies"
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Importing...' : 'Import Recipe'}
              </button>
            </form>
          )}

          {/* Paste Unformatted Recipe Text */}
          {activeTab === 'import-text' && !extractedRecipe && (
            <form onSubmit={handleExtractText} className="space-y-4">
              <div>
                <p className="text-muted-foreground mb-2">
                  Copy and paste unformatted or poorly formatted text from any website, blog post, email, or document. Nommable will automatically parse out the title, ingredients, quantities, and step-by-step instructions.
                </p>
              </div>

              <div>
                <label htmlFor="recipe-text" className="block text-sm font-medium text-foreground mb-2">
                  Recipe Text
                </label>
                <textarea
                  id="recipe-text"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`Paste any raw recipe text here...\n\nExample:\nHomemade Sloppy Joes\nPrep: 10 mins | Cook: 20 mins | Serves: 6\n\nIngredients:\n1 lb lean ground beef\n1/2 medium yellow onion, diced\n3/4 cup ketchup\n1 tbsp brown sugar\n1 tsp yellow mustard\n\nInstructions:\n1. Brown the ground beef and onion in a skillet over medium-high heat; drain excess fat.\n2. Stir in ketchup, brown sugar, and mustard.\n3. Simmer on low for 10 minutes until thickened, then serve on toasted buns.`}
                  rows={12}
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !pastedText.trim()}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Parsing Recipe...
                  </>
                ) : (
                  <>
                    <AutoAwesomeIcon size={18} />
                    Generate Recipe from Text
                  </>
                )}
              </button>
            </form>
          )}

          {/* AI Extract from Images */}
          {activeTab === 'import-image-pdf' && !extractedRecipe && (
            <form onSubmit={handleExtract} className="space-y-6">
              {/* Cost Warning */}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="flex gap-3">
                  <WarningIcon size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 mb-1">AI Vision Cost Notice</h3>
                    <p className="text-sm text-amber-800">
                      Extracting recipes from images uses AI vision models, which have higher costs than text-only AI features.
                      Each image processed will consume AI tokens.
                    </p>
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label htmlFor="files" className="block text-sm font-medium text-foreground mb-2">
                  Select Images <span className="text-destructive">*</span>
                </label>
                <input
                  id="files"
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  capture="environment"
                  onChange={handleFileChange}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  required
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Supported formats: PNG, JPG, WebP • Maximum 5 files • Auto-compressed for upload
                </p>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground">Selected Files ({files.length}/5)</h3>
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">
                            🖼️
                          </div>
                          <div>
                            <div className="font-medium text-foreground text-sm">{file.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Remove file"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <h3 className="font-semibold text-blue-900 mb-2">How it works</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Upload screenshots of recipes from paywalled sites or cookbooks</li>
                  <li>AI vision will extract ingredients, instructions, and other details</li>
                  <li>Review the extracted recipe before saving (you can edit it after)</li>
                  <li>Supports up to 5 images if the recipe spans multiple screenshots</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading || files.length === 0}
                className="w-full py-3 rounded-lg border border-border bg-background font-semibold text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Extracting...
                  </>
                ) : (
                  <>
                    <AutoAwesomeIcon size={18} />
                    Extract Recipe
                  </>
                )}
              </button>
            </form>
          )}

          {/* Recipe Preview */}
          {(activeTab === 'import-text' || activeTab === 'import-image-pdf') && extractedRecipe && (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <h3 className="font-semibold text-green-900 mb-1">✓ Recipe Extracted Successfully</h3>
                <p className="text-sm text-green-800">
                  Review the extracted recipe below. You can edit it after saving.
                </p>
              </div>

              <div className="space-y-4 border border-border rounded-lg p-4 bg-accent/5">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{extractedRecipe.title}</h3>
                  {extractedRecipe.description && (
                    <p className="text-muted-foreground mt-1">{extractedRecipe.description}</p>
                  )}
                </div>

                {(extractedRecipe.servings || extractedRecipe.prepTime || extractedRecipe.cookTime) && (
                  <div className="flex gap-4 text-sm">
                    {extractedRecipe.servings && (
                      <div><strong>Servings:</strong> {extractedRecipe.servings}</div>
                    )}
                    {extractedRecipe.prepTime && (
                      <div><strong>Prep:</strong> {extractedRecipe.prepTime}min</div>
                    )}
                    {extractedRecipe.cookTime && (
                      <div><strong>Cook:</strong> {extractedRecipe.cookTime}min</div>
                    )}
                  </div>
                )}

                {extractedRecipe.ingredients && extractedRecipe.ingredients.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Ingredients</h4>
                    <ul className="space-y-1 text-sm">
                      {extractedRecipe.ingredients.map((ing, i) => (
                        <li key={i} className="text-muted-foreground">
                          {ing.quantity && `${ing.quantity} `}
                          {ing.unit && `${ing.unit} `}
                          {ing.name}
                          {ing.notes && ` (${ing.notes})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {extractedRecipe.instructions && extractedRecipe.instructions.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Instructions</h4>
                    <ol className="space-y-2 text-sm list-decimal list-inside">
                      {extractedRecipe.instructions.map((step, i) => (
                        <li key={i} className="text-muted-foreground">{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {extractedRecipe.tags && extractedRecipe.tags.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {extractedRecipe.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Note: The extracted recipe will be saved as-is. You can edit it after saving by viewing the recipe details.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="flex-1 py-3 rounded-lg border border-border bg-background text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveRecipe}
                  disabled={loading}
                  className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Saving...' : 'Save Recipe'}
                </button>
              </div>
            </div>
          )}
      </div>
    </Dialog>
  );
}
