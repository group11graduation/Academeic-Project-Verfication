import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, Eye, EyeOff, ShieldCheck, Loader2, GraduationCap, Pencil, Trash2 } from 'lucide-react';
import adminTeacherService from '../../../services/adminTeacherService';

const AdminTeachers = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
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
        const shouldDelete = window.confirm('Are you sure you want to delete this teacher?');
        if (!shouldDelete) return;
        setDeletingId(teacherId);
        try {
            const response = await adminTeacherService.deleteTeacher(teacherId);
            if (!response.success) throw new Error(response.message || 'Failed to delete teacher');
            setTeachers((prev) => prev.filter((teacher) => teacher.id !== teacherId));
        } catch (error) {
            window.alert(error.response?.data?.message || error.message || 'Failed to delete teacher');
        } finally {
            setDeletingId('');
        }
    };

    const filteredTeachers = teachers.filter(teacher =>
        (teacher.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (teacher.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (teacher.subjects && teacher.subjects.some(sub => (sub || '').toLowerCase().includes(searchQuery.toLowerCase())))
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] dark:bg-slate-900 flex flex-col items-center justify-center transition-colors">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">Loading faculty directory...</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-10 max-w-[1600px] mx-auto font-sans bg-[#F8FAFB] dark:bg-[#0F172A]/30 min-h-screen transition-colors">

            {/* Top Bar Area */}
            <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5 mb-6 md:mb-8 gap-4">
                {/* Search Bar */}
                <div className="relative w-full max-w-[450px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search teachers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-100/80 dark:bg-slate-900 border-none rounded-[12px] py-3 pl-12 pr-4 text-[14px] focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-700 dark:text-slate-200 outline-none"
                    />
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <Link to="/admin/teachers/new" className="flex items-center gap-2 bg-[#1D68E3] text-white px-6 py-2.5 rounded-[12px] font-bold text-[14px] shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-colors">
                        <Plus className="h-5 w-5" />
                        <span className="hidden sm:inline">Add Teacher</span>
                        <span className="sm:hidden">Add</span>
                    </Link>
                    <div className="text-right hidden sm:block">
                        <h1 className="text-xl md:text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none mb-1">Faculty</h1>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">Directory</p>
                    </div>
                </div>
            </div>

            {/* Sub-header info */}
            <div className="mb-6 md:mb-8">
                <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 font-medium">Academic staff profiles and assignments.</p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

                {/* Teacher Cards */}
                {filteredTeachers.map((teacher, index) => (
                    <Link to={`/admin/teachers/${teacher.id}`} state={{ from: location.pathname }} key={index} className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-shadow">

                        {/* Image Profile Area */}
                        <div className="h-[200px] relative bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden">
                            {/* Status Badge */}
                            <div className="absolute top-4 right-4 z-10">
                                <span className={`px-2.5 py-1 text-[10px] font-extrabold tracking-widest uppercase rounded-[6px] shadow-sm ${teacher.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}>
                                    {teacher.status}
                                </span>
                            </div>

                            {/* Photo or Placeholder */}
                            {teacher.photo && teacher.photo !== 'https://via.placeholder.com/150' ? (
                                <img src={teacher.photo} alt={teacher.name || 'Teacher'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                                    <GraduationCap className="h-16 w-16 text-blue-200 dark:text-slate-700 mb-2" />
                                    <span className="text-[12px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">{teacher.department || 'N/A'}</span>
                                </div>
                            )}
                        </div>

                        {/* Card Body */}
                        <div className="p-6 pb-5 flex flex-col flex-1">
                            <div className="mb-4">
                                <h3 className="text-[18px] font-bold text-[#0F172A] dark:text-slate-100 mb-0.5 line-clamp-1">{teacher.name}</h3>
                                <p className="text-[12px] font-bold text-[#1D68E3] dark:text-blue-400 uppercase tracking-wide">{teacher.id}</p>
                            </div>

                            <div className="mt-auto">
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-3">
                                    Subjects & Classes
                                </p>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {teacher.subjects.map((subject, i) => (
                                        <span key={i} className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-[8px] text-[11px] font-semibold">
                                            {subject}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Passcode Area */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-[#1D68E3] dark:text-blue-400" />
                                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Passcode</span>
                            </div>

                            {teacher.passcode ? (
                                <div
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        togglePasscode(teacher.id);
                                    }}
                                    title="Click to reveal/hide"
                                >
                                    {showPasscodes[teacher.id] ? (
                                        <span className="text-[14px] font-black text-[#0F172A] dark:text-slate-200 font-mono tracking-wider">
                                            {teacher.passcode}
                                        </span>
                                    ) : (
                                        <span className="text-[14px] font-black text-slate-300 font-mono tracking-[0.15em] leading-none pt-1">
                                            ••••••
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                                    Hidden
                                </div>
                            )}
                        </div>
                        <div className="px-6 pb-5 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    navigate(`/admin/teachers/${teacher.id}/edit`);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                            >
                                <Pencil className="h-3.5 w-3.5" /> Update
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteTeacher(teacher.id);
                                }}
                                disabled={deletingId === teacher.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-60"
                            >
                                {deletingId === teacher.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                Delete
                            </button>
                        </div>
                    </Link>
                ))}

                {/* Register New Faculty Placeholder Card */}
                <Link to="/admin/teachers/new" className="bg-[#F8FAFB] dark:bg-slate-900/40 border-[2px] border-dashed border-slate-200 dark:border-slate-700 rounded-[24px] flex flex-col items-center justify-center min-h-[420px] text-slate-400 group-hover:border-slate-300 dark:group-hover:border-slate-600 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80">
                    <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                        <Plus className="h-6 w-6 text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400" />
                    </div>
                    <span className="text-[14px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Register New Faculty</span>
                </Link>

            </div>

        </div >
    );
};

export default AdminTeachers;
