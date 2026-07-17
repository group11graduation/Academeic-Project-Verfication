import React from 'react';
import { PRODUCT_TAGLINE, PROJECT_NAME } from '../ui/brandTheme';

const SIZE = {
    sm: { img: 'h-12 w-12', title: 'text-[13px]' },
    md: { img: 'h-16 w-16', title: 'text-[15px]' },
    lg: { img: 'h-20 w-20', title: 'text-[16px]' },
    xl: { img: 'h-28 w-28', title: 'text-[18px]' },
};

/**
 * Shared Project Verify logo — image mark + optional wordmark.
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
}) {
    const s = SIZE[size] || SIZE.md;

    return (
        <div className={`flex items-center gap-3 shrink-0 ${className}`}>
            {showMark ? (
                <img
                    src="/logo.png"
                    alt={PROJECT_NAME}
                    className={`${s.img} shrink-0 object-contain`}
                />
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
