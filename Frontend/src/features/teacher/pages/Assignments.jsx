import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, Plus, Trash2, ChevronRight, ChevronDown,
    Calendar, Users, FileText, Loader2,
    Clock, BookOpen
} from 'lucide-react';
import teacherService from '../../../services/teacherService';

const Assignments = () => {
    const navigate = useNavigate();
    const [assignments, setAssignments] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeClassId, setActiveClassId] = useState('');
    const [semesterFilter, setSemesterFilter] = useState('');

    const fetchData = async () => {
        try {
            const [aRes, cRes] = await Promise.all([
                teacherService.getMyAssignments(),
                teacherService.getMyClasses()
            ]);
            if (aRes.success) setAssignments(aRes.data || []);
            if (cRes.success) {
                const rows = cRes.data || [];
                setClasses(rows);
                if (rows.length) setActiveClassId(String(rows[0]._id || ''));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Delete this assignment?')) return;
        try {
            await teacherService.deleteAssignment(id);
            setAssignments((prev) => prev.filter((a) => a._id !== id));
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Delete not available.');
        }
    };

    const formatDate = (d) =>
        d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const isPast = (d) => d && new Date(d) < new Date();

    const assignmentsFilteredBySemester = useMemo(() => {
        if (!semesterFilter) return assignments;
        return assignments.filter((a) => String(a.semester?._id || a.semester) === String(semesterFilter));
    }, [assignments, semesterFilter]);

    const semesterOptions = useMemo(() => {
        const m = new Map();
        for (const a of assignments) {
            const id = a.semester?._id || a.semester;
            const name = a.semester?.name;
            if (id) m.set(String(id), name || 'Semester');
        }
        return Array.from(m.entries());
    }, [assignments]);

    const groupedAssignmentsByClass = useMemo(() => {
        const map = new Map();
        for (const cls of classes) map.set(String(cls._id), []);
        for (const a of assignmentsFilteredBySemester) {
            const classIds = Array.isArray(a.classes) && a.classes.length
                ? a.classes.map((c) => String(c?._id || c))
                : a.class?._id
                    ? [String(a.class._id)]
                    : [];
            for (const cid of classIds) {
                if (map.has(cid)) map.get(cid).push(a);
            }
        }
        return map;
    }, [assignmentsFilteredBySemester, classes]);

    const activeClassAssignments = activeClassId ? (groupedAssignmentsByClass.get(String(activeClassId)) || []) : [];
    const activeClassFinalAssignments = activeClassAssignments.filter(
        (a) => String(a.assignmentType || 'normal').toLowerCase() === 'final'
    );
    const activeClassNormalAssignments = activeClassAssignments.filter(
        (a) => String(a.assignmentType || 'normal').toLowerCase() !== 'final'
    );

    if (loading)
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B1120]">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );

    return (
        <div className="p-4 md:p-10 max-w-[1400px] mx-auto min-h-screen">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-12 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 mb-1 tracking-tight">
                        Assignments
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">
                        Create assignments per term; students submit proposals, then projects after approval.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                    {semesterOptions.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                            <select
                                value={semesterFilter}
                                onChange={(e) => setSemesterFilter(e.target.value)}
                                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[180px]"
                            >
                                <option value="">All semesters</option>
                                {semesterOptions.map(([id, label]) => (
                                    <option key={id} value={id}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                <button
                    onClick={() => navigate('/teacher/assignments/new')}
                    className="flex items-center justify-center gap-2 bg-[#2a3fa4] text-white font-bold text-sm px-5 py-3 rounded-2xl hover:bg-[#223688] transition-all shadow-lg"
                >
                    <Plus className="h-4 w-4" /> New Assignment
                </button>
                </div>
            </header>

            {classes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-[#0F172A] rounded-[32px] border border-dashed border-slate-200 dark:border-white/5">
                    <div className="bg-blue-500/10 p-5 rounded-full mb-4">
                        <ClipboardList className="h-10 w-10 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-black text-slate-700 dark:text-slate-200 mb-1">No classes assigned yet</h3>
                    <p className="text-slate-500 text-sm mb-6">Ask admin to assign classes and subjects first.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="lg:col-span-1 rounded-[24px] border border-slate-200 bg-white p-4 h-fit">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">My Classes</p>
                        <div className="space-y-2">
                            {classes.map((cls) => {
                                const cid = String(cls._id || '');
                                const classAssignments = groupedAssignmentsByClass.get(cid) || [];
                                const hasMultipleMode = classAssignments.some((a) => (a.classAssignmentMode || 'single') === 'multiple');
                                return (
                                    <button
                                        key={cid}
                                        type="button"
                                        onClick={() => setActiveClassId(cid)}
                                        className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                                            activeClassId === cid
                                                ? 'border-[#1D68E3] bg-blue-50/60'
                                                : 'border-slate-200 hover:border-slate-300 bg-white'
                                        }`}
                                    >
                                        <p className="text-sm font-black text-slate-800">{cls.code} - {cls.title}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {classAssignments.length} assignment{classAssignments.length === 1 ? '' : 's'} · {hasMultipleMode ? 'has multiple-class assignments' : 'single-class assignments'}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        {activeClassAssignments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-[#0F172A] rounded-[32px] border border-dashed border-slate-200 dark:border-white/5">
                                <div className="bg-blue-500/10 p-5 rounded-full mb-4">
                                    <ClipboardList className="h-10 w-10 text-blue-400" />
                                </div>
                                <h3 className="text-lg font-black text-slate-700 dark:text-slate-200 mb-1">No assignments in this class</h3>
                                <p className="text-slate-500 text-sm mb-6">Create assignment for this class from New Assignment.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Final assignments</p>
                                    <div className="grid grid-cols-1 gap-4">
                                        {activeClassFinalAssignments.length === 0 && (
                                            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
                                                No final assignments in this class.
                                            </div>
                                        )}
                                        {activeClassFinalAssignments.map((a) => {
                                            const classLabel =
                                                (Array.isArray(a.classNames) && a.classNames.length > 0 && a.classNames.join(', ')) ||
                                                (Array.isArray(a.assignedClasses) && a.assignedClasses.length > 0 && a.assignedClasses.join(', ')) ||
                                                a.class?.code || a.class?.name || 'Class';
                                            return (
                                            <div
                                                key={a._id}
                                                onClick={() => navigate(`/teacher/assignments/${a._id}/proposals`)}
                                                className="group bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 rounded-[24px] p-6 flex flex-col md:flex-row md:items-center gap-4 hover:border-blue-500/30 hover:shadow-xl transition-all cursor-pointer"
                                            >
                                                <div className="bg-blue-500/10 p-4 rounded-2xl self-start">
                                                    <FileText className="h-6 w-6 text-blue-400" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-base truncate mb-1">
                                                        {a.title}
                                                    </h3>
                                                    <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                                                        <span className="flex items-center gap-1">
                                                            <BookOpen className="h-3.5 w-3.5" />
                                                            {a.subject?.name || '—'} ({a.subject?.code})
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Users className="h-3.5 w-3.5" />
                                                            {classLabel}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            {a.submissionMode === 'group' ? 'Group' : 'Single'}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-300">
                                                            <Calendar className="h-3.5 w-3.5" />
                                                            {a.semester?.name || 'Semester'}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <ChevronDown className="h-3.5 w-3.5" />
                                                            {(a.classAssignmentMode || ((a.classes || []).length > 1 ? 'multiple' : 'single')) === 'multiple'
                                                                ? 'Multiple Classes'
                                                                : 'Single Class'}
                                                        </span>
                                                        <span
                                                            className={`flex items-center gap-1 ${isPast(a.proposalDeadline) ? 'text-rose-400' : 'text-slate-500'}`}
                                                        >
                                                            <Calendar className="h-3.5 w-3.5" />
                                                            Proposal: {formatDate(a.proposalDeadline)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={(e) => handleDelete(a._id, e)}
                                                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                    <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Normal assignments</p>
                                    <div className="grid grid-cols-1 gap-4">
                                        {activeClassNormalAssignments.length === 0 && (
                                            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
                                                No normal assignments in this class.
                                            </div>
                                        )}
                                        {activeClassNormalAssignments.map((a) => {
                                    const classLabel =
                                        (Array.isArray(a.classNames) && a.classNames.length > 0 && a.classNames.join(', ')) ||
                                        (Array.isArray(a.assignedClasses) && a.assignedClasses.length > 0 && a.assignedClasses.join(', ')) ||
                                        a.class?.code || a.class?.name || 'Class';
                                    return (
                                    <div
                                        key={a._id}
                                        onClick={() => navigate(`/teacher/assignments/${a._id}/normal-students`)}
                                        className="group bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 rounded-[24px] p-6 flex flex-col md:flex-row md:items-center gap-4 hover:border-blue-500/30 hover:shadow-xl transition-all cursor-pointer"
                                    >
                                        <div className="bg-blue-500/10 p-4 rounded-2xl self-start">
                                            <FileText className="h-6 w-6 text-blue-400" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-slate-800 dark:text-slate-100 text-base truncate mb-1">
                                                {a.title}
                                            </h3>
                                            <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <BookOpen className="h-3.5 w-3.5" />
                                                    {a.subject?.name || '—'} ({a.subject?.code})
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Users className="h-3.5 w-3.5" />
                                                    {classLabel}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {a.submissionMode === 'group' ? 'Group' : 'Single'}
                                                </span>
                                                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-300">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {a.semester?.name || 'Semester'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                    {(a.classAssignmentMode || ((a.classes || []).length > 1 ? 'multiple' : 'single')) === 'multiple'
                                                        ? 'Multiple Classes'
                                                        : 'Single Class'}
                                                </span>
                                                <span className="flex items-center gap-1 text-slate-500">
                                                    <FileText className="h-3.5 w-3.5" />
                                                    File upload — open student list
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={(e) => handleDelete(a._id, e)}
                                                className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                            <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                    );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {classes.length > 0 && assignments.length === 0 && (
                <div className="mt-5 flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
                    No assignments created yet. Click <span className="mx-1 text-[#1D68E3]">New Assignment</span> to start.
                </div>
            )}
        </div>
    );
};

export default Assignments;
