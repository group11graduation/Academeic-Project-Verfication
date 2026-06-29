import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, Plus, Trash2, ChevronRight,
    Calendar, FileText, Loader2, UserPlus,
} from 'lucide-react';
import teacherService from '../../../services/teacherService';

const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const isPast = (d) => d && new Date(d) < new Date();

function AssignmentCard({ assignment: a, onOpen, onDelete, showDelete }) {
    const isFinal = String(a.assignmentType || 'normal').toLowerCase() === 'final';
    const isMulti =
        (a.classAssignmentMode || ((a.classes || []).length > 1 ? 'multiple' : 'single')) === 'multiple';
    const pastDeadline = isFinal && isPast(a.proposalDeadline);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen();
                }
            }}
            className="group relative flex flex-col rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:border-[#1D68E3]/40 hover:shadow-md cursor-pointer dark:border-slate-700 dark:bg-slate-900"
        >
            <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                            isFinal
                                ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                    >
                        {isFinal ? 'Final' : 'Normal'}
                    </span>
                    {a.isCollaborative && (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                            Collab
                        </span>
                    )}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {a.submissionMode === 'group' ? 'Group' : 'Single'}
                    </span>
                </div>
                {showDelete && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(e);
                        }}
                        className="rounded p-1 text-slate-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                        aria-label="Delete assignment"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            <h3 className="mb-2 line-clamp-2 text-[13px] font-black leading-snug text-slate-900 dark:text-slate-100">
                {a.title}
            </h3>

            <div className="mb-2 flex flex-wrap gap-1">
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-[#1D68E3] dark:bg-blue-500/10">
                    {a.subject?.code || '—'}
                </span>
                {a.semester?.name && (
                    <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {a.semester.name}
                    </span>
                )}
                {isMulti && (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        Multi-class
                    </span>
                )}
            </div>

            <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                {isFinal ? (
                    <span
                        className={`text-[10px] font-bold ${pastDeadline ? 'text-rose-500' : 'text-slate-500'}`}
                    >
                        Proposal {formatDate(a.proposalDeadline)}
                    </span>
                ) : (
                    <span className="text-[10px] font-semibold text-slate-500">File upload</span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#1D68E3]" />
            </div>
        </div>
    );
}

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
                teacherService.getMyClasses(),
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

    const activeClass = classes.find((c) => String(c._id) === String(activeClassId));
    const activeClassAssignments = activeClassId
        ? groupedAssignmentsByClass.get(String(activeClassId)) || []
        : [];
    const activeClassFinalAssignments = activeClassAssignments.filter(
        (a) => String(a.assignmentType || 'normal').toLowerCase() === 'final',
    );
    const activeClassNormalAssignments = activeClassAssignments.filter(
        (a) => String(a.assignmentType || 'normal').toLowerCase() !== 'final',
    );

    if (loading) {
        return (
            <div className="flex min-h-[40vh] flex-col items-center justify-center">
                <Loader2 className="mb-2 h-7 w-7 animate-spin text-[#1D68E3]" />
                <p className="text-[12px] font-medium text-slate-500">Loading assignments...</p>
            </div>
        );
    }

    return (
        <div className="font-sans text-[13px]">
            <div className="mb-3 flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-base font-extrabold leading-none text-slate-900 dark:text-white">
                        Assignments
                    </h1>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                        Proposals first, then project uploads after approval.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {semesterOptions.length > 0 && (
                        <select
                            value={semesterFilter}
                            onChange={(e) => setSemesterFilter(e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <option value="">All semesters</option>
                            {semesterOptions.map(([id, label]) => (
                                <option key={id} value={id}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    )}
                    <button
                        type="button"
                        onClick={() => navigate('/teacher/assignments/collaborative/new')}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700"
                    >
                        <UserPlus className="h-3.5 w-3.5" /> Collab
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/teacher/assignments/new')}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#2a3fa4] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#223688]"
                    >
                        <Plus className="h-3.5 w-3.5" /> New
                    </button>
                </div>
            </div>

            {classes.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-10 dark:border-slate-700 dark:bg-slate-900">
                    <ClipboardList className="mb-2 h-8 w-8 text-blue-400" />
                    <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">No classes assigned yet</h3>
                    <p className="mt-1 text-[11px] text-slate-500">Ask admin to assign classes and subjects first.</p>
                </div>
            ) : (
                <>
                    <div className="mb-3">
                        <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            My classes
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {classes.map((cls) => {
                                const cid = String(cls._id || '');
                                const count = (groupedAssignmentsByClass.get(cid) || []).length;
                                const active = activeClassId === cid;
                                return (
                                    <button
                                        key={cid}
                                        type="button"
                                        onClick={() => setActiveClassId(cid)}
                                        className={`rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                                            active
                                                ? 'border-[#1D68E3] bg-blue-50 text-[#1D68E3] dark:bg-blue-500/10'
                                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                        }`}
                                    >
                                        <span className="block text-[11px] font-black leading-none">{cls.code}</span>
                                        <span className="mt-0.5 block max-w-[140px] truncate text-[9px] font-medium opacity-80">
                                            {count} assignment{count === 1 ? '' : 's'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {activeClass && (
                        <p className="mb-3 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            <span className="font-black text-slate-800 dark:text-slate-200">{activeClass.code}</span>
                            {' — '}
                            {activeClass.title}
                        </p>
                    )}

                    {activeClassAssignments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-10 dark:border-slate-700 dark:bg-slate-900">
                            <FileText className="mb-2 h-7 w-7 text-slate-300" />
                            <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">
                                No assignments in this class
                            </h3>
                            <p className="mt-1 text-[11px] text-slate-500">Use New to create one for this class.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <section>
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        Final assignments
                                    </p>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {activeClassFinalAssignments.length}
                                    </span>
                                </div>
                                {activeClassFinalAssignments.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-900/50">
                                        No final assignments.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                        {activeClassFinalAssignments.map((a) => (
                                            <AssignmentCard
                                                key={a._id}
                                                assignment={a}
                                                onOpen={() => navigate(`/teacher/assignments/${a._id}/proposals`)}
                                                onDelete={(e) => handleDelete(a._id, e)}
                                                showDelete={a.collaborationRole !== 'co-teacher'}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section>
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        Normal assignments
                                    </p>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {activeClassNormalAssignments.length}
                                    </span>
                                </div>
                                {activeClassNormalAssignments.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-900/50">
                                        No normal assignments.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                        {activeClassNormalAssignments.map((a) => (
                                            <AssignmentCard
                                                key={a._id}
                                                assignment={a}
                                                onOpen={() => navigate(`/teacher/assignments/${a._id}/normal-students`)}
                                                onDelete={(e) => handleDelete(a._id, e)}
                                                showDelete
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </>
            )}

            {classes.length > 0 && assignments.length === 0 && (
                <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-center text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                    No assignments yet — click <span className="font-black text-[#1D68E3]">New</span> to start.
                </div>
            )}
        </div>
    );
};

export default Assignments;
