import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Loader2, Send, UserCheck, UserMinus, UserX, X } from 'lucide-react';
import { appConfirm } from '../../../lib/appDialog';
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
    refreshKey = 0,
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
    const [acceptForms, setAcceptForms] = useState({});

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
        if (refreshKey > 0) reload();
    }, [refreshKey, reload]);

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

    useEffect(() => {
        if (!incoming.length || !catalog.length) return;
        setAcceptForms((prev) => {
            const next = { ...prev };
            for (const row of incoming) {
                if (next[row._id]) continue;
                const catalogRow = catalog.find((c) => String(c.class?._id) === String(row.class?._id));
                const defaultRole = row.partnerRole || (row.requesterRole === 'frontend' ? 'backend' : 'frontend');
                const subjects = (catalogRow?.subjects || []).filter((s) => inferSubjectSide(s) === defaultRole);
                next[row._id] = {
                    myRole: defaultRole,
                    subjectId: String(subjects[0]?._id || ''),
                };
            }
            return next;
        });
    }, [incoming, catalog]);

    const subjectsForAcceptRole = useCallback(
        (row, role) => {
            const catalogRow = catalog.find((c) => String(c.class?._id) === String(row.class?._id));
            return (catalogRow?.subjects || []).filter((s) => inferSubjectSide(s) === role);
        },
        [catalog]
    );

    const updateAcceptForm = (rowId, patch) => {
        setAcceptForms((prev) => {
            const current = prev[rowId] || {};
            const nextRole = patch.myRole ?? current.myRole;
            const subjects = patch.subjectsForRole || [];
            let nextSubjectId = patch.subjectId ?? current.subjectId;
            if (patch.myRole && !patch.subjectId) {
                const row = incoming.find((r) => String(r._id) === String(rowId));
                const roleSubjects = row ? subjectsForAcceptRole(row, nextRole) : [];
                nextSubjectId = String(roleSubjects[0]?._id || '');
            }
            return {
                ...prev,
                [rowId]: {
                    ...current,
                    ...patch,
                    myRole: nextRole,
                    subjectId: nextSubjectId,
                },
            };
        });
    };

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
            const meta = [
                row.class?.code,
                (row.requesterSubject || row.subject)?.code,
                row.requesterRole && `You: ${roleLabel(row.requesterRole)}`,
            ]
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

    const handleRespond = async (collaborationId, action, acceptPayload = null) => {
        setBusyId(`${collaborationId}-${action}`);
        setError('');
        try {
            await teacherService.respondToCollaboration(collaborationId, action, acceptPayload || {});
            await reload();
            onAcceptedChange?.();
        } catch (err) {
            setError(err.response?.data?.message || 'Action failed.');
        } finally {
            setBusyId('');
        }
    };

    const handleAcceptRequest = async (row) => {
        const form = acceptForms[row._id] || {};
        if (!form.subjectId || !form.myRole) {
            setError('Choose your role and subject before accepting.');
            return;
        }
        await handleRespond(row._id, 'accept', { myRole: form.myRole, subjectId: form.subjectId });
    };

    const handleRevokePartnership = async (collaborationId, partnerName) => {
        if (
            !(await appConfirm({
                message: `End collaboration with ${partnerName}? Any draft assignment with them will also be deleted. You can send a new request later. Other partners are not affected.`,
                danger: true,
                confirmLabel: 'End partnership',
            }))
        ) {
            return;
        }
        setBusyId(`${collaborationId}-revoke`);
        setError('');
        try {
            await teacherService.revokeCollaboration(collaborationId);
            await reload();
            onAcceptedChange?.();
        } catch (err) {
            setError(err.response?.data?.message || 'Could not end partnership.');
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
        const reqSubject = row.requesterSubject || row.subject;
        if (reqSubject?.code) parts.push(`Their subject: ${reqSubject.code}`);
        if (row.partnerSubject?.code) parts.push(`Your subject: ${row.partnerSubject.code}`);
        if (row.requesterRole) parts.push(`They: ${roleLabel(row.requesterRole)}`);
        if (row.myRole && row.status === 'accepted') parts.push(`You: ${roleLabel(row.myRole)}`);
        if (!parts.length) return null;
        return <p className="text-[10px] text-slate-500 mt-0.5">{parts.join(' · ')}</p>;
    };

    return (
        <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-slate-900/30 px-3 py-2 text-[10px] text-slate-600 dark:text-slate-400">
                <p>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Collaboration status: </span>
                    {incoming.length} incoming · {outgoing.length} waiting · {accepted.length} accepted partner
                    {accepted.length === 1 ? '' : 's'}
                </p>
                <p className="mt-0.5">
                    You can partner with <strong>many teachers</strong> (one partnership each). Each partner gets their own assignment draft.
                    <strong> Delete draft</strong> only removes assignment work — partnerships and requests stay unless you cancel or end them.
                </p>
            </div>

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
                    {incoming.map((row) => {
                        const acceptForm = acceptForms[row._id] || {};
                        const acceptSubjects = subjectsForAcceptRole(row, acceptForm.myRole || row.partnerRole || 'backend');
                        const requesterSubject = row.requesterSubject || row.subject;
                        return (
                        <div
                            key={row._id}
                            className="rounded-lg bg-white dark:bg-[#0B1120] border border-amber-100 dark:border-white/10 px-3 py-2 space-y-2"
                        >
                            <div>
                                <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                                    {row.partner?.name || row.partner?.email}
                                </p>
                                <p className="text-[10px] text-slate-500">{row.partner?.email}</p>
                                {row.notes && (
                                    <p className="text-[10px] text-slate-600 mt-0.5 italic">&ldquo;{row.notes}&rdquo;</p>
                                )}
                            </div>

                            <div className="rounded-md border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/40 p-2 space-y-2">
                                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">From their request</p>
                                <p className="text-[10px] text-slate-600 dark:text-slate-400">
                                    Class: <strong>{row.class?.code || '—'}</strong>
                                    {row.class?.name ? ` — ${row.class.name}` : ''}
                                </p>
                                <p className="text-[10px] text-slate-600 dark:text-slate-400">
                                    Their role: <strong>{roleLabel(row.requesterRole)}</strong>
                                    {requesterSubject?.code ? (
                                        <> · Their subject: <strong>{requesterSubject.code} — {requesterSubject.name}</strong></>
                                    ) : null}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Your choices before accepting</p>
                                <div>
                                    <label className={Z_LABEL}>Your role</label>
                                    <div className="flex gap-2 mt-1">
                                        {['frontend', 'backend'].map((role) => (
                                            <button
                                                key={role}
                                                type="button"
                                                disabled={Boolean(busyId) || role === row.requesterRole}
                                                onClick={() => updateAcceptForm(row._id, { myRole: role })}
                                                className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold capitalize ${
                                                    acceptForm.myRole === role
                                                        ? 'border-indigo-600 bg-indigo-600 text-white'
                                                        : 'border-slate-200 bg-white text-slate-700 dark:bg-slate-900 dark:border-slate-600'
                                                } ${role === row.requesterRole ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            >
                                                {roleLabel(role)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className={Z_LABEL}>Your subject ({roleLabel(acceptForm.myRole || row.partnerRole)})</label>
                                    {acceptSubjects.length === 0 ? (
                                        <p className="text-[11px] text-amber-700 mt-1">
                                            No {acceptForm.myRole || row.partnerRole} subject in this class. Ask admin to assign one.
                                        </p>
                                    ) : (
                                        <select
                                            value={acceptForm.subjectId || ''}
                                            onChange={(e) => updateAcceptForm(row._id, { subjectId: e.target.value })}
                                            className={Z_INPUT}
                                        >
                                            {acceptSubjects.map((s) => (
                                                <option key={String(s._id)} value={String(s._id)}>
                                                    {s.code} — {s.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-1.5">
                                <button
                                    type="button"
                                    disabled={Boolean(busyId) || !acceptForm.subjectId || !acceptSubjects.length}
                                    onClick={() => handleAcceptRequest(row)}
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
                        );
                    })}
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

            {incoming.length === 0 && outgoing.length === 0 && accepted.length === 0 && (
                <p className="text-[11px] text-slate-500 px-1">
                    No collaboration requests yet. Expand <strong>Invite a co-teacher</strong> below to send one.
                </p>
            )}

            {accepted.length > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 p-3 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" /> Accepted partners ({accepted.length})
                    </p>
                    {accepted.map((row) => (
                        <div
                            key={row._id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-white/80 dark:bg-[#0B1120] border border-emerald-100 dark:border-white/10 px-3 py-2"
                        >
                            <div className="min-w-0">
                                <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                                    {row.partner?.name || row.partner?.email}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate">{row.partner?.email}</p>
                                {renderRequestMeta(row)}
                            </div>
                            <button
                                type="button"
                                disabled={Boolean(busyId)}
                                onClick={() => handleRevokePartnership(row._id, row.partner?.name || row.partner?.email)}
                                className={`${actionBtn} border-rose-200 text-rose-700 hover:bg-rose-50 shrink-0`}
                                title="End this partnership only (other partners unchanged)"
                            >
                                {busyId === `${row._id}-revoke` ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <UserMinus className="h-3 w-3" />
                                )}
                                End partnership
                            </button>
                        </div>
                    ))}
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
