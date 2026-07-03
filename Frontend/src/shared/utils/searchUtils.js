/** Case-insensitive match against one or more text fields. */
export function matchesSearchQuery(query, ...parts) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    const hay = parts
        .flat()
        .filter((p) => p != null && p !== '')
        .join(' ')
        .toLowerCase();
    return hay.includes(q);
}
