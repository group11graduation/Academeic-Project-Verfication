import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';
import {
    ClipboardList, Plus, Trash2, ChevronRight,
    Calendar, FileText, Loader2, UserPlus, Settings2,
} from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { useShellSearchFilter } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';

const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

const isPast = (d) => d && new Date(d) < new Date();

function AssignmentCard({ assignment: a, onOpen, onEdit, onDelete, showDelete }) {
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
            className="group relative flex flex-col rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:border-[#2f4aad]/40 hover:shadow-md cursor-pointer dark:border-slate-700 dark:bg-slate-900"
        >
            <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                            isFinal
                                ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                    >
                        {isFinal ? 'Final' : 'Normal'}
                    </span>
                    {a.isCollaborative && (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                            Collab
                        </span>
                    )}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {a.submissionMode === 'group' ? 'Group' : 'Single'}
                    </span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                {onEdit && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(e);
                        }}
                        className="rounded p-1 text-slate-400 opacity-0 transition-all hover:bg-blue-50 hover:text-[#2f4aad] group-hover:opacity-100"
                        aria-label="Edit assignment settings"
                        title="Edit assignment"
                    >
                        <Settings2 className="h-3.5 w-3.5" />
                    </button>
                )}
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
            </div>

            <h3 className="mb-2 line-clamp-2 text-[13px] font-bold leading-snug text-slate-900 dark:text-slate-100">
                {a.title}
            </h3>

            <div className="mb-2 flex flex-wrap gap-1">
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-[#2f4aad] dark:bg-blue-500/10">
                    {a.subject?.code || '-'}
                </span>
                {a.isCollaborative && a.collaborationReviewRole && (
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                        Your role: {a.collaborationReviewRole}
                    </span>
                )}
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
                <ChevronRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#2f4aad]" />
            </div>
        </div>
    );
}

