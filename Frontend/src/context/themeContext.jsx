import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const THEME_STORAGE_KEY = 'project-verify-theme';
const ThemeContext = createContext(null);

function getSystemTheme() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme) {
    return theme === 'system' ? getSystemTheme() : theme === 'dark' ? 'dark' : 'light';
}

/** Apply both data-theme (CSS vars) and .dark (Tailwind dark: variants). */
export function applyTheme(theme) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const resolved = resolveTheme(theme);
    root.setAttribute('data-theme', resolved);
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
}

function readStoredTheme() {
    if (typeof window === 'undefined') return 'light';
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {
        /* ignore */
    }
    return 'light';
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        const initial = readStoredTheme();
        applyTheme(initial);
        return initial;
    });

    useEffect(() => {
        applyTheme(theme);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            /* ignore */
        }
    }, [theme]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => {
            if (readStoredTheme() === 'system') applyTheme('system');
        };
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    const resolvedTheme = resolveTheme(theme);

    const value = useMemo(
        () => ({
            theme,
            setTheme,
            resolvedTheme,
            isDark: resolvedTheme === 'dark',
            toggleTheme: () =>
                setTheme((prev) => (resolveTheme(prev) === 'dark' ? 'light' : 'dark')),
        }),
        [theme, resolvedTheme]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
    return ctx;
}
