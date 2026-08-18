import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, Upload, Eye, EyeOff, ShieldCheck, Loader2, Pencil, Trash2, Download } from 'lucide-react';
import adminTeacherService from '../../../services/adminTeacherService';
import { usePageSearch } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';
import { appConfirm, appError } from '../../../lib/appDialog';
import { downloadTeacherImportTemplate } from '../../../lib/spreadsheetImport';

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
                    setTeachers(response.data.map(t => {
                        const classesCount = (t.assignedClassCodes || t.assignedClasses || []).length;
                        const subjectsCount = (t.skills || []).length;
                        const progressCount = Math.min(classesCount, subjectsCount || classesCount);
                        const productivity = Math.min(
                            100,
                            Math.round(
                                (t.status === 'ACTIVE' || t.isActive !== false ? 40 : 10) +
                                    classesCount * 12 +
                                    subjectsCount * 8
                            )
                        );
                        return {
                            id: t._id || t.teacherId,
                            name: t.name,
                            status: t.status,
                            subjects: t.skills || [],
                            department: t.department,
                            photo: t.photo,
                            passcode: t.passcode || null,
                            email: t.email,
                            classesCount,
                            subjectsCount,
                            progressCount,
                            productivity,
                        };
                    }));
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
                <Loader2 className="h-7 w-7 text-[#2f4aad] animate-spin mb-2" />
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
                        <Link to="/admin/teachers/new" className="inline-flex items-center gap-1.5 bg-[#2f4aad] text-white px-3 py-1.5 rounded-lg font-bold text-[12px] hover:bg-blue-700 transition-colors whitespace-nowrap">
                            <Plus className="h-3.5 w-3.5" />
                            Add Teacher
                        </Link>
                        <button
                            type="button"
                            onClick={() => {
                                try {
                                    downloadTeacherImportTemplate();
                                } catch (err) {
                                    appError(err.message || 'Could not download template.');
                                }
                            }}
                            className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg font-bold text-[12px] hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors whitespace-nowrap"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Excel template
                        </button>
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

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTeachers.map((teacher) => {
                    const initial = (teacher.name || 'T').trim().slice(0, 1).toUpperCase();
                    const roleLabel =
                        teacher.department ||
                        (teacher.subjects[0] ? String(teacher.subjects[0]) : 'Faculty');
                    const hasPhoto = teacher.photo && teacher.photo !== 'https://via.placeholder.com/150';

                    return (
                        <div
                            key={teacher.id}
                            className="group flex flex-col items-center rounded-[1.35rem] bg-white px-6 pb-5 pt-7 text-center shadow-[0_10px_30px_-18px_rgba(15,23,42,0.28)] ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-18px_rgba(47,74,173,0.35)] dark:bg-slate-900 dark:ring-white/10"
                        >
                            <Link
                                to={`/admin/teachers/${teacher.id}`}
                                state={{ from: location.pathname }}
                                className="flex w-full flex-col items-center"
                            >
                                <div className="relative mb-3">
                                    {hasPhoto ? (
                                        <img
                                            src={teacher.photo}
                                            alt={teacher.name || 'Teacher'}
                                            className="h-[88px] w-[88px] rounded-full object-cover ring-4 ring-[#eef2fb]"
                                        />
                                    ) : (
                                        <div
                                            className="flex h-[88px] w-[88px] items-center justify-center rounded-full text-2xl font-extrabold text-white ring-4 ring-[#eef2fb]"
                                            style={{ background: 'linear-gradient(145deg, #6b84d4 0%, #2f4aad 100%)' }}
                                        >
                                            {initial}
                                        </div>
                                    )}
                                    <span
                                        className={`absolute -bottom-0.5 right-0 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide ring-2 ring-white ${
                                            teacher.status === 'ACTIVE'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}
                                    >
                                        {teacher.status === 'ACTIVE' ? 'On' : 'Off'}
                                    </span>
                                </div>

                                <h3 className="max-w-full truncate text-[15px] font-extrabold tracking-tight text-[#1e293b] dark:text-slate-100">
                                    {teacher.name}
                                </h3>
                                <p className="mt-0.5 max-w-full truncate text-[12px] font-medium text-slate-400">
                                    {roleLabel}
                                </p>

                                <div className="mt-5 grid w-full grid-cols-3 gap-2 border-t border-slate-100 pt-4 dark:border-white/10">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Classes</p>
                                        <p className="mt-1 text-[17px] font-extrabold text-[#1e293b] dark:text-slate-100">
                                            {teacher.classesCount}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Subjects</p>
                                        <p className="mt-1 text-[17px] font-extrabold text-[#1e293b] dark:text-slate-100">
                                            {teacher.subjectsCount}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Progress</p>
                                        <p className="mt-1 text-[17px] font-extrabold text-[#1e293b] dark:text-slate-100">
                                            {teacher.progressCount}
                                        </p>
                                    </div>
                                </div>

                                <p className="mt-4 text-[12px] font-bold text-[#2f4aad]">
                                    Productivity: {teacher.productivity}%
                                </p>
                                <div className="mt-2 h-1.5 w-[85%] overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                                    <div
                                        className="h-full rounded-full bg-[#2f4aad] transition-[width]"
                                        style={{ width: `${teacher.productivity}%` }}
                                    />
                                </div>
                            </Link>

                            <div className="mt-4 flex w-full items-center justify-center gap-1.5 border-t border-slate-100 pt-3 dark:border-white/10">
                                {teacher.passcode ? (
                                    <button
                                        type="button"
                                        onClick={() => togglePasscode(teacher.id)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                        title="Toggle passcode"
                                    >
                                        <ShieldCheck className="h-3 w-3 text-[#2f4aad]" />
                                        {showPasscodes[teacher.id] ? teacher.passcode : '••••••'}
                                        {showPasscodes[teacher.id] ? (
                                            <EyeOff className="h-3 w-3 text-slate-400" />
                                        ) : (
                                            <Eye className="h-3 w-3 text-slate-400" />
                                        )}
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => navigate(`/admin/teachers/${teacher.id}/edit`)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    <Pencil className="h-3 w-3" /> Update
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteTeacher(teacher.id)}
                                    disabled={deletingId === teacher.id}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-60"
                                >
                                    {deletingId === teacher.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-3 w-3" />
                                    )}
                                    Delete
                                </button>
                            </div>
                        </div>
                    );
                })}

                <Link
                    to="/admin/teachers/new"
                    className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.35rem] border-2 border-dashed border-slate-200 bg-[#F8FAFB] text-slate-400 transition hover:border-[#2f4aad]/40 hover:bg-white dark:border-slate-700 dark:bg-slate-900/40"
                >
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm dark:bg-slate-800">
                        <Plus className="h-5 w-5 text-slate-400" />
                    </div>
                    <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">Register New Faculty</span>
                </Link>
            </div>
        </div>
    );
};

export default AdminTeachers;
