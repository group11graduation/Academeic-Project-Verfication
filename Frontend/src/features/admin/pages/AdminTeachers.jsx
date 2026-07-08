import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, Upload, Eye, EyeOff, ShieldCheck, Loader2, GraduationCap, Pencil, Trash2 } from 'lucide-react';
import adminTeacherService from '../../../services/adminTeacherService';
import { usePageSearch } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';

const AdminTeachers = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { query: searchQuery, setQuery: setSearchQuery } = usePageSearch('Search teachers…');
    const [showPasscodes, setShowPasscodes] = useState({});
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState('');

    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                const response = await adminTeacherService.getTeachers();
                if (response.success) {
                    setTeachers(response.data.map(t => ({
                        id: t._id || t.teacherId,
                        name: t.name,
                        status: t.status,
                        subjects: t.skills || [],
                        department: t.department,
                        photo: t.photo,
                        passcode: t.passcode || null,
                        email: t.email
                    })));
                }
            } catch (error) {
                console.error("Failed to fetch teachers:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTeachers();
    }, []);

    const togglePasscode = (id) => {
        setShowPasscodes(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleDeleteTeacher = async (teacherId) => {
        const shouldDelete = await appConfirm({
            message: 'Are you sure you want to delete this teacher?',
            danger: true,
            confirmLabel: 'Delete',
        });
        if (!shouldDelete) return;
        setDeletingId(teacherId);
        try {
            const response = await adminTeacherService.deleteTeacher(teacherId);
            if (!response.success) throw new Error(response.message || 'Failed to delete teacher');
            setTeachers((prev) => prev.filter((teacher) => teacher.id !== teacherId));
        } catch (error) {
            await appError(error.response?.data?.message || error.message || 'Failed to delete teacher');
        } finally {
            setDeletingId('');
        }
    };

    const filteredTeachers = teachers.filter((teacher) =>
        matchesSearchQuery(searchQuery, teacher.name, teacher.id, teacher.department, teacher.email, teacher.subjects)
    );

    if (loading) {
        return (
            <div className="min-h-[40vh] flex flex-col items-center justify-center">
                <Loader2 className="h-7 w-7 text-[#1D68E3] animate-spin mb-2" />
                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Loading faculty directory...</p>
            </div>
        );
    }

    return (
        <div className="font-sans transition-colors min-w-0 max-w-full">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-3 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none">Faculty</h1>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">Directory</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link to="/admin/teachers/new" className="inline-flex items-center gap-1.5 bg-[#1D68E3] text-white px-3 py-1.5 rounded-lg font-bold text-[12px] hover:bg-blue-700 transition-colors whitespace-nowrap">
                            <Plus className="h-3.5 w-3.5" />
                            Add Teacher
                        </Link>
                        <Link
                            to="/admin/teachers/import"
                            className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg font-bold text-[12px] hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors whitespace-nowrap"
                        >
                            <Upload className="h-3.5 w-3.5" />
                            Import Teachers
                        </Link>
                    </div>
                </div>

                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search teachers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-3 text-[12px] focus:ring-2 focus:ring-blue-500/10 font-medium text-slate-700 dark:text-slate-200 outline-none"
                    />
                </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-3">Academic staff profiles and assignments.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {filteredTeachers.map((teacher, index) => (
                    <Link to={`/admin/teachers/${teacher.id}`} state={{ from: location.pathname }} key={index} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
                        <div className="h-[120px] relative bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden">
                            <div className="absolute top-2 right-2 z-10">
                                <span className={`px-2 py-0.5 text-[8px] font-extrabold tracking-wider uppercase rounded shadow-sm ${teacher.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}>
                                    {teacher.status}
                                </span>
                            </div>
                            {teacher.photo && teacher.photo !== 'https://via.placeholder.com/150' ? (
                                <img src={teacher.photo} alt={teacher.name || 'Teacher'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                                    <GraduationCap className="h-10 w-10 text-blue-200 dark:text-slate-700 mb-1" />
                                    <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">{teacher.department || 'N/A'}</span>
                                </div>
                            )}
                        </div>

                        <div className="p-3 pb-2 flex flex-col flex-1">
                            <div className="mb-2">
                                <h3 className="text-[13px] font-bold text-[#0F172A] dark:text-slate-100 mb-0.5 line-clamp-1">{teacher.name}</h3>
                                <p className="text-[10px] font-bold text-[#1D68E3] dark:text-blue-400 uppercase tracking-wide">{teacher.id}</p>
                            </div>
                            <div className="mt-auto">
                                <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1.5">Subjects</p>
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {teacher.subjects.map((subject, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded text-[9px] font-semibold">
                                            {subject}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5 text-[#1D68E3] dark:text-blue-400" />
                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Passcode</span>
                            </div>
                            {teacher.passcode ? (
                                <div
                                    className="flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePasscode(teacher.id); }}
                                    title="Click to reveal/hide"
                                >
                                    {showPasscodes[teacher.id] ? (
                                        <span className="text-[11px] font-black text-[#0F172A] dark:text-slate-200 font-mono">{teacher.passcode}</span>
                                    ) : (
                                        <span className="text-[11px] font-black text-slate-300 font-mono tracking-[0.15em]">••••••</span>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded text-[9px] font-bold uppercase">Hidden</div>
                            )}
                        </div>
                        <div className="px-3 pb-3 flex items-center gap-1.5">
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/admin/teachers/${teacher.id}/edit`); }} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                                <Pencil className="h-3 w-3" /> Update
                            </button>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteTeacher(teacher.id); }} disabled={deletingId === teacher.id} className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-60">
                                {deletingId === teacher.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                Delete
                            </button>
                        </div>
                    </Link>
                ))}

                <Link to="/admin/teachers/new" className="bg-[#F8FAFB] dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center min-h-[220px] text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                    <div className="w-9 h-9 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-2">
                        <Plus className="h-5 w-5 text-slate-400 group-hover:text-blue-500" />
                    </div>
                    <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">Register New Faculty</span>
                </Link>
            </div>
        </div>
    );
};

export default AdminTeachers;
