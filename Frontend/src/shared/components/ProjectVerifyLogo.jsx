import React from 'react';
import { PRODUCT_TAGLINE, PROJECT_NAME } from '../ui/brandTheme';

const SIZE = {
    sm: { box: 'h-12 w-12', img: 'h-10 w-10', title: 'text-[14px]', gap: 'gap-1.5' },
    md: { box: 'h-16 w-16', img: 'h-14 w-14', title: 'text-[17px]', gap: 'gap-2' },
    lg: { box: 'h-[4.75rem] w-[4.75rem]', img: 'h-[4.25rem] w-[4.25rem]', title: 'text-[19px]', gap: 'gap-2' },
    xl: { box: 'h-[5.5rem] w-[5.5rem]', img: 'h-20 w-20', title: 'text-[22px]', gap: 'gap-2.5' },
};

/** Shield + code + motion lines — no check-circle badge */
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
 * Shared Project Verify logo - image mark + optional wordmark.
 * Use `framed` (or `onDark`) for a white circle plate on blue/dark UI.
 * Use `plainMark` for the shield mark without the check badge / circle plate (sidebar).
 */
export default function ProjectVerifyLogo({
    showText = true,
    showMark = true,
    size = 'md',
    className = '',
    textClassName = '',
    tagline = PRODUCT_TAGLINE,
    onDark = false,
    framed,
    plainMark = false,
    hideTextOnMobile = false,
}) {
    const s = SIZE[size] || SIZE.md;
    const useFrame = plainMark ? false : framed ?? onDark;

    const mark = plainMark ? (
        <LogoMarkSvg
            className={`${s.box} shrink-0 ${onDark ? 'text-white' : 'text-[#2a3fa4]'}`}
        />
    ) : (
        <img
            src="/logo.png"
            alt={PROJECT_NAME}
            className={`${useFrame ? s.img : s.box} shrink-0 object-contain`}
        />
    );

    return (
        <div className={`flex items-center ${s.gap} shrink-0 ${className}`}>
            {showMark ? (
                useFrame ? (
                    <span
                        className={`${s.box} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--sv-card)] shadow-[0_4px_18px_rgba(15,23,42,0.18)] ring-1 ring-white/50`}
                    >
                        {mark}
                    </span>
                ) : (
                    mark
                )
            ) : null}
            {showText ? (
                <div
                    className={`flex min-w-0 flex-col justify-center leading-none ${
                        hideTextOnMobile ? 'hidden sm:flex' : ''
                    } ${textClassName}`}
                >
                    <span
                        className={`block font-extrabold tracking-tight ${s.title} ${
                            onDark ? 'text-white' : 'text-[var(--sv-text)]'
                        }`}
                    >
                        {PROJECT_NAME}
                    </span>
                    {tagline ? (
                        <span
                            className={`mt-0.5 block text-[10px] font-medium uppercase tracking-[0.5px] ${
                                onDark ? 'text-white/65' : 'text-[var(--sv-muted)]'
                            }`}
                        >
                            {tagline}
                        </span>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
