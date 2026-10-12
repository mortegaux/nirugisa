import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  /** Show a toast. Returns its id. */
  push: (message: string, type?: ToastType, duration?: number) => number;
  /** Shorthand for push(message, 'success'). */
  success: (message: string, duration?: number) => number;
  /** Shorthand for push(message, 'error'). Errors stay longer by default. */
  error: (message: string, duration?: number) => number;
  /** Shorthand for push(message, 'info'). */
  info: (message: string, duration?: number) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;

/**
 * Global toast notifications. Any component can call:
 *
 *   import { useToastStore } from '@/store/toast.store';
 *   const toast = useToastStore();
 *   toast.success('Recipe saved');
 *   toast.error('Failed to delete — try again');
 *
 * <ToastHost /> is mounted once in App.tsx and renders the queue.
 */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (message, type = 'info', duration) => {
    const id = nextId++;
    const resolvedDuration = duration ?? (type === 'error' ? 6000 : 3500);
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { id, message, type, duration: resolvedDuration }],
    }));
    return id;
  },

  success: (message, duration) =>
    get().push(message, 'success', duration),
  error: (message, duration) =>
    get().push(message, 'error', duration),
  info: (message, duration) =>
    get().push(message, 'info', duration),

  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
