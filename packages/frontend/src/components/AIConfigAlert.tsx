import { Link } from 'react-router-dom';
import { AutoAwesomeIcon, WarningIcon } from './icons/MaterialIcon';

interface AIConfigAlertProps {
  onClose: () => void;
  message?: string;
}

export function AIConfigAlert({ onClose, message }: AIConfigAlertProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <WarningIcon size={28} className="text-amber-500" />
            <h2 className="text-xl font-bold text-foreground">AI Not Configured</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-muted-foreground">
            {message || 'AI features require configuration before they can be used.'}
          </p>

          <div className="bg-accent/10 rounded-lg p-4 border border-accent/20">
            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <AutoAwesomeIcon size={18} />
              Quick Setup
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Configure your AI provider to unlock features like:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
              <li>AI-powered recipe generation</li>
              <li>Smart meal plan creation</li>
              <li>Recipe enhancement suggestions</li>
              <li>Ingredient substitutions</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            You'll need an API key from providers like OpenAI, Anthropic, or Google AI.
            You can also use Ollama for local AI processing.
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <Link
            to="/settings"
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors text-center"
          >
            Go to AI Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
