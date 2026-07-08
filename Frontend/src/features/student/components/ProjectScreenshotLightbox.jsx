import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import galleryService from '../../../services/galleryService';

export default function ProjectScreenshotLightbox({ urls = [], title = 'Project', startIndex = 0, onClose }) {
    const list = (Array.isArray(urls) ? urls : []).map((u) => galleryService.resolveMediaUrl(u)).filter(Boolean);
    const [index, setIndex] = React.useState(Math.min(startIndex, Math.max(0, list.length - 1)));

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
            if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
            if (e.key === 'ArrowRight') setIndex((i) => Math.min(list.length - 1, i + 1));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [list.length, onClose]);

    if (!list.length) return null;

    const src = list[index];

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={`${title} screenshots`}
            onClick={onClose}
        >
            <div
                className="relative max-h-[90vh] w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-bold text-slate-800 truncate pr-4">{title}</p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="relative bg-slate-900 flex items-center justify-center min-h-[240px] max-h-[75vh]">
                    <img src={src} alt={`${title} screenshot ${index + 1}`} className="max-h-[75vh] w-full object-contain" />
                    {list.length > 1 && (
                        <>
                            <button
                                type="button"
                                disabled={index <= 0}
                                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow disabled:opacity-40"
                                aria-label="Previous screenshot"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                disabled={index >= list.length - 1}
                                onClick={() => setIndex((i) => Math.min(list.length - 1, i + 1))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow disabled:opacity-40"
                                aria-label="Next screenshot"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">
                                {index + 1} / {list.length}
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
