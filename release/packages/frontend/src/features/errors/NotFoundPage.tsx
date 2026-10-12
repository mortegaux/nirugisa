import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* 404 Icon */}
        <div className="mb-8">
          <svg
            className="mx-auto h-32 w-32 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* Error Message */}
        <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-foreground mb-4">Page Not Found</h2>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 rounded-lg border border-border bg-background text-foreground hover:bg-accent transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => navigate('/recipes')}
            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Go to Recipes
          </button>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground mb-4">You might be looking for:</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => navigate('/recipes')}
              className="text-sm text-primary hover:underline"
            >
              Recipes
            </button>
            <span className="text-muted-foreground">•</span>
            <button
              onClick={() => navigate('/meal-plans')}
              className="text-sm text-primary hover:underline"
            >
              Meal Plans
            </button>
            <span className="text-muted-foreground">•</span>
            <button
              onClick={() => navigate('/shopping-lists')}
              className="text-sm text-primary hover:underline"
            >
              Shopping Lists
            </button>
            <span className="text-muted-foreground">•</span>
            <button
              onClick={() => navigate('/pantry')}
              className="text-sm text-primary hover:underline"
            >
              Pantry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
