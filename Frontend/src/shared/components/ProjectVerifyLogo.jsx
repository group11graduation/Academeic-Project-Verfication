import React from 'react';
import { PRODUCT_TAGLINE, PROJECT_NAME } from '../ui/brandTheme';

const SIZE = {
    sm: { box: 'h-9 w-9', title: 'text-[14px]', gap: 'gap-1.5' },
    md: { box: 'h-11 w-11', title: 'text-[17px]', gap: 'gap-2' },
    lg: { box: 'h-12 w-12', title: 'text-[15px]', gap: 'gap-2' },
    xl: { box: 'h-14 w-14', title: 'text-[22px]', gap: 'gap-2.5' },
};

/** Shield + code mark — transparent SVG (no baked white background). */
function LogoMarkSvg({ className = '' }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 128 112"
            fill="none"
            className={className}
            aria-hidden
        >
            <path d="M6 34h30" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
            <path d="M6 56h40" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
            <path d="M6 78h26" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
            <path
                d="M72 10c16 7 30 9 40 9v36c0 24-16 42-40 54C48 97 32 79 32 55V20c10 0 24-3 40-10z"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinejoin="round"
            />
            <path
                d="M58 40L46 56l12 16"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M86 40l12 16-12 16"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path d="M78 34L70 78" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
        </svg>
    );
}

/**
 * Shared Project Verify logo — transparent SVG mark + optional wordmark.
 * No white plate / image background.
 */
export default function ProjectVerifyLogo({
    showText = true,
    showMark = true,
    size = 'md',
    className = '',
    textClassName = '',
    tagline = PRODUCT_TAGLINE,
    onDark = false,
    hideTextOnMobile = false,
    /** @deprecated Ignored — mark is always transparent SVG */
    framed: _framed,
    /** @deprecated Ignored — mark is always transparent SVG */
    plainMark: _plainMark,
}) {
    const s = SIZE[size] || SIZE.md;
    const markColor = onDark ? 'text-[var(--sidebar-fg)]' : 'text-[var(--accent)]';
    const titleColor = onDark ? 'text-[var(--sidebar-fg)]' : 'text-[var(--text-primary)]';
    const tagColor = onDark ? 'text-[var(--sidebar-fg-muted)]' : 'text-[var(--text-secondary)]';

    return (
        <div className={`flex items-center ${s.gap} shrink-0 ${className}`}>
            {showMark ? (
                <LogoMarkSvg className={`${s.box} shrink-0 bg-transparent ${markColor}`} />
            ) : null}
            {showText ? (
                <div
                    className={`flex min-w-0 flex-col justify-center leading-none ${
                        hideTextOnMobile ? 'hidden sm:flex' : ''
                    } ${textClassName}`}
                >
                    <span className={`block font-extrabold tracking-tight ${s.title} ${titleColor}`}>
                        {PROJECT_NAME}
                    </span>
                    {tagline ? (
                        <span
                            className={`mt-0.5 block text-[10px] font-medium uppercase tracking-[0.5px] ${tagColor}`}
                        >
                            {tagline}
                        </span>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
