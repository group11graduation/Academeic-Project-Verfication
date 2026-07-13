import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Loader2, Send, UserCheck, UserX, X } from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { Z_BTN_INDIGO, Z_FORM_SECTION, Z_INPUT, Z_LABEL } from '../../../shared/ui/zendentaLayout';

const FRONTEND_HINTS = ['frontend', 'react', 'vue', 'angular', 'html', 'css', 'javascript', 'ui', 'web'];
const BACKEND_HINTS = ['backend', 'php', 'node', 'java', 'spring', 'api', 'database', 'mysql', 'server'];

function inferSubjectSide(subject = {}) {
    const explicit = String(subject.collaborationSide || '').toLowerCase();
    if (explicit === 'frontend' || explicit === 'backend') return explicit;
    const text = `${subject.code || ''} ${subject.name || ''}`.toLowerCase();
    const fe = FRONTEND_HINTS.some((h) => text.includes(h));
    const be = BACKEND_HINTS.some((h) => text.includes(h));
    if (fe && !be) return 'frontend';
    if (be && !fe) return 'backend';
    return '';
}

function roleLabel(role) {
    if (role === 'frontend') return 'Frontend';
    if (role === 'backend') return 'Backend';
    return '';
}

/**
 * Self-service collaboration: send requests, accept/decline incoming, cancel outgoing.
 */
