import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import { getApiOrigin } from '../../../lib/api';
import ExtractedSubmissionView from '../components/ExtractedSubmissionView';
import { Z_PAGE, Z_INNER, Z_CARD, Z_LINK } from '../../../shared/ui/zendentaLayout';

const statusLabel = (s) => {
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
    return map[s] || s;
};

const studentIdentityLabel = (proposal) => {
    const name = proposal?.submittedBy?.name || 'Student';
    const sid = proposal?.submittedBy?.studentId || proposal?.submittedBy?.email || '';
    return sid ? `${name} (${sid})` : name;
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
    }
    if (p.aiSummary) {
        parts.push(`\n\nAI SUMMARY (ADVISORY)\n${p.aiSummary}`);
    }
    return parts.join('');
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
    const [assignment, setAssignment] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('proposal');
    const [actionId, setActionId] = useState(null);
    const [comment, setComment] = useState('');
    const [evalScore, setEvalScore] = useState('');
    const [vsAi, setVsAi] = useState('not_set');
    const [previewSessionByProposal, setPreviewSessionByProposal] = useState({});
    const [previewBusyId, setPreviewBusyId] = useState(null);
    /** auto | node-js | php-apache | jupyter */
    const [previewStackChoice, setPreviewStackChoice] = useState('node-js');
    const [previewAdminEmail, setPreviewAdminEmail] = useState('admin@preview.demo');
    const [previewAdminPassword, setPreviewAdminPassword] = useState('Preview123!');
    const previewMapRef = useRef({});

    useEffect(() => {
        previewMapRef.current = previewSessionByProposal;
    }, [previewSessionByProposal]);

    useEffect(() => {
        const tick = async () => {
            const prev = previewMapRef.current;
            const active = Object.entries(prev).filter(([, s]) =>
                ['running', 'starting'].includes(s?.status)
            );
            for (const [pid, s] of active) {
                try {
                    const r = await teacherService.getPreviewSession(s._id);
                    if (r.success && r.data) {
                        setPreviewSessionByProposal((p) => ({ ...p, [pid]: r.data }));
                    }
                } catch {
                    /* ignore */
                }
            }
        };
        tick();
        const iv = setInterval(tick, 2000);
        return () => clearInterval(iv);
    }, []);

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

    useEffect(() => {
        if (!proposal) return;
        setComment('');
        setEvalScore(
            proposal.teacherProposalScore != null && proposal.teacherProposalScore !== undefined
                ? String(proposal.teacherProposalScore)
                : ''
        );
        setVsAi(
            proposal.teacherVsAi && ['aligns', 'stricter', 'lenient', 'not_set'].includes(proposal.teacherVsAi)
                ? proposal.teacherVsAi
                : 'not_set'
        );
    }, [proposal?._id, proposal?.teacherProposalScore, proposal?.teacherVsAi]);

    const proposalPlain = useMemo(() => buildProposalPlainText(proposal), [proposal]);

    const reviewPayload = () => {
        const n = String(evalScore).trim();
        const num = n === '' ? undefined : Number(n);
        return {
            comment,
            teacherProposalScore: num !== undefined && !Number.isNaN(num) && num >= 0 && num <= 100 ? num : undefined,
            vsAi: vsAi || 'not_set',
        };
    };

    const runReview = async (action) => {
        if (!proposal) return;
        setActionId(proposal._id + action);
        try {
            const res = await teacherService.reviewProposal(proposal._id, { action, ...reviewPayload() });
            if (res.success) {
                setComment('');
                await load();
            }
        } catch (e) {
            alert(e.response?.data?.message || 'Action failed');
        } finally {
            setActionId(null);
        }
    };

    const startPreview = async () => {
        if (!proposal) return;
        setPreviewBusyId(proposal._id);
        try {
            const r = await teacherService.startProposalPreview(proposal._id, {
                stack: previewStackChoice,
                adminEmail: previewAdminEmail.trim(),
                adminPassword: previewAdminPassword,
            });
            if (r.success && r.data) {
                setPreviewSessionByProposal((prev) => ({ ...prev, [proposal._id]: r.data }));
                if (r.data.previewLoginEmail) setPreviewAdminEmail(r.data.previewLoginEmail);
                if (r.data.previewLoginPassword) setPreviewAdminPassword(r.data.previewLoginPassword);
            } else {
                alert(r.message || 'Could not start preview');
            }
        } catch (e) {
            alert(e.response?.data?.message || 'Could not start preview');
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
            alert(e.response?.data?.message || 'Stop failed');
        } finally {
            setPreviewBusyId(null);
        }
    };

    const copyProposal = async () => {
        if (!proposalPlain) return;
        try {
            await navigator.clipboard.writeText(proposalPlain);
        } catch {
            /* ignore */
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

    const sameSemPct = Number.isFinite(proposal.aiSameSemesterMaxScore)
        ? `${Math.round(Number(proposal.aiSameSemesterMaxScore) * 100)}%`
        : '—';
    const legacyPct = Number.isFinite(proposal.aiPreviousSemesterMaxScore)
        ? `${Math.round(Number(proposal.aiPreviousSemesterMaxScore) * 100)}%`
        : '—';

    const zip = proposal.latestProjectSubmission;
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
                    <span className="max-w-[180px] truncate text-slate-800 md:max-w-md" title={student?.name || ''}>
                        {student?.name || 'Student'}
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

                <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className={`${Z_CARD} p-5`}>
                        <div className="flex flex-col items-center text-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#1e56e3] to-[#3b74ff] text-2xl font-bold text-white shadow-md">
                                {(student?.name || student?.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <h1 className="mt-4 text-lg font-bold text-slate-900">{student?.name || 'Student'}</h1>
                            <p className="mt-1 max-w-full break-all text-sm text-slate-500">{student?.email || '—'}</p>
                            <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#1e56e3]">
                                {statusLabel(proposal.status)}
                            </p>
                            <div className="mt-5 grid w-full grid-cols-2 gap-3 border-t border-slate-100 pt-5">
                                <div className="rounded-lg bg-slate-50 py-2 text-center">
                                    <p className="text-xl font-bold text-slate-900">{sameSemPct}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Same term (max)</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 py-2 text-center">
                                    <p className="text-xl font-bold text-slate-900">{legacyPct}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Legacy (max)</p>
                                </div>
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
                            <DetailRow label="Author" value={studentIdentityLabel(proposal)} />
                            <DetailRow label="Student ID" value={student?.studentId || '—'} />
                            <DetailRow label="Assignment" value={assignmentTitle} />
                            <DetailRow label="Subject" value={subjectLine} />
                            <DetailRow label="Class" value={classCodeForStudents || classLabelFromAssignment(assignment) || '—'} />
                            <DetailRow label="Status" value={statusLabel(proposal.status)} />
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
                            <h2 className="text-sm font-bold text-slate-900">AI similarity</h2>
                            <BarChart2 className="h-4 w-4 shrink-0 text-[#1e56e3]" />
                        </div>
                        <p className="text-xs leading-relaxed text-slate-500">
                            Advisory signals only — not a grade. You decide approve, revision, or reject.
                        </p>
                        {proposal.aiSummary ? (
                            <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2 text-[11px] font-mono text-slate-600">{proposal.aiSummary}</p>
                        ) : null}
                        <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                            <li className="flex gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1e56e3]" />
                                <span>
                                    Same-semester overlap (max): <strong>{sameSemPct}</strong>
                                </span>
                            </li>
                            <li className="flex gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1e56e3]" />
                                <span>
                                    Legacy / other term (max): <strong>{legacyPct}</strong>
                                </span>
                            </li>
                        </ul>
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
                        <div className={`${Z_CARD} flex min-h-[420px] flex-col overflow-hidden`}>
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
                                    <div className="relative pl-6">
                                        <div className="absolute bottom-2 left-[11px] top-2 w-0.5 bg-[#1e56e3]/25" />
                                        <ul className="space-y-6">
                                            <li className="relative">
                                                <span className="absolute -left-1 top-1.5 flex h-3 w-3 -translate-x-[1.125rem] items-center justify-center rounded-full border-2 border-white bg-[#1e56e3] shadow" />
                                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Record</p>
                                                <p className="mt-1 font-bold text-slate-900">Proposal received</p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    {proposal.submittedAt
                                                        ? `Recorded at ${submittedAt}.`
                                                        : 'No submission timestamp on file.'}
                                                </p>
                                            </li>
                                            <li className="relative">
                                                <span className="absolute -left-1 top-1.5 flex h-3 w-3 -translate-x-[1.125rem] items-center justify-center rounded-full border-2 border-white bg-[#1e56e3] shadow" />
                                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Workflow</p>
                                                <p className="mt-1 font-bold text-slate-900">{statusLabel(proposal.status)}</p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    Current proposal state in the assignment pipeline.
                                                </p>
                                            </li>
                                            {zipUrl ? (
                                                <li className="relative">
                                                    <span className="absolute -left-1 top-1.5 flex h-3 w-3 -translate-x-[1.125rem] items-center justify-center rounded-full border-2 border-white bg-emerald-600 shadow" />
                                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Project code</p>
                                                    <p className="mt-1 font-bold text-slate-900">ZIP uploaded</p>
                                                    <p className="mt-1 text-sm text-slate-600">
                                                        {zip?.originalFilename || 'project.zip'} ({zipSizeLabel}) at {zipUploadedAt}. Use
                                                        Download ZIP on the right or sandbox preview to inspect.
                                                    </p>
                                                </li>
                                            ) : null}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 lg:col-span-2">
                        <div className={`${Z_CARD} p-5`}>
                            <h2 className="text-sm font-bold text-slate-900">Your review</h2>
                            <p className="mb-4 text-xs text-slate-500">Score, AI comparison, and written feedback.</p>
                            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Quality score (0–100)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={evalScore}
                                        onChange={(e) => setEvalScore(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                        placeholder="e.g. 78"
                                    />
                                </div>
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
                                disabled={!!actionId || !comment.trim()}
                                onClick={() => runReview('comment')}
                                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                            >
                                <MessageSquare className="h-3.5 w-3.5" />
                                Send feedback only
                            </button>
                        </div>

                        {(proposal.status === 'pending_teacher_approval' || proposal.status === 'revision_required') && (
                            <div className={`${Z_CARD} p-5`}>
                                <h2 className="mb-3 text-sm font-bold text-slate-900">Decision</h2>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={!!actionId}
                                        onClick={() => runReview('approve')}
                                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        Approve
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


                        {proposal.status === 'teacher_approved' && !proposal.hasProjectSubmission && (
                            <div className={`${Z_CARD} border-amber-100 bg-amber-50/80 p-5`}>
                                <p className="text-xs font-black uppercase tracking-widest text-amber-900">Project preview</p>
                                <p className="mt-2 text-sm font-semibold text-amber-900/90">
                                    Sandbox preview will be available after the student uploads a project <code className="text-xs">.zip</code>.
                                </p>
                            </div>
                        )}

                        {proposal.status === 'teacher_approved' && proposal.hasProjectSubmission && zipUrl && (
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

                        {proposal.status === 'teacher_approved' && proposal.hasProjectSubmission && (
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
                                    const displayEmail = sess?.previewLoginEmail || previewAdminEmail;
                                    const displayPassword = sess?.previewLoginPassword || previewAdminPassword;
                                    const loginUrl =
                                        sess?.previewLoginUrl ||
                                        (sess?.previewUrl ? `${String(sess.previewUrl).replace(/\/$/, '')}/login` : '');
                                    const copyText = async (label, value) => {
                                        try {
                                            await navigator.clipboard.writeText(value);
                                            alert(`${label} copied`);
                                        } catch {
                                            alert(`Copy ${label} manually: ${value}`);
                                        }
                                    };
                                    return (
                                        <div className="mb-4 rounded-2xl border-2 border-emerald-500 bg-white p-4 shadow-sm">
                                            <p className="text-sm font-black text-slate-900">Login credentials for student app</p>
                                            <p className="mt-1 mb-4 text-xs font-semibold text-slate-600">
                                                Use this email and password on the student login page after you open the preview.
                                            </p>
                                            <div className="space-y-3">
                                                <div>
                                                    <label
                                                        className="text-[10px] font-black uppercase tracking-widest text-slate-500"
                                                        htmlFor="preview-admin-email"
                                                    >
                                                        Email
                                                    </label>
                                                    <div className="mt-1 flex gap-2">
                                                        <input
                                                            id="preview-admin-email"
                                                            type="email"
                                                            value={previewAdminEmail}
                                                            onChange={(e) => setPreviewAdminEmail(e.target.value)}
                                                            disabled={!!previewBusyId}
                                                            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-900"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => copyText('Email', displayEmail)}
                                                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                                            title="Copy email"
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
                                                            value={previewAdminPassword}
                                                            onChange={(e) => setPreviewAdminPassword(e.target.value)}
                                                            disabled={!!previewBusyId}
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
                                            {loginUrl && previewRunning && (
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
                                            {previewStarting && (
                                                <p className="mt-4 text-xs font-semibold text-amber-800">
                                                    Wait until status shows “Preview ready” in the log below, then open
                                                    the login page.
                                                </p>
                                            )}
                                            {sess?.previewApiUrl && ['starting', 'running'].includes(sess?.status) && (
                                                <p className="mt-2 text-xs font-semibold text-slate-600">
                                                    Student API (not port 5000):{' '}
                                                    <code className="bg-white px-1 rounded text-[11px]">{sess.previewApiUrl}</code>
                                                    {sess.apiPortReachable === false && (
                                                        <span className="ml-1 text-rose-700 font-bold">
                                                            — API not responding yet; wait for Preview ready or check MongoDB is running.
                                                        </span>
                                                    )}
                                                </p>
                                            )}
                                            <p className="mt-3 text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                                                Wait until the log shows Preview ready, then sign in. ERR_EMPTY_RESPONSE means the student API
                                                is still starting — Stop and Start preview again if it persists after 5 minutes.
                                            </p>
                                            {sess?.previewLoginHint && (
                                                <p className="mt-2 text-[11px] font-semibold text-emerald-800">{sess.previewLoginHint}</p>
                                            )}
                                        </div>
                                    );
                                })()}

                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <label className="text-xs font-bold text-emerald-900" htmlFor="preview-stack">
                                        Container type
                                    </label>
                                    <select
                                        id="preview-stack"
                                        value={previewStackChoice}
                                        onChange={(e) => setPreviewStackChoice(e.target.value)}
                                        disabled={!!previewBusyId}
                                        className="rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800"
                                    >
                                        <option value="auto">Auto-detect from ZIP</option>
                                        <option value="node-js">React / Node.js</option>
                                        <option value="php-apache">PHP / Apache</option>
                                        <option value="jupyter">Jupyter notebook</option>
                                    </select>
                                </div>
                                {(() => {
                                    const sess = previewSessionByProposal[proposal._id];
                                    const terminal = ['stopped', 'failed', 'expired'].includes(sess?.status);
                                    const running = sess?.status === 'running';
                                    const starting = sess?.status === 'starting';
                                    const failed = sess?.status === 'failed';
                                    return (
                                        <div className="space-y-3">
                                        {failed && sess.errorMessage && (
                                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                                                {sess.errorMessage}
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
                                                            {sess.previewStack === 'php-apache'
                                                                ? 'Starting Apache…'
                                                                : sess.previewStack === 'jupyter'
                                                                  ? 'Starting Jupyter…'
                                                                  : 'Installing dependencies & starting app (1–5 min)…'}
                                                        </span>
                                                    )}
                                                    {running && sess.portReachable === false && (
                                                        <span className="text-sm font-bold text-rose-700">
                                                            UI port not responding — click Stop, then Start preview again.
                                                        </span>
                                                    )}
                                                    {running &&
                                                        sess.previewApiHostPort &&
                                                        sess.apiPortReachable === false && (
                                                            <span className="text-sm font-bold text-rose-700">
                                                                Student API on :{sess.previewApiHostPort} not ready — wait or check MongoDB.
                                                            </span>
                                                        )}
                                                    {sess.portReachable === false && !running ? (
                                                        <span
                                                            className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-400 px-4 py-2 text-sm font-bold text-white opacity-80"
                                                            title="Waiting for the preview port to open"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                            Open preview (starting…)
                                                        </span>
                                                    ) : (
                                                    <a
                                                        href={safePreviewUrl(sess.previewUrl)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white ${
                                                            running && sess.portReachable !== false
                                                                ? 'bg-[#1e56e3] hover:bg-[#1a4dcc]'
                                                                : 'bg-amber-600 hover:bg-amber-700'
                                                        }`}
                                                        title={
                                                            running && sess.portReachable !== false
                                                                ? 'Preview is ready'
                                                                : 'Placeholder page may show first — refresh after logs say Preview ready'
                                                        }
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        {running && sess.portReachable !== false
                                                            ? 'Open preview'
                                                            : 'Open preview (loading…)'}
                                                    </a>
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
