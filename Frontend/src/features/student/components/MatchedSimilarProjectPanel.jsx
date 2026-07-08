import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, ImageIcon, ShieldCheck } from 'lucide-react';
import galleryService from '../../../services/galleryService';
import ProjectScreenshotLightbox from './ProjectScreenshotLightbox';

export default function MatchedSimilarProjectPanel({
    match,
    suggestedFeatures = [],
    onAddFeature,
    recommendation,
}) {
    const [lightboxOpen, setLightboxOpen] = useState(false);

    if (!match?.title) return null;

    const screenshotUrls =
        match.screenshotUrls?.length > 0
            ? match.screenshotUrls
            : match.screenshotUrl
              ? [match.screenshotUrl]
              : [];
    const thumb = galleryService.resolveMediaUrl(screenshotUrls[0]);
    const galleryPath = match.galleryPath || (match.inVerifiedGallery !== false ? `/gallery/${match.id}` : null);

    return (
        <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 dark:to-slate-900 shadow-sm">
            <div className="border-b border-amber-200/80 bg-amber-100/60 dark:bg-amber-900/30 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-200">
                    Similar verified project
                </p>
                <p className="mt-1 text-sm font-semibold text-amber-950 dark:text-amber-50">
                    This idea resembles an approved project from a previous semester
                    {match.similarityPercent != null ? ` (${match.similarityPercent}% overlap)` : ''}.
                    Review it before you add optional differentiators.
                </p>
            </div>

            <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,200px)_1fr] md:items-start">
                <button
                    type="button"
                    onClick={() => screenshotUrls.length && setLightboxOpen(true)}
                    className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-left transition hover:ring-2 hover:ring-[#1D68E3]/40 ${
                        screenshotUrls.length ? 'cursor-zoom-in' : 'cursor-default'
                    }`}
                    title={screenshotUrls.length ? 'View project screenshots' : 'No screenshot uploaded'}
                >
                    {thumb ? (
                        <img src={thumb} alt="" className="h-full w-full object-cover object-top" />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
                            <ImageIcon className="h-8 w-8 text-slate-400" />
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">No screenshot</span>
                        </div>
                    )}
                    {screenshotUrls.length > 1 && (
                        <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white">
                            {screenshotUrls.length} photos
                        </span>
                    )}
                </button>

                <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#2a3fa4]">
                            <ShieldCheck className="h-3 w-3" />
                            Verified archive
                        </span>
                        {match.category ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                                {match.category}
                            </span>
                        ) : null}
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{match.title}</h3>
                    {match.author ? (
                        <p className="mt-1 text-xs font-semibold text-slate-500">By {match.author}</p>
                    ) : null}
                    {match.description ? (
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            {match.description}
                        </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                        {galleryPath ? (
                            <Link
                                to={galleryPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl bg-[#1D68E3] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#1a4dcc]"
                            >
                                Open in verified projects
                                <ExternalLink className="h-4 w-4" />
                            </Link>
                        ) : (
                            <Link
                                to="/gallery"
                                className="inline-flex items-center gap-2 rounded-xl bg-[#1D68E3] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#1a4dcc]"
                            >
                                Browse verified projects
                                <ExternalLink className="h-4 w-4" />
                            </Link>
                        )}
                        {screenshotUrls.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setLightboxOpen(true)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            >
                                View screenshots
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {(recommendation || suggestedFeatures.length > 0) && (
                <div className="border-t border-amber-200/80 bg-white/70 dark:bg-slate-900/50 px-4 py-4">
                    {recommendation ? (
                        <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{recommendation}</p>
                    ) : null}
                    {suggestedFeatures.length > 0 && (
                        <div className={recommendation ? 'mt-3' : ''}>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                                Optional features to differentiate (click to add)
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {suggestedFeatures.map((feat) => (
                                    <button
                                        key={feat}
                                        type="button"
                                        onClick={() => onAddFeature?.(feat)}
                                        className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
                                    >
                                        + {feat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {lightboxOpen && (
                <ProjectScreenshotLightbox
                    urls={screenshotUrls}
                    title={match.title}
                    onClose={() => setLightboxOpen(false)}
                />
            )}
        </div>
    );
}
