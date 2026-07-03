import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, Loader2, ShieldCheck, TrendingUp, ImageIcon } from 'lucide-react';
import StudentPublicShell from '../layouts/StudentPublicShell';
import PublicSiteFooter from '../../../shared/components/PublicSiteFooter';
import galleryService from '../../../services/galleryService';
import { BRAND } from '../../../shared/ui/brandTheme';
import { useShellSearchFilter } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';

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
    const [categories, setCategories] = useState(['ALL CATEGORIES']);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const searchQuery = useShellSearchFilter('Search verified projects…');

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
                    if (Array.isArray(res.data?.categories) && res.data.categories.length) {
                        setCategories(res.data.categories);
                    }
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
                proj.studentName,
                proj.classCode
            )
        );
        if (!sortBest) return list;
        return list.sort((a, b) => getProjectLikes(b) - getProjectLikes(a));
    }, [projects, sortBest, likesData, searchQuery]);

    return (
        <StudentPublicShell>
        <div className="min-h-screen bg-[#f8faff] font-sans text-slate-900 overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">

            <main className="pt-32 pb-12 px-6 max-w-[1536px] mx-auto">
                <div className="mb-16">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2a3fa4] mb-3">Verified projects</p>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-[1.1] mb-6 tracking-tight">
                        Approved student <span className="text-[#1D68E3]">submissions</span>
                    </h1>
                    <p className="text-lg text-slate-500 font-medium max-w-2xl leading-relaxed">
                        Top teacher-approved capstone projects from the academic database — each with a description and UI
                        screenshot when the student uploads one.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3 mb-6">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setActiveCategory(cat)}
                            className={`px-5 py-2.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                                activeCategory === cat && sortBest
                                    ? 'bg-[#1D68E3] text-white shadow-md shadow-blue-200'
                                    : 'bg-slate-100/80 text-slate-500 hover:bg-slate-200'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="flex gap-3 mb-12">
                    <button
                        type="button"
                        onClick={() => setSortBest((v) => !v)}
                        className={`px-5 py-2.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${
                            sortBest
                                ? 'bg-gradient-to-r from-[#2a3fa4] to-[#1D68E3] text-white shadow-md shadow-blue-200'
                                : 'bg-blue-50 text-[#2a3fa4] hover:bg-blue-100 border border-blue-200'
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
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-center text-rose-700 font-semibold">
                        {error}
                    </div>
                ) : sortedProjects.length === 0 ? (
                    <div className="rounded-[24px] border border-slate-200 bg-white px-8 py-16 text-center max-w-xl mx-auto">
                        <ShieldCheck className="h-12 w-12 text-[#2a3fa4] mx-auto mb-4" />
                        <h2 className="text-xl font-black text-slate-900 mb-2">No verified projects yet</h2>
                        <p className="text-sm text-slate-500 font-medium">
                            When teachers approve final projects and students upload a UI screenshot, they appear here
                            automatically.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {sortedProjects.map((proj) => {
                            const totalLikes = getProjectLikes(proj);
                            const isLiked = !!likesData[proj.id];
                            return (
                                <article
                                    key={proj.id}
                                    className="bg-white rounded-[24px] border border-slate-100 overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 flex flex-col h-full"
                                >
                                    <Link to={`/gallery/${proj.id}`} className="relative h-[240px] overflow-hidden bg-slate-100 block">
                                        <ProjectCover project={proj} className="group-hover:scale-[1.02] transition-transform duration-700 ease-out" />
                                        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-700 shadow-sm">
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
                                                isLiked ? 'bg-rose-500 text-white' : 'bg-white/95 text-slate-600'
                                            }`}
                                        >
                                            <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-white' : ''}`} />
                                            {totalLikes}
                                        </button>
                                    </Link>
                                    <div className="p-8 flex flex-col flex-grow">
                                        <h3 className="text-2xl font-black text-slate-900 mb-2">{proj.title}</h3>
                                        <p className="text-sm font-semibold text-slate-500 mb-4">
                                            By <span className="text-slate-700">{proj.author}</span>
                                            {proj.subject ? (
                                                <span className="text-slate-400"> · {proj.subject}</span>
                                            ) : null}
                                        </p>
                                        <p className="text-[15px] text-slate-600 leading-relaxed mb-8 flex-grow line-clamp-4">
                                            {proj.description}
                                        </p>
                                        {proj.tags?.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-8">
                                                {proj.tags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] border border-slate-200 px-2.5 py-1 rounded-md"
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
                        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.25em]">
                            Showing {sortedProjects.length} verified project{sortedProjects.length === 1 ? '' : 's'}
                        </p>
                    </div>
                )}
            </main>

            <PublicSiteFooter />
        </div>
        </StudentPublicShell>
    );
};

export default StudentGallery;