const Assignments = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [assignments, setAssignments] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeClassId, setActiveClassId] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [semesterFilter, setSemesterFilter] = useState('');
    const [collabPendingCount, setCollabPendingCount] = useState(0);
    const searchQuery = useShellSearchFilter('Search assignments by title or subject…');

    const fetchData = async () => {
        try {
            const [aRes, cRes, collabCountRes] = await Promise.all([
                teacherService.getMyAssignments(),
                teacherService.getMyClasses(),
                teacherService.getCollaborationPendingCount().catch(() => ({ success: false })),
            ]);
            if (aRes.success) setAssignments(aRes.data || []);
            if (cRes.success) {
                const rows = cRes.data || [];
                setClasses(rows);
                const fromUrl = String(searchParams.get('classId') || '').trim();
                const urlMatch = fromUrl && rows.some((c) => String(c._id) === fromUrl);
                if (urlMatch) setActiveClassId(fromUrl);
                else if (rows.length) setActiveClassId(String(rows[0]._id || ''));
            }
            if (collabCountRes?.success) {
                setCollabPendingCount(Number(collabCountRes.data?.count || 0));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [location.pathname]);

    // Keep class tab in sync when navigating back via breadcrumb (?classId=…)
    useEffect(() => {
        const fromUrl = String(searchParams.get('classId') || '').trim();
        if (!fromUrl || !classes.length) return;
        if (classes.some((c) => String(c._id) === fromUrl)) {
            setActiveClassId(fromUrl);
        }
    }, [searchParams, classes]);

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        const target = assignments.find((a) => String(a._id) === String(id));
        if (target?.hasSubmissions || target?.canDelete === false) {
            await appWarning(
                'This assignment already has proposals or project submissions, so it cannot be deleted.'
            );
            return;
        }
        if (!(await appConfirm({
            message: 'Delete this assignment? Only empty assignments with no student submissions can be deleted.',
            danger: true,
            confirmLabel: 'Delete',
        }))) return;
        try {
            await teacherService.deleteAssignment(id);
            setAssignments((prev) => prev.filter((a) => a._id !== id));
            await appSuccess('Assignment deleted.');
        } catch (err) {
            console.error(err);
            await appError(err.response?.data?.message || 'Delete not available.');
        }
    };

    const yearOptions = useMemo(() => {
        const m = new Map();
        for (const cls of classes) {
            const id = cls.academicYear?._id || cls.academicYear;
            const label = cls.academicYearLabel || cls.academicYear?.label;
            if (!id || !label) continue;
            const start = cls.academicYear?.startDate
                ? new Date(cls.academicYear.startDate).getTime()
                : 0;
            m.set(String(id), { label: String(label), start });
        }
        for (const a of assignments) {
            const id = a.academicYear?._id || a.academicYear;
            const label = a.academicYear?.label;
            if (!id || !label || m.has(String(id))) continue;
            m.set(String(id), { label: String(label), start: 0 });
        }
        return Array.from(m.entries())
            .sort((a, b) => {
                if (a[1].start !== b[1].start) return b[1].start - a[1].start;
                return String(b[1].label).localeCompare(String(a[1].label));
            })
            .map(([id, meta]) => [id, meta.label]);
    }, [classes, assignments]);

    const filteredClasses = useMemo(() => {
        if (!yearFilter) return classes;
        return classes.filter(
            (cls) => String(cls.academicYear?._id || cls.academicYear || '') === String(yearFilter)
        );
    }, [classes, yearFilter]);

    const assignmentsFilteredByTerm = useMemo(() => {
        return assignments.filter((a) => {
            if (yearFilter) {
                const yearId = String(a.academicYear?._id || a.academicYear || '');
                if (yearId !== String(yearFilter)) return false;
            }
            if (semesterFilter) {
                const semId = String(a.semester?._id || a.semester || '');
                if (semId !== String(semesterFilter)) return false;
            }
            return true;
        });
    }, [assignments, yearFilter, semesterFilter]);

    const semesterOptions = useMemo(() => {
        const m = new Map();
        const source = yearFilter
            ? assignments.filter(
                  (a) => String(a.academicYear?._id || a.academicYear || '') === String(yearFilter)
              )
            : assignments;
        for (const a of source) {
            const id = a.semester?._id || a.semester;
            const name = a.semester?.name;
            if (id) m.set(String(id), name || 'Semester');
        }
        for (const cls of filteredClasses) {
            const id = cls.semester?._id || cls.semester;
            const name = cls.semesterLabel || cls.semester?.name;
            if (id && !m.has(String(id))) m.set(String(id), name || 'Semester');
        }
        return Array.from(m.entries());
    }, [assignments, yearFilter, filteredClasses]);

    // Drop invalid semester selection when year changes
    useEffect(() => {
        if (!semesterFilter) return;
        if (!semesterOptions.some(([id]) => id === String(semesterFilter))) {
            setSemesterFilter('');
        }
    }, [semesterOptions, semesterFilter]);

    // Keep active class inside the filtered year set
    useEffect(() => {
        if (!filteredClasses.length) {
            if (activeClassId) setActiveClassId('');
            return;
        }
        const stillVisible = filteredClasses.some((c) => String(c._id) === String(activeClassId));
        if (!stillVisible) {
            const nextId = String(filteredClasses[0]._id || '');
            setActiveClassId(nextId);
            const next = new URLSearchParams(searchParams);
            if (nextId) next.set('classId', nextId);
            else next.delete('classId');
            navigate(
                { pathname: '/teacher/assignments', search: next.toString() ? `?${next}` : '' },
                { replace: true }
            );
        }
    }, [filteredClasses, activeClassId, navigate, searchParams]);

    const classesGroupedByTerm = useMemo(() => {
        const groups = new Map();
        for (const cls of filteredClasses) {
            const yearId = String(cls.academicYear?._id || cls.academicYear || 'none');
            const semId = String(cls.semester?._id || cls.semester || 'none');
            const key = `${yearId}|${semId}`;
            if (!groups.has(key)) {
                const yearLabel = cls.academicYearLabel || cls.academicYear?.label || '';
                const semesterLabel = cls.semesterLabel || cls.semester?.name || '';
                const semesterOrder = Number(cls.semester?.order) || 0;
                const yearStart = cls.academicYear?.startDate
                    ? new Date(cls.academicYear.startDate).getTime()
                    : 0;
                groups.set(key, {
                    key,
                    yearLabel,
                    semesterLabel,
                    semesterOrder,
                    yearStart,
                    heading:
                        yearLabel && semesterLabel
                            ? `${yearLabel} · ${semesterLabel}`
                            : yearLabel || semesterLabel || 'Unassigned term',
                    classes: [],
                });
            }
            groups.get(key).classes.push(cls);
        }
        return Array.from(groups.values()).sort((a, b) => {
            if (a.yearStart !== b.yearStart) return b.yearStart - a.yearStart;
            const yearCmp = String(b.yearLabel || '').localeCompare(String(a.yearLabel || ''));
            if (yearCmp) return yearCmp;
            if (a.semesterOrder !== b.semesterOrder) return a.semesterOrder - b.semesterOrder;
            return String(a.semesterLabel || '').localeCompare(String(b.semesterLabel || ''));
        });
    }, [filteredClasses]);

    const groupedAssignmentsByClass = useMemo(() => {
        const map = new Map();
        for (const cls of filteredClasses) map.set(String(cls._id), []);
        for (const a of assignmentsFilteredByTerm) {
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
    }, [assignmentsFilteredByTerm, filteredClasses]);

    const activeClass = filteredClasses.find((c) => String(c._id) === String(activeClassId));

    const selectClassTab = (cid) => {
        const id = String(cid || '');
        setActiveClassId(id);
        const next = new URLSearchParams(searchParams);
        if (id) next.set('classId', id);
        else next.delete('classId');
        navigate({ pathname: '/teacher/assignments', search: next.toString() ? `?${next}` : '' }, { replace: true });
    };
    const rawActiveClassAssignments = activeClassId
        ? groupedAssignmentsByClass.get(String(activeClassId)) || []
        : [];
    const activeClassAssignments = useMemo(() => {
        return rawActiveClassAssignments.filter((a) =>
            matchesSearchQuery(searchQuery, a.title, a.subject?.code, a.subject?.name, a.semester?.name)
        );
    }, [rawActiveClassAssignments, searchQuery]);
    const activeClassFinalAssignments = activeClassAssignments.filter(
        (a) => String(a.assignmentType || 'normal').toLowerCase() === 'final',
    );
    const activeClassNormalAssignments = activeClassAssignments.filter(
        (a) => String(a.assignmentType || 'normal').toLowerCase() !== 'final',
    );

    if (loading) {
        return (
            <div className="flex min-h-[40vh] flex-col items-center justify-center">
                <Loader2 className="mb-2 h-7 w-7 animate-spin text-[#2f4aad]" />
                <p className="text-[12px] font-medium text-slate-500">Loading assignments...</p>
            </div>
        );
    }

    return (
        <div className="text-[13px] antialiased [font-family:var(--sv-font-sans)]">
            <div className="mb-3 flex flex-col gap-3 border-b border-[#d5dcf0] pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-[1.15rem] font-bold leading-[1.2] tracking-tight text-[#2f4aad] sm:text-[1.25rem]">
                        Assignments
                    </h1>
                    <p className="mt-0.5 text-[12px] font-normal text-[#647092]">
                        Proposals first, then project uploads after approval.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {yearOptions.length > 0 && (
                        <select
                            value={yearFilter}
                            onChange={(e) => {
                                setYearFilter(e.target.value);
                                setSemesterFilter('');
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <option value="">All years</option>
                            {yearOptions.map(([id, label]) => (
                                <option key={id} value={id}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    )}
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
                        className="relative inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700"
                    >
                        <UserPlus className="h-3.5 w-3.5" /> Collab
                        {collabPendingCount > 0 && (
                            <span
                                className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900"
                                title={`${collabPendingCount} pending collaboration request${collabPendingCount === 1 ? '' : 's'}`}
                            >
                                {collabPendingCount > 9 ? '9+' : collabPendingCount}
                            </span>
                        )}
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
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">No classes assigned yet</h3>
                    <p className="mt-1 text-[11px] text-slate-500">Ask admin to assign classes and subjects first.</p>
                </div>
            ) : filteredClasses.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-10 dark:border-slate-700 dark:bg-slate-900">
                    <ClipboardList className="mb-2 h-8 w-8 text-slate-300" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">No classes in this year</h3>
                    <p className="mt-1 text-[11px] text-slate-500">Try another year or clear the year filter.</p>
                </div>
            ) : (
                <>
                    <div className="mb-3 space-y-3">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                            My classes
                        </p>
                        {classesGroupedByTerm.map((group) => (
                            <div key={group.key}>
                                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                    {group.heading}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {group.classes.map((cls) => {
                                        const cid = String(cls._id || '');
                                        const count = (groupedAssignmentsByClass.get(cid) || []).length;
                                        const active = activeClassId === cid;
                                        return (
                                            <button
                                                key={cid}
                                                type="button"
                                                onClick={() => selectClassTab(cid)}
                                                className={`rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                                                    active
                                                        ? 'border-[#2f4aad] bg-blue-50 text-[#2f4aad] dark:bg-blue-500/10'
                                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                                }`}
                                            >
                                                <span className="block text-[11px] font-bold leading-none">{cls.code}</span>
                                                <span className="mt-0.5 block max-w-[140px] truncate text-[9px] font-medium opacity-80">
                                                    {count} assignment{count === 1 ? '' : 's'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {activeClass && (
                        <p className="mb-3 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{activeClass.code}</span>
                            {' - '}
                            {activeClass.title}
                        </p>
                    )}

                    {activeClassAssignments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-10 dark:border-slate-700 dark:bg-slate-900">
                            <FileText className="mb-2 h-7 w-7 text-slate-300" />
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                {rawActiveClassAssignments.length > 0 && searchQuery.trim()
                                    ? 'No assignments match your search'
                                    : 'No assignments in this class'}
                            </h3>
                            <p className="mt-1 text-[11px] text-slate-500">
                                {rawActiveClassAssignments.length > 0 && searchQuery.trim()
                                    ? 'Try a different title or subject code.'
                                    : 'Use New to create one for this class.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <section>
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
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
                                                onEdit={() => navigate(`/teacher/assignments/${a._id}/edit`)}
                                                onDelete={(e) => handleDelete(a._id, e)}
                                                showDelete={a.collaborationRole !== 'co-teacher' && a.canDelete !== false && !a.hasSubmissions}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section>
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
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
                                                onEdit={() => navigate(`/teacher/assignments/${a._id}/edit`)}
                                                onDelete={(e) => handleDelete(a._id, e)}
                                                showDelete={a.collaborationRole !== 'co-teacher' && a.canDelete !== false && !a.hasSubmissions}
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
                    No assignments yet - click <span className="font-bold text-[#2f4aad]">New</span> to start.
                </div>
            )}
        </div>
    );
};

export default Assignments;
