import React, { useMemo } from 'react';
import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';

function buildPageItems(current, total) {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    const items = [1];
    if (current > 3) items.push('…');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let p = start; p <= end; p += 1) items.push(p);
    if (current < total - 2) items.push('…');
    items.push(total);
    return items;
}

/**
 * Footer pagination matching the spacious card-table style.
 * Accent uses admin indigo by default.
 */
export default function TablePagination({
    page,
    pageSize,
    totalItems,
    onPageChange,
    accentClass = 'bg-[#2f4aad] text-white',
}) {
    const totalPages = Math.max(1, Math.ceil((totalItems || 0) / Math.max(1, pageSize)));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const pageItems = useMemo(() => buildPageItems(safePage, totalPages), [safePage, totalPages]);

    if (totalItems <= 0) {
        return (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-white/10">
                <p className="text-[11px] font-medium text-slate-400">Page 0 of 0</p>
            </div>
        );
    }

    const go = (next) => {
        const clamped = Math.min(Math.max(1, next), totalPages);
        if (clamped !== safePage) onPageChange(clamped);
    };

    const navBtn =
        'flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none disabled:opacity-35 dark:hover:bg-white/10 dark:hover:text-slate-200';

    return (
        <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <p className="text-[11px] font-medium text-slate-400">
                Page {safePage} of {totalPages}
            </p>
            <div className="flex items-center justify-center gap-0.5 sm:justify-end">
                <button type="button" className={navBtn} onClick={() => go(1)} disabled={safePage <= 1} aria-label="First page">
                    <ChevronsLeft className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={navBtn} onClick={() => go(safePage - 1)} disabled={safePage <= 1} aria-label="Previous page">
                    <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                {pageItems.map((item, idx) =>
                    item === '…' ? (
                        <span key={`ellipsis-${idx}`} className="px-1.5 text-[11px] font-medium text-slate-300">
                            …
                        </span>
                    ) : (
                        <button
                            key={item}
                            type="button"
                            onClick={() => go(item)}
                            className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-bold transition ${
                                item === safePage
                                    ? accentClass
                                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10'
                            }`}
                            aria-current={item === safePage ? 'page' : undefined}
                        >
                            {item}
                        </button>
                    )
                )}

                <button type="button" className={navBtn} onClick={() => go(safePage + 1)} disabled={safePage >= totalPages} aria-label="Next page">
                    <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={navBtn} onClick={() => go(totalPages)} disabled={safePage >= totalPages} aria-label="Last page">
                    <ChevronsRight className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

export function slicePage(items, page, pageSize) {
    const size = Math.max(1, pageSize);
    const start = (Math.max(1, page) - 1) * size;
    return (items || []).slice(start, start + size);
}
