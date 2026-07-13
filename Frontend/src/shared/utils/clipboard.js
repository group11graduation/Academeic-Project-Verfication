function copyWithExecCommand(value) {
    if (typeof document === 'undefined') {
        throw new Error('Clipboard is not available in this environment.');
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
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

/**
 * Copy text to clipboard. Uses the Clipboard API on HTTPS/localhost;
 * falls back to execCommand on plain HTTP (e.g. VPS IP) where clipboard API is blocked.
 */
export async function copyTextToClipboard(text) {
    const value = String(text ?? '');
    if (!value) {
        throw new Error('Nothing to copy');
    }

    if (typeof navigator !== 'undefined' && window.isSecureContext && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return;
        } catch {
            // HTTP or permission denied — use legacy fallback below.
        }
    }

    copyWithExecCommand(value);
}
