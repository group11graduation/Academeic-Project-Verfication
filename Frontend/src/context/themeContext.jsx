import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const THEME_STORAGE_KEY = 'project-verify-theme';
const ThemeContext = createContext(null);

function getSystemTheme() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeClass(theme) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        if (typeof window === 'undefined') return 'system';
        return localStorage.getItem(THEME_STORAGE_KEY) || 'system';
    });

    useEffect(() => {
        applyThemeClass(theme);
        if (typeof window !== 'undefined') {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        }
    }, [theme]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => {
            if ((localStorage.getItem(THEME_STORAGE_KEY) || 'system') === 'system') {
                applyThemeClass('system');
            }
        };
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    const value = useMemo(
        () => ({
            theme,
            setTheme,
            resolvedTheme: theme === 'system' ? getSystemTheme() : theme,
            toggleTheme: () => setTheme((prev) => ((prev === 'dark') || (prev === 'system' && getSystemTheme() === 'dark') ? 'light' : 'dark')),
        }),
        [theme]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
    return ctx;
}
