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
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-4 text-center"
            style={{ background: BRAND_GRADIENT }}
        >
            <ImageIcon className="h-6 w-6 text-white/45" />
            <p className="line-clamp-2 text-[10px] font-bold text-white/85">{project.title}</p>
        </div>
    );
}

/**
 * Compact verified project card: title, student, technology only.
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
    const category = (project.category || 'Verified').toString();
    const technology = project.subject || category;
    const canZoom = Boolean(screenshotUrls.length && onOpenScreenshots);

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.04] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(42,63,164,0.12)] hover:ring-[#2a3fa4]/15">
            <div className="relative p-2.5 pb-0">
                <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-[#eef2ff]">
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
                    </button>

                    <span className="pointer-events-none absolute left-2 top-2 z-[1] rounded-full bg-white/95 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.1em] text-slate-700 shadow-sm backdrop-blur-md">
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
                            className={`absolute right-2 top-2 z-[1] inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold shadow-sm backdrop-blur-md transition disabled:opacity-60 ${
                                isLiked
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-white/95 text-slate-600 hover:bg-white'
                            }`}
                            title={isLiked ? 'Remove love' : 'Love this project'}
                        >
                            {likeBusy ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <Heart className={`h-3 w-3 ${isLiked ? 'fill-white' : ''}`} />
                            )}
                            <span className="tabular-nums">{totalLikes}</span>
                        </button>
                    ) : (
                        <span className="absolute right-2 top-2 z-[1] inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-600 shadow-sm backdrop-blur-md">
                            <Heart className="h-3 w-3" />
                            <span className="tabular-nums">{totalLikes}</span>
                        </span>
                    )}
                </div>
            </div>

            <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3 sm:px-4 sm:pb-4">
                <h3 className="mb-1 line-clamp-2 text-[0.95rem] font-extrabold leading-snug tracking-tight text-slate-950">
                    <Link
                        to={`/gallery/${project.id}`}
                        className="transition-colors hover:text-[#2a3fa4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a3fa4]/40"
                    >
                        {project.title}
                    </Link>
                </h3>

                <p className="mb-3 line-clamp-1 text-xs font-medium text-slate-500">
                    By <span className="font-semibold text-slate-800">{project.author || 'Student'}</span>
                    <span className="text-slate-300"> · </span>
                    <span className="text-slate-400">{technology}</span>
                </p>

                <Link
                    to={`/gallery/${project.id}`}
                    className="mt-auto inline-flex min-h-8 w-fit items-center gap-1.5 rounded-full bg-[#eef2ff] px-3 py-1.5 text-xs font-bold text-[#2a3fa4] transition hover:bg-[#2a3fa4] hover:text-white"
                >
                    View project
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                </Link>
            </div>
        </article>
    );
}
