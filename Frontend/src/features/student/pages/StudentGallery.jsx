import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, Loader2, Search, ShieldCheck, TrendingUp, ImageIcon } from 'lucide-react';
import StudentPublicShell from '../layouts/StudentPublicShell';
import PublicSiteFooter from '../../../shared/components/PublicSiteFooter';
import galleryService from '../../../services/galleryService';
import ProjectScreenshotLightbox from '../components/ProjectScreenshotLightbox';
import { BRAND } from '../../../shared/ui/brandTheme';
import { usePageSearch } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';

const GALLERY_CATEGORIES = [
    'ALL CATEGORIES',
    'WEB DEVELOPMENT',
    'REACT',
    'PHP',
    'HTML & CSS',
    'HTML & CSS WITH JAVASCRIPT',
];

const getLikes = () => {
    try {
        return JSON.parse(localStorage.getItem('projectLikes') || '{}');
    } catch {
        return {};
    }
};

const ProjectCover = ({ project, className = '' }) => {
    const src = galleryService.resolveMediaUrl(project.screenshotUrl);
    if (src) {
        return (
            <img
                src={src}
                alt={`${project.title} screenshot`}
                className={`w-full h-full object-cover object-top ${className}`}
                loading="lazy"
            />
        );
    }
    return (
        <div
            className={`w-full h-full flex flex-col items-center justify-center gap-3 px-6 text-center ${className}`}
            style={{ background: `linear-gradient(135deg, ${BRAND.railFrom} 0%, ${BRAND.railTo} 100%)` }}
        >
            <ImageIcon className="h-10 w-10 text-white/50" />
            <p className="text-sm font-bold text-white/90 line-clamp-2">{project.title}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Screenshot pending</p>
        </div>
    );
};

