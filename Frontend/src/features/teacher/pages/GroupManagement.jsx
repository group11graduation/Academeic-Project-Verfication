import React, { useState, useEffect } from 'react';
import {
    Search,
    Bell,
    Settings,
    RotateCw,
    FileUp,
    Info,
    ArrowRight,
    Plus,
    X,
    Users,
    Loader2,
    AlertTriangle,
    ChevronRight,
    ArrowLeft
} from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import teacherService from '../../../services/teacherService';

const GroupManagement = () => {
    const { id: classCode } = useParams();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [genType, setGenType] = useState('group'); // 'group' or 'individual'
    const [groupSize, setGroupSize] = useState(4);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (classCode) {
            fetchGroups();
        }
    }, [classCode]);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const res = await teacherService.getGroups(classCode);
            if (res.success) {
                setGroups(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch groups:', err);
            setError('Failed to load groups. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            const res = await teacherService.generateGroups(classCode, {
                type: genType,
                groupSize: genType === 'group' ? groupSize : 1
            });
            if (res.success) {
                setIsModalOpen(false);
                fetchGroups();
            }
        } catch (err) {
            console.error('Generation failed:', err);
            alert('Failed to generate groups');
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B1120]">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-10 max-w-[1600px] mx-auto min-h-screen bg-white dark:bg-[#0B1120] transition-colors">
            {/* Breadcrumbs & Utility Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="space-y-2">
                    <nav className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4">
                        <Link to="/teacher/classes" className="hover:text-[#1D68E3] transition-colors">Classes</Link>
                        <ChevronRight className="h-3 w-3" />
                        <Link to={`/teacher/classes/${classCode}`} className="hover:text-[#1D68E3] transition-colors">{classCode}</Link>
                        <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                        <span className="text-slate-700 dark:text-slate-100">Project Assignments</span>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link 
                            to={`/teacher/classes/${classCode}`}
                            className="p-2.5 bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-900 transition-all shadow-xl group"
                        >
                            <ArrowLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
                        </Link>
                        <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                            Group Management
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group flex-1 md:flex-none">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-600 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search groups..."
                            className="w-full md:w-[320px] bg-slate-50 dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-slate-700 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-[#1D68E3] text-white p-3.5 rounded-2xl shadow-lg shadow-blue-500/20 hover:scale-[1.05] active:scale-[0.95] transition-all"
                        title="Regenerate Groups"
                    >
                        <RotateCw className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="bg-white dark:bg-[#0F172A] p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Total Groups</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-4xl font-black text-slate-800 dark:text-slate-100 transition-colors">{groups.length}</h3>
                        <div className="text-[10px] font-black px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">ACTIVE</div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0F172A] p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Avg. Size</p>
                    <h3 className="text-4xl font-black text-slate-800 dark:text-slate-100 transition-colors">
                        {groups.length > 0 ? (groups.reduce((acc, g) => acc + g.members.length, 0) / groups.length).toFixed(1) : 0}
                    </h3>
                </div>

                <div className="bg-white dark:bg-[#0F172A] p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl transition-all group overflow-hidden relative sm:col-span-2">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full -mr-24 -mt-24 transition-transform group-hover:scale-110" />
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 h-full">
                        <div>
                            <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">AI Status</p>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 transition-colors leading-tight">
                                Proctored Analysis Complete
                            </h3>
                        </div>
                        <div className="flex items-center gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-500 px-4 py-2 rounded-xl border border-amber-100 dark:border-amber-900/30">
                            <span className="text-[11px] font-black uppercase tracking-wider">Similarity scores verified</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {groups.map((group) => (
                    <div key={group._id} className="bg-white dark:bg-[#0F172A] rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col group/card hover:border-blue-500/30 transition-all duration-300">
                        <div className="p-8 pb-6">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                                        {group.type === 'individual' ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                                    </div>
                                    <h4 className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                        {group.type === 'individual' ? 'Individual' : `Group ${group.assignmentNumber}`}
                                    </h4>
                                </div>
                                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest ${
                                    group.status === 'SUBMITTED' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-500' :
                                    group.status === 'DRAFT' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                                    'bg-slate-100 dark:bg-[#0B1120] text-slate-400 dark:text-slate-600'
                                }`}>
                                    {group.status}
                                </span>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-8 leading-tight min-h-[56px] transition-colors line-clamp-2">
                                {group.title}
                            </h3>

                             <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-white/5">
                                <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-600 tracking-[0.2em] mb-4">Group Members</p>
                                <div className="space-y-4">
                                    {group.members.map((member, i) => (
                                        <div key={i} className="flex items-center gap-4 group/member">
                                            <div className="w-10 h-10 rounded-[12px] bg-slate-50 dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 flex items-center justify-center text-[12px] font-black text-slate-700 dark:text-slate-100 shrink-0 overflow-hidden shadow-sm group-hover/member:border-blue-500/20">
                                                {member.photo && member.photo !== 'default-student.jpg' ? (
                                                    <img
                                                        src={member.photo.startsWith('http') ? member.photo : `http://localhost:5000/uploads/${member.photo}`}
                                                        className="w-full h-full object-cover"
                                                        alt=""
                                                    />
                                                ) : (
                                                    member.name.split(' ').map(n => n[0]).join('')
                                                )}
                                            </div>
                                            <span className="text-[15px] font-bold text-slate-500 dark:text-slate-400 group-hover/member:text-blue-600 dark:group-hover/member:text-blue-400">{member.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto px-8 py-6 bg-slate-50 dark:bg-[#0B1120] border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-600 tracking-widest">Similarity</p>
                                <div className="flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${
                                        group.similarityLevel === 'Low' ? 'bg-emerald-500' :
                                        group.similarityLevel === 'High' ? 'bg-rose-600' :
                                        'bg-amber-500'
                                    }`} />
                                    <p className={`text-base font-black tracking-tight ${
                                        group.similarityLevel === 'Low' ? 'text-emerald-500' :
                                        group.similarityLevel === 'High' ? 'text-rose-600' :
                                        'text-amber-500'
                                    }`}>
                                        {group.similarity}%
                                    </p>
                                </div>
                            </div>
                            <button className="p-3 bg-white dark:bg-[#0F172A] rounded-xl text-blue-600 dark:text-blue-400 border border-slate-100 dark:border-white/5 hover:bg-blue-600 hover:text-white transition-all shadow-xl active:scale-95">
                                <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                ))}

                {groups.length === 0 && (
                    <div className="col-span-full py-24 bg-white dark:bg-[#0F172A] rounded-[40px] border-4 border-dashed border-slate-100 dark:border-white/5 flex flex-col items-center justify-center text-center transition-colors">
                        <div className="p-6 bg-slate-50 dark:bg-[#0B1120] rounded-[32px] mb-6 shadow-xl border border-slate-100 dark:border-white/5">
                            <Plus className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 transition-colors">No Projects Generated</h3>
                        <p className="text-slate-500 dark:text-slate-400 font-bold max-w-[300px] transition-colors">Configure and regenerate project assignments to start managing student work.</p>
                    </div>
                )}
            </div>

            {/* Regeneration Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !generating && setIsModalOpen(false)}></div>
                    <div className="bg-white dark:bg-[#0F172A] rounded-[40px] w-full max-w-[540px] relative z-10 shadow-2xl border border-slate-100 dark:border-white/5 transition-colors overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-10 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-[#0B1120]/50">
                            <div>
                                <h3 className="text-2xl font-black text-[#0F172A] dark:text-white transition-colors tracking-tight">Regenerate Assignments</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-bold mt-1">Configure your project workflow</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white dark:bg-[#0B1120] text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-10 space-y-10">
                            <div>
                                <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6 block transition-colors">Project Type</label>
                                <div className="grid grid-cols-2 gap-6">
                                    <button
                                        onClick={() => setGenType('group')}
                                        className={`p-8 rounded-[32px] border-2 font-black transition-all group relative overflow-hidden ${genType === 'group' ? 'border-[#1D68E3] bg-[#1D68E3] text-white shadow-xl shadow-blue-500/30' : 'border-slate-100 dark:border-white/5 text-slate-500 hover:border-slate-200 dark:hover:border-white/10 bg-white dark:bg-[#0B1120]'}`}
                                    >
                                        <Users className={`h-6 w-6 mb-3 mx-auto ${genType === 'group' ? 'text-white' : 'text-slate-400'}`} />
                                        <span className="block text-sm uppercase tracking-widest">Group</span>
                                    </button>
                                    <button
                                        onClick={() => setGenType('individual')}
                                        className={`p-8 rounded-[32px] border-2 font-black transition-all group relative overflow-hidden ${genType === 'individual' ? 'border-[#1D68E3] bg-[#1D68E3] text-white shadow-xl shadow-blue-500/30' : 'border-slate-100 dark:border-white/5 text-slate-500 hover:border-slate-200 dark:hover:border-white/10 bg-white dark:bg-[#0B1120]'}`}
                                    >
                                        <Users className={`h-6 w-6 mb-3 mx-auto ${genType === 'individual' ? 'text-white' : 'text-slate-400'}`} />
                                        <span className="block text-sm uppercase tracking-widest">Individual</span>
                                    </button>
                                </div>
                            </div>

                            {genType === 'group' && (
                                <div className="animate-in slide-in-from-top-4 duration-500">
                                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6 block transition-colors">Capacity Per Group</label>
                                    <div className="flex flex-wrap items-center gap-4">
                                        {[2, 3, 4, 5, 6].map(size => (
                                            <button
                                                key={size}
                                                onClick={() => setGroupSize(size)}
                                                className={`w-14 h-14 rounded-2xl border-2 font-black transition-all ${groupSize === size ? 'border-[#1D68E3] bg-[#1D68E3] text-white shadow-lg shadow-blue-500/20' : 'border-slate-100 dark:border-white/5 text-slate-500 hover:border-slate-200 dark:hover:border-white/10 bg-white dark:bg-[#0B1120]'}`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-4">
                                <button
                                    onClick={handleGenerate}
                                    disabled={generating}
                                    className="w-full py-5 bg-[#1D68E3] text-white rounded-[24px] font-black text-base shadow-2xl shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-[0.2em]"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                            Analysis in progress...
                                        </>
                                    ) : (
                                        <>✨ Start AI Generation</>
                                    )}
                                </button>
                                <div className="mt-8 flex items-center justify-center gap-3 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 py-4 rounded-2xl border border-amber-100 dark:border-amber-900/20 px-6">
                                    <AlertTriangle className="h-5 w-5 shrink-0" />
                                    <p className="text-[12px] font-bold leading-relaxed">
                                        Regenerating will clear all existing data for <span className="font-black underline">{classCode}</span>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupManagement;
