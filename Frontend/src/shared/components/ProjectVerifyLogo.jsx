import React from 'react';
import { PRODUCT_TAGLINE, PROJECT_NAME } from '../ui/brandTheme';

const SIZE = {
    sm: { box: 'h-12 w-12', img: 'h-10 w-10', title: 'text-[13px]' },
    md: { box: 'h-14 w-14', img: 'h-12 w-12', title: 'text-[15px]' },
    lg: { box: 'h-24 w-24', img: 'h-[5.25rem] w-[5.25rem]', title: 'text-[16px]' },
    xl: { box: 'h-28 w-28', img: 'h-24 w-24', title: 'text-[18px]' },
};

/**
 * Shared Project Verify logo — image mark + optional wordmark.
 * Logo art is blue on a dark square; we seat it on a light plate so it stays
 * readable on both the blue login screen and light sidebars/headers.
 */
export default function ProjectVerifyLogo({
    showText = true,
    size = 'md',
    className = '',
    textClassName = '',
    tagline = PRODUCT_TAGLINE,
    onDark = false,
    hideTextOnMobile = false,
}) {
    const s = SIZE[size] || SIZE.md;

    return (
        <div className={`flex items-center gap-3 shrink-0 ${className}`}>
            <span
                className={`${s.box} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_4px_18px_rgba(15,23,42,0.18)] ring-1 ${
                    onDark ? 'ring-white/40' : 'ring-slate-200/90'
                }`}
            >
                <img
                    src="/logo.png"
                    alt={PROJECT_NAME}
                    className={`${s.img} object-contain`}
                />
            </span>
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
