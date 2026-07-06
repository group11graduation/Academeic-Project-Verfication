/**
 * Turn axios / network / server errors into a short user-facing message.
 */
export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
    if (!error) return fallback;

    if (typeof error.userMessage === 'string' && error.userMessage.trim()) {
        return error.userMessage.trim();
    }

    const data = error.response?.data;
    if (data) {
        if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
        if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
    }

    if (error.code === 'ECONNABORTED') {
        return 'Request timed out. The server took too long to respond.';
    }

    if (error.message === 'Network Error' || !error.response) {
        return 'Cannot reach the server. Check your connection and that the backend is running.';
    }

    const status = error.response?.status;
    if (status === 401) return 'Your session expired. Please sign in again.';
    if (status === 403) return 'You do not have permission for this action.';
    if (status === 404) return 'The requested resource was not found.';
    if (status >= 500) {
        return typeof data?.message === 'string' ? data.message : 'Server error. Please try again or contact support.';
    }

    if (typeof error.message === 'string' && error.message.trim()) {
        return error.message.trim();
    }

    return fallback;
}
