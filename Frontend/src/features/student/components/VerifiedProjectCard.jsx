import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Heart, ImageIcon, Loader2 } from 'lucide-react';
import galleryService from '../../../services/galleryService';
import { BRAND_GRADIENT } from '../../../shared/ui/brandTheme';

function Cover({ project }) {
    const src = galleryService.resolveMediaUrl(project.screenshotUrl);
    if (src) {
        return (
            <img
                src={src}
                alt=""
                className="h-full w-full object-cover object-top transition duration-500 ease-out group-hover:scale-[1.04]"
                loading="lazy"
            />
        );
    }
    return (
        <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center"
            style={{ background: BRAND_GRADIENT }}
        >
            <ImageIcon className="h-8 w-8 text-white/45" />
            <p className="line-clamp-2 text-xs font-bold text-white/85">{project.title}</p>
        </div>
    );
}

/** Plain-text preview from proposal/markdown descriptions */
export function previewDescription(raw, fallback) {
    const text = String(raw || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/[*_~`>#|-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text || fallback;
}

/**
 * Verified project card — gallery / public surfaces.
 * Structure: media → title → meta → description → action
 */
export default function VerifiedProjectCard({
    project,
    onOpenScreenshots,
    onToggleLike,
    likeBusy = false,
}) {
    const totalLikes = Number(project.likeCount) || 0;
    const isLiked = Boolean(project.likedByMe);
    const screenshotUrls =
        project.screenshotUrls?.length > 0
            ? project.screenshotUrls
            : project.screenshotUrl
              ? [project.screenshotUrl]
              : [];
    const description = previewDescription(
        project.description,
        'Teacher-approved student project verified through the Project Verify workflow.'
    );
    const category = (project.category || 'Verified').toString();
    const canZoom = Boolean(screenshotUrls.length && onOpenScreenshots);

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.04] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(42,63,164,0.12)] hover:ring-[#2a3fa4]/15">
            {/* Media */}
            <div className="relative p-3 pb-0">
                <div className="relative aspect-[16/10] overflow-hidden rounded-[1.25rem] bg-[#eef2ff]">
                    <button
                        type="button"
                        onClick={() =>
                            canZoom ? onOpenScreenshots({ title: project.title, urls: screenshotUrls }) : undefined
                        }
                        className={`absolute inset-0 block w-full text-left ${
                            canZoom ? 'cursor-zoom-in' : 'cursor-default'
                        }`}
                        title={canZoom ? 'View screenshots' : undefined}
                        aria-label={canZoom ? `Preview ${project.title}` : project.title}
                    >
                        <Cover project={project} />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent opacity-60" />
                    </button>

                    <span className="pointer-events-none absolute left-3 top-3 z-[1] rounded-full bg-white/95 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-700 shadow-sm backdrop-blur-md">
                        {category}
                    </span>

                    {onToggleLike ? (
                        <button
                            type="button"
                            disabled={likeBusy}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onToggleLike(project);
                            }}
                            className={`absolute right-3 top-3 z-[1] inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold shadow-sm backdrop-blur-md transition disabled:opacity-60 ${
                                isLiked
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-white/95 text-slate-600 hover:bg-white'
                            }`}
                            title={isLiked ? 'Remove love' : 'Love this project'}
                        >
                            {likeBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-white' : ''}`} />
                            )}
                            <span className="tabular-nums">{totalLikes}</span>
                        </button>
                    ) : (
                        <span className="absolute right-3 top-3 z-[1] inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm backdrop-blur-md">
                            <Heart className="h-3.5 w-3.5" />
                            <span className="tabular-nums">{totalLikes}</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
                <h3 className="mb-2 line-clamp-2 min-h-[2.75rem] text-[1.05rem] font-extrabold leading-snug tracking-tight text-slate-950 sm:min-h-[3.25rem] sm:text-xl">
                    <Link
                        to={`/gallery/${project.id}`}
                        className="transition-colors hover:text-[#2a3fa4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a3fa4]/40 focus-visible:ring-offset-2"
                    >
                        {project.title}
                    </Link>
                </h3>

                <p className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] font-medium leading-snug text-slate-500">
                    <span>
                        By <span className="font-semibold text-slate-800">{project.author || 'Student'}</span>
                    </span>
                    {project.subject ? (
                        <>
                            <span className="text-slate-300" aria-hidden>
                                ·
                            </span>
                            <span className="text-slate-400">{project.subject}</span>
                        </>
                    ) : null}
                </p>

                <p className="mb-5 line-clamp-3 min-h-[3.75rem] text-sm font-medium leading-relaxed text-slate-500">
                    {description}
                </p>

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <Link
                        to={`/gallery/${project.id}`}
                        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#eef2ff] px-4 py-2 text-sm font-bold text-[#2a3fa4] transition hover:bg-[#2a3fa4] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a3fa4]/40"
                    >
                        View project
                        <ArrowUpRight className="h-4 w-4 shrink-0" />
                    </Link>
                    {project.teacherScore != null ? (
                        <span className="text-[11px] font-bold tabular-nums text-slate-400">
                            Score {project.teacherScore}%
                        </span>
                    ) : null}
                </div>
            </div>
        </article>
    );
}
