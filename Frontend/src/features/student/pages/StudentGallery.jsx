import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, ShieldCheck, TrendingUp } from 'lucide-react';
import StudentPublicShell from '../layouts/StudentPublicShell';
import PublicSiteFooter from '../../../shared/components/PublicSiteFooter';
import galleryService from '../../../services/galleryService';
import ProjectScreenshotLightbox from '../components/ProjectScreenshotLightbox';
import VerifiedProjectCard from '../components/VerifiedProjectCard';
import { BRAND_GRADIENT } from '../../../shared/ui/brandTheme';
import { usePageSearch } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';
import { useAuth } from '../../../context/authContext';
import { appWarning } from '../../../lib/appDialog';

const GALLERY_CATEGORIES = [
    'ALL CATEGORIES',
    'WEB DEVELOPMENT',
    'REACT',
    'PHP',
    'HTML & CSS',
    'HTML & CSS WITH JAVASCRIPT',
];

const StudentGallery = () => {
    const { token } = useAuth();
    const [activeCategory, setActiveCategory] = useState('ALL CATEGORIES');
    const [sortBest, setSortBest] = useState(true);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lightbox, setLightbox] = useState(null);
    const [reactBusyId, setReactBusyId] = useState(null);
    const { query: searchQuery, setQuery: setSearchQuery } = usePageSearch('Search verified projects…');

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await galleryService.listVerifiedProjects({
                    category: activeCategory,
                    sort: sortBest ? 'best' : 'recent',
                    limit: 48,
                });
                if (res.success) {
                    setProjects(res.data?.projects || []);
                } else {
                    setError(res.message || 'Could not load verified projects.');
                }
            } catch (e) {
                setError(e.response?.data?.message || 'Could not load verified projects.');
            } finally {
                setLoading(false);
            }
        })();
    }, [activeCategory, sortBest, token]);

    const toggleLike = async (proj) => {
        setReactBusyId(proj.id);
        try {
            const res = await galleryService.toggleProjectReaction(proj.id);
            if (res.success && res.data) {
                setProjects((prev) =>
                    prev.map((p) =>
                        p.id === proj.id
                            ? {
                                  ...p,
                                  likeCount: res.data.likeCount,
                                  likedByMe: res.data.likedByMe,
                              }
                            : p
                    )
                );
            }
        } catch (e) {
            await appWarning(e.response?.data?.message || 'Could not update reaction.');
        } finally {
            setReactBusyId(null);
        }
    };

    const sortedProjects = useMemo(() => {
        const list = projects.filter((proj) =>
            matchesSearchQuery(
                searchQuery,
                proj.title,
                proj.description,
                proj.category,
                proj.author,
                proj.subject,
                proj.subjectCode,
                ...(Array.isArray(proj.tags) ? proj.tags : [])
            )
        );
        if (!sortBest) return list;
        return [...list].sort(
            (a, b) =>
                (b.likeCount || 0) - (a.likeCount || 0) ||
                (b.featuredRank || 0) - (a.featuredRank || 0) ||
                (b.teacherScore ?? 0) - (a.teacherScore ?? 0)
        );
    }, [projects, sortBest, searchQuery]);

    return (
        <StudentPublicShell>
            <div className="relative min-h-screen overflow-x-clip bg-[#eef1f6] text-[var(--sv-text)] antialiased [font-family:var(--sv-font-sans)]">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            'radial-gradient(ellipse 80% 45% at 50% 0%, rgba(42,63,164,0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 20%, rgba(29,104,227,0.10), transparent 50%), radial-gradient(ellipse 45% 35% at 0% 30%, rgba(165,180,252,0.18), transparent 50%)',
                    }}
                />

                <main className="relative px-3 pb-12 pt-4 sm:px-4 sm:pt-5 md:px-5 lg:px-6">
                    {/* Floating gradient panel — near edges, not touching */}
                    <div
                        className="relative overflow-hidden rounded-[28px] border border-white/70 px-4 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.07)] sm:rounded-[36px] sm:px-6 sm:py-8 md:rounded-[40px] lg:px-8 lg:py-10"
                        style={{
                            background: 'linear-gradient(180deg, #e8eeff 0%, #f5f7ff 32%, #ffffff 78%)',
                        }}
                    >
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[#c7d2fe]/45 blur-3xl"
                        />
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-[#bfdbfe]/40 blur-3xl"
                        />

                        <div className="relative mb-8 mx-auto max-w-3xl text-center">
                            <p className="mb-3 text-sm font-bold tracking-tight text-[var(--brand-primary)]">Verified projects</p>
                            <h1 className="mb-3 text-[1.75rem] font-extrabold leading-[1.15] tracking-tight text-[var(--text-primary)] sm:text-4xl md:text-5xl">
                                Approved student submissions
                            </h1>
                            <p className="mx-auto max-w-xl text-sm font-medium leading-relaxed text-[var(--text-secondary)] sm:text-base">
                                Teacher-approved capstone projects from the academic database. Browse titles,
                                descriptions, and reactions.
                            </p>
                        </div>

                        <div className="relative mb-8 rounded-[24px] border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:rounded-[28px] sm:p-5">
                            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {GALLERY_CATEGORIES.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setActiveCategory(cat)}
                                        className={`shrink-0 rounded-full px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-widest transition sm:text-xs ${
 activeCategory === cat
 ? 'bg-[var(--brand-primary)] text-white shadow-md shadow-[#2a3fa4]/20'
 : 'bg-[#f0f2f7] text-[var(--text-secondary)] hover:bg-slate-200/80'
 }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <div className="relative min-w-0 flex-1">
                                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                                    <input
                                        type="search"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search projects by title, author, description…"
                                        className="w-full rounded-full border border-[var(--border)] bg-[var(--bg-card)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--text-primary)] outline-none transition focus:border-[#2a3fa4] focus:ring-2 focus:ring-[#2a3fa4]/15"
                                        aria-label="Search verified projects"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSortBest((v) => !v)}
                                    className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[10px] font-extrabold uppercase tracking-widest transition sm:text-xs ${
 sortBest
 ? 'text-white shadow-md shadow-[#2a3fa4]/20'
 : 'border border-[var(--border)] bg-[var(--bg-card)] text-[var(--brand-primary)] hover:bg-[#eef2ff]'
 }`}
                                    style={sortBest ? { background: BRAND_GRADIENT } : undefined}
                                >
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    {sortBest ? 'Most loved' : 'Most recent'}
                                </button>
                            </div>
                        </div>

                        <div className="relative">
                            {loading ? (
                                <div className="flex justify-center py-24">
                                    <Loader2 className="h-10 w-10 animate-spin text-[var(--brand-primary)]" />
                                </div>
                            ) : error ? (
                                <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-8 text-center font-semibold text-rose-700">
                                    {error}
                                </div>
                            ) : sortedProjects.length === 0 ? (
                                <div className="mx-auto max-w-xl rounded-[28px] border border-[var(--border)]/80 bg-[var(--bg-card)] px-8 py-16 text-center">
                                    <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-[var(--brand-primary)]" />
                                    <h2 className="mb-2 text-xl font-extrabold text-[var(--text-primary)]">
                                        {searchQuery.trim() ? 'No matching projects' : 'No verified projects yet'}
                                    </h2>
                                    <p className="text-sm font-medium text-[var(--text-secondary)]">
                                        {searchQuery.trim()
                                            ? 'Try a different search term or switch back to All Categories.'
                                            : 'When teachers approve final projects and students upload a UI screenshot, they appear here automatically.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-7 xl:grid-cols-3">
                                    {sortedProjects.map((proj) => (
                                        <VerifiedProjectCard
                                            key={proj.id}
                                            project={proj}
                                            onOpenScreenshots={setLightbox}
                                            onToggleLike={toggleLike}
                                            likeBusy={reactBusyId === proj.id}
                                        />
                                    ))}
                                </div>
                            )}

                            {!loading && sortedProjects.length > 0 && (
                                <div className="pt-12 text-center">
                                    <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
                                        Showing {sortedProjects.length} verified project
                                        {sortedProjects.length === 1 ? '' : 's'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>

                <PublicSiteFooter />

                {lightbox ? (
                    <ProjectScreenshotLightbox
                        urls={lightbox.urls}
                        title={lightbox.title}
                        onClose={() => setLightbox(null)}
                    />
                ) : null}
            </div>
        </StudentPublicShell>
    );
};

export default StudentGallery;
