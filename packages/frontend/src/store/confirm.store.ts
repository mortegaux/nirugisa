import { create } from 'zustand';

export interface ConfirmOptions {
  /** Dialog title, e.g. "Delete recipe?" */
  title: string;
  /** Body text naming the item and the consequence. */
  message: string;
  /** Label for the confirm button. Default "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Default "Cancel". */
  cancelLabel?: string;
  /** Red styling for destructive actions. Default true. */
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  id: number;
}

interface ConfirmState {
  request: ConfirmRequest | null;
  /**
   * Promise-based confirmation. Awaits the user's choice:
   *
   *   const { confirm } = useConfirmStore();
   *   const ok = await confirm({
   *     title: 'Delete recipe?',
   *     message: `Delete "${name}"? This cannot be undone.`,
   *     confirmLabel: 'Delete',
   *   });
   *   if (!ok) return;
   *
   * <ConfirmHost /> is mounted once in App.tsx and renders the dialog.
   */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  resolve: (value: boolean) => void;
}

let nextId = 1;
let pendingResolve: ((value: boolean) => void) | null = null;

export const useConfirmStore = create<ConfirmState>((set) => ({
  request: null,

  confirm: (options) => {
    // If a confirm is already open, resolve it as cancelled first.
    if (pendingResolve) pendingResolve(false);
    return new Promise<boolean>((resolve) => {
      pendingResolve = resolve;
      set({ request: { ...options, id: nextId++ } });
    });
  },

  resolve: (value) => {
    if (pendingResolve) {
      pendingResolve(value);
      pendingResolve = null;
    }
    set({ request: null });
  },
}));
