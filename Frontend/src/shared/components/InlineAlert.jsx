import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const STYLES = {
    success: {
        wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300',
        icon: CheckCircle2,
    },
    error: {
        wrap: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300',
        icon: AlertCircle,
    },
    info: {
        wrap: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300',
        icon: Info,
    },
};

/**
 * Small inline page alert — not a modal.
 */
export default function InlineAlert({ variant = 'info', title = '', message = '', onDismiss }) {
    const style = STYLES[variant] || STYLES.info;
    const Icon = style.icon;
    const body = message || title;
    if (!body) return null;

    return (
        <div
            className={`rounded-lg border px-3 py-2 text-[11px] font-semibold flex items-start gap-2 ${style.wrap}`}
            role="status"
            aria-live="polite"
        >
            <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0 flex-1">
                {title && message ? <p className="font-black">{title}</p> : null}
                <p className={title && message ? 'mt-0.5 font-medium' : ''}>{message || title}</p>
            </div>
            {onDismiss ? (
                <button
                    type="button"
                    onClick={onDismiss}
                    className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
                    aria-label="Dismiss"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            ) : null}
        </div>
    );
}
