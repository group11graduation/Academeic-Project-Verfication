import React from 'react';
import { PRODUCT_TAGLINE, PROJECT_NAME } from '../ui/brandTheme';

const SIZE = {
    sm: { box: 'h-12 w-12', img: 'h-10 w-10', title: 'text-[14px]', gap: 'gap-1.5' },
    md: { box: 'h-16 w-16', img: 'h-14 w-14', title: 'text-[17px]', gap: 'gap-2' },
    lg: { box: 'h-[4.75rem] w-[4.75rem]', img: 'h-[4.25rem] w-[4.25rem]', title: 'text-[19px]', gap: 'gap-2' },
    xl: { box: 'h-32 w-32', img: 'h-28 w-28', title: 'text-[22px]', gap: 'gap-2.5' },
};

/**
 * Shared Project Verify logo - image mark + optional wordmark.
 * Use `framed` (or `onDark`) for a white circle plate on blue/dark UI (login, sidebar).
 * Home/header stays unframed so the mark sits cleanly on white.
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
    hideTextOnMobile = false,
}) {
    const s = SIZE[size] || SIZE.md;
    const useFrame = framed ?? onDark;

    const mark = (
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
