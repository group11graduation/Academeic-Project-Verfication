/**
 * Turn axios / network / server errors into a short user-facing message.
 */
import { humanizeModelOrServerError } from './humanizeErrors';

export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
    if (!error) return fallback;

    if (typeof error.userMessage === 'string' && error.userMessage.trim()) {
        return error.userMessage.trim();
    }

    const data = error.response?.data;
    if (data) {
        const preferred =
            (typeof data.reason === 'string' && data.reason.trim()) ||
            (typeof data.message === 'string' && data.message.trim()) ||
            (typeof data.error === 'string' && data.error.trim()) ||
            '';
        if (preferred) return humanizeModelOrServerError(preferred, preferred);

        if (Array.isArray(data.failures) && data.failures[0]?.message) {
            return humanizeModelOrServerError(String(data.failures[0].message).trim());
        }
        if (Array.isArray(data.validationFailures) && data.validationFailures[0]?.message) {
            return humanizeModelOrServerError(String(data.validationFailures[0].message).trim());
        }
        if (data.data && typeof data.data === 'object') {
            const nested =
                (typeof data.data.reason === 'string' && data.data.reason.trim()) ||
                (typeof data.data.message === 'string' && data.data.message.trim()) ||
                '';
            if (nested) return humanizeModelOrServerError(nested, nested);
        }
    }

    if (error.code === 'ECONNABORTED') {
        const text = String(error.message || '');
        if (/Cannot reach the API from this page/i.test(text)) return text;
        if (/Server is busy or restarting/i.test(text)) return text;
        return 'Upload timed out. Hard-refresh the page (Ctrl+Shift+R), wait 10 seconds, then try again. If it keeps failing, ask admin to restart node-backend.';
    }

    if (error.message === 'Network Error' || !error.response) {
        return 'Cannot reach the server. Check your connection and that the backend is running.';
    }

    const status = error.response?.status;
    if (status === 401) return 'Your session expired. Please sign in again.';
    if (status === 403) return 'You do not have permission for this action.';
    if (status === 404) return 'The requested resource was not found.';
    if (status === 409) {
        const conflict =
            (typeof data?.message === 'string' && data.message.trim()) ||
            (typeof data?.reason === 'string' && data.reason.trim()) ||
            '';
        return humanizeModelOrServerError(
            conflict,
            'This conflicts with an existing record. Refresh the page or contact your teacher.'
        );
    }
    if (status === 400 || status === 422) {
        const detail =
            (typeof data?.message === 'string' && data.message.trim()) ||
            (typeof data?.reason === 'string' && data.reason.trim()) ||
            '';
        if (detail) return humanizeModelOrServerError(detail, detail);
        return 'The server rejected this request. Check the details and try again.';
    }
    if (status >= 500) {
        const serverMsg = typeof data?.message === 'string' ? data.message : '';
        return humanizeModelOrServerError(
            serverMsg,
            'Server error. Please try again or contact support.'
        );
    }

    if (typeof error.message === 'string' && error.message.trim()) {
        if (!/^Request failed with status code \d+$/i.test(error.message)) {
            return humanizeModelOrServerError(error.message.trim());
        }
    }

    return fallback;
}
