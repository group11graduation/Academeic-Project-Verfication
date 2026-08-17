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
                alt={`${project.title} screenshot`}
                className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-[1.03]"
                loading="lazy"
            />
        );
    }
    return (
        <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 px-5 text-center"
            style={{ background: BRAND_GRADIENT }}
        >
            <ImageIcon className="h-9 w-9 text-white/50" />
            <p className="line-clamp-2 text-sm font-bold text-white/90">{project.title}</p>
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
 * Shared verified-project card for homepage + gallery.
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

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(42,63,164,0.12)] sm:rounded-[28px]">
            <div className="relative aspect-[16/10] overflow-hidden bg-[#f3f6ff]">
                <button
                    type="button"
                    onClick={() =>
                        screenshotUrls.length && onOpenScreenshots
                            ? onOpenScreenshots({ title: project.title, urls: screenshotUrls })
                            : undefined
                    }
                    className={`block h-full w-full text-left ${
                        screenshotUrls.length && onOpenScreenshots ? 'cursor-zoom-in' : 'cursor-default'
                    }`}
                    title={screenshotUrls.length ? 'View screenshots' : undefined}
                >
                    <Cover project={project} />
                </button>

                <div className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-700 shadow-sm backdrop-blur-md">
                    {project.category || 'Verified'}
                </div>

                {onToggleLike ? (
                    <button
                        type="button"
                        disabled={likeBusy}
                        onClick={(e) => {
                            e.preventDefault();
                            onToggleLike(project);
                        }}
                        className={`absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold shadow-sm backdrop-blur-md transition disabled:opacity-60 ${
                            isLiked ? 'bg-rose-500 text-white' : 'bg-white/95 text-slate-500'
                        }`}
                        title={isLiked ? 'Remove love' : 'Love this project'}
                    >
                        {likeBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-white' : ''}`} />
                        )}
                        {totalLikes}
                    </button>
                ) : (
                    <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 shadow-sm backdrop-blur-md">
                        <Heart className="h-3.5 w-3.5" />
                        {totalLikes}
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col p-5 sm:p-6">
                <h3 className="mb-1.5 line-clamp-2 text-lg font-extrabold leading-snug tracking-tight text-slate-950 sm:text-xl">
                    {project.title}
                </h3>
                <p className="mb-3 text-sm font-medium text-slate-500">
                    By <span className="font-semibold text-slate-800">{project.author || 'Student'}</span>
                    {project.subject ? <span className="text-slate-400"> · {project.subject}</span> : null}
                </p>
                <p className="mb-5 line-clamp-3 flex-1 text-sm font-medium leading-relaxed text-slate-500">
                    {description}
                </p>
                <Link
                    to={`/gallery/${project.id}`}
                    className="mt-auto inline-flex min-h-10 w-fit items-center gap-2 rounded-full bg-[#eef2ff] px-4 py-2 text-sm font-bold text-[#2a3fa4] transition group-hover:bg-[#2a3fa4] group-hover:text-white"
                >
                    View project <ArrowUpRight className="h-4 w-4" />
                </Link>
            </div>
        </article>
    );
}
