import { create } from 'zustand';
import { checkAIConfiguration, aiUnavailableMessage } from '@/utils/aiValidation';

export type RecipeCreateModal = 'import' | 'ai';

interface RecipeCreateState {
  /** Which creation modal is open globally, or null. */
  modal: RecipeCreateModal | null;
  /** Message for the AI-not-configured alert, or null. */
  aiAlertMessage: string | null;
  /** Open the Import Recipe modal from anywhere. */
  openImport: () => void;
  /**
   * Open the Generate-with-AI modal from anywhere.
   * Runs the AI configuration check first — shows the AI config alert
   * instead when AI isn't available.
   */
  openAIGenerate: () => Promise<void>;
  /** Close whichever creation modal is open. */
  closeModal: () => void;
  /** Dismiss the AI-not-configured alert. */
  dismissAiAlert: () => void;
}

/**
 * Global recipe-creation entry point. Any page can trigger it:
 *
 *   import { useRecipeCreateStore } from '@/store/recipeCreate.store';
 *   const { openImport, openAIGenerate } = useRecipeCreateStore();
 *
 * <NewRecipeMenu /> (in the app header) is the visible trigger; the modals
 * themselves are mounted once in DashboardLayout.
 */
export const useRecipeCreateStore = create<RecipeCreateState>((set) => ({
  modal: null,
  aiAlertMessage: null,

  openImport: () => set({ modal: 'import', aiAlertMessage: null }),

  openAIGenerate: async () => {
    const aiStatus = await checkAIConfiguration();
    if (!aiStatus.isConfigured || !aiStatus.isEnabled) {
      set({ aiAlertMessage: aiUnavailableMessage(aiStatus), modal: null });
      return;
    }
    set({ modal: 'ai', aiAlertMessage: null });
  },

  closeModal: () => set({ modal: null }),
  dismissAiAlert: () => set({ aiAlertMessage: null }),
}));
