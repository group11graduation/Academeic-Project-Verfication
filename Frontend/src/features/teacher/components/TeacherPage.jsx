import React from 'react';
import { TEACHER_PRIMARY, TEACHER_MUTED } from '../ui/teacherTheme';

/**
 * Shared page chrome for teacher screens — Inter + admin-aligned typography.
 */
export default function TeacherPage({
    title,
    subtitle,
    actions = null,
    children,
    className = '',
}) {
    return (
        <div className={`space-y-3 antialiased [font-family:var(--sv-font-sans)] ${className}`}>
            {(title || subtitle || actions) && (
                <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        {title ? (
                            <h1
                                className="truncate text-[1.15rem] font-bold leading-[1.2] tracking-tight sm:text-[1.25rem]"
                                style={{ color: TEACHER_PRIMARY }}
                            >
                                {title}
                            </h1>
                        ) : null}
                        {subtitle ? (
                            <p className="mt-0.5 text-[12px] font-normal" style={{ color: TEACHER_MUTED }}>
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
                </header>
            )}
            {children}
        </div>
    );
}