const TeacherCollaborationPanel = ({
    onAcceptedChange,
    onPendingCountChange,
    collapseInviteWhenReady = true,
    draftActive = false,
}) => {
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState('');
    const [incoming, setIncoming] = useState([]);
    const [outgoing, setOutgoing] = useState([]);
    const [accepted, setAccepted] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [targetTeacherId, setTargetTeacherId] = useState('');
    const [classId, setClassId] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [myRole, setMyRole] = useState('frontend');
    const [requestNotes, setRequestNotes] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [inviteCollapsed, setInviteCollapsed] = useState(false);
    const [inviteManuallyExpanded, setInviteManuallyExpanded] = useState(false);

    const selectedCatalogRow = useMemo(
        () => catalog.find((row) => String(row.class?._id) === String(classId)),
        [catalog, classId]
    );

    const subjectsForRole = useMemo(() => {
        const subjects = selectedCatalogRow?.subjects || [];
        return subjects.filter((s) => inferSubjectSide(s) === myRole);
    }, [selectedCatalogRow, myRole]);

    const loadCandidates = useCallback(async (nextClassId) => {
        const candRes = await teacherService.getCollaborationCandidates(
            nextClassId ? { classId: nextClassId } : {}
        );
        if (candRes.success) {
            const rows = (candRes.data || []).filter((t) => t.collaborationStatus !== 'accepted');
            setCandidates(rows);
            setTargetTeacherId((prev) =>
                prev && rows.some((t) => String(t._id) === String(prev)) ? prev : String(rows[0]?._id || '')
            );
        }
    }, []);

    const reload = useCallback(async () => {
        setError('');
        try {
            const [collabRes, catalogRes] = await Promise.all([
                teacherService.getCollaborations(),
                teacherService.getCatalog(),
            ]);
            if (collabRes.success) {
                const inc = collabRes.data?.incoming || [];
                setIncoming(inc);
                setOutgoing(collabRes.data?.outgoing || []);
                setAccepted(collabRes.data?.accepted || []);
                onPendingCountChange?.(inc.length);
            }
            const rows = catalogRes.success ? catalogRes.data || [] : [];
            setCatalog(rows);
            const nextClassId = classId || String(rows[0]?.class?._id || '');
            if (!classId && nextClassId) setClassId(nextClassId);
            await loadCandidates(nextClassId || classId);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Could not load collaborations.');
        } finally {
            setLoading(false);
        }
    }, [classId, loadCandidates, onPendingCountChange]);

    useEffect(() => {
        reload();
    }, [reload]);

    useEffect(() => {
        if (!classId) return;
        loadCandidates(classId).catch(() => {});
    }, [classId, loadCandidates]);

    useEffect(() => {
        if (!subjectsForRole.length) {
            setSubjectId('');
            return;
        }
        setSubjectId((prev) =>
            prev && subjectsForRole.some((s) => String(s._id) === String(prev))
                ? prev
                : String(subjectsForRole[0]._id)
        );
    }, [subjectsForRole]);

    const shouldAutoCollapseInvite =
        draftActive || (collapseInviteWhenReady && (accepted.length > 0 || outgoing.length > 0));
    const inviteFormOpen = !inviteCollapsed || inviteManuallyExpanded;

    useEffect(() => {
        if (shouldAutoCollapseInvite && !inviteManuallyExpanded) {
            setInviteCollapsed(true);
        }
    }, [shouldAutoCollapseInvite, inviteManuallyExpanded]);

    const inviteCollapsedSummary = useMemo(() => {
        if (draftActive) {
            return 'Assignment draft in progress — expand only if you need to invite another co-teacher.';
        }
        if (accepted.length > 0) {
            const names = accepted.map((r) => r.partner?.name || r.partner?.email).filter(Boolean);
            return `Connected with ${names.join(', ')}. You can start the assignment below.`;
        }
        if (outgoing.length > 0) {
            const row = outgoing[0];
            const name = row.partner?.name || row.partner?.email || 'co-teacher';
            const meta = [row.class?.code, row.subject?.code, row.requesterRole && `You: ${roleLabel(row.requesterRole)}`]
                .filter(Boolean)
                .join(' · ');
            return `Request sent to ${name}${meta ? ` (${meta})` : ''} — waiting for acceptance.`;
        }
        return 'Invite form hidden. Expand to send another collaboration request.';
    }, [accepted, outgoing, draftActive]);

    const toggleInviteForm = () => {
        if (inviteFormOpen) {
            setInviteManuallyExpanded(false);
            setInviteCollapsed(true);
            return;
        }
        setInviteCollapsed(false);
        setInviteManuallyExpanded(true);
    };

    const handleSendRequest = async (e) => {
        e.preventDefault();
        if (!targetTeacherId || !classId || !subjectId || !myRole) return;
        setSending(true);
        setError('');
        try {
            const res = await teacherService.requestCollaboration({
                targetTeacherId,
                classId,
                subjectId,
                myRole,
                notes: requestNotes.trim(),
            });
            if (res.success) {
                setRequestNotes('');
                setInviteCollapsed(true);
                setInviteManuallyExpanded(false);
                await reload();
                onAcceptedChange?.();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Could not send request.');
        } finally {
            setSending(false);
        }
    };

    const handleRespond = async (collaborationId, action) => {
        setBusyId(`${collaborationId}-${action}`);
        setError('');
        try {
            await teacherService.respondToCollaboration(collaborationId, action);
            await reload();
            onAcceptedChange?.();
        } catch (err) {
            setError(err.response?.data?.message || 'Action failed.');
        } finally {
            setBusyId('');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
            </div>
        );
    }

    const requestableCandidates = candidates.filter((t) => !['pending', 'accepted'].includes(t.collaborationStatus));

    const actionBtn =
        'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-60';

    const renderRequestMeta = (row) => {
        const parts = [];
        if (row.class?.code) parts.push(`Class ${row.class.code}`);
        if (row.subject?.code) parts.push(row.subject.code);
        if (row.myRole) parts.push(`You: ${roleLabel(row.myRole)}`);
        if (row.partnerRole) parts.push(`Partner: ${roleLabel(row.partnerRole)}`);
        if (!parts.length) return null;
        return <p className="text-[10px] text-slate-500 mt-0.5">{parts.join(' · ')}</p>;
    };

    return (
        <div className="space-y-3">
            {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-800">
                    {error}
                </div>
            )}

            {incoming.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-900/40 p-3 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        Requests for you ({incoming.length})
                    </p>
                    {incoming.map((row) => (
                        <div
                            key={row._id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-white dark:bg-[#0B1120] border border-amber-100 dark:border-white/10 px-3 py-2"
                        >
                            <div>
                                <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                                    {row.partner?.name || row.partner?.email}
                                </p>
                                <p className="text-[10px] text-slate-500">{row.partner?.email}</p>
                                {renderRequestMeta(row)}
                                {row.notes && (
                                    <p className="text-[10px] text-slate-600 mt-0.5 italic">&ldquo;{row.notes}&rdquo;</p>
                                )}
                            </div>
                            <div className="flex gap-1.5">
                                <button
                                    type="button"
                                    disabled={Boolean(busyId)}
                                    onClick={() => handleRespond(row._id, 'accept')}
                                    className={`${actionBtn} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
                                >
                                    {busyId === `${row._id}-accept` ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Check className="h-3 w-3" />
                                    )}
                                    Accept
                                </button>
                                <button
                                    type="button"
                                    disabled={Boolean(busyId)}
                                    onClick={() => handleRespond(row._id, 'decline')}
                                    className={`${actionBtn} border-slate-200 text-slate-700 hover:bg-slate-50`}
                                >
                                    <UserX className="h-3 w-3" /> Decline
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {outgoing.length > 0 && (
                <div className={`${Z_FORM_SECTION} space-y-2`}>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Waiting for response</p>
                    {outgoing.map((row) => (
                        <div
                            key={row._id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-[#0B1120] px-3 py-2"
                        >
                            <div>
                                <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                                    {row.partner?.name || row.partner?.email}
                                </p>
                                <p className="text-[10px] text-slate-500">Pending — they need to accept</p>
                                {renderRequestMeta(row)}
                            </div>
                            <button
                                type="button"
                                disabled={Boolean(busyId)}
                                onClick={() => handleRespond(row._id, 'cancel')}
                                className={`${actionBtn} border-slate-200 text-slate-600 hover:bg-white`}
                            >
                                {busyId === `${row._id}-cancel` ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <X className="h-3 w-3" />
                                )}
                                Cancel
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {accepted.length > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1.5 flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" /> Accepted partners ({accepted.length})
                    </p>
                    <ul className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 space-y-0.5">
                        {accepted.map((row) => (
                            <li key={row._id}>
                                {row.partner?.name || row.partner?.email}
                                {row.partner?.email ? ` · ${row.partner.email}` : ''}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 overflow-hidden">
                <button
                    type="button"
                    onClick={toggleInviteForm}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-indigo-100/50 dark:hover:bg-indigo-950/40 transition-colors"
                >
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                            Invite a co-teacher
                        </p>
                        {!inviteFormOpen && (
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                                {inviteCollapsedSummary}
                            </p>
                        )}
                    </div>
                    <span className="shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden>
                        {inviteFormOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                </button>

                {inviteFormOpen && (
            <form onSubmit={handleSendRequest} className="px-3 pb-3 pt-0 space-y-2.5 border-t border-indigo-200/60 dark:border-indigo-900/30">
                <p className="text-[10px] text-slate-600 dark:text-slate-400 pt-2">
                    Choose class and your subject role. Collaboration requires one Frontend teacher and one Backend teacher in the same class — not two frontend or two backend subjects.
                </p>
                {catalog.length === 0 ? (
                    <p className="text-[11px] text-slate-500">No classes assigned yet. Ask admin to assign you to a class first.</p>
                ) : requestableCandidates.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                        No other teachers in this class to invite yet. Pick another class or ask admin to assign a co-teacher.
                    </p>
                ) : (
                    <>
                        <div>
                            <label className={Z_LABEL}>Class</label>
                            <select
                                value={classId}
                                onChange={(e) => setClassId(e.target.value)}
                                className={Z_INPUT}
                            >
                                {catalog.map((row) => (
                                    <option key={String(row.class?._id)} value={String(row.class?._id)}>
                                        {row.class?.code} — {row.class?.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={Z_LABEL}>Your role in this collaboration</label>
                            <div className="flex gap-2 mt-1">
                                {['frontend', 'backend'].map((role) => (
                                    <button
                                        key={role}
                                        type="button"
                                        onClick={() => setMyRole(role)}
                                        className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold capitalize ${
                                            myRole === role
                                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                                : 'border-slate-200 bg-white text-slate-700 dark:bg-slate-900 dark:border-slate-600'
                                        }`}
                                    >
                                        {roleLabel(role)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className={Z_LABEL}>Your subject ({roleLabel(myRole)})</label>
                            {subjectsForRole.length === 0 ? (
                                <p className="text-[11px] text-amber-700 mt-1">
                                    No {myRole} subject assigned in this class. Ask admin to set subject collaboration side or assign the right subject.
                                </p>
                            ) : (
                                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={Z_INPUT}>
                                    {subjectsForRole.map((s) => (
                                        <option key={String(s._id)} value={String(s._id)}>
                                            {s.code} — {s.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div>
                            <label className={Z_LABEL}>Co-teacher</label>
                            <select value={targetTeacherId} onChange={(e) => setTargetTeacherId(e.target.value)} className={Z_INPUT}>
                                {requestableCandidates.map((t) => (
                                    <option key={String(t._id)} value={String(t._id)}>
                                        {t.name || t.email}
                                        {t.email ? ` (${t.email})` : ''}
                                        {t.collaborationStatus === 'declined' ? ' — previously declined' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <input
                            type="text"
                            value={requestNotes}
                            onChange={(e) => setRequestNotes(e.target.value)}
                            placeholder="Optional message (e.g. Joint capstone — I handle frontend, you handle backend)"
                            className={Z_INPUT}
                        />
                        <button
                            type="submit"
                            disabled={sending || !targetTeacherId || !classId || !subjectId || !subjectsForRole.length}
                            className={`${Z_BTN_INDIGO} w-auto px-3`}
                        >
                            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            Send collaboration request
                        </button>
                    </>
                )}
            </form>
                )}
            </div>
        </div>
    );
};

export default TeacherCollaborationPanel;
