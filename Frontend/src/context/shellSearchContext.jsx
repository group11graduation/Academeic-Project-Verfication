import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ShellSearchContext = createContext(null);

export function ShellSearchProvider({ children }) {
    const [query, setQuery] = useState('');
    const [placeholder, setPlaceholder] = useState('Search current page…');

    const clear = useCallback(() => setQuery(''), []);

    const value = useMemo(
        () => ({
            query,
            setQuery,
            placeholder,
            setPlaceholder,
            clear,
        }),
        [query, placeholder, clear]
    );

    return <ShellSearchContext.Provider value={value}>{children}</ShellSearchContext.Provider>;
}

const noop = () => {};

const fallback = {
    query: '',
    setQuery: noop,
    placeholder: 'Search…',
    setPlaceholder: noop,
    clear: noop,
};

export function useShellSearch() {
    return useContext(ShellSearchContext) || fallback;
}

/** Page-level search synced with the layout header search bar. */
export function usePageSearch(defaultPlaceholder = 'Search…') {
    const { query: shellQuery, setQuery: setShellQuery, setPlaceholder, clear } = useShellSearch();
    const [localQuery, setLocalQuery] = useState('');

    useEffect(() => {
        setPlaceholder(defaultPlaceholder);
        return () => {
            setPlaceholder('Search current page…');
            clear();
        };
    }, [defaultPlaceholder, setPlaceholder, clear]);

    useEffect(() => {
        setLocalQuery(shellQuery);
    }, [shellQuery]);

    const setQuery = useCallback(
        (value) => {
            const next = typeof value === 'function' ? value(localQuery) : value;
            setLocalQuery(next);
            setShellQuery(next);
        },
        [localQuery, setShellQuery]
    );

    return { query: localQuery, setQuery };
}

/** Filter-only pages that rely on the layout header search (no inline search field). */
export function useShellSearchFilter(defaultPlaceholder = 'Search…') {
    const { query, setPlaceholder, clear } = useShellSearch();

    useEffect(() => {
        setPlaceholder(defaultPlaceholder);
        return () => {
            setPlaceholder('Search current page…');
            clear();
        };
    }, [defaultPlaceholder, setPlaceholder, clear]);

    return query;
}
