import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AppDialogModal from '../shared/components/AppDialogModal';
import { registerDialogApi } from '../lib/appDialog';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
    const [dialog, setDialog] = useState(null);

    const closeDialog = useCallback((result) => {
        setDialog((current) => {
            if (current?.resolve) current.resolve(result);
            return null;
        });
    }, []);

    const openAlert = useCallback((options) => {
        const config = typeof options === 'string' ? { message: options } : options;
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
    }, []);

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
        registerDialogApi({ alert: openAlert, confirm: openConfirm });
        return () => registerDialogApi(null);
    }, [openAlert, openConfirm]);

    const value = { alert: openAlert, confirm: openConfirm };

    return (
        <DialogContext.Provider value={value}>
            {children}
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
