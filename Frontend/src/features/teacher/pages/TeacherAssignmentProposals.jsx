import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Loader2, Search, Users, ClipboardList, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { Z_PAGE, Z_INNER, Z_CARD, Z_LINK, Z_EMPTY_PAD } from '../../../shared/ui/zendentaLayout';
import { usePageSearch } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';
import { getProposalAiSimilarityContext } from '../../../shared/utils/proposalSimilarityUi';

const statusLabel = (s, proposal) => {
    const status = proposal?.displayStatus || s;
    if (status === 'pending_teacher_approval' && proposal?.collaborativeApproval?.awaitingDualApproval) {
        const fe = proposal.collaborativeApproval.frontendApproved;
        const be = proposal.collaborativeApproval.backendApproved;
        if (fe && !be) return 'Frontend approved · backend pending';
        if (be && !fe) return 'Backend approved · frontend pending';
        return 'Dual teacher approval pending';
    }
    const map = {
        draft: 'Draft',
        submitted: 'Submitted',
        ai_rejected_same_semester: 'AI rejected (same semester)',
        ai_flagged_previous_semester: 'AI warning (legacy similarity)',
        revision_required: 'Revision required',
        pending_teacher_approval: 'Pending your approval',
        teacher_approved: 'Approved',
        teacher_rejected: 'Rejected',
        requirements_rejected: 'Requirements rejected',
    };
    return map[status] || status;
};

const studentIdentityLabel = (proposal) => {
    const name = proposal?.submittedBy?.name || 'Student';
    const sid = proposal?.submittedBy?.studentId || proposal?.submittedBy?.email || '';
    return sid ? `${name} (${sid})` : name;
};

