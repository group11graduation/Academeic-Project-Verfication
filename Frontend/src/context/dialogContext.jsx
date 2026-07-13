import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AppDialogModal from '../shared/components/AppDialogModal';
import AppToastStack from '../shared/components/AppToastStack';
import { registerDialogApi } from '../lib/appDialog';

const DialogContext = createContext(null);
const DEFAULT_TOAST_MS = 4500;

export function DialogProvider({ children }) {
    const [dialog, setDialog] = useState(null);
    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);

    const dismissToast = useCallback((id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const pushToast = useCallback((config = {}) => {
        const id = ++toastIdRef.current;
        const toast = {
            id,
            variant: 'success',
            title: config.title || '',
            message: config.message || '',
        };
        setToasts((current) => [...current, toast]);
        const duration = Number(config.duration ?? DEFAULT_TOAST_MS);
        if (duration > 0) {
            window.setTimeout(() => dismissToast(id), duration);
        }
        return Promise.resolve(true);
    }, [dismissToast]);

    const closeDialog = useCallback((result) => {
        setDialog((current) => {
            if (current?.resolve) current.resolve(result);
            return null;
        });
    }, []);

    const openAlert = useCallback((options) => {
        const config = typeof options === 'string' ? { message: options } : options;
        if (config.variant === 'success') {
            return pushToast(config);
        }
        return new Promise((resolve) => {
            setDialog({
                type: 'alert',
                variant: config.variant || 'info',
                title: config.title,
                message: config.message || '',
                confirmLabel: config.confirmLabel || 'OK',
                resolve,
            });
        });
    }, [pushToast]);

    const openConfirm = useCallback((options) => {
        const config = typeof options === 'string' ? { message: options } : options;
        return new Promise((resolve) => {
            setDialog({
                type: 'confirm',
                variant: config.variant || 'warning',
                title: config.title,
                message: config.message || '',
                confirmLabel: config.confirmLabel || 'Confirm',
                cancelLabel: config.cancelLabel || 'Cancel',
                danger: Boolean(config.danger),
                resolve,
            });
        });
    }, []);

    useEffect(() => {
        registerDialogApi({ alert: openAlert, confirm: openConfirm, toast: pushToast });
        return () => registerDialogApi(null);
    }, [openAlert, openConfirm, pushToast]);

    const value = { alert: openAlert, confirm: openConfirm, toast: pushToast };

    return (
        <DialogContext.Provider value={value}>
            {children}
            <AppToastStack toasts={toasts} onDismiss={dismissToast} />
            <AppDialogModal dialog={dialog} onClose={closeDialog} />
        </DialogContext.Provider>
    );
}

export function useDialog() {
    const ctx = useContext(DialogContext);
    if (!ctx) {
        throw new Error('useDialog must be used within DialogProvider');
    }
    return ctx;
}
