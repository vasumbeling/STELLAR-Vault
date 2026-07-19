'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning' | 'action_required';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  /**
   * ms before auto-dismiss. Pass `null` for a toast that only goes away
   * when the user closes it themselves (e.g. important errors).
   * Defaults to 6000ms — long enough to read, but the user can also
   * dismiss early via the close button.
   */
  duration?: number | null;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, variant?: ToastVariant, duration?: number | null) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration: number | null = 6000) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
      return id;
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

/** Access showToast/dismissToast from any component wrapped by ToastProvider. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, { border: string; icon: React.ReactNode; iconBg: string }> = {
  success: {
    border: 'border-cyan-200/60',
    iconBg: 'bg-cyan-50 text-cyan-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  error: {
    border: 'border-red-200/60',
    iconBg: 'bg-red-50 text-red-500',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  info: {
    border: 'border-amber-200/60',
    iconBg: 'bg-orange-50 text-[#FF5E00]',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  },
  warning: {
    border: 'border-amber-300/60',
    iconBg: 'bg-amber-50 text-amber-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.125 3.75L1.5 18.75A1.5 1.5 0 002.874 21h18.252a1.5 1.5 0 001.374-2.25L13.875 3.75a1.5 1.5 0 00-2.625 0z" />
      </svg>
    ),
  },
  action_required: {
    border: 'border-rose-200/60',
    iconBg: 'bg-rose-50 text-rose-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-xs">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // duration === null means "persist until the user dismisses it" — no timer at all.
    if (toast.duration === null) return;

    timerRef.current = setTimeout(() => onDismiss(toast.id), toast.duration ?? 6000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.duration, onDismiss]);

  const styles = VARIANT_STYLES[toast.variant];

  return (
    <div
      role="status"
      className={`flex items-start gap-3 bg-white border ${styles.border} rounded-xl shadow-md px-3.5 py-3 animate-in slide-in-from-bottom-2 fade-in duration-200`}
    >
      <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${styles.iconBg}`}>
        {styles.icon}
      </div>
      <p className="text-sm font-medium text-slate-700 leading-snug flex-1 pt-0.5">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors p-0.5 -mt-0.5 -mr-0.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}