const TeacherAssignmentProposals = () => {
    const { id: assignmentId } = useParams();
    const navigate = useNavigate();
    const [assignment, setAssignment] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { query, setQuery } = usePageSearch('Search proposals…');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const [aRes, pRes] = await Promise.all([
                    teacherService.getAssignmentById(assignmentId),
                    teacherService.getProposalsForAssignment(assignmentId),
                ]);
                if (cancelled) return;
                if (aRes.success) setAssignment(aRes.data);
                if (pRes.success) setProposals(pRes.data || []);
                else setError(pRes.message || 'Could not load proposals.');
            } catch (e) {
                if (!cancelled) setError(e.response?.data?.message || 'Could not load proposals.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [assignmentId]);

    const filteredProposals = useMemo(() => {
        const list = !query.trim()
            ? proposals
            : proposals.filter((p) =>
                  matchesSearchQuery(
                      query,
                      studentIdentityLabel(p),
                      p.title,
                      p.status,
                      p.submittedBy?.email
                  )
              );
        return [...list].sort((a, b) =>
            String(a?.submittedBy?.name || a?.group?.name || a?.title || '').localeCompare(
                String(b?.submittedBy?.name || b?.group?.name || b?.title || ''),
                undefined,
                { sensitivity: 'base' }
            )
        );
    }, [proposals, query]);

    const stats = useMemo(() => {
        const needsReview = proposals.filter((p) =>
            ['pending_teacher_approval', 'revision_required', 'submitted'].includes(p.status)
        ).length;
        const approved = proposals.filter((p) => p.status === 'teacher_approved').length;
        const flagged = proposals.filter((p) =>
            ['ai_rejected_same_semester', 'ai_flagged_previous_semester'].includes(p.status)
        ).length;
        return { total: proposals.length, needsReview, approved, flagged };
    }, [proposals]);

    if (loading) {
        return (
            <div className={`${Z_PAGE} flex min-h-[50vh] items-center justify-center`}>
                <Loader2 className="h-10 w-10 animate-spin text-[#1e56e3]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className={Z_PAGE}>
                <div className={Z_INNER}>
                    <nav className="mx-auto mb-6 flex max-w-[900px] flex-wrap items-center gap-1 text-xs font-semibold text-slate-500">
                        <Link to="/teacher/assignments" className={Z_LINK}>
                            Assignments
                        </Link>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="text-slate-800">Proposals</span>
                    </nav>
                    <div className={`${Z_CARD} mx-auto max-w-[900px] border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800`}>
                        {error}
                    </div>
                </div>
            </div>
        );
    }

    const title = assignment?.title || 'Assignment';

    return (
        <div className={Z_PAGE}>
            <div className={Z_INNER}>
                <nav className="mb-4 flex flex-wrap items-center gap-1 text-[13px] font-semibold text-slate-500">
                    <Link to="/teacher/assignments" className={Z_LINK}>
                        Assignments
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <Link to={`/teacher/assignments/${assignmentId}`} className={`${Z_LINK} max-w-[min(100%,28rem)] truncate`} title={title}>
                        {title}
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="text-slate-800">Proposal roster</span>
                </nav>

                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[26px]">Proposal roster</h1>
                        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
                            Open a student to review AI similarity, read proposal content like an extracted document, add your score, and
                            approve or request changes — same flow as the normal assignment student list.
                        </p>
                    </div>
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by name, email, title, status…"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-slate-800 shadow-sm outline-none ring-[#1e56e3]/0 transition focus:border-[#1e56e3]/40 focus:ring-2 focus:ring-[#1e56e3]/20"
                        />
                    </div>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className={`${Z_CARD} p-4`}>
                        <div className="flex items-center gap-2 text-slate-500">
                            <Users className="h-4 w-4 text-[#1e56e3]" />
                            <span className="text-[11px] font-bold uppercase tracking-wide">Proposals</span>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
                    </div>
                    <div className={`${Z_CARD} p-4`}>
                        <div className="flex items-center gap-2 text-slate-500">
                            <Clock className="h-4 w-4 text-amber-600" />
                            <span className="text-[11px] font-bold uppercase tracking-wide">Needs attention</span>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{stats.needsReview}</p>
                    </div>
                    <div className={`${Z_CARD} p-4`}>
                        <div className="flex items-center gap-2 text-slate-500">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="text-[11px] font-bold uppercase tracking-wide">Approved</span>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{stats.approved}</p>
                    </div>
                    <div className={`${Z_CARD} p-4`}>
                        <div className="flex items-center gap-2 text-slate-500">
                            <AlertCircle className="h-4 w-4 text-violet-600" />
                            <span className="text-[11px] font-bold uppercase tracking-wide">AI flagged</span>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{stats.flagged}</p>
                    </div>
                </div>

                {proposals.length === 0 ? (
                    <div className={`${Z_CARD} ${Z_EMPTY_PAD} text-sm font-semibold text-slate-500`}>No proposals submitted yet.</div>
                ) : filteredProposals.length === 0 ? (
                    <div className={`${Z_CARD} ${Z_EMPTY_PAD} text-sm font-semibold text-slate-500`}>
                        No proposals match “{query.trim()}”.
                    </div>
                ) : (
                    <div className={`${Z_CARD} overflow-hidden`}>
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 md:px-5">
                            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                <ClipboardList className="h-4 w-4 text-[#1e56e3]" />
                                Students with proposals
                            </h2>
                            <span className="text-xs font-semibold text-slate-400">{filteredProposals.length} shown</span>
                        </div>
                        <ul className="divide-y divide-slate-100">
                            {filteredProposals.map((p) => (
                                <li key={p._id}>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/teacher/assignments/${assignmentId}/proposals/${p._id}`)}
                                        className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-slate-50 md:px-5"
                                    >
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1e56e3] to-[#3b74ff] text-sm font-bold text-white shadow-sm">
                                            {(p.submittedBy?.name || p.submittedBy?.email || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-bold text-slate-900">{studentIdentityLabel(p)}</p>
                                            <p className="mt-0.5 truncate text-xs font-semibold text-slate-600">{p.title || 'Untitled proposal'}</p>
                                        </div>
                                        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                                            <span className="text-xs font-bold text-slate-700">{statusLabel(p.status, p)}</span>
                                            {p.requirementReview?.passed === false || p.requirementCheckPassed === false ? (
                                                <span className="text-[10px] font-semibold text-rose-600">
                                                    Requirements not met
                                                </span>
                                            ) : p.status === 'ai_rejected_same_semester' ? (
                                                <span className="text-[10px] font-semibold text-rose-600">
                                                    AI blocked ({getProposalAiSimilarityContext(p).samePct} same-term)
                                                </span>
                                            ) : p.status === 'ai_flagged_previous_semester' ? (
                                                <span className="text-[10px] font-semibold text-amber-700">
                                                    Legacy similarity warning
                                                </span>
                                            ) : Number.isFinite(p.aiSameSemesterMaxScore) ? (
                                                <span className="text-[10px] font-semibold text-emerald-700">
                                                    AI cleared · {getProposalAiSimilarityContext(p).samePct} advisory
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

export default TeacherAssignmentProposals;
