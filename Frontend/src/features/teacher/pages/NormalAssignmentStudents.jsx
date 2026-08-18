import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ChevronRight,
    Loader2,
    Mail,
    Hash,
    FileCheck,
    AlertTriangle,
    Search,
    Users,
    FileText,
} from 'lucide-react';
import teacherService from '../../../services/teacherService';

import { Z_PAGE, Z_INNER, Z_CARD, Z_LINK, Z_EMPTY_PAD } from '../../../shared/ui/zendentaLayout';
import { usePageSearch } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';
import { resolveAssignmentClassCrumb } from '../../../shared/utils/assignmentClassBreadcrumb';

const NormalAssignmentStudents = () => {
    const { id: assignmentId } = useParams();
    const navigate = useNavigate();
    const [bundle, setBundle] = useState(null);
    const [assignment, setAssignment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { query, setQuery } = usePageSearch('Search students…');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const [res, aRes] = await Promise.all([
                    teacherService.getNormalSubmissionsForAssignment(assignmentId),
                    teacherService.getAssignmentById(assignmentId).catch(() => ({ success: false })),
                ]);
                if (cancelled) return;
                if (res.success) setBundle(res.data);
                else setError(res.message || 'Could not load students.');
                if (aRes?.success) setAssignment(aRes.data || null);
            } catch (e) {
                if (!cancelled) setError(e.response?.data?.message || 'Could not load students.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [assignmentId]);

    const students = bundle?.students || [];

    const filteredStudents = useMemo(() => {
        const list = !query.trim()
            ? students
            : students.filter((s) =>
                  matchesSearchQuery(query, s.name, s.email, s.studentId, s.classCode)
              );
        return [...list].sort((a, b) =>
            String(a.name || a.email || '').localeCompare(String(b.name || b.email || ''), undefined, {
                sensitivity: 'base',
            })
        );
    }, [students, query]);

    if (loading) {
        return (
            <div className={`${Z_PAGE} flex min-h-[50vh] items-center justify-center`}>
                <Loader2 className="h-10 w-10 animate-spin text-[var(--brand-primary)]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className={`${Z_PAGE} px-4 py-8 md:px-8`}>
                <nav className="mx-auto mb-6 flex max-w-[900px] flex-wrap items-center gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                    <Link to="/teacher/assignments" className={Z_LINK}>
                        Assignments
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
                    <span className="text-[var(--text-primary)]">Students</span>
                </nav>
                <div className={`${Z_CARD} mx-auto max-w-[900px] border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800`}>
                    {error}
                </div>
            </div>
        );
    }

    const title = assignment?.title || 'Assignment';
    const classCrumb = resolveAssignmentClassCrumb(assignment);

    return (
        <div className={Z_PAGE}>
            <div className={Z_INNER}>
                <nav className="mb-4 flex flex-wrap items-center gap-1 text-[13px] font-semibold text-[var(--text-secondary)]">
                    <Link to="/teacher/assignments" className={Z_LINK}>
                        Assignments
                    </Link>
                    {classCrumb ? (
                        <>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
                            <Link
                                to={classCrumb.to}
                                className={`${Z_LINK} max-w-[min(100%,14rem)] truncate`}
                                title={classCrumb.label}
                            >
                                {classCrumb.label}
                            </Link>
                        </>
                    ) : null}
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
                    <span className="max-w-[min(100%,28rem)] truncate text-[var(--text-primary)]" title={title}>
                        {title}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
                    <span className="text-[var(--text-primary)]">Students</span>
                </nav>

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] md:text-[26px]">Class roster</h1>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
                        Open a student to see submission status, similarity vs peers, and extracted document content.
                    </p>
                </div>
                <div className="relative w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by name, email, ID, class…"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-2.5 pl-10 pr-3 text-sm font-medium text-[var(--text-primary)] shadow-sm outline-none ring-[#2f4aad]/0 transition focus:border-[#2f4aad]/40 focus:ring-2 focus:ring-[#2f4aad]/20"
                    />
                </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className={`${Z_CARD} p-4`}>
                    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                        <Users className="h-4 w-4 text-[var(--brand-primary)]" />
                        <span className="text-[11px] font-bold uppercase tracking-wide">Students</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{students.length}</p>
                </div>
                <div className={`${Z_CARD} p-4`}>
                    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                        <FileCheck className="h-4 w-4 text-emerald-600" />
                        <span className="text-[11px] font-bold uppercase tracking-wide">Submitted</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{bundle?.submittedCount ?? 0}</p>
                </div>
                <div className={`${Z_CARD} p-4`}>
                    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                        <FileText className="h-4 w-4 text-amber-600" />
                        <span className="text-[11px] font-bold uppercase tracking-wide">Pending</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
                        {Math.max(0, students.length - (bundle?.submittedCount ?? 0))}
                    </p>
                </div>
                <div className={`${Z_CARD} p-4`}>
                    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                        <span className="text-[11px] font-bold uppercase tracking-wide">Flagged</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{bundle?.flaggedCount ?? 0}</p>
                </div>
            </div>

            {students.length === 0 ? (
                <div className={`${Z_CARD} ${Z_EMPTY_PAD} text-sm font-semibold text-[var(--text-secondary)]`}>
                    No students found for this assignment's classes.
                </div>
            ) : filteredStudents.length === 0 ? (
                <div className={`${Z_CARD} ${Z_EMPTY_PAD} text-sm font-semibold text-[var(--text-secondary)]`}>
                    No students match "{query.trim()}".
                </div>
            ) : (
                <div className={`${Z_CARD} overflow-hidden`}>
                    <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 md:px-5">
                        <h2 className="text-sm font-bold text-[var(--text-primary)]">Student list</h2>
                        <span className="text-xs font-semibold text-[var(--text-secondary)]">
                            {filteredStudents.length} shown
                        </span>
                    </div>
                    <ul className="divide-y divide-slate-100">
                        {filteredStudents.map((s) => (
                            <li key={s.studentUserId}>
                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate(
                                            `/teacher/assignments/${assignmentId}/normal-students/${encodeURIComponent(s.studentUserId)}`
                                        )
                                    }
                                    className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-[var(--bg-elevated)] md:px-5"
                                >
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2f4aad] to-[#3b74ff] text-sm font-bold text-white shadow-sm">
                                        {(s.name || s.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-bold text-[var(--text-primary)]">{s.name || 'Student'}</p>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[var(--text-secondary)]">
                                            {s.email ? (
                                                <span className="flex min-w-0 items-center gap-1">
                                                    <Mail className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">{s.email}</span>
                                                </span>
                                            ) : null}
                                            {s.studentId ? (
                                                <span className="flex items-center gap-1">
                                                    <Hash className="h-3.5 w-3.5 shrink-0" />
                                                    {s.studentId}
                                                </span>
                                            ) : null}
                                            {s.classCode ? (
                                                <span className="rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                                                    {s.classCode}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                                        {s.submitted ? (
                                            <span className="text-xs font-bold text-emerald-600">Submitted</span>
                                        ) : (
                                            <span className="text-xs font-bold text-amber-600">Pending</span>
                                        )}
                                        {s.submission?.plagiarismFlag ? (
                                            <span className="text-[10px] font-bold uppercase text-rose-600">High similarity</span>
                                        ) : s.submitted && s.submission?.plagiarismScore != null ? (
                                            <span className="text-[10px] font-semibold text-[var(--text-secondary)]">
                                                {Math.round(Number(s.submission.plagiarismScore) * 100)}% vs peers
                                            </span>
                                        ) : null}
                                    </div>
                                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            </div>
        </div>
    );
};

export default NormalAssignmentStudents;