const StudentGallery = () => {
    const [activeCategory, setActiveCategory] = useState('ALL CATEGORIES');
    const [sortBest, setSortBest] = useState(true);
    const [likesData, setLikesData] = useState(getLikes());
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lightbox, setLightbox] = useState(null);
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
    }, [activeCategory, sortBest]);

    useEffect(() => {
        setLikesData(getLikes());
    }, [projects]);

    const toggleLike = (id) => {
        const next = { ...likesData, [id]: !likesData[id] };
        if (!next[id]) delete next[id];
        localStorage.setItem('projectLikes', JSON.stringify(next));
        setLikesData(next);
    };

    const getProjectLikes = (proj) => {
        const base = Math.round((proj.teacherScore ?? 50) / 5);
        return base + (likesData[proj.id] ? 1 : 0);
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
        return list.sort((a, b) => getProjectLikes(b) - getProjectLikes(a));
    }, [projects, sortBest, likesData, searchQuery]);

    return (
        <StudentPublicShell>
        <div className="min-h-screen overflow-x-hidden bg-[#f8faff] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900 dark:bg-[#020617] dark:text-slate-100">

            <main className="pt-32 pb-12 px-6 max-w-[1536px] mx-auto">
                <div className="mb-16">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2a3fa4] mb-3">Verified projects</p>
                    <h1 className="mb-6 text-4xl font-black leading-[1.1] tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">
                        Approved student <span className="text-[#1D68E3]">submissions</span>
                    </h1>
                    <p className="max-w-2xl text-lg font-medium leading-relaxed text-slate-500 dark:text-slate-300">
                        Top teacher-approved capstone projects from the academic database — each with a description and UI
                        screenshot when the student uploads one.
                    </p>
                </div>

                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-3">
                        {GALLERY_CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setActiveCategory(cat)}
                                className={`px-5 py-2.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                                    activeCategory === cat
                                        ? 'bg-[#1D68E3] text-white shadow-md shadow-blue-200'
                                        : 'bg-slate-100/80 text-slate-500 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full lg:max-w-md">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search projects by title, author, description…"
                            className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-[#1D68E3] focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-[#111827] dark:text-slate-100 dark:focus:ring-blue-500/20"
                            aria-label="Search verified projects"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mb-12">
                    <button
                        type="button"
                        onClick={() => setSortBest((v) => !v)}
                        className={`px-5 py-2.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${
                            sortBest
                                ? 'bg-gradient-to-r from-[#2a3fa4] to-[#1D68E3] text-white shadow-md shadow-blue-200'
                                : 'border border-blue-200 bg-blue-50 text-[#2a3fa4] hover:bg-blue-100 dark:border-blue-400/20 dark:bg-[#111827] dark:text-blue-300 dark:hover:bg-[#1f2937]'
                        }`}
                    >
                        <TrendingUp className="h-3.5 w-3.5" />
                        {sortBest ? 'Best approved' : 'Most recent'}
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="h-10 w-10 animate-spin text-[#2a3fa4]" />
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-center font-semibold text-rose-700 dark:border-rose-400/20 dark:bg-rose-950/30 dark:text-rose-200">
                        {error}
                    </div>
                ) : sortedProjects.length === 0 ? (
                    <div className="mx-auto max-w-xl rounded-[24px] border border-slate-200 bg-white px-8 py-16 text-center dark:border-white/10 dark:bg-[#111827]">
                        <ShieldCheck className="h-12 w-12 text-[#2a3fa4] mx-auto mb-4" />
                        <h2 className="mb-2 text-xl font-black text-slate-900 dark:text-slate-100">
                            {searchQuery.trim() ? 'No matching projects' : 'No verified projects yet'}
                        </h2>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-300">
                            {searchQuery.trim()
                                ? 'Try a different search term or switch back to All Categories.'
                                : 'When teachers approve final projects and students upload a UI screenshot, they appear here automatically.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {sortedProjects.map((proj) => {
                            const totalLikes = getProjectLikes(proj);
                            const isLiked = !!likesData[proj.id];
                            const screenshotUrls =
                                proj.screenshotUrls?.length > 0
                                    ? proj.screenshotUrls
                                    : proj.screenshotUrl
                                      ? [proj.screenshotUrl]
                                      : [];
                            return (
                                <article
                                    key={proj.id}
                                    className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-slate-100 bg-white transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 dark:border-white/10 dark:bg-[#111827] dark:hover:shadow-none"
                                >
                                    <div className="relative h-[240px] overflow-hidden bg-slate-100 dark:bg-[#0f172a]">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                screenshotUrls.length
                                                    ? setLightbox({ title: proj.title, urls: screenshotUrls })
                                                    : undefined
                                            }
                                            className={`block h-full w-full text-left ${screenshotUrls.length ? 'cursor-zoom-in' : 'cursor-default'}`}
                                            title={screenshotUrls.length ? 'View screenshots' : undefined}
                                        >
                                            <ProjectCover project={proj} className="group-hover:scale-[1.02] transition-transform duration-700 ease-out" />
                                        </button>
                                        <div className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-700 shadow-sm backdrop-blur-md dark:bg-[#0b1220]/95 dark:text-slate-100">
                                            {proj.category}
                                        </div>
                                        {proj.teacherScore != null && (
                                            <div className="absolute bottom-4 left-4 bg-[#2a3fa4] text-white px-3 py-1 rounded-full text-[10px] font-black shadow-sm">
                                                Score {proj.teacherScore}%
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                toggleLike(proj.id);
                                            }}
                                            className={`absolute top-4 right-4 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-black shadow-sm flex items-center gap-1.5 transition-all ${
                                                isLiked ? 'bg-rose-500 text-white' : 'bg-white/95 text-slate-600 dark:bg-[#0b1220]/95 dark:text-slate-200'
                                            }`}
                                        >
                                            <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-white' : ''}`} />
                                            {totalLikes}
                                        </button>
                                    </div>
                                    <div className="p-8 flex flex-col flex-grow">
                                        <h3 className="mb-2 text-2xl font-black text-slate-900 dark:text-slate-100">{proj.title}</h3>
                                        <p className="mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                            By <span className="text-slate-700 dark:text-slate-200">{proj.author}</span>
                                            {proj.subject ? (
                                                <span className="text-slate-400 dark:text-slate-500"> · {proj.subject}</span>
                                            ) : null}
                                        </p>
                                        <p className="mb-8 flex-grow line-clamp-4 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                                            {proj.description}
                                        </p>
                                        {proj.tags?.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-8">
                                                {proj.tags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="rounded-md border border-slate-200 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:border-white/10 dark:text-slate-500"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <Link
                                            to={`/gallery/${proj.id}`}
                                            className="inline-flex items-center gap-2 text-sm font-bold text-[#1D68E3] group-hover:gap-3 transition-all w-fit mt-auto"
                                        >
                                            View project <ArrowRight className="h-4 w-4" />
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}

                {!loading && sortedProjects.length > 0 && (
                    <div className="py-24 text-center">
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                            Showing {sortedProjects.length} verified project{sortedProjects.length === 1 ? '' : 's'}
                        </p>
                    </div>
                )}
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
