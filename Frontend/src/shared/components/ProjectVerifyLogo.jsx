import React from 'react';
import { PRODUCT_TAGLINE, PROJECT_NAME } from '../ui/brandTheme';

const SIZE = {
    sm: { box: 'h-12 w-12', img: 'h-10 w-10', title: 'text-[13px]' },
    md: { box: 'h-14 w-14', img: 'h-12 w-12', title: 'text-[15px]' },
    lg: { box: 'h-20 w-20', img: 'h-[4.5rem] w-[4.5rem]', title: 'text-[16px]' },
    xl: { box: 'h-28 w-28', img: 'h-24 w-24', title: 'text-[18px]' },
};

/**
 * Shared Project Verify logo — image mark + optional wordmark.
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
        <div className={`flex items-center gap-3 shrink-0 ${className}`}>
            {showMark ? (
                useFrame ? (
                    <span
                        className={`${s.box} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_4px_18px_rgba(15,23,42,0.18)] ring-1 ring-white/50`}
                    >
                        {mark}
                    </span>
                ) : (
                    mark
                )
            ) : null}
            {showText ? (
                <div className={`leading-tight min-w-0 ${hideTextOnMobile ? 'hidden sm:block' : ''} ${textClassName}`}>
                    <span
                        className={`block font-extrabold tracking-tight ${s.title} ${
                            onDark ? 'text-white' : 'text-slate-900'
                        }`}
                    >
                        {PROJECT_NAME}
                    </span>
                    {tagline ? (
                        <span
                            className={`block text-[10px] font-bold uppercase tracking-[0.14em] ${
                                onDark ? 'text-white/65' : 'text-slate-400'
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
