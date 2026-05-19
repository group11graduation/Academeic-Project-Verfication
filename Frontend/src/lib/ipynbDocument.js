/** Normalize a block of text for similarity highlighting across panes. */
export function normalizeTextBlock(s) {
    return String(s).replace(/\s+/g, ' ').trim().toLowerCase();
}

export function cellSourceToString(source) {
    if (source == null) return '';
    if (Array.isArray(source)) return source.join('');
    return String(source);
}

/** Split plain-text / prose extracts into paragraphs (non-notebook). */
export function splitPlainParagraphs(text) {
    if (!text || !String(text).trim()) return [];
    const t = String(text).replace(/\r\n/g, '\n');
    const paras = t.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    if (paras.length > 1) return paras;
    return t.split('\n').map((s) => s.trimEnd()).filter((s) => s.length > 0);
}

/**
 * Parse Jupyter notebook JSON (nbformat). Returns null if not a valid notebook object.
 */
export function tryParseIpynb(text) {
    const t = String(text || '').trim();
    if (!t || t[0] !== '{') return null;
    try {
        const json = JSON.parse(t);
        if (!json || typeof json !== 'object' || !Array.isArray(json.cells)) return null;
        return json;
    } catch {
        return null;
    }
}

function summarizeOutputs(outputs, maxLen = 12000) {
    if (!Array.isArray(outputs) || !outputs.length) return '';
    const chunks = [];
    let len = 0;
    for (const out of outputs) {
        if (len >= maxLen) break;
        let piece = '';
        if (out.output_type === 'stream' && out.text != null) {
            piece = cellSourceToString(out.text);
        } else if (
            (out.output_type === 'execute_result' || out.output_type === 'display_data') &&
            out.data &&
            out.data['text/plain'] != null
        ) {
            piece = String(out.data['text/plain']);
        } else if (out.output_type === 'error' && Array.isArray(out.traceback)) {
            piece = out.traceback.join('\n');
        }
        if (!piece) continue;
        const rest = maxLen - len;
        if (piece.length > rest) {
            piece = `${piece.slice(0, rest)}\n… (output truncated)`;
        }
        chunks.push(piece);
        len += piece.length;
    }
    return chunks.join('\n\n');
}

export function listNotebookCells(nb) {
    return (nb.cells || []).map((cell, index) => {
        const rawType = cell.cell_type;
        const type = rawType === 'markdown' ? 'markdown' : rawType === 'code' ? 'code' : 'raw';
        const source = cellSourceToString(cell.source);
        const outputsSummary = type === 'code' ? summarizeOutputs(cell.outputs) : '';
        return { index, type, source, outputsSummary };
    });
}

/** Set of normalized cell sources (for cross-pane highlighting). */
export function notebookSourceNormSet(nb) {
    const set = new Set();
    for (const c of listNotebookCells(nb)) {
        const n = normalizeTextBlock(c.source);
        if (n) set.add(n);
    }
    return set;
}

export function normsFromAnyDocument(text) {
    const nb = tryParseIpynb(text);
    if (nb) return notebookSourceNormSet(nb);
    const set = new Set();
    for (const p of splitPlainParagraphs(text)) {
        const n = normalizeTextBlock(p);
        if (n) set.add(n);
    }
    return set;
}

export function notebookKernelspecLanguage(nb) {
    const lang =
        nb?.metadata?.kernelspec?.language ||
        nb?.metadata?.language_info?.name ||
        nb?.metadata?.language_info?.pygments_lexer ||
        '';
    return String(lang || 'text').toLowerCase();
}
