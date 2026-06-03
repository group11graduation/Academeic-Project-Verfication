import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import studentService from '../../../services/studentService';
import { getApiOrigin } from '../../../lib/api';
import {
    FileText,
    Calendar,
    CheckCircle2,
    AlertCircle,
    Download,
    User,
    Loader2,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Rocket,
    Search,
} from 'lucide-react';
import { Z_PAGE, Z_INNER, Z_CARD, Z_INPUT, Z_LINK } from '../../../shared/ui/zendentaLayout';

const StudentAssignments = () => {
    const [rows, setRows] = useState([]);
    const [studentInfo, setStudentInfo] = useState(null);
    const [enrolledSubjects, setEnrolledSubjects] = useState([]);
    const [studentMeta, setStudentMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [query, setQuery] = useState('');

    useEffect(() => {
        const fetchAssignments = async () => {
            try {
                const response = await studentService.getAssignments();
                if (response.success) {
                    const raw = response.data;
                    const list = Array.isArray(raw) ? raw : raw?.assignments || [];
                    setRows(list);
                    setStudentInfo(raw?.class || list[0]?.assignment?.class || null);
                    setEnrolledSubjects(Array.isArray(raw?.subjects) ? raw.subjects : []);
                    setStudentMeta(raw?.student || null);
                }
            } catch (err) {
                console.error('Error fetching assignments:', err);
                setError('Failed to load assignments');
            } finally {
                setLoading(false);
            }
        };
        fetchAssignments();
    }, []);

    const isFinalProjectAssignment = (row) => {
        const a = row?.assignment || {};
        if (String(a.assignmentType || '').toLowerCase() === 'final') return true;
        if (String(a.assignmentType || '').toLowerCase() === 'normal') return false;
        const text = `${a.title || ''} ${a.description || ''}`.toLowerCase();
        return Boolean(
            a.projectPhaseOpen ||
                text.includes('final project') ||
                text.includes('capstone') ||
                text.includes('graduation project')
        );
    };

    const subjects = useMemo(() => {
        if (enrolledSubjects.length > 0) {
            const teacherBySubject = new Map();
            for (const r of rows) {
                const sid = String(r?.assignment?.subject?._id || '');
                const teacherName = r?.assignment?.teacher?.name;
                if (sid && teacherName && !teacherBySubject.has(sid)) {
                    teacherBySubject.set(sid, teacherName);
                }
            }
            return enrolledSubjects.map((s) => ({
                _id: String(s._id),
                name: s.name || 'Subject',
                code: s.code || 'N/A',
                teacher: teacherBySubject.get(String(s._id)) || 'Teacher',
            }));
        }

        const map = new Map();
        for (const r of rows) {
            const s = r?.assignment?.subject;
            if (s?._id && !map.has(String(s._id))) {
                map.set(String(s._id), {
                    _id: String(s._id),
                    name: s.name || 'Subject',
                    code: s.code || 'N/A',
                    teacher: r?.assignment?.teacher?.name || 'Teacher',
                });
            }
        }
        return Array.from(map.values());
    }, [rows, enrolledSubjects]);

    const subjectsFiltered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return subjects;
        return subjects.filter((s) => `${s.name} ${s.code} ${s.teacher}`.toLowerCase().includes(q));
    }, [subjects, query]);

    const rowsForSubject = useMemo(() => {
        if (!selectedSubjectId) return [];
        return rows.filter((r) => String(r?.assignment?.subject?._id) === String(selectedSubjectId));
    }, [rows, selectedSubjectId]);

    const finalRows = useMemo(() => rowsForSubject.filter(isFinalProjectAssignment), [rowsForSubject]);
    const normalRows = useMemo(() => rowsForSubject.filter((r) => !isFinalProjectAssignment(r)), [rowsForSubject]);
    const displayedRows = selectedCategory === 'final' ? finalRows : selectedCategory === 'normal' ? normalRows : [];
    const selectedSubject = subjects.find((s) => String(s._id) === String(selectedSubjectId));

    const displayedRowsFiltered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return displayedRows;
        return displayedRows.filter((r) => {
            const a = r.assignment || {};
            const hay = `${a.title || ''} ${a.teacher?.name || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [displayedRows, query]);

    const getSubjectStats = (subjectId) => {
        const subRows = rows.filter((r) => String(r?.assignment?.subject?._id) === String(subjectId));
        const submitted = subRows.filter((r) => {
            if (String(r?.assignment?.assignmentType || 'normal') === 'normal') {
                return Boolean(r?.latestNormalSubmission);
            }
            return Boolean(r?.latestProjectSubmission);
        }).length;
        const finals = subRows.filter((r) => isFinalProjectAssignment(r)).length;
        const total = subRows.length;
        return { total, submitted, pending: total - submitted, finals };
    };

    const getDeadlineStatus = (deadline) => {
        if (!deadline) return { label: 'No deadline', color: 'text-slate-500', bg: 'bg-slate-100' };
        const now = new Date();
        const dl = new Date(deadline);
        const diff = dl - now;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

        if (days < 0) return { label: 'Overdue', color: 'text-rose-700', bg: 'bg-rose-50' };
        if (days <= 3) return { label: `${days}d left`, color: 'text-amber-700', bg: 'bg-amber-50' };
        return { label: `${days}d left`, color: 'text-emerald-700', bg: 'bg-emerald-50' };
    };

    const getProposalStatusLabel = (row) => {
        const status = row?.proposal?.status || 'not_submitted';
        if (status === 'teacher_approved') return 'Proposal accepted';
        if (status === 'pending_teacher_approval' || status === 'submitted' || status === 'pending') {
            return 'Pending teacher';
        }
        if (status === 'ai_rejected_same_semester') return 'Rejected (AI)';
        if (status === 'requirements_rejected') return 'Rejected (requirements)';
        if (status === 'ai_flagged_previous_semester') return 'Needs update';
        if (status === 'teacher_rejected') return 'Rejected (teacher)';
        return 'No proposal';
    };

    const getSubmissionDeadline = (a) => a?.projectDeadline || a?.proposalDeadline || null;
    const canOpenProjectUpload = (row) => {
        if (String(row?.assignment?.assignmentType || 'normal') === 'normal') {
            return false;
        }
        const proposalStatus = row?.proposal?.status;
        return Boolean(
            row?.latestProjectSubmission ||
                proposalStatus === 'teacher_approved' ||
                (row?.projectSubmissionAllowed && proposalStatus === 'teacher_approved')
        );
    };
    const isProjectSubmitted = (row) => {
        if (String(row?.assignment?.assignmentType || 'normal') === 'normal') {
            return Boolean(row?.latestNormalSubmission);
        }
        return Boolean(row?.latestProjectSubmission);
    };
    const submittedCount = displayedRowsFiltered.filter((r) => isProjectSubmitted(r)).length;
    const pendingCount = displayedRowsFiltered.length - submittedCount;

    if (loading) {
        return (
            <div className={`${Z_PAGE} flex flex-1 items-center justify-center`}>
                <Loader2 className="h-10 w-10 animate-spin text-[#1e56e3]" />
            </div>
        );
    }

    return (
        <div className={`${Z_PAGE} flex min-h-full flex-1 flex-col`}>
            <div className={`${Z_INNER} flex-1`}>
                <nav className="mb-4 flex flex-wrap items-center gap-1 text-[13px] font-semibold text-slate-500">
                    <Link to="/student" className={Z_LINK}>
                        Dashboard
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="text-slate-800">Assignments</span>
                    {selectedSubjectId ? (
                        <>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedSubjectId(null);
                                    setSelectedCategory(null);
                                    setQuery('');
                                }}
                                className={`${Z_LINK} max-w-[10rem] truncate sm:max-w-xs`}
                            >
                                {selectedSubject?.name || 'Subject'}
                            </button>
                        </>
                    ) : null}
                    {selectedCategory ? (
                        <>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="text-slate-800">
                                {selectedCategory === 'final' ? 'Final projects' : 'Normal assignments'}
                            </span>
                        </>
                    ) : null}
                </nav>

                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="mb-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                {new Date().getFullYear()}
                            </span>
                            {studentInfo?.code ? (
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1e56e3]">
                                    Class {studentInfo.code}
                                </span>
                            ) : null}
                        </div>
                        {!selectedSubjectId ? (
                            <>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Your modules</h1>
                                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                                    Select a subject, then choose final projects or normal assignments.
                                </p>
                                {studentMeta?.name ? (
                                    <p className="mt-2 text-sm text-slate-500">
                                        Signed in as <span className="font-semibold text-slate-800">{studentMeta.name}</span>
                                    </p>
                                ) : null}
                            </>
                        ) : !selectedCategory ? (
                            <div className="flex items-start gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedSubjectId(null);
                                        setQuery('');
                                    }}
                                    className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                                        {selectedSubject?.name}
                                    </h1>
                                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Choose category
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategory(null);
                                        setQuery('');
                                    }}
                                    className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                                        {selectedCategory === 'final' ? 'Final projects' : 'Normal assignments'}
                                    </h1>
                                    <p className="mt-1 text-sm text-slate-600">
                                        {selectedCategory === 'final'
                                            ? 'Proposal, AI checks, teacher approval, then project ZIP.'
                                            : 'Upload your work for each task.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    {(selectedSubjectId && selectedCategory) || !selectedSubjectId ? (
                        <div className="relative w-full md:max-w-sm">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={
                                    !selectedSubjectId
                                        ? 'Search modules…'
                                        : !selectedCategory
                                          ? ''
                                          : 'Search assignments…'
                                }
                                className={`${Z_INPUT} pl-10`}
                                disabled={Boolean(selectedSubjectId && !selectedCategory)}
                            />
                        </div>
                    ) : null}
                </div>

                {error && (
                    <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                        <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
                        <span className="text-sm font-semibold text-rose-800">{error}</span>
                    </div>
                )}

                {!selectedSubjectId ? (
                    subjects.length === 0 ? (
                        <div className={`${Z_CARD} p-12 text-center`}>
                            <BookOpen className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                            <h3 className="text-lg font-bold text-slate-500">No modules</h3>
                            <p className="mt-2 text-sm text-slate-500">You are not enrolled in any subjects yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {subjectsFiltered.map((subject) => {
                                const stats = getSubjectStats(subject._id);
                                return (
                                    <button
                                        type="button"
                                        key={subject._id}
                                        onClick={() => {
                                            setSelectedSubjectId(subject._id);
                                            setSelectedCategory(null);
                                            setQuery('');
                                        }}
                                        className={`${Z_CARD} p-5 text-left transition hover:border-[#1e56e3]/30 hover:shadow-md`}
                                    >
                                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#1e56e3]">
                                            <BookOpen className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">{subject.name}</h3>
                                        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#1e56e3]">{subject.code}</p>
                                        <div className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-500">
                                            <User className="h-4 w-4 shrink-0" />
                                            {subject.teacher}
                                        </div>
                                        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                                            <div className="flex gap-6 text-center">
                                                <div>
                                                    <p className="text-lg font-bold text-slate-900">{stats.total}</p>
                                                    <p className="text-[10px] font-bold uppercase text-slate-400">All</p>
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-[#1e56e3]">{stats.finals}</p>
                                                    <p className="text-[10px] font-bold uppercase text-slate-400">Final</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-slate-300" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )
                ) : !selectedCategory ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedCategory('final');
                                setQuery('');
                            }}
                            className={`${Z_CARD} p-6 text-left transition hover:border-[#1e56e3]/30 hover:shadow-md`}
                        >
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#1e56e3]">
                                <Rocket className="h-5 w-5" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Final class-based projects</h3>
                            <p className="mt-2 text-sm text-slate-600">Proposal, AI review, teacher approval, project ZIP.</p>
                            <p className="mt-4 text-xs font-bold uppercase text-slate-500">{finalRows.length} assignments</p>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedCategory('normal');
                                setQuery('');
                            }}
                            className={`${Z_CARD} p-6 text-left transition hover:border-[#1e56e3]/30 hover:shadow-md`}
                        >
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                <FileText className="h-5 w-5" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Normal assignments</h3>
                            <p className="mt-2 text-sm text-slate-600">Regular uploads for this subject.</p>
                            <p className="mt-4 text-xs font-bold uppercase text-slate-500">{normalRows.length} assignments</p>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 xl:flex-row">
                        <div className="min-w-0 flex-1 space-y-0">
                            {displayedRowsFiltered.length === 0 ? (
                                <div className={`${Z_CARD} p-12 text-center`}>
                                    <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                                    <p className="font-semibold text-slate-500">No assignments in this view.</p>
                                </div>
                            ) : (
                                <div className={`${Z_CARD} overflow-hidden`}>
                                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 md:px-5">
                                        <h2 className="text-sm font-bold text-slate-900">Assignment list</h2>
                                        <span className="text-xs font-semibold text-slate-400">
                                            {displayedRowsFiltered.length} shown
                                        </span>
                                    </div>
                                    <ul className="divide-y divide-slate-100">
                                        {displayedRowsFiltered.map((row) => {
                                            const a = row.assignment || {};
                                            const deadlineStatus = getDeadlineStatus(getSubmissionDeadline(a));
                                            return (
                                                <li key={a._id} className="px-4 py-4 md:px-5">
                                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                        <div className="flex min-w-0 flex-1 gap-4">
                                                            <div
                                                                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                                                                    isProjectSubmitted(row)
                                                                        ? 'bg-emerald-50 text-emerald-600'
                                                                        : 'bg-blue-50 text-[#1e56e3]'
                                                                }`}
                                                            >
                                                                {isProjectSubmitted(row) ? (
                                                                    <CheckCircle2 className="h-5 w-5" />
                                                                ) : (
                                                                    <FileText className="h-5 w-5" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <h3 className="font-bold text-slate-900">{a.title || 'Assignment'}</h3>
                                                                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                                                                    <span className="flex items-center gap-1">
                                                                        <User className="h-3.5 w-3.5" />
                                                                        {a.teacher?.name || 'Teacher'}
                                                                    </span>
                                                                    <span className="flex items-center gap-1">
                                                                        <Calendar className="h-3.5 w-3.5" />
                                                                        {a.createdAt
                                                                            ? new Date(a.createdAt).toLocaleDateString()
                                                                            : '—'}
                                                                    </span>
                                                                </div>
                                                                <div className="mt-2 flex flex-wrap gap-2">
                                                                    <span
                                                                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                                                            isProjectSubmitted(row)
                                                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                                                : 'border-amber-200 bg-amber-50 text-amber-800'
                                                                        }`}
                                                                    >
                                                                        {isProjectSubmitted(row) ? 'Submitted' : 'Pending'}
                                                                    </span>
                                                                    {getSubmissionDeadline(a) ? (
                                                                        <span
                                                                            className={`rounded-full border border-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${deadlineStatus.bg} ${deadlineStatus.color}`}
                                                                        >
                                                                            {deadlineStatus.label}
                                                                        </span>
                                                                    ) : null}
                                                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                                                        {getProposalStatusLabel(row)}
                                                                    </span>
                                                                </div>
                                                                {row?.proposal?.teacherComment ? (
                                                                    <p className="mt-2 line-clamp-2 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2 text-xs text-blue-900">
                                                                        {row.proposal.teacherComment}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 lg:shrink-0">
                                                            <Link
                                                                to={`/student/assignments/${a._id}`}
                                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                                                            >
                                                                Details
                                                            </Link>
                                                            {a.assignmentFile ? (
                                                                <a
                                                                    href={`${getApiOrigin()}${a.assignmentFile}`}
                                                                    download
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
                                                                >
                                                                    <Download className="h-3.5 w-3.5" />
                                                                    File
                                                                </a>
                                                            ) : null}
                                                            {String(a.assignmentType || 'normal') === 'normal' ? (
                                                                <Link
                                                                    to={`/student/assignments/${a._id}`}
                                                                    className="rounded-xl bg-[#1e56e3] px-3 py-2 text-center text-xs font-bold text-white shadow-sm transition hover:bg-[#1a4dcc]"
                                                                >
                                                                    Submit
                                                                </Link>
                                                            ) : canOpenProjectUpload(row) ? (
                                                                <Link
                                                                    to={`/student/project/${a._id}`}
                                                                    className="rounded-xl bg-emerald-600 px-3 py-2 text-center text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                                                                >
                                                                    Project
                                                                </Link>
                                                            ) : (
                                                                <Link
                                                                    to={`/student/assignments/${a._id}/proposal`}
                                                                    className="rounded-xl bg-[#1e56e3] px-3 py-2 text-center text-xs font-bold text-white shadow-sm transition hover:bg-[#1a4dcc]"
                                                                >
                                                                    Proposal
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="w-full shrink-0 space-y-4 xl:w-[300px]">
                            <div className={`${Z_CARD} p-5`}>
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-500">Overview</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-600">Total</span>
                                        <span className="text-xl font-bold text-slate-900">{displayedRowsFiltered.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-600">Submitted</span>
                                        <span className="text-xl font-bold text-emerald-600">{submittedCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-600">Pending</span>
                                        <span className="text-xl font-bold text-amber-600">{pendingCount}</span>
                                    </div>
                                </div>
                            </div>
                            {selectedCategory === 'final' ? (
                                <div className={`${Z_CARD} border-slate-800 bg-slate-900 p-5 text-slate-100`}>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-blue-300">AI verification</p>
                                    <p className="mt-2 text-xs leading-relaxed text-slate-300">
                                        Proposals are checked for duplication. After teacher approval you can upload your project ZIP.
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentAssignments;








