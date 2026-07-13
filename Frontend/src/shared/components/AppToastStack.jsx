import React from 'react';
import { CheckCircle2, X } from 'lucide-react';

/**
 * Lightweight success toasts — top-right, auto-dismiss, no blocking modal.
 */
export default function AppToastStack({ toasts = [], onDismiss }) {
    if (!toasts.length) return null;

    return (
        <div
            className="pointer-events-none fixed top-4 right-4 z-[9998] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
            aria-live="polite"
            aria-label="Notifications"
        >
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="pointer-events-auto flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] font-semibold text-emerald-800 shadow-md shadow-emerald-900/5 dark:border-emerald-900/40 dark:bg-emerald-950/90 dark:text-emerald-300"
                    role="status"
                >
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                        {toast.title ? <p className="font-black">{toast.title}</p> : null}
                        <p className={toast.title ? 'mt-0.5 font-medium' : ''}>{toast.message}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onDismiss?.(toast.id)}
                        className="shrink-0 rounded p-0.5 text-emerald-700/70 hover:text-emerald-900 dark:text-emerald-300/80"
                        aria-label="Dismiss"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            ))}
        </div>
    );
}
