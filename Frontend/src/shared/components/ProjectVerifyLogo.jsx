import React from 'react';
import { PRODUCT_TAGLINE, PROJECT_NAME } from '../ui/brandTheme';

/**
 * Shared Project Verify logo — image mark + optional wordmark.
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
    const img =
        size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
    const titleSize =
        size === 'sm' ? 'text-[13px]' : size === 'lg' ? 'text-[16px]' : 'text-[15px]';

    return (
        <div className={`flex items-center gap-3 shrink-0 ${className}`}>
            <img
                src="/logo.png"
                alt=""
                className={`${img} object-contain shrink-0`}
            />
            {showText ? (
                <div className={`leading-tight min-w-0 ${hideTextOnMobile ? 'hidden sm:block' : ''} ${textClassName}`}>
                    <span
                        className={`block font-extrabold tracking-tight ${titleSize} ${
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
