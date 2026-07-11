/**
 * Copy text to clipboard with Clipboard API when available,
 * otherwise fall back to execCommand for HTTP / older browsers.
 */
export async function copyTextToClipboard(text) {
    const value = String(text ?? '');
    if (!value) {
        throw new Error('Nothing to copy');
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }

    if (typeof document === 'undefined') {
        throw new Error('Clipboard is not available in this environment.');
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        const copied = document.execCommand('copy');
        if (!copied) {
            throw new Error('Copy command was rejected by the browser.');
        }
    } finally {
        document.body.removeChild(textarea);
    }
}
