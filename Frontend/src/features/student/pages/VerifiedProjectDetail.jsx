import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ShieldCheck, ImageIcon } from 'lucide-react';
import StudentHeader from '../components/StudentHeader';
import PublicSiteFooter from '../../../shared/components/PublicSiteFooter';
import galleryService from '../../../services/galleryService';
import { BRAND } from '../../../shared/ui/brandTheme';

const VerifiedProjectDetail = () => {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        window.scrollTo(0, 0);
        (async () => {
            try {
                const res = await galleryService.getVerifiedProject(id);
                if (res.success) setProject(res.data);
                else setError(res.message || 'Project not found');
            } catch (e) {
                setError(e.response?.data?.message || 'Project not found');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const screenshotSrc = galleryService.resolveMediaUrl(project?.screenshotUrl);

    return (
        <div className="min-h-screen bg-[#f8faff] font-sans text-slate-900">
            <StudentHeader />

            <main className="pt-28 pb-16 px-6 max-w-[1200px] mx-auto">
                <Link
                    to="/gallery"
                    className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#2a3fa4] mb-8"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to verified projects
                </Link>

                {loading ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="h-10 w-10 animate-spin text-[#2a3fa4]" />
                    </div>
                ) : error || !project ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                        <p className="text-slate-600 font-semibold">{error || 'Project not found'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                        <div className="rounded-[24px] overflow-hidden border border-slate-200 bg-white shadow-lg">
                            {screenshotSrc ? (
                                <img
                                    src={screenshotSrc}
                                    alt={`${project.title} UI screenshot`}
                                    className="w-full max-h-[520px] object-cover object-top"
                                />
                            ) : (
                                <div
                                    className="aspect-video flex flex-col items-center justify-center gap-4 p-8"
                                    style={{ background: `linear-gradient(135deg, ${BRAND.railFrom}, ${BRAND.railTo})` }}
                                >
                                    <ImageIcon className="h-14 w-14 text-white/40" />
                                    <p className="text-white font-bold text-center">No UI screenshot uploaded yet</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex flex-wrap gap-2 mb-4">
                                <span className="rounded-full bg-blue-50 text-[#2a3fa4] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                                    {project.category}
                                </span>
                                {project.teacherScore != null && (
                                    <span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3" /> Approved · {project.teacherScore}%
                                    </span>
                                )}
                            </div>

                            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 tracking-tight">{project.title}</h1>
                            <p className="text-sm font-semibold text-slate-500 mb-6">
                                By {project.author}
                                {project.subject ? ` · ${project.subject}` : ''}
                                {project.className ? ` · ${project.className}` : ''}
                            </p>

                            <div className="rounded-[20px] bg-white border border-slate-100 p-6 mb-6 shadow-sm">
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Description</h2>
                                <p className="text-[15px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                                    {project.description || 'No description provided.'}
                                </p>
                            </div>

                            {project.features?.length > 0 && (
                                <div className="rounded-[20px] bg-white border border-slate-100 p-6 mb-6 shadow-sm">
                                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Features</h2>
                                    <ul className="space-y-2">
                                        {project.features.map((f) => (
                                            <li key={f} className="text-sm font-medium text-slate-700 flex gap-2">
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
                                            className="text-[9px] font-bold text-slate-500 uppercase tracking-widest border border-slate-200 px-2.5 py-1 rounded-md bg-white"
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
        </div>
    );
};

export default VerifiedProjectDetail;
