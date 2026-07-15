import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';
import {
    ArrowLeft,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    MessageSquare,
    PlayCircle,
    Square,
    ExternalLink,
    Shield,
    BarChart2,
    ChevronRight,
    Copy,
    Printer,
    FileText,
    Download,
    Package,
} from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { useAuth } from '../../../context/authContext';
import { getApiOrigin, getApiErrorMessage } from '../../../lib/api';
import ExtractedSubmissionView from '../components/ExtractedSubmissionView';
import { Z_PAGE, Z_INNER, Z_CARD, Z_LINK } from '../../../shared/ui/zendentaLayout';
import { getProposalAiSimilarityContext } from '../../../shared/utils/proposalSimilarityUi';
import {
    formatSubmissionHistoryEntry,
    getProposalSubmissionHistoryContext,
    getTeacherSubmissionJourneyHeadline,
} from '../../../shared/utils/proposalSubmissionHistoryUi';
import { copyTextToClipboard } from '../../../shared/utils/clipboard';

const PREVIEW_STACK_LABELS = {
    'static-html': 'HTML + CSS',
    'static-html-js': 'HTML + CSS + JavaScript',
    'node-js': 'React + Express',
    'java-spring-react': 'React + Spring Boot',
    'php-apache': 'PHP / Apache',
    jupyter: 'Jupyter notebook',
};

function previewStackLabel(stack, sess) {
    if (sess?.previewStackLabel) return sess.previewStackLabel;
    return PREVIEW_STACK_LABELS[stack] || stack || 'Detecting…';
}

/** Teacher can open the preview URL when the student app responds (HTTP probe or container log). */
function isPreviewOpenReady(sess) {
    if (sess?.previewAppReady === true) {
        return sess?.status === 'running' || sess?.status === 'starting';
    }
    // Spring UI often serves 200s while API/Maven is still starting — unlock from live logs.
    if (
        sess?.previewStack === 'java-spring-react' &&
        (sess?.status === 'running' || sess?.status === 'starting') &&
        sess?.previewUrl &&
        sess?.portReachable !== false &&
        /Returned\s+200/i.test(String(sess?.liveContainerLog || ''))
    ) {
        return true;
    }
    return sess?.status === 'running' && sess?.previewAppReady === true;
}


const statusLabel = (s, proposal) => {
    const status = proposal?.displayStatus || s;
    if (status === 'pending_teacher_approval' && proposal?.collaborativeApproval?.awaitingDualApproval) {
        const fe = proposal.collaborativeApproval.frontendApproved;
        const be = proposal.collaborativeApproval.backendApproved;
        if (fe && !be) return 'Waiting for backend teacher approval';
        if (be && !fe) return 'Waiting for frontend teacher approval';
        return 'Pending dual teacher approval';
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

const userIdOf = (u) => String(u?._id || u?.id || '');

/** Leader first, then other members alphabetically by name. */
const buildGroupRoster = (group) => {
    if (!group || typeof group !== 'object') return [];
    const leaderId = userIdOf(group.leader);
    const seen = new Set();
    const roster = [];

    const addUser = (u, isLeader) => {
        const id = userIdOf(u);
        if (!id || seen.has(id)) return;
        if (!u?.name && !u?.email) return;
        seen.add(id);
        roster.push({ ...u, isLeader });
    };

    if (group.leader && typeof group.leader === 'object') {
        addUser(group.leader, true);
    }
    for (const m of group.members || []) {
        const u = m?.user;
        if (u && typeof u === 'object') {
            addUser(u, leaderId && userIdOf(u) === leaderId);
        }
    }

    const leaders = roster.filter((r) => r.isLeader);
    const others = roster
        .filter((r) => !r.isLeader)
        .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
    return [...leaders, ...others];
};

const safePreviewUrl = (url) => {
    if (!url) return '';
    try {
        const u = new URL(url);
        if (u.hostname === '127.0.0.1') u.hostname = 'localhost';
        return u.toString();
    } catch {
        return String(url).replace('127.0.0.1', 'localhost');
    }
};

function DetailRow({ label, value }) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-3 gap-y-1 border-b border-slate-50 py-3 last:border-0 sm:grid-cols-[140px_1fr]">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
            <span className="text-sm font-semibold break-words text-slate-900">{value ?? '—'}</span>
        </div>
    );
}

function getProposalRequirementIssue(proposal) {
    const liveReview = proposal?.requirementReview || null;
    const storedFailed = proposal?.requirementCheckPassed === false;
    const statusFailed =
        proposal?.status === 'requirements_rejected' || proposal?.displayStatus === 'requirements_rejected';
    const liveFailed = liveReview?.passed === false;
    const failed = statusFailed || storedFailed || liveFailed;
    const summary =
        proposal?.requirementCheckSummary ||
        liveReview?.summary ||
        (failed ? 'This proposal does not match the assignment requirements.' : '');
    return {
        failed,
        isPrimaryIssue: failed && proposal?.status !== 'ai_rejected_same_semester',
        summary,
        review: liveReview,
    };
}

function buildProposalPlainText(p) {
    if (!p) return '';
    const parts = [];
    parts.push(`PROJECT TITLE\n${p.title || '—'}`);
    parts.push(`\n\nOVERVIEW\n${(p.description || '').trim() || 'No overview provided.'}`);
    if (Array.isArray(p.features) && p.features.length) {
        parts.push('\n\nPROPOSED FUNCTIONALITY');
        p.features.forEach((f) => parts.push(`\n• ${f}`));
    }
    if (p.requirementCheckSummary && p.requirementCheckPassed === false) {
        parts.push(`\n\nREQUIREMENT CHECK\n${p.requirementCheckSummary}`);
    } else if (p.requirementReview?.passed === false && p.requirementReview?.summary) {
        parts.push(`\n\nREQUIREMENT CHECK\n${p.requirementReview.summary}`);
    }
    if (p.aiSummary) {
        parts.push(`\n\nAI SUMMARY (ADVISORY)\n${p.aiSummary}`);
    }
    return parts.join('');
}

