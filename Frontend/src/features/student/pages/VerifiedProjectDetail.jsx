import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, Loader2, ShieldCheck, ImageIcon } from 'lucide-react';
import StudentPublicShell from '../layouts/StudentPublicShell';
import PublicSiteFooter from '../../../shared/components/PublicSiteFooter';
import galleryService from '../../../services/galleryService';
import ProjectScreenshotLightbox from '../components/ProjectScreenshotLightbox';
import { BRAND } from '../../../shared/ui/brandTheme';
import { useAuth } from '../../../context/authContext';
import { appWarning } from '../../../lib/appDialog';

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
        <div className="min-h-screen bg-[#f8faff] font-sans text-[var(--sv-text)] dark:bg-[#020617] dark:text-slate-100">

            <main className="pt-28 pb-16 px-6 max-w-[1200px] mx-auto">
                <Link
                    to="/gallery"
                    className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-[var(--sv-muted)] hover:text-[#2a3fa4] dark:text-[var(--sv-muted)] dark:hover:text-blue-300"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to verified projects
                </Link>

                {loading ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="h-10 w-10 animate-spin text-[#2a3fa4]" />
                    </div>
                ) : error || !project ? (
                    <div className="rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-card)] p-6 sm:p-8 lg:p-10 text-center dark:border-white/10 dark:bg-[#111827]">
                        <p className="font-semibold text-[var(--sv-muted)] dark:text-slate-300">{error || 'Project not found'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10 items-start">
                        <div className="overflow-hidden rounded-[24px] border border-[var(--sv-border)] bg-[var(--sv-card)] shadow-lg dark:border-white/10 dark:bg-[#111827]">
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
                                        className="w-full max-h-[520px] object-cover object-top"
                                    />
                                </button>
                            ) : (
                                <div
                                    className="aspect-video flex flex-col items-center justify-center gap-4 p-8"
                                    style={{ background: `linear-gradient(135deg, ${BRAND.railFrom}, ${BRAND.railTo})` }}
                                >
                                    <ImageIcon className="h-14 w-14 text-white/40" />
                                    <p className="text-white font-bold text-center">No UI screenshot uploaded yet</p>
                                </div>
                            )}
                            {resolvedUrls.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto border-t border-[var(--sv-border)] p-3 dark:border-white/10">
                                    {resolvedUrls.map((src, i) => (
                                        <button
                                            key={src}
                                            type="button"
                                            onClick={() => setLightboxIndex(i)}
                                            className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-[var(--sv-border)] hover:ring-2 hover:ring-[#2a3fa4] dark:border-white/10"
                                        >
                                            <img src={src} alt="" className="h-full w-full object-cover object-top" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex flex-wrap gap-2 mb-4">
                                    <span className="rounded-full bg-blue-50 dark:bg-blue-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#2a3fa4] dark:bg-blue-500/15 dark:text-blue-300">
                                    {project.category}
                                </span>
                                {project.teacherScore != null && (
                                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                        <ShieldCheck className="h-3 w-3" /> Approved · {project.teacherScore}%
                                    </span>
                                )}
                            </div>

                            <h1 className="mb-3 text-3xl font-black tracking-tight text-[var(--sv-text)] dark:text-slate-100 md:text-4xl">{project.title}</h1>
                            <p className="mb-4 text-sm font-semibold text-[var(--sv-muted)] dark:text-[var(--sv-muted)]">
                                By {project.author}
                                {project.subject ? ` · ${project.subject}` : ''}
                                {project.className ? ` · ${project.className}` : ''}
                            </p>

                            <div className="mb-6 flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    disabled={reactBusy}
                                    onClick={toggleLike}
                                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-sm transition disabled:opacity-60 ${
                                        project.likedByMe
                                            ? 'bg-rose-500 text-white'
                                            : 'border border-[var(--sv-border)] bg-[var(--sv-card)] text-[var(--sv-text)] hover:border-rose-300 dark:border-white/10 dark:bg-[#111827]'
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

                            <div className="mb-6 rounded-[20px] border border-[var(--sv-border)] bg-[var(--sv-card)] p-6 shadow-sm dark:border-white/10 dark:bg-[#111827]">
                                <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-[var(--sv-muted)] dark:text-[var(--sv-muted)]">Description</h2>
                                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--sv-text)] dark:text-slate-300">
                                    {project.description || 'No description provided.'}
                                </p>
                            </div>

                            {project.features?.length > 0 && (
                                <div className="mb-6 rounded-[20px] border border-[var(--sv-border)] bg-[var(--sv-card)] p-6 shadow-sm dark:border-white/10 dark:bg-[#111827]">
                                    <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-[var(--sv-muted)] dark:text-[var(--sv-muted)]">Features</h2>
                                    <ul className="space-y-2">
                                        {project.features.map((f) => (
                                            <li key={f} className="flex gap-2 text-sm font-medium text-[var(--sv-text)] dark:text-slate-300">
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
                                            className="rounded-md border border-[var(--sv-border)] bg-[var(--sv-card)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-[var(--sv-muted)] dark:border-white/10 dark:bg-[#111827] dark:text-[var(--sv-muted)]"
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
