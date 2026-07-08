import React, { useEffect, useRef } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { BRAND } from '../ui/brandTheme';

const PRIMARY_BTN =
    'text-white shadow-sm shadow-[#2a3fa4]/20 hover:brightness-95 active:scale-[0.99]';

const VARIANTS = {
    info: {
        icon: Info,
        iconWrap: 'bg-[#EEF4FF] text-[var(--sv-primary)] ring-1 ring-[#2a3fa4]/10',
        button: PRIMARY_BTN,
        buttonStyle: { backgroundColor: BRAND.primary },
    },
    success: {
        icon: CheckCircle2,
        iconWrap: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/10',
        button: PRIMARY_BTN,
        buttonStyle: { backgroundColor: BRAND.primary },
    },
    error: {
        icon: AlertCircle,
        iconWrap: 'bg-red-50 text-red-600 ring-1 ring-red-500/10',
        button: PRIMARY_BTN,
        buttonStyle: { backgroundColor: BRAND.primary },
    },
    warning: {
        icon: AlertTriangle,
        iconWrap: 'bg-[#EEF4FF] text-[var(--sv-primary)] ring-1 ring-[#2a3fa4]/10',
        button: PRIMARY_BTN,
        buttonStyle: { backgroundColor: BRAND.primary },
    },
};

export default function AppDialogModal({ dialog, onClose }) {
    const primaryRef = useRef(null);

    useEffect(() => {
        if (!dialog) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose(false);
        };
        window.addEventListener('keydown', onKey);
        const t = window.setTimeout(() => primaryRef.current?.focus(), 0);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.clearTimeout(t);
        };
    }, [dialog, onClose]);

    if (!dialog) return null;

    const {
        type = 'alert',
        title,
        message = '',
        variant = type === 'confirm' ? 'warning' : 'info',
        confirmLabel = type === 'confirm' ? 'Confirm' : 'OK',
        cancelLabel = 'Cancel',
        danger = false,
    } = dialog;

    const style = VARIANTS[variant] || VARIANTS.info;
    const Icon = style.icon;
    const isConfirm = type === 'confirm';

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !isConfirm) onClose(true);
            }}
        >
            <div className="absolute inset-0 bg-[#0f172a]/45 backdrop-blur-[3px]" aria-hidden="true" />
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="app-dialog-title"
                aria-describedby="app-dialog-message"
                className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-slate-200 bg-[var(--sv-card)] p-6 shadow-2xl shadow-[#2a3fa4]/10"
            >
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--sv-primary)] via-[var(--sv-action)] to-[var(--sv-shell)]"
                    aria-hidden="true"
                />

                <button
                    type="button"
                    onClick={() => onClose(false)}
                    className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[#EEF4FF] hover:text-[var(--sv-primary)]"
                    aria-label="Close"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="flex gap-4 pr-6">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${style.iconWrap}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2
                            id="app-dialog-title"
                            className="text-[18px] font-extrabold tracking-tight text-[var(--sv-text)]"
                        >
                            {title ||
                                (type === 'confirm'
                                    ? 'Please confirm'
                                    : variant === 'error'
                                      ? 'Something went wrong'
                                      : variant === 'success'
                                        ? 'Success'
                                        : variant === 'warning'
                                          ? 'Attention'
                                          : 'Notice')}
                        </h2>
                        <p
                            id="app-dialog-message"
                            className="mt-2 whitespace-pre-wrap text-[14px] font-medium leading-relaxed text-[var(--sv-muted)]"
                        >
                            {message}
                        </p>
                    </div>
                </div>

                <div className={`mt-6 flex gap-3 ${isConfirm ? 'justify-end' : 'justify-stretch'}`}>
                    {isConfirm ? (
                        <>
                            <button
                                type="button"
                                onClick={() => onClose(false)}
                                className="rounded-[12px] border border-slate-200 bg-white px-5 py-2.5 text-[14px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                {cancelLabel}
                            </button>
                            <button
                                ref={primaryRef}
                                type="button"
                                onClick={() => onClose(true)}
                                className={`rounded-[12px] px-5 py-2.5 text-[14px] font-bold transition-all ${
                                    danger
                                        ? 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.99]'
                                        : `${PRIMARY_BTN}`
                                }`}
                                style={danger ? undefined : { backgroundColor: BRAND.primary }}
                            >
                                {confirmLabel}
                            </button>
                        </>
                    ) : (
                        <button
                            ref={primaryRef}
                            type="button"
                            onClick={() => onClose(true)}
                            className={`w-full rounded-[12px] px-5 py-3 text-[14px] font-bold transition-all ${style.button}`}
                            style={style.buttonStyle}
                        >
                            {confirmLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
