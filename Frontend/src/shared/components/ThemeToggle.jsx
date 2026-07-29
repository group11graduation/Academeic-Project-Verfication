import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/themeContext';

export default function ThemeToggle({ className = '', compact = false, iconOnly = false }) {
    const { resolvedTheme, toggleTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--sv-border)] bg-[var(--sv-card)] text-sm font-bold text-[var(--sv-text)] shadow-sm transition hover:bg-[var(--sv-card-muted)] dark:border-white/10 dark:bg-[#111827] dark:text-slate-100 dark:hover:bg-[#1f2937] ${
                iconOnly ? 'h-9 w-9 px-0 py-0' : 'px-3 py-2'
            } ${className}`}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!compact && !iconOnly ? <span>{isDark ? 'Light' : 'Dark'}</span> : null}
        </button>
    );
}
