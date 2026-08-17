import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, ImageIcon, Loader2, ShieldCheck } from 'lucide-react';
import StudentPublicShell from '../layouts/StudentPublicShell';
import PublicSiteFooter from '../../../shared/components/PublicSiteFooter';
import galleryService from '../../../services/galleryService';
import ProjectScreenshotLightbox from '../components/ProjectScreenshotLightbox';
import { BRAND_GRADIENT } from '../../../shared/ui/brandTheme';
import { useAuth } from '../../../context/authContext';
import { appWarning } from '../../../lib/appDialog';

/** Light markdown → readable blocks for description cards */
function DescriptionBody({ text }) {
    const raw = (text || '').trim();
    if (!raw) {
        return <p className="text-[15px] font-medium leading-relaxed text-slate-500">No description provided.</p>;
    }

    const blocks = raw.split(/\n{2,}/).filter(Boolean);

    return (
        <div className="space-y-4">
            {blocks.map((block, i) => {
                const lines = block.split('\n');
                const heading = lines[0].match(/^(#{1,3})\s+(.+)$/);
                if (heading && lines.length === 1) {
                    const level = heading[1].length;
                    const content = heading[2];
                    const cls =
                        level === 1
                            ? 'text-xl font-extrabold text-slate-950'
                            : level === 2
                              ? 'text-lg font-extrabold text-slate-950'
                              : 'text-base font-bold text-slate-900';
                    return (
                        <p key={i} className={cls}>
                            {content}
                        </p>
                    );
                }

                return (
                    <div key={i} className="space-y-2">
                        {lines.map((line, j) => {
                            const h = line.match(/^(#{1,3})\s+(.+)$/);
                            if (h) {
                                return (
                                    <p
                                        key={j}
                                        className={
                                            h[1].length === 1
                                                ? 'text-xl font-extrabold text-slate-950'
                                                : h[1].length === 2
                                                  ? 'text-lg font-extrabold text-slate-950'
                                                  : 'text-base font-bold text-slate-900'
                                        }
                                    >
                                        {h[2]}
                                    </p>
                                );
                            }
                            if (/^[-*]\s+/.test(line)) {
                                return (
                                    <p key={j} className="flex gap-2 text-[15px] font-medium leading-relaxed text-slate-600">
                                        <span className="text-[#2a3fa4]">•</span>
                                        <span>{line.replace(/^[-*]\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1')}</span>
                                    </p>
                                );
                            }
                            if (/^---+$/.test(line.trim())) {
                                return <hr key={j} className="border-slate-200" />;
                            }
                            return (
                                <p key={j} className="text-[15px] font-medium leading-relaxed text-slate-600">
                                    {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                                </p>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

const VerifiedProjectDetail = () => {
    const { id } = useParams();
    const { token } = useAuth();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [reactBusy, setReactBusy] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
        (async () => {
            try {
                const res = await galleryService.getVerifiedProject(id);
                if (res.success) {
                    setProject(res.data);
                } else setError(res.message || 'Project not found');
            } catch (e) {
                setError(e.response?.data?.message || 'Project not found');
            } finally {
                setLoading(false);
            }
        })();
    }, [id, token]);

    const screenshotUrls = useMemo(() => {
        if (!project) return [];
        if (project.screenshotUrls?.length) return project.screenshotUrls;
        return project.screenshotUrl ? [project.screenshotUrl] : [];
    }, [project]);

    const resolvedUrls = screenshotUrls.map((u) => galleryService.resolveMediaUrl(u)).filter(Boolean);
    const heroSrc = resolvedUrls[0] || null;

    const toggleLike = async () => {
        setReactBusy(true);
        try {
            const res = await galleryService.toggleProjectReaction(id);
            if (res.success && res.data) {
                setProject((p) =>
                    p
                        ? {
                              ...p,
                              likeCount: res.data.likeCount,
                              likedByMe: res.data.likedByMe,
                          }
                        : p
                );
            }
        } catch (e) {
            await appWarning(e.response?.data?.message || 'Could not update reaction.');
        } finally {
            setReactBusy(false);
        }
    };

    return (
        <StudentPublicShell>
            <div className="relative min-h-screen overflow-x-clip bg-[#eef1f6] text-[var(--sv-text)] antialiased [font-family:var(--sv-font-sans)]">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(42,63,164,0.14), transparent 58%), radial-gradient(ellipse 45% 40% at 100% 25%, rgba(29,104,227,0.10), transparent 50%), radial-gradient(ellipse 40% 35% at 0% 40%, rgba(165,180,252,0.16), transparent 50%)',
                    }}
                />

                <main className="relative px-3 pb-16 pt-4 sm:px-4 sm:pt-5 md:px-5 lg:px-6">
                    <div className="mb-5">
                        <Link
                            to="/gallery"
                            className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#2a3fa4]"
                        >
                            <ArrowLeft className="h-4 w-4" /> Back to verified projects
                        </Link>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-24">
                            <Loader2 className="h-10 w-10 animate-spin text-[#2a3fa4]" />
                        </div>
                    ) : error || !project ? (
                        <div className="rounded-[28px] border border-white/70 bg-white/90 p-8 text-center shadow-sm sm:rounded-[36px]">
                            <p className="font-semibold text-slate-500">{error || 'Project not found'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-10">
                            {/* Image column */}
                            <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:rounded-[36px]">
                                {heroSrc ? (
                                    <button
                                        type="button"
                                        onClick={() => setLightboxIndex(0)}
                                        className="block w-full cursor-zoom-in"
                                        title="View full screenshot"
                                    >
                                        <img
                                            src={heroSrc}
                                            alt={`${project.title} UI screenshot`}
                                            className="max-h-[560px] w-full object-cover object-top"
                                        />
                                    </button>
                                ) : (
                                    <div
                                        className="flex aspect-video flex-col items-center justify-center gap-4 p-8"
                                        style={{ background: BRAND_GRADIENT }}
                                    >
                                        <ImageIcon className="h-14 w-14 text-white/40" />
                                        <p className="text-center font-bold text-white">No UI screenshot uploaded yet</p>
                                    </div>
                                )}
                                {resolvedUrls.length > 1 && (
                                    <div className="flex gap-2 overflow-x-auto border-t border-slate-100 bg-white p-3">
                                        {resolvedUrls.map((src, i) => (
                                            <button
                                                key={src}
                                                type="button"
                                                onClick={() => setLightboxIndex(i)}
                                                className="h-16 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200 hover:ring-2 hover:ring-[#2a3fa4]"
                                            >
                                                <img src={src} alt="" className="h-full w-full object-cover object-top" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Details column */}
                            <div className="min-w-0">
                                <div className="mb-4 flex flex-wrap gap-2">
                                    <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#2a3fa4]">
                                        {project.category}
                                    </span>
                                    {project.teacherScore != null && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                                            <ShieldCheck className="h-3 w-3" /> Approved · {project.teacherScore}%
                                        </span>
                                    )}
                                </div>

                                <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
                                    {project.title}
                                </h1>
                                <p className="mb-5 text-sm font-medium text-slate-500">
                                    By <span className="font-semibold text-slate-700">{project.author}</span>
                                    {project.subject ? ` · ${project.subject}` : ''}
                                    {project.className ? ` · ${project.className}` : ''}
                                </p>

                                <div className="mb-6">
                                    <button
                                        type="button"
                                        disabled={reactBusy}
                                        onClick={toggleLike}
                                        className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-sm transition disabled:opacity-60 ${
                                            project.likedByMe
                                                ? 'bg-rose-500 text-white'
                                                : 'border border-slate-900/80 bg-white text-slate-900 hover:bg-slate-50'
                                        }`}
                                    >
                                        {reactBusy ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Heart className={`h-4 w-4 ${project.likedByMe ? 'fill-white' : ''}`} />
                                        )}
                                        {project.likedByMe ? 'Loved' : 'Love'} · {Number(project.likeCount) || 0}
                                    </button>
                                </div>

                                <div className="mb-5 rounded-[28px] border border-white bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:rounded-[32px] sm:p-7">
                                    <h2 className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                                        Description
                                    </h2>
                                    <DescriptionBody text={project.description} />
                                </div>

                                {project.features?.length > 0 && (
                                    <div className="mb-5 rounded-[28px] border border-white bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:rounded-[32px] sm:p-7">
                                        <h2 className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                                            Features
                                        </h2>
                                        <ul className="space-y-2.5">
                                            {project.features.map((f) => (
                                                <li key={f} className="flex gap-2 text-sm font-medium text-slate-600">
                                                    <span className="text-[#2a3fa4]">•</span> {f}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {project.tags?.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {project.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-500"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>

                <PublicSiteFooter />

                {lightboxIndex != null && resolvedUrls.length > 0 ? (
                    <ProjectScreenshotLightbox
                        urls={resolvedUrls}
                        title={project?.title || 'Project'}
                        startIndex={lightboxIndex}
                        onClose={() => setLightboxIndex(null)}
                    />
                ) : null}
            </div>
        </StudentPublicShell>
    );
};

export default VerifiedProjectDetail;
