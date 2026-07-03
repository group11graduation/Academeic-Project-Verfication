import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Send, UserCheck, UserX, X } from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { Z_BTN_INDIGO, Z_FORM_SECTION, Z_INPUT } from '../../../shared/ui/zendentaLayout';

/**
 * Self-service collaboration: send requests, accept/decline incoming, cancel outgoing.
 * Calls onAcceptedChange when the accepted partner list may have changed.
 */
const TeacherCollaborationPanel = ({ onAcceptedChange }) => {
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState('');
    const [incoming, setIncoming] = useState([]);
    const [outgoing, setOutgoing] = useState([]);
    const [accepted, setAccepted] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [targetTeacherId, setTargetTeacherId] = useState('');
    const [requestNotes, setRequestNotes] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    const reload = useCallback(async () => {
        setError('');
        try {
            const [collabRes, candRes] = await Promise.all([
                teacherService.getCollaborations(),
                teacherService.getCollaborationCandidates(),
            ]);
            if (collabRes.success) {
                setIncoming(collabRes.data?.incoming || []);
                setOutgoing(collabRes.data?.outgoing || []);
                setAccepted(collabRes.data?.accepted || []);
            }
            if (candRes.success) {
                const rows = (candRes.data || []).filter((t) => t.collaborationStatus !== 'accepted');
                setCandidates(rows);
                setTargetTeacherId((prev) =>
                    prev && rows.some((t) => String(t._id) === String(prev)) ? prev : String(rows[0]?._id || '')
                );
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Could not load collaborations.');
        } finally {
            setLoading(false);
        }
    }, [onAcceptedChange]);

    useEffect(() => {
        reload();
    }, [reload]);

    const handleSendRequest = async (e) => {
        e.preventDefault();
        if (!targetTeacherId) return;
        setSending(true);
        setError('');
        try {
            const res = await teacherService.requestCollaboration({
                targetTeacherId,
                notes: requestNotes.trim(),
            });
            if (res.success) {
                setRequestNotes('');
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
                                {row.notes && <p className="text-[10px] text-slate-600 mt-0.5 italic">&ldquo;{row.notes}&rdquo;</p>}
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

            <form
                onSubmit={handleSendRequest}
                className="rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 space-y-2.5"
            >
                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    Invite a co-teacher
                </p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 -mt-1">
                    Pick another teacher and send a request. When they accept, you can create collaborative assignments together — no admin needed.
                </p>
                {requestableCandidates.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                        No other teachers available to invite yet. Ask admin to assign another teacher to your class, or wait for pending requests above.
                    </p>
                ) : (
                    <>
                        <select value={targetTeacherId} onChange={(e) => setTargetTeacherId(e.target.value)} className={Z_INPUT}>
                            {requestableCandidates.map((t) => (
                                <option key={String(t._id)} value={String(t._id)}>
                                    {t.name || t.email}
                                    {t.email ? ` (${t.email})` : ''}
                                    {t.collaborationStatus === 'declined' ? ' — previously declined' : ''}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={requestNotes}
                            onChange={(e) => setRequestNotes(e.target.value)}
                            placeholder="Optional message (e.g. Joint capstone — I handle frontend, you handle backend)"
                            className={Z_INPUT}
                        />
                        <button type="submit" disabled={sending || !targetTeacherId} className={`${Z_BTN_INDIGO} w-auto px-3`}>
                            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            Send collaboration request
                        </button>
                    </>
                )}
            </form>
        </div>
    );
};

export default TeacherCollaborationPanel;