function SubmissionAttemptTimeline({ history, emptyMessage = 'No submission attempts recorded yet.' }) {
    const items = (Array.isArray(history) ? history : []).map((entry, index) =>
        formatSubmissionHistoryEntry(entry, index)
    );
    if (!items.length) {
        return <p className="text-sm text-slate-500">{emptyMessage}</p>;
    }
    const toneClass = (tone) => {
        if (tone === 'error') return 'border-rose-200 bg-rose-50 text-rose-950';
        if (tone === 'warn') return 'border-amber-200 bg-amber-50 text-amber-950';
        if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-950';
        if (tone === 'info') return 'border-blue-200 bg-blue-50 text-blue-950';
        return 'border-slate-200 bg-slate-50 text-slate-800';
    };
    return (
        <ul className="space-y-3">
            {items.map((item) => (
                <li key={item.key} className={`rounded-lg border p-3 text-sm ${toneClass(item.tone)}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold">{item.headline}</p>
                        <span className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                            {item.attemptLabel}
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold opacity-80">{item.when}</p>
                    {item.detail ? <p className="mt-2 text-xs leading-relaxed">{item.detail}</p> : null}
                    {item.resolved?.length ? (
                        <p className="mt-2 text-xs font-semibold text-emerald-800">
                            Fixed: {item.resolved.join(', ')}
                        </p>
                    ) : null}
                </li>
            ))}
        </ul>
    );
}

function DocumentPane({ title, subtitle, onCopy, text }) {
    return (
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#1e56e3]">{title}</p>
                    <p className="mt-0.5 truncate text-base font-bold text-slate-900">{subtitle}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Structured like extracted submission text for easier reading.</p>
                </div>
                {text ? (
                    <button
                        type="button"
                        onClick={onCopy}
                        className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                        title="Copy proposal text"
                    >
                        <Copy className="h-4 w-4" />
                    </button>
                ) : null}
            </div>
            <div className="max-h-[min(65vh,720px)] flex-1 overflow-y-auto px-5 py-4">
                <ExtractedSubmissionView text={text} filename={`${(subtitle || 'proposal').replace(/\s+/g, '_')}.txt`} highlightNorms={null} />
            </div>
        </div>
    );
}

const TeacherProposalStudentDetail = () => {
    const { id: assignmentId, proposalId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const currentUserId = String(user?._id || user?.id || '');
    const [assignment, setAssignment] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('proposal');
    const [actionId, setActionId] = useState(null);
    const [comment, setComment] = useState('');
    const [evalScore, setEvalScore] = useState('');
    const [evalScoreMax, setEvalScoreMax] = useState('100');
    const [vsAi, setVsAi] = useState('not_set');
    const [previewSessionByProposal, setPreviewSessionByProposal] = useState({});
    const [previewBusyId, setPreviewBusyId] = useState(null);
    const [previewAdminEmail, setPreviewAdminEmail] = useState('');
    const [previewAdminPassword, setPreviewAdminPassword] = useState('');
    const previewMapRef = useRef({});

    useEffect(() => {
        previewMapRef.current = previewSessionByProposal;
    }, [previewSessionByProposal]);

    useEffect(() => {
        const sess = proposalId ? previewSessionByProposal[proposalId] : null;
        if (sess && isPreviewOpenReady(sess)) {
            if (sess.previewLoginEmail) setPreviewAdminEmail(sess.previewLoginEmail);
            if (sess.previewLoginPassword) setPreviewAdminPassword(sess.previewLoginPassword);
        } else if (!sess || ['stopped', 'failed', 'expired', 'runtime_error'].includes(sess?.status)) {
            setPreviewAdminEmail('');
            setPreviewAdminPassword('');
        }
    }, [previewSessionByProposal, proposalId]);

    useEffect(() => {
        const tick = async () => {
            const prev = previewMapRef.current;
            const active = Object.entries(prev).filter(([, s]) =>
                ['running', 'starting', 'runtime_error'].includes(s?.status)
            );
            for (const [pid, s] of active) {
                try {
                    const r = await teacherService.getPreviewSession(s._id);
                    if (r.success && r.data) {
                        setPreviewSessionByProposal((p) => ({ ...p, [pid]: r.data }));
                    }
                } catch (e) {
                    const status = e.response?.status;
                    if (status === 403 || status === 404) {
                        setPreviewSessionByProposal((p) => {
                            const next = { ...p };
                            delete next[pid];
                            return next;
                        });
                    }
                }
            }
        };
        tick();
        const iv = setInterval(tick, 2000);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        if (!proposalId) return;
        let cancelled = false;
        (async () => {
            try {
                const r = await teacherService.getActiveProposalPreview(proposalId);
                if (cancelled) return;
                if (!r.success || !r.data) {
                    setPreviewSessionByProposal((prev) => {
                        if (!prev[proposalId]) return prev;
                        const next = { ...prev };
                        delete next[proposalId];
                        return next;
                    });
                    return;
                }
                setPreviewSessionByProposal((prev) => ({ ...prev, [proposalId]: r.data }));
            } catch {
                if (!cancelled) {
                    setPreviewSessionByProposal((prev) => {
                        if (!prev[proposalId]) return prev;
                        const next = { ...prev };
                        delete next[proposalId];
                        return next;
                    });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [proposalId]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [aRes, pRes] = await Promise.all([
                teacherService.getAssignmentById(assignmentId),
                teacherService.getProposalsForAssignment(assignmentId),
            ]);
            if (aRes.success) setAssignment(aRes.data);
            if (pRes.success) setProposals(pRes.data || []);
            else setError(pRes.message || 'Could not load proposals.');
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load.');
        } finally {
            setLoading(false);
        }
    }, [assignmentId]);

    useEffect(() => {
        load();
    }, [load]);

    const proposal = useMemo(() => proposals.find((p) => String(p._id) === String(proposalId)) || null, [proposals, proposalId]);
    const requirementIssue = useMemo(() => getProposalRequirementIssue(proposal), [proposal]);
    const aiSimilarity = useMemo(() => getProposalAiSimilarityContext(proposal), [proposal]);
    const submissionHistoryCtx = useMemo(
        () => getProposalSubmissionHistoryContext(proposal),
        [proposal]
    );
    const submissionJourney = useMemo(
        () => getTeacherSubmissionJourneyHeadline(submissionHistoryCtx, proposal?.status),
        [submissionHistoryCtx, proposal?.status]
    );

    const isCollaborative = Boolean(assignment?.isCollaborative);
    const myReviewRole = assignment?.collaborationReviewRole || null;
    const collabApproval = proposal?.collaborativeApproval;
    const displayStatus = proposal?.displayStatus || proposal?.status;
    const awaitingDual = Boolean(collabApproval?.awaitingDualApproval);
    const isFullyApproved = displayStatus === 'teacher_approved' && !awaitingDual;
    const mySlotApproved =
        myReviewRole === 'frontend'
            ? Boolean(collabApproval?.frontendApproved)
            : myReviewRole === 'backend'
              ? Boolean(collabApproval?.backendApproved)
              : false;
    const approveLabel =
        myReviewRole === 'frontend'
            ? 'Approve (frontend teacher)'
            : myReviewRole === 'backend'
              ? 'Approve (backend teacher)'
              : 'Approve';
    const canDecide =
        displayStatus === 'pending_teacher_approval' || proposal?.status === 'revision_required';
    const canApproveCollab = !isCollaborative || (myReviewRole && !mySlotApproved);
    const showCollabPanel = isCollaborative && (awaitingDual || displayStatus === 'pending_teacher_approval');

    useEffect(() => {
        if (!proposal) return;
        const zip = proposal.latestProjectSubmission;
        const isProjectPhase = Boolean(zip);
        const collabRole = assignment?.collaborationReviewRole;
        const collabSlot =
            isProjectPhase && isCollaborative && collabRole
                ? zip?.collaborativeProjectReviews?.[collabRole]
                : null;

        setComment('');

        if (collabSlot) {
            setEvalScore(collabSlot.score != null ? String(collabSlot.score) : '');
            setEvalScoreMax(collabSlot.scoreMax != null ? String(collabSlot.scoreMax) : '100');
        } else if (isProjectPhase) {
            setEvalScore(
                zip.teacherScore != null && zip.teacherScore !== undefined
                    ? String(zip.teacherScore)
                    : proposal.teacherProposalScore != null
                      ? String(proposal.teacherProposalScore)
                      : ''
            );
            setEvalScoreMax(
                String(zip.teacherScoreMax ?? proposal.teacherProposalScoreMax ?? 100)
            );
        } else {
            setEvalScore(
                proposal.teacherProposalScore != null && proposal.teacherProposalScore !== undefined
                    ? String(proposal.teacherProposalScore)
                    : ''
            );
            setEvalScoreMax(String(proposal.teacherProposalScoreMax ?? 100));
        }
        setVsAi(
            proposal.teacherVsAi && ['aligns', 'stricter', 'lenient', 'not_set'].includes(proposal.teacherVsAi)
                ? proposal.teacherVsAi
                : 'not_set'
        );
    }, [
        proposal?._id,
        proposal?.teacherProposalScore,
        proposal?.teacherProposalScoreMax,
        proposal?.teacherVsAi,
        proposal?.latestProjectSubmission?.teacherScore,
        proposal?.latestProjectSubmission?.teacherScoreMax,
        proposal?.latestProjectSubmission?._id,
        proposal?.latestProjectSubmission?.collaborativeProjectReviews,
        assignment?.collaborationReviewRole,
        isCollaborative,
    ]);

    const proposalPlain = useMemo(() => buildProposalPlainText(proposal), [proposal]);

    const reviewPayload = () => {
        const scoreStr = String(evalScore).trim();
        const maxStr = String(evalScoreMax).trim();
        const scoreNum = scoreStr === '' ? undefined : Number(scoreStr);
        const maxNum = maxStr === '' ? 100 : Number(maxStr);
        const payload = { vsAi: vsAi || 'not_set' };
        if (comment.trim()) payload.comment = comment.trim();
        if (scoreNum !== undefined && !Number.isNaN(scoreNum)) {
            payload.teacherProposalScore = scoreNum;
            payload.teacherProposalScoreMax =
                !Number.isNaN(maxNum) && maxNum > 0 ? maxNum : 100;
        } else if (!Number.isNaN(maxNum) && maxNum > 0 && maxNum !== 100) {
            payload.teacherProposalScoreMax = maxNum;
        }
        return payload;
    };

    const canSendFeedback = Boolean(comment.trim() || String(evalScore).trim());

    const runReview = async (action) => {
        if (!proposal) return;
        setActionId(proposal._id + action);
        try {
            const res = await teacherService.reviewProposal(proposal._id, { action, ...reviewPayload() });
            if (res.success) {
                setComment('');
                await load();
                if (
                    action === 'approve' &&
                    res.data?.collaborativeApproval?.awaitingDualApproval
                ) {
                    await appWarning('Your approval was saved. Waiting for your co-teacher to approve before the student can proceed.');
                }
            }
        } catch (e) {
            await appError(e.response?.data?.message || 'Action failed');
        } finally {
            setActionId(null);
        }
    };

    const startPreview = async () => {
        if (!proposal) return;
        setPreviewBusyId(proposal._id);
        try {
            const previewOpts = {};
            if (previewAdminEmail.trim()) previewOpts.adminEmail = previewAdminEmail.trim();
            if (previewAdminPassword) previewOpts.adminPassword = previewAdminPassword;
            const r = await teacherService.startProposalPreview(proposal._id, previewOpts);
            if (r.success && r.data) {
                setPreviewSessionByProposal((prev) => ({ ...prev, [proposal._id]: r.data }));
            } else {
                await appError(r.message || 'Could not start preview');
            }
        } catch (e) {
            const data = e.response?.data;
            const timedOut = e.code === 'ECONNABORTED' || /timeout/i.test(e.message || '');
            if (timedOut) {
                await appWarning(
                    'Preview is still starting in the background (this can take several minutes). ' +
                        'Keep this page open — status will update automatically.'
                );
                try {
                    const active = await teacherService.getActiveProposalPreview(proposal._id);
                    if (active.success && active.data) {
                        setPreviewSessionByProposal((prev) => ({ ...prev, [proposal._id]: active.data }));
                    }
                } catch {
                    /* polling will pick up session */
                }
                return;
            }
            if (data?.validationFailures?.length) {
                setPreviewSessionByProposal((prev) => ({
                    ...prev,
                    [proposal._id]: {
                        ...(prev[proposal._id] || {}),
                        _id: data.sessionId || prev[proposal._id]?._id,
                        status: 'failed',
                        errorMessage: data.error || 'The student project cannot be previewed.',
                        validationFailures: data.validationFailures,
                    },
                }));
            } else {
                await appError(
                    getApiErrorMessage(
                        e,
                        'Could not start preview. Make sure the backend API is running on port 5000 and Docker Desktop is started.'
                    )
                );
            }
        } finally {
            setPreviewBusyId(null);
        }
    };

    const stopPreview = async () => {
        if (!proposal) return;
        const s = previewSessionByProposal[proposal._id];
        if (!s?._id) return;
        setPreviewBusyId(proposal._id);
        try {
            const r = await teacherService.stopPreviewSession(s._id);
            if (r.success && r.data) {
                setPreviewSessionByProposal((prev) => ({ ...prev, [proposal._id]: r.data }));
            }
        } catch (e) {
            await appError(e.response?.data?.message || 'Stop failed');
        } finally {
            setPreviewBusyId(null);
        }
    };

    const copyProposal = async () => {
        if (!proposalPlain) return;
        try {
            await copyTextToClipboard(proposalPlain);
            await appSuccess('Proposal text copied');
        } catch {
            await appWarning('Could not copy proposal text automatically.');
        }
    };

    const assignmentTitle = assignment?.title || 'Assignment';
    const subj = assignment?.subject;
    const subjectLine =
        subj && typeof subj === 'object' && (subj.name || subj.code)
            ? `${subj.name || ''}${subj.code ? ` (${subj.code})` : ''}`.trim() || '—'
            : '—';
    const classCodeForStudents = assignment?.class?.code || assignment?.class?.name || '';
    const student = proposal?.submittedBy;
    const isGroupSubmission = assignment?.submissionMode === 'group' && proposal?.group;
    const group = isGroupSubmission ? proposal.group : null;
    const groupRoster = isGroupSubmission ? buildGroupRoster(group) : [];
    const groupName = group?.name || 'Group';
    const profileTitle = isGroupSubmission ? groupName : student?.name || 'Student';
    const profileInitial = isGroupSubmission
        ? (groupName.charAt(0) || 'G').toUpperCase()
        : (student?.name || student?.email || '?').charAt(0).toUpperCase();
    const submittedAt = proposal?.submittedAt
        ? new Date(proposal.submittedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : '—';

    if (loading) {
        return (
            <div className={`${Z_PAGE} flex min-h-[50vh] flex-1 items-center justify-center`}>
                <Loader2 className="h-10 w-10 animate-spin text-[#1e56e3]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className={Z_PAGE}>
                <div className={Z_INNER}>
                    <nav className="mb-4 flex flex-wrap items-center gap-1 text-[13px] font-semibold text-slate-500">
                        <Link to="/teacher/assignments" className={Z_LINK}>
                            Assignments
                        </Link>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <Link to={`/teacher/assignments/${assignmentId}/proposals`} className={Z_LINK}>
                            Proposals
                        </Link>
                    </nav>
                    <div className={`${Z_CARD} border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800`}>{error}</div>
                </div>
            </div>
        );
    }

    if (!proposal) {
        return (
            <div className={Z_PAGE}>
                <div className={Z_INNER}>
                    <nav className="mb-4 flex flex-wrap items-center gap-1 text-[13px] font-semibold text-slate-500">
                        <Link to="/teacher/assignments" className={Z_LINK}>
                            Assignments
                        </Link>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <Link to={`/teacher/assignments/${assignmentId}/proposals`} className={Z_LINK}>
                            Proposals
                        </Link>
                    </nav>
                    <div className={`${Z_CARD} border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900`}>
                        This proposal was not found. It may have been removed or the link is invalid.
                    </div>
                </div>
            </div>
        );
    }

    const sameSemPct = aiSimilarity.samePct;
    const legacyPct = aiSimilarity.legacyPct;

    const zip = proposal.latestProjectSubmission;
    const isProjectReviewPhase = Boolean(zip);
    const myProjectReviewSlot =
        isProjectReviewPhase && isCollaborative && myReviewRole
            ? zip?.collaborativeProjectReviews?.[myReviewRole]
            : null;
    const projectFeedbackComment = myProjectReviewSlot?.comment || zip?.teacherComment || '';
    const projectFeedbackScore = myProjectReviewSlot?.score ?? zip?.teacherScore ?? null;
    const projectFeedbackScoreMax = myProjectReviewSlot?.scoreMax ?? zip?.teacherScoreMax ?? 100;
    const otherCollabProjectSlot =
        isProjectReviewPhase && isCollaborative && myReviewRole
            ? zip?.collaborativeProjectReviews?.[myReviewRole === 'frontend' ? 'backend' : 'frontend']
            : null;
    const apiOrigin = getApiOrigin();
    const zipUrl =
        zip?.downloadPath && String(zip.downloadPath).startsWith('/')
            ? `${apiOrigin}${zip.downloadPath}`
            : zip?.downloadPath
              ? `${apiOrigin}/${String(zip.downloadPath).replace(/^\//, '')}`
              : '';
    const zipSizeLabel =
        zip?.sizeBytes != null
            ? zip.sizeBytes >= 1_048_576
                ? `${(zip.sizeBytes / 1_048_576).toFixed(1)} MB`
                : `${Math.max(1, Math.round(zip.sizeBytes / 1024))} KB`
            : '—';
    const zipUploadedAt = zip?.createdAt
        ? new Date(zip.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : '—';

    return (
        <div className={Z_PAGE}>
            <div className={Z_INNER}>
                <nav className="mb-4 flex flex-wrap items-center gap-1 text-[13px] font-semibold text-slate-500">
                    <Link to="/teacher/assignments" className={Z_LINK}>
                        Assignments
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <Link
                        to={`/teacher/assignments/${assignmentId}/proposals`}
                        className={`${Z_LINK} max-w-[200px] truncate md:max-w-xs`}
                        title={assignmentTitle}
                    >
                        {assignmentTitle}
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="max-w-[180px] truncate text-slate-800 md:max-w-md" title={profileTitle}>
                        {profileTitle}
                    </span>
                </nav>

                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        type="button"
                        onClick={() => navigate(`/teacher/assignments/${assignmentId}/proposals`)}
                        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-800"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to proposal roster
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            <Printer className="h-4 w-4" />
                            Print
                        </button>
                    </div>
                </div>

                {requirementIssue.failed ? (
                    <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 px-4 py-4 text-sm text-rose-950 shadow-sm">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                            <div className="min-w-0">
                                <p className="font-bold text-rose-900">
                                    {proposal?.status === 'requirements_rejected'
                                        ? 'Proposal rejected — assignment requirements not met'
                                        : 'Assignment requirements not met'}
                                </p>
                                <p className="mt-2 leading-relaxed">{requirementIssue.summary}</p>
                                {requirementIssue.review?.missingImplicitTerms?.length > 0 ? (
                                    <p className="mt-2 text-[13px]">
                                        Expected for this assignment:{' '}
                                        <strong>{requirementIssue.review.missingImplicitTerms.join(', ')}</strong>
                                    </p>
                                ) : null}
                                {requirementIssue.review?.missingAllowedTech?.length > 0 ? (
                                    <p className="mt-1 text-[13px]">
                                        Missing required technologies:{' '}
                                        <strong>{requirementIssue.review.missingAllowedTech.join(', ')}</strong>
                                    </p>
                                ) : null}
                                {requirementIssue.review?.disallowedMentionedTech?.length > 0 ? (
                                    <p className="mt-1 text-[13px]">
                                        Technologies not allowed here:{' '}
                                        <strong>{requirementIssue.review.disallowedMentionedTech.join(', ')}</strong>
                                    </p>
                                ) : null}
                                {requirementIssue.isPrimaryIssue ? (
                                    <p className="mt-3 text-[12px] font-semibold text-rose-800">
                                        This is a requirement mismatch, not a same-semester similarity issue. Low overlap
                                        scores below do not mean the proposal fits the assignment.
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className={`${Z_CARD} flex h-full flex-col p-5`}>
                        <div className="flex flex-col items-center text-center">
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1e56e3] to-[#3b74ff] text-2xl font-bold text-white shadow-md">
                                {profileInitial}
                            </div>
                            <h1 className="mt-4 max-w-full break-words text-lg font-bold text-slate-900">{profileTitle}</h1>
                            {isGroupSubmission ? (
                                <ul className="mt-3 w-full space-y-2 text-left">
                                    {groupRoster.length ? (
                                        groupRoster.map((member) => (
                                            <li key={member._id || member.email} className="rounded-lg bg-slate-50 px-3 py-2">
                                                <p className="text-sm font-semibold break-words text-slate-900">
                                                    {member.name || member.email || 'Student'}
                                                    {member.isLeader ? (
                                                        <span className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[#1e56e3]">
                                                            (Leader)
                                                        </span>
                                                    ) : null}
                                                </p>
                                                {member.email ? (
                                                    <p className="mt-0.5 text-xs break-all text-slate-500">{member.email}</p>
                                                ) : null}
                                            </li>
                                        ))
                                    ) : (
                                        <li className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">No members listed</li>
                                    )}
                                </ul>
                            ) : (
                                <p className="mt-1 min-h-[1.25rem] max-w-full break-all text-sm text-slate-500">{student?.email || '—'}</p>
                            )}
                            <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#1e56e3]">
                                {statusLabel(proposal.status, proposal)}
                            </p>
                            <div className="mt-5 grid w-full grid-cols-1 gap-3 border-t border-slate-100 pt-5">
                                <div
                                    className={`col-span-2 rounded-lg border py-3 px-2 text-center ${
                                        submissionJourney.tone === 'success'
                                            ? 'border-emerald-200 bg-emerald-50'
                                            : submissionJourney.tone === 'error'
                                              ? 'border-rose-200 bg-rose-50'
                                              : 'border-blue-200 bg-blue-50'
                                    }`}
                                >
                                    <p
                                        className={`text-sm font-bold ${
                                            submissionJourney.tone === 'success'
                                                ? 'text-emerald-800'
                                                : submissionJourney.tone === 'error'
                                                  ? 'text-rose-800'
                                                  : 'text-blue-900'
                                        }`}
                                    >
                                        {submissionJourney.title}
                                    </p>
                                    <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-700">
                                        {submissionJourney.subtitle}
                                    </p>
                                    {submissionHistoryCtx.attemptCount > 1 ? (
                                        <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                            {submissionHistoryCtx.attemptCount} submission attempts
                                        </p>
                                    ) : null}
                                </div>
                                {requirementIssue.failed ? (
                                    <div className="col-span-2 rounded-lg bg-rose-50 py-3 px-2 text-center">
                                        <p className="text-sm font-bold text-rose-800">Current issue</p>
                                        <p className="mt-1 text-[10px] font-semibold text-rose-700">
                                            Requirements — not AI similarity
                                        </p>
                                    </div>
                                ) : submissionHistoryCtx.resolvedAfterFailure ? (
                                    <div className="col-span-2 rounded-lg border border-emerald-200 bg-emerald-50/80 py-3 px-2 text-center">
                                        <p className="text-sm font-bold text-emerald-800">Earlier issue resolved</p>
                                        <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                                            {submissionHistoryCtx.lastResolved.join(', ') || 'Requirements now pass'}
                                        </p>
                                    </div>
                                ) : aiSimilarity.level === 'ok' ? (
                                    <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 py-3 px-2 text-center">
                                        <p className="text-sm font-bold text-slate-800">AI similarity (advisory)</p>
                                        <p className="mt-1 text-[11px] font-semibold text-slate-600">
                                            {sameSemPct} same-term · did not block student
                                        </p>
                                    </div>
                                ) : aiSimilarity.level === 'warn' ? (
                                    <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 py-3 px-2 text-center">
                                        <p className="text-sm font-bold text-amber-900">Legacy similarity flag</p>
                                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                            {legacyPct} legacy · {sameSemPct} same-term
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="rounded-lg bg-rose-50 py-2 text-center">
                                            <p className="text-xl font-bold text-rose-800">{sameSemPct}</p>
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-rose-600">
                                                Same term (blocked)
                                            </p>
                                        </div>
                                        <div className="rounded-lg bg-slate-50 py-2 text-center">
                                            <p className="text-xl font-bold text-slate-900">{legacyPct}</p>
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                Legacy (max)
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                            {classCodeForStudents ? (
                                <Link
                                    to={`/teacher/classes/${classCodeForStudents}/students`}
                                    className="mt-5 w-full rounded-xl border border-slate-200 py-2.5 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                                >
                                    Open class student profiles
                                </Link>
                            ) : null}
                        </div>
                    </div>

                    <div className={`${Z_CARD} p-5`}>
                        <h2 className="mb-1 text-sm font-bold text-slate-900">Student and proposal</h2>
                        <p className="mb-4 text-xs text-slate-500">Identity and submission metadata.</p>
                        <div className="divide-y divide-slate-50">
                            <DetailRow label="Proposal title" value={proposal.title} />
                            {isGroupSubmission ? (
                                <>
                                    <DetailRow label="Group" value={groupName} />
                                    <DetailRow
                                        label="Members"
                                        value={
                                            groupRoster.length ? (
                                                <ul className="space-y-1.5">
                                                    {groupRoster.map((member) => (
                                                        <li key={member._id || member.email} className="break-words">
                                                            {member.name || member.email || 'Student'}
                                                            {member.studentId ? ` (${member.studentId})` : ''}
                                                            {member.isLeader ? (
                                                                <span className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[#1e56e3]">
                                                                    (Leader)
                                                                </span>
                                                            ) : null}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                '—'
                                            )
                                        }
                                    />
                                </>
                            ) : (
                                <>
                                    <DetailRow label="Author" value={studentIdentityLabel(proposal)} />
                                    <DetailRow label="Student ID" value={student?.studentId || '—'} />
                                </>
                            )}
                            <DetailRow label="Assignment" value={assignmentTitle} />
                            <DetailRow label="Subject" value={subjectLine} />
                            <DetailRow label="Class" value={classCodeForStudents || classLabelFromAssignment(assignment) || '—'} />
                            <DetailRow label="Status" value={statusLabel(proposal.status, proposal)} />
                            <DetailRow label="Submitted" value={submittedAt} />
                            {zipUrl ? (
                                <DetailRow
                                    label="Project ZIP"
                                    value={`${zip?.originalFilename || 'project.zip'} · ${zipSizeLabel} · ${zipUploadedAt}`}
                                />
                            ) : null}
                        </div>
                    </div>

                    <div className={`${Z_CARD} flex flex-col p-5`}>
                        <div className="mb-3 flex items-start justify-between gap-2">
                            <h2 className="text-sm font-bold text-slate-900">Submission checks & history</h2>
                            {requirementIssue.failed ? (
                                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                            ) : (
                                <BarChart2 className="h-4 w-4 shrink-0 text-[#1e56e3]" />
                            )}
                        </div>
                        <p className="text-xs leading-relaxed text-slate-500">
                            Each student resubmit is logged here. Requirement failures are the real blockers; same-term
                            overlap is advisory unless it auto-rejects.
                        </p>

                        {submissionHistoryCtx.firstFailureIssues.length > 0 &&
                        submissionHistoryCtx.resolvedAfterFailure ? (
                            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                                <p className="font-bold">Student fixed earlier requirement errors</p>
                                <p className="mt-1 text-xs">
                                    Was missing:{' '}
                                    <strong>{submissionHistoryCtx.firstFailureIssues.join(' · ')}</strong>
                                </p>
                                {submissionHistoryCtx.lastResolved.length ? (
                                    <p className="mt-2 text-xs font-semibold">
                                        Now includes: {submissionHistoryCtx.lastResolved.join(', ')}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}

                        {requirementIssue.failed ? (
                            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-sm font-semibold text-rose-900">
                                {requirementIssue.summary}
                            </p>
                        ) : null}

                        <div className="mt-4">
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                Attempt timeline
                            </p>
                            <SubmissionAttemptTimeline
                                history={submissionHistoryCtx.history}
                                emptyMessage="No finalize attempts yet. History starts from the next student submit."
                            />
                        </div>

                        {!requirementIssue.failed && aiSimilarity.level === 'ok' ? (
                            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                                <p className="font-bold text-slate-800">Latest AI similarity (advisory)</p>
                                <p className="mt-1">{aiSimilarity.detail}</p>
                                <ul className="mt-2 space-y-1">
                                    <li>
                                        Same-semester overlap: <strong>{sameSemPct}</strong>
                                    </li>
                                    <li>
                                        Legacy / other term: <strong>{legacyPct}</strong>
                                    </li>
                                </ul>
                            </div>
                        ) : null}

                        {proposal.aiSummary ? (
                            <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2 text-[11px] font-mono text-slate-600">
                                {proposal.aiSummary}
                            </p>
                        ) : null}
                        {proposal.teacherComment ? (
                            <div className="mt-4 border-t border-slate-100 pt-3 text-xs font-semibold text-amber-800">
                                <span className="flex items-start gap-2">
                                    <MessageSquare className="h-4 w-4 shrink-0" />
                                    {proposal.teacherComment}
                                </span>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-5">
                    <div className="lg:col-span-3">
                        <div className={`${Z_CARD} flex min-h-0 flex-col overflow-hidden lg:min-h-[320px]`}>
                            <div className="flex flex-wrap gap-1 border-b border-slate-100 px-2 pt-2">
                                {[
                                    { id: 'proposal', label: 'Proposal content' },
                                    { id: 'activity', label: 'Submission activity' },
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setTab(t.id)}
                                        className={`rounded-t-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition ${
                                            tab === t.id
                                                ? 'border border-b-0 border-slate-200 bg-white text-[#1e56e3]'
                                                : 'border border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                            <div className="min-h-0 flex-1 bg-white p-4 md:p-5">
                                {tab === 'proposal' && (
                                    <DocumentPane
                                        title="Extracted-style view"
                                        subtitle={proposal.title || 'Proposal'}
                                        text={proposalPlain}
                                        onCopy={copyProposal}
                                    />
                                )}
                                {tab === 'activity' && (
                                    <div>
                                        <p className="mb-4 text-sm text-slate-600">
                                            Full log of requirement checks, fixes, and AI similarity on each finalize
                                            attempt.
                                        </p>
                                        <SubmissionAttemptTimeline
                                            history={submissionHistoryCtx.history}
                                            emptyMessage="No submission attempts recorded yet."
                                        />
                                        {zipUrl ? (
                                            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                                                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                                                    Project code
                                                </p>
                                                <p className="mt-1 font-bold text-slate-900">ZIP uploaded</p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    {zip?.originalFilename || 'project.zip'} ({zipSizeLabel}) at{' '}
                                                    {zipUploadedAt}.
                                                </p>
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 lg:col-span-2">
                        <div className={`${Z_CARD} p-5`}>
                            <h2 className="text-sm font-bold text-slate-900">
                                {isProjectReviewPhase ? 'Project feedback' : 'Your review'}
                            </h2>
                            <p className="mb-4 text-xs text-slate-500">
                                {isProjectReviewPhase
                                    ? 'Score and written feedback on the student project ZIP. The student sees this after submission.'
                                    : 'Score, AI comparison, and written feedback on the proposal.'}
                            </p>
                            {isProjectReviewPhase && isCollaborative && myReviewRole ? (
                                <p className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-900">
                                    You are reviewing as the{' '}
                                    <strong>{myReviewRole === 'frontend' ? 'Frontend' : 'Backend'} teacher</strong>.
                                    The student will see your feedback separately from your co-teacher.
                                </p>
                            ) : null}
                            {otherCollabProjectSlot &&
                            (otherCollabProjectSlot.comment || otherCollabProjectSlot.score != null) ? (
                                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
                                    <p className="font-bold uppercase tracking-wide text-slate-500">
                                        Co-teacher project feedback
                                    </p>
                                    {otherCollabProjectSlot.score != null ? (
                                        <p className="mt-1 font-bold">
                                            Score: {otherCollabProjectSlot.score}/{otherCollabProjectSlot.scoreMax ?? 100}
                                        </p>
                                    ) : null}
                                    {otherCollabProjectSlot.comment ? (
                                        <p className="mt-1">{otherCollabProjectSlot.comment}</p>
                                    ) : null}
                                </div>
                            ) : null}
                            {isProjectReviewPhase && (projectFeedbackComment || projectFeedbackScore != null) ? (
                                <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/80 px-3 py-2 text-xs text-violet-900">
                                    <p className="font-bold uppercase tracking-wide text-violet-700">
                                        {isCollaborative && myReviewRole ? 'Your saved project feedback' : 'Current project feedback'}
                                    </p>
                                    {projectFeedbackScore != null ? (
                                        <p className="mt-1 font-bold">
                                            Score: {projectFeedbackScore}/{projectFeedbackScoreMax}
                                        </p>
                                    ) : null}
                                    {projectFeedbackComment ? <p className="mt-1">{projectFeedbackComment}</p> : null}
                                </div>
                            ) : null}
                            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div>
                                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Points earned</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={evalScore}
                                        onChange={(e) => setEvalScore(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                        placeholder="e.g. 29"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Out of (total)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={evalScoreMax}
                                        onChange={(e) => setEvalScoreMax(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                        placeholder="e.g. 30"
                                    />
                                </div>
                                {!isProjectReviewPhase ? (
                                <div>
                                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Vs AI signal</label>
                                    <select
                                        value={vsAi}
                                        onChange={(e) => setVsAi(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                    >
                                        <option value="not_set">Not specified</option>
                                        <option value="aligns">I agree with the AI risk picture</option>
                                        <option value="stricter">I am stricter than the AI hint</option>
                                        <option value="lenient">The AI is too harsh — I accept this work</option>
                                    </select>
                                </div>
                                ) : (
                                <div className="flex items-end">
                                    <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600">
                                        Preview: {evalScore.trim() ? `${evalScore}/${evalScoreMax || '100'}` : '—'}
                                    </p>
                                </div>
                                )}
                            </div>
                            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Written feedback</label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={3}
                                className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                placeholder="Feedback for the student…"
                            />
                            <button
                                type="button"
                                disabled={!!actionId || !canSendFeedback}
                                onClick={() => runReview('comment')}
                                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                            >
                                <MessageSquare className="h-3.5 w-3.5" />
                                {isProjectReviewPhase ? 'Send project feedback' : 'Send feedback only'}
                            </button>
                        </div>

                        {showCollabPanel && (
                            <div className={`${Z_CARD} border-indigo-100 bg-indigo-50/40 p-5`}>
                                <h2 className="mb-2 text-sm font-bold text-slate-900">Collaborative approval</h2>
                                <p className="mb-3 text-xs text-slate-600">
                                    Both the frontend and backend teachers must approve before the student can submit their project.
                                </p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <div
                                        className={`rounded-lg border px-3 py-2 text-[11px] ${
                                            collabApproval?.frontendApproved
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                : 'border-amber-200 bg-amber-50 text-amber-900'
                                        }`}
                                    >
                                        <p className="font-black uppercase tracking-wider">Frontend teacher</p>
                                        <p className="mt-1 font-semibold">
                                            {collabApproval?.frontendApproved ? 'Approved' : 'Pending'}
                                        </p>
                                    </div>
                                    <div
                                        className={`rounded-lg border px-3 py-2 text-[11px] ${
                                            collabApproval?.backendApproved
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                : 'border-amber-200 bg-amber-50 text-amber-900'
                                        }`}
                                    >
                                        <p className="font-black uppercase tracking-wider">Backend teacher</p>
                                        <p className="mt-1 font-semibold">
                                            {collabApproval?.backendApproved ? 'Approved' : 'Pending'}
                                        </p>
                                    </div>
                                </div>
                                {myReviewRole && mySlotApproved && displayStatus === 'pending_teacher_approval' && (
                                    <p className="mt-3 text-xs font-semibold text-indigo-900">
                                        You already approved as the {myReviewRole} teacher. Waiting for your co-teacher.
                                    </p>
                                )}
                                {myReviewRole && !mySlotApproved && (
                                    <p className="mt-3 text-xs text-slate-600">
                                        You are reviewing as the <strong>{myReviewRole}</strong> teacher on this assignment.
                                    </p>
                                )}
                            </div>
                        )}

                        {canDecide && (
                            <div className={`${Z_CARD} p-5`}>
                                <h2 className="mb-3 text-sm font-bold text-slate-900">Decision</h2>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={!!actionId || (isCollaborative && !canApproveCollab)}
                                        onClick={() => runReview('approve')}
                                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        {approveLabel}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!!actionId}
                                        onClick={() => runReview('revision')}
                                        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                                    >
                                        <AlertTriangle className="h-4 w-4" />
                                        Request revision
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!!actionId}
                                        onClick={() => runReview('reject')}
                                        className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                                    >
                                        <XCircle className="h-4 w-4" />
                                        Reject
                                    </button>
                                </div>
                            </div>
                        )}


                        {isFullyApproved && !proposal.hasProjectSubmission && (
                            <div className={`${Z_CARD} border-amber-100 bg-amber-50/80 p-5`}>
                                <p className="text-xs font-black uppercase tracking-widest text-amber-900">Project preview</p>
                                <p className="mt-2 text-sm font-semibold text-amber-900/90">
                                    Sandbox preview will be available after the student uploads a project <code className="text-xs">.zip</code>.
                                </p>
                            </div>
                        )}

                        {isFullyApproved && proposal.hasProjectSubmission && zipUrl && (
                            <div className={`${Z_CARD} border-slate-200 bg-white p-5`}>
                                <div className="mb-3 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#1e56e3]">
                                        <Package className="h-4 w-4" />
                                        Student project (ZIP)
                                    </div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400">Download and inspect</span>
                                </div>
                                <p className="mb-4 text-xs leading-relaxed text-slate-600">
                                    This is the archive the student uploaded after approval. Download it to open locally, or use the
                                    sandbox below to run it in the browser.
                                </p>
                                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
                                        <Package className="h-5 w-5 text-[#1e56e3]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-slate-900">{zip?.originalFilename || 'project.zip'}</p>
                                        <p className="text-xs font-medium text-slate-500">
                                            {zipSizeLabel} · {zipUploadedAt}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                        <a
                                            href={zipUrl}
                                            download
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 rounded-xl bg-[#1e56e3] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#1a4dcc]"
                                        >
                                            <Download className="h-4 w-4" />
                                            Download ZIP
                                        </a>
                                        <a
                                            href={zipUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Open file
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isFullyApproved && proposal.hasProjectSubmission && (
                            <div className={`${Z_CARD} border-emerald-100 bg-emerald-50/60 p-5`}>
                                <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-900">
                                    <Shield className="h-4 w-4" />
                                    Docker sandbox preview
                                </div>
                                <p className="mb-3 text-xs font-semibold text-emerald-900/85">
                                    Spins up a temporary container from the uploaded ZIP so you can click through the app without
                                    installing it locally.
                                </p>

                                {(() => {
                                    const sess = previewSessionByProposal[proposal._id];
                                    const previewRunning = sess?.status === 'running';
                                    const previewStarting = sess?.status === 'starting';
                                    const previewOpenReady = isPreviewOpenReady(sess);
                                    const displayIdentifier =
                                        previewOpenReady && (sess?.previewLoginEmail || previewAdminEmail)
                                            ? sess?.previewLoginEmail || previewAdminEmail
                                            : '';
                                    const displayPassword =
                                        previewOpenReady && (sess?.previewLoginPassword || previewAdminPassword)
                                            ? sess?.previewLoginPassword || previewAdminPassword
                                            : '';
                                    const identifierLabel = sess?.previewLoginIdentifierLabel || 'Email';
                                    const identifierType =
                                        sess?.previewLoginIdentifierType === 'email' ? 'email' : 'text';
                                    const loginSource = sess?.previewLoginSource || '';
                                    const fromProject =
                                        loginSource === 'project_files' || loginSource === 'project_php_setup';
                                    const loginUrl =
                                        sess?.previewLoginUrl ||
                                        (sess?.previewUrl ? `${String(sess.previewUrl).replace(/\/$/, '')}/login` : '');
                                    const copyText = async (label, value) => {
                                        if (!value) return;
                                        try {
                                            await copyTextToClipboard(value);
                                            await appSuccess(`${label} copied`);
                                        } catch {
                                            await appWarning(`Could not copy ${label.toLowerCase()} automatically. Select the field and copy manually.`);
                                        }
                                    };

                                    if (!previewOpenReady) {
                                        return (
                                            <div className="mb-4 rounded-2xl border border-dashed border-emerald-300 bg-white/80 p-4">
                                                <p className="text-sm font-black text-slate-900">Login credentials</p>
                                                <p className="mt-1 text-xs font-semibold text-slate-600">
                                                    {!sess
                                                        ? 'Click Start preview below. Email and password appear here once the container is ready and Open preview unlocks.'
                                                        : previewStarting || previewRunning
                                                          ? 'Preview is building… login credentials will appear when Open preview becomes available.'
                                                          : 'Start preview again to load login credentials for the student app.'}
                                                </p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="mb-4 rounded-2xl border-2 border-emerald-500 bg-white p-4 shadow-sm">
                                            <p className="text-sm font-black text-emerald-900">Preview ready — sign in to the student app</p>
                                            <p className="mt-1 mb-4 text-xs font-semibold text-slate-600">
                                                {fromProject
                                                    ? `Open preview, then use this ${identifierLabel.toLowerCase()} and password from the student project on the login page.`
                                                    : `Open preview, then use this ${identifierLabel.toLowerCase()} and password on the student login page.`}
                                            </p>
                                            <div className="space-y-3">
                                                <div>
                                                    <label
                                                        className="text-[10px] font-black uppercase tracking-widest text-slate-500"
                                                        htmlFor="preview-admin-identifier"
                                                    >
                                                        {identifierLabel}
                                                    </label>
                                                    <div className="mt-1 flex gap-2">
                                                        <input
                                                            id="preview-admin-identifier"
                                                            type={identifierType}
                                                            value={displayIdentifier}
                                                            onChange={(e) => setPreviewAdminEmail(e.target.value)}
                                                            disabled={!!previewBusyId}
                                                            readOnly={fromProject && !!sess?.previewLoginEmail}
                                                            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-900"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => copyText(identifierLabel, displayIdentifier)}
                                                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                                            title={`Copy ${identifierLabel.toLowerCase()}`}
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label
                                                        className="text-[10px] font-black uppercase tracking-widest text-slate-500"
                                                        htmlFor="preview-admin-password"
                                                    >
                                                        Password
                                                    </label>
                                                    <div className="mt-1 flex gap-2">
                                                        <input
                                                            id="preview-admin-password"
                                                            type="text"
                                                            value={displayPassword}
                                                            onChange={(e) => setPreviewAdminPassword(e.target.value)}
                                                            disabled={!!previewBusyId}
                                                            readOnly={fromProject && !!sess?.previewLoginPassword}
                                                            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-900"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => copyText('Password', displayPassword)}
                                                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                                            title="Copy password"
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            {loginUrl && (
                                                <p className="mt-4 text-xs font-semibold text-slate-700">
                                                    Student login page:{' '}
                                                    <a
                                                        href={safePreviewUrl(loginUrl)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-bold text-[#1e56e3] underline break-all"
                                                    >
                                                        {loginUrl}
                                                    </a>
                                                </p>
                                            )}
                                            {sess?.previewApiUrl && (
                                                <p className="mt-2 text-xs font-semibold text-slate-600">
                                                    Student API (not port 5000):{' '}
                                                    <code className="bg-white px-1 rounded text-[11px]">{sess.previewApiUrl}</code>
                                                    {sess.apiPortReachable === false && (
                                                        <span className="ml-1 text-rose-700 font-bold">
                                                            — API still starting; wait a moment before signing in.
                                                        </span>
                                                    )}
                                                </p>
                                            )}
                                            {sess?.previewLoginHint && (
                                                <p className="mt-2 text-[11px] font-semibold text-emerald-800">{sess.previewLoginHint}</p>
                                            )}
                                        </div>
                                    );
                                })()}

                                <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
                                    <p className="text-xs font-bold text-emerald-900">
                                        Automatic preview
                                    </p>
                                    <p className="mt-1 text-[11px] font-medium text-emerald-800/90">
                                        After you click Start preview, the system extracts the student ZIP, detects the
                                        project type, and runs the matching Docker template (cached for fast start).
                                    </p>
                                    {(() => {
                                        const sess = previewSessionByProposal[proposal._id];
                                        if (!sess?.previewStack) return null;
                                        return (
                                            <p className="mt-2 text-xs font-bold text-emerald-900">
                                                Detected type:{' '}
                                                <span className="rounded-md bg-white px-2 py-0.5 text-emerald-800">
                                                    {previewStackLabel(sess.previewStack, sess)}
                                                </span>
                                            </p>
                                        );
                                    })()}
                                </div>
                                {(() => {
                                    const sess = previewSessionByProposal[proposal._id];
                                    const terminal = ['stopped', 'failed', 'expired', 'runtime_error'].includes(sess?.status);
                                    const running = sess?.status === 'running';
                                    const starting = sess?.status === 'starting';
                                    const failed = sess?.status === 'failed' || sess?.status === 'runtime_error';
                                    const previewOpenReady = isPreviewOpenReady(sess);
                                    return (
                                        <div className="space-y-3">
                                        {failed && sess.errorMessage && (
                                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                                                <p className="font-bold">
                                                    {sess.validationFailures?.some((f) => f.rule === 'container_runtime')
                                                        ? 'Preview failed in Docker'
                                                        : sess.validationFailures?.length > 0
                                                          ? 'Student project cannot be previewed'
                                                          : sess.status === 'runtime_error'
                                                            ? 'Runtime error'
                                                            : 'Preview failed'}
                                                </p>
                                                <p className="mt-1 font-semibold">{sess.errorMessage}</p>
                                                {sess.validationFailures?.length > 0 && (
                                                    <div className="mt-2">
                                                        <p className="text-xs font-bold uppercase tracking-wide text-rose-700">
                                                            {sess.validationFailures.some((f) => f.rule === 'container_runtime')
                                                                ? 'Error from container'
                                                                : 'What the student is missing'}
                                                        </p>
                                                        <ul className="mt-1 list-disc pl-4 text-xs font-semibold">
                                                            {sess.validationFailures.map((f, i) => (
                                                                <li key={`${f.rule}-${i}`}>
                                                                    {f.message}
                                                                    {f.path ? ` (${f.path})` : ''}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {sess.runtimeTraceback && (
                                                    <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-rose-200 bg-white/80 p-2 text-[10px] font-mono text-rose-900">
                                                        {sess.runtimeTraceback.slice(-3000)}
                                                    </pre>
                                                )}
                                                {!sess.validationFailures?.length && !sess.runtimeTraceback && failed && (
                                                    <p className="mt-2 text-xs text-rose-700">
                                                        Check the session log below for details.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2">
                                            {(!sess || terminal) && (
                                                <button
                                                    type="button"
                                                    disabled={!!previewBusyId}
                                                    onClick={startPreview}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                                >
                                                    <PlayCircle className="h-4 w-4" />
                                                    {previewBusyId === proposal._id ? 'Starting…' : 'Start preview'}
                                                </button>
                                            )}
                                            {starting && !sess.previewUrl && (
                                                <span className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Building container…
                                                </span>
                                            )}
                                            {(running || starting) && sess.previewUrl && (
                                                <>
                                                    {starting && (
                                                        <span className="flex items-center gap-2 text-sm font-bold text-amber-800">
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            {sess.previewStack === 'static-html' || sess.previewStack === 'static-html-js'
                                                                ? 'Starting static site…'
                                                                : sess.previewStack === 'php-apache'
                                                                  ? 'Starting Apache…'
                                                                  : sess.previewStack === 'jupyter'
                                                                    ? 'Starting Jupyter…'
                                                                    : sess.previewWorkspaceCached
                                                                      ? 'Restarting from cached build (usually 30s–2 min)…'
                                                                      : sess.previewTemplateCached
                                                                        ? 'Using cached Docker template — installing deps (1–5 min)…'
                                                                        : sess.previewStack === 'java-spring-react'
                                                                          ? 'First start: Maven + npm build (5–15 min)…'
                                                                          : 'Installing dependencies & starting app (1–5 min)…'}
                                                        </span>
                                                    )}
                                                    {running && !previewOpenReady && sess.portReachable === false && (
                                                        <span className="text-sm font-bold text-rose-700">
                                                            UI port not responding — click Stop, then Start preview again.
                                                        </span>
                                                    )}
                                                    {running &&
                                                        !previewOpenReady &&
                                                        sess.portReachable &&
                                                        sess.previewAppReadyReason === 'placeholder_or_empty' && (
                                                            <span className="text-sm font-bold text-amber-800">
                                                                Student app is still installing in Docker — wait for “Preview ready” in the log.
                                                            </span>
                                                        )}
                                                    {running &&
                                                        sess.previewApiHostPort &&
                                                        sess.apiPortReachable === false && (
                                                            <span className="text-sm font-bold text-rose-700">
                                                                {sess.previewStack === 'java-spring-react'
                                                                    ? `Spring API on :${sess.previewApiHostPort} is not ready — login will fail until it listens. Wait for Maven (first start) or Stop + Start preview so H2 is rebuilt into the jar. Check session logs for DIAGNOSIS.`
                                                                    : `Student API on :${sess.previewApiHostPort} not ready — wait or check MongoDB.`}
                                                            </span>
                                                        )}
                                                    {previewOpenReady ? (
                                                        <a
                                                            href={safePreviewUrl(sess.previewUrl)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-2 rounded-xl bg-[#1e56e3] px-4 py-2 text-sm font-bold text-white hover:bg-[#1a4dcc]"
                                                            title="Preview is ready"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                            Open preview
                                                        </a>
                                                    ) : (
                                                        <span
                                                            className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-300 px-4 py-2 text-sm font-bold text-slate-600"
                                                            title="Wait until the log shows Preview ready"
                                                        >
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            {starting
                                                                ? 'Open preview (starting…)'
                                                                : sess.previewAppReadyReason === 'api_not_http' ||
                                                                    sess.previewAppReadyReason === 'api_port_closed'
                                                                  ? 'Open preview (API starting…)'
                                                                  : 'Open preview (building…)'}
                                                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        disabled={!!previewBusyId}
                                                        onClick={stopPreview}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50"
                                                    >
                                                        <Square className="h-4 w-4" />
                                                        Stop
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        </div>
                                    );
                                })()}
                                {(() => {
                                    const sess = previewSessionByProposal[proposal._id];
                                    if (!sess?.logs?.length && !sess?.liveContainerLog) return null;
                                    return (
                                    <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white/90 p-2 font-mono text-[11px] text-slate-600">
                                        {(sess.logs || []).slice(-8).map((log, i) => (
                                            <div key={`l-${i}`} className="truncate">
                                                <span className="text-slate-400">{log.level}</span> {log.message}
                                            </div>
                                        ))}
                                        {sess.liveContainerLog && (
                                            <pre className="mt-2 whitespace-pre-wrap text-[10px] text-slate-500 border-t border-slate-100 pt-2">
                                                {sess.liveContainerLog}
                                            </pre>
                                        )}
                                    </div>
                                    );
                                })()}
                            </div>
                        )}

                        <div className={`${Z_CARD} p-5`}>
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <h2 className="text-sm font-bold text-slate-900">Proposal record</h2>
                                <span className="text-xs font-semibold text-slate-400">Text submission</span>
                            </div>
                            <p className="text-xs text-slate-500">
                                Text proposal fields render in the left panel like extracted uploads. When the student submits a project
                                archive, it appears here too.
                            </p>
                            <ul className="mt-4 space-y-2">
                                <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
                                        <FileText className="h-5 w-5 text-[#1e56e3]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-slate-900">{proposal.title || 'Proposal'}</p>
                                        <p className="text-xs font-medium text-slate-500">Overview + feature list</p>
                                    </div>
                                </li>
                                {zipUrl ? (
                                    <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
                                            <Package className="h-5 w-5 text-emerald-600" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-slate-900">{zip?.originalFilename || 'project.zip'}</p>
                                            <p className="text-xs font-medium text-slate-500">
                                                {zipSizeLabel} · {zipUploadedAt}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 gap-1">
                                            <a
                                                href={zipUrl}
                                                download
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-[#1e56e3]"
                                                title="Download"
                                            >
                                                <Download className="h-4 w-4" />
                                            </a>
                                            <a
                                                href={zipUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-[#1e56e3]"
                                                title="Open"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </div>
                                    </li>
                                ) : null}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

function classLabelFromAssignment(a) {
    if (!a) return '';
    if (Array.isArray(a.classNames) && a.classNames.length) return a.classNames.join(', ');
    if (Array.isArray(a.assignedClasses) && a.assignedClasses.length) return a.assignedClasses.join(', ');
    return [a.class?.code, a.class?.name].filter(Boolean).join(' · ') || '';
}

export default TeacherProposalStudentDetail;
