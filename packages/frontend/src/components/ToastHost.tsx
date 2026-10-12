import { Toast } from './Toast';
import { useToastStore } from '@/store/toast.store';

/**
 * Mounted once in App.tsx. Renders the global toast queue
 * (see store/toast.store.ts) as a stacked, screen-reader-friendly
 * notification region.
 */
export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="relative">
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => dismiss(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}
