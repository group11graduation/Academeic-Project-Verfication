import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import teacherService from '../../../services/teacherService';

const statusLabel = (s) => {
    const map = {
        draft: 'Draft',
        submitted: 'Submitted',
        ai_rejected_same_semester: 'AI rejected (same semester)',
        ai_flagged_previous_semester: 'AI warning (legacy similarity)',
        revision_required: 'Revision required',
        pending_teacher_approval: 'Pending your approval',
        teacher_approved: 'Approved',
        teacher_rejected: 'Rejected'
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

const TeacherAssignmentProposals = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [assignment, setAssignment] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState(null);
    const [comment, setComment] = useState('');
    /** proposalId -> latest preview session doc */
    const [previewSessionByProposal, setPreviewSessionByProposal] = useState({});
    const [previewBusyId, setPreviewBusyId] = useState(null);
    const [openProposalId, setOpenProposalId] = useState(null);
    const previewMapRef = useRef({});

    useEffect(() => {
        previewMapRef.current = previewSessionByProposal;
    }, [previewSessionByProposal]);

    useEffect(() => {
        const iv = setInterval(async () => {
            const prev = previewMapRef.current;
            const running = Object.entries(prev).filter(([, s]) => s?.status === 'running');
            for (const [pid, s] of running) {
                try {
                    const r = await teacherService.getPreviewSession(s._id);
                    if (r.success && r.data) {
                        setPreviewSessionByProposal((p) => ({ ...p, [pid]: r.data }));
                    }
                } catch {
                    /* ignore transient errors */
                }
            }
        }, 4000);
        return () => clearInterval(iv);
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [aRes, pRes] = await Promise.all([
                teacherService.getAssignmentById(id),
                teacherService.getProposalsForAssignment(id)
            ]);
            if (aRes.success) setAssignment(aRes.data);
            if (pRes.success) {
                const rows = pRes.data || [];
                setProposals(rows);
                setOpenProposalId((prev) => prev || rows[0]?._id || null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [id]);

    const startPreview = async (proposalId) => {
        setPreviewBusyId(proposalId);
        try {
            const r = await teacherService.startProposalPreview(proposalId);
            if (r.success && r.data) {
                setPreviewSessionByProposal((prev) => ({ ...prev, [proposalId]: r.data }));
            } else {
                alert(r.message || 'Could not start preview');
            }
        } catch (e) {
            alert(e.response?.data?.message || 'Could not start preview');
        } finally {
            setPreviewBusyId(null);
        }
    };

    const stopPreview = async (proposalId) => {
        const s = previewSessionByProposal[proposalId];
        if (!s?._id) return;
        setPreviewBusyId(proposalId);
        try {
            const r = await teacherService.stopPreviewSession(s._id);
            if (r.success && r.data) {
                setPreviewSessionByProposal((prev) => ({ ...prev, [proposalId]: r.data }));
            }
        } catch (e) {
            alert(e.response?.data?.message || 'Stop failed');
        } finally {
            setPreviewBusyId(null);
        }
    };

    const runReview = async (proposalId, action) => {
        setActionId(proposalId + action);
        try {
            const res = await teacherService.reviewProposal(proposalId, { action, comment });
            if (res.success) await load();
        } catch (e) {
            alert(e.response?.data?.message || 'Action failed');
        } finally {
            setActionId(null);
            setComment('');
        }
    };

    if (loading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    const selectedProposal = proposals.find((p) => p._id === openProposalId) || proposals[0] || null;

    return (
        <div className="p-6 md:p-10 max-w-[1200px] mx-auto">
            <button
                type="button"
                onClick={() => navigate(`/teacher/assignments/${id}`)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm mb-6"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to assignment
            </button>

            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                Proposal review
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8">
                {assignment?.title || 'Assignment'} — approve, reject, or request revision when status is pending.
            </p>

            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
                <p className="font-bold">Step 1: Select a student card</p>
                <p className="text-xs mt-1">Step 2: Review that student&apos;s proposal and project preview below.</p>
            </div>

            {proposals.length === 0 ? (
                <p className="text-slate-500">No proposals yet.</p>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                        {proposals.map((p) => (
                            <button
                                key={p._id}
                                type="button"
                                onClick={() => setOpenProposalId(p._id)}
                                className={`text-left rounded-xl border p-4 transition-all ${
                                    selectedProposal?._id === p._id
                                        ? 'border-[#1D68E3] bg-blue-50/70 shadow-sm'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                            >
                                <p className="text-sm font-black text-slate-900">{studentIdentityLabel(p)}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{statusLabel(p.status)}</p>
                                <p className="text-xs font-semibold text-slate-600 mt-1 truncate">{p.title || 'Untitled proposal'}</p>
                            </button>
                        ))}
                    </div>

                    {selectedProposal && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
                            <div className="flex flex-wrap justify-between gap-4 mb-4">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                        {selectedProposal.title || 'Proposal'}
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        By {studentIdentityLabel(selectedProposal)} · {statusLabel(selectedProposal.status)}
                                    </p>
                                </div>
                                {selectedProposal.aiSummary && (
                                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                        {selectedProposal.aiSummary}
                                    </span>
                                )}
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                                    Optional comment for this student
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={2}
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm"
                                    placeholder="Feedback for the student..."
                                />
                                <div className="mt-2">
                                    <button
                                        type="button"
                                        disabled={!!actionId || !comment.trim()}
                                        onClick={() => runReview(selectedProposal._id, 'comment')}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 text-xs font-bold disabled:opacity-50"
                                    >
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        Send feedback
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-4 mb-4">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Step 2A: Proposal details</p>
                                <p className="text-slate-700 dark:text-slate-300 text-sm mb-3 whitespace-pre-wrap">
                                    {selectedProposal.description}
                                </p>
                                <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 mb-2">
                                    {(selectedProposal.features || []).map((f, i) => (
                                        <li key={i}>{f}</li>
                                    ))}
                                </ul>
                                {selectedProposal.teacherComment && (
                                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-2 flex items-start gap-2">
                                        <MessageSquare className="h-4 w-4 shrink-0 mt-0.5" />
                                        {selectedProposal.teacherComment}
                                    </p>
                                )}
                            </div>

                            {selectedProposal.status === 'teacher_approved' && !selectedProposal.hasProjectSubmission && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 p-3 text-xs font-bold text-amber-800 dark:text-amber-200 mb-4">
                                    <p className="font-black uppercase tracking-widest mb-1">Step 2B: Project preview</p>
                                    Sandbox preview will be available after the student uploads a project <code className="text-[10px]">.zip</code>.
                                </div>
                            )}

                            {selectedProposal.status === 'teacher_approved' && selectedProposal.hasProjectSubmission && (
                                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 mb-4">
                                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-black uppercase tracking-widest mb-2">
                                        <Shield className="h-4 w-4" />
                                        Step 2B: Docker sandbox project preview
                                    </div>
                                    {(() => {
                                        const sess = previewSessionByProposal[selectedProposal._id];
                                        const terminal = ['stopped', 'failed', 'expired'].includes(sess?.status);
                                        const running = sess?.status === 'running';
                                        const starting = sess?.status === 'starting';
                                        return (
                                            <div className="flex flex-wrap items-center gap-2">
                                                {(!sess || terminal) && (
                                                    <button
                                                        type="button"
                                                        disabled={!!previewBusyId}
                                                        onClick={() => startPreview(selectedProposal._id)}
                                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50"
                                                    >
                                                        <PlayCircle className="h-4 w-4" />
                                                        {previewBusyId === selectedProposal._id ? 'Starting…' : 'Start preview'}
                                                    </button>
                                                )}
                                                {starting && (
                                                    <span className="text-sm font-bold text-slate-500 flex items-center gap-2">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Starting container…
                                                    </span>
                                                )}
                                                {running && sess.previewUrl && (
                                                    <>
                                                        <a
                                                            href={safePreviewUrl(sess.previewUrl)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1D68E3] text-white font-bold text-sm hover:bg-blue-700"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                            Open preview
                                                        </a>
                                                        <button
                                                            type="button"
                                                            disabled={!!previewBusyId}
                                                            onClick={() => stopPreview(selectedProposal._id)}
                                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 font-bold text-sm disabled:opacity-50"
                                                        >
                                                            <Square className="h-4 w-4" />
                                                            Stop
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    {previewSessionByProposal[selectedProposal._id]?.logs?.length > 0 && (
                                        <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 p-2 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                                            {previewSessionByProposal[selectedProposal._id].logs.slice(-12).map((log, i) => (
                                                <div key={i} className="truncate">
                                                    <span className="text-slate-400">{log.level}</span> {log.message}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {(selectedProposal.status === 'pending_teacher_approval' || selectedProposal.status === 'revision_required') && (
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={!!actionId}
                                        onClick={() => runReview(selectedProposal._id, 'approve')}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        Approve
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!!actionId}
                                        onClick={() => runReview(selectedProposal._id, 'revision')}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-50"
                                    >
                                        <AlertTriangle className="h-4 w-4" />
                                        Request revision
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!!actionId}
                                        onClick={() => runReview(selectedProposal._id, 'reject')}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 disabled:opacity-50"
                                    >
                                        <XCircle className="h-4 w-4" />
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TeacherAssignmentProposals;
