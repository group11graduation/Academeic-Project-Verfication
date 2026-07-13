/** Imperative dialog API — use instead of window.alert / window.confirm */

let api = null;

export function registerDialogApi(next) {
    api = next;
}

function normalizeAlertInput(messageOrOptions, options = {}) {
    if (typeof messageOrOptions === 'string') {
        return { message: messageOrOptions, ...options };
    }
    return messageOrOptions || {};
}

function normalizeConfirmInput(messageOrOptions, options = {}) {
    if (typeof messageOrOptions === 'string') {
        return { message: messageOrOptions, ...options };
    }
    return messageOrOptions || {};
}

export function appAlert(messageOrOptions, options = {}) {
    const config = normalizeAlertInput(messageOrOptions, options);
    if (api?.alert) {
        return api.alert(config);
    }
    window.alert(config.message || '');
    return Promise.resolve();
}

export function appConfirm(messageOrOptions, options = {}) {
    const config = normalizeConfirmInput(messageOrOptions, options);
    if (api?.confirm) {
        return api.confirm(config);
    }
    return Promise.resolve(window.confirm(config.message || ''));
}

function wrapVariant(variant, message, options = {}) {
    if (typeof message === 'object' && message !== null && !Array.isArray(message)) {
        return appAlert({ variant, ...message, ...options });
    }
    return appAlert({ message, variant, ...options });
}

/** Shorthand helpers */
export function appSuccess(message, options = {}) {
    return wrapVariant('success', message, options);
}

export function appToast(message, options = {}) {
    if (api?.toast) {
        const config = typeof message === 'object' && message !== null ? message : { message, ...options };
        return api.toast(config);
    }
    return wrapVariant('success', message, options);
}

export function appError(message, options = {}) {
    return wrapVariant('error', message, options);
}

export function appWarning(message, options = {}) {
    return wrapVariant('warning', message, options);
}
