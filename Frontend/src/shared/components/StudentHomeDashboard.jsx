import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowDownRight,
    ArrowUpRight,
    BookOpen,
    ChevronDown,
    FileText,
    Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/authContext';
import studentService from '../../services/studentService';
import { BRAND, BRAND_GRADIENT, PROJECT_NAME } from '../ui/brandTheme';

const statusBadge = (row) => {
    const s = row?.proposal?.status;
    if (s === 'teacher_approved') return { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700' };
    if (s === 'pending_teacher_approval') return { label: 'In progress', cls: 'bg-sky-50 text-sky-700' };
    if (s === 'teacher_rejected' || s === 'requirements_rejected') {
        return { label: 'Declined', cls: 'bg-rose-50 text-rose-700' };
    }
    if (row?.latestProjectSubmission) return { label: 'Submitted', cls: 'bg-emerald-50 text-emerald-700' };
    return { label: 'Pending', cls: 'bg-amber-50 text-amber-800' };
};

const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const actionLabel = (row, canOpenProject) => {
    if (canOpenProject(row)) return 'Project';
    return 'Proposal';
};

const StudentHomeDashboard = () => {
    const { user } = useAuth();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statTab, setStatTab] = useState('all');

    useEffect(() => {
        (async () => {
            try {
                const res = await studentService.getAssignments();
                if (res.success) {
                    const list = Array.isArray(res.data) ? res.data : res.data?.assignments || [];
                    setRows(list);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const stats = useMemo(() => {
        const total = rows.length;
        const proposalApproved = rows.filter((r) => r?.proposal?.status === 'teacher_approved').length;
        const waitingReview = rows.filter((r) => r?.proposal?.status === 'pending_teacher_approval').length;
        const projectSubmitted = rows.filter((r) => Boolean(r?.latestProjectSubmission)).length;
        const pending = total - projectSubmitted;
        return { total, proposalApproved, waitingReview, projectSubmitted, pending };
    }, [rows]);

    const recentRows = useMemo(() => rows.slice(0, 5), [rows]);
    const canOpenProject = (row) =>
        Boolean(row?.latestProjectSubmission || row?.proposal?.status === 'teacher_approved');

    const submittedPct = stats.total ? Math.round((stats.projectSubmitted / stats.total) * 100) : 0;
    const remainingPct = 100 - submittedPct;

    const tabStats = useMemo(() => {
        if (statTab === 'approved') {
            return {
                headline: stats.proposalApproved,
                label: 'Proposals accepted',
                sub: 'Ready for project phase',
                limit: stats.total,
                used: stats.proposalApproved,
            };
        }
        if (statTab === 'review') {
            return {
                headline: stats.waitingReview,
                label: 'Waiting on teacher',
                sub: 'Under review',
                limit: stats.total,
                used: stats.waitingReview,
            };
        }
        return {
            headline: stats.total,
            label: 'Active assignments',
            sub: 'Enrolled this term',
            limit: stats.total,
            used: stats.projectSubmitted,
        };
    }, [statTab, stats]);

    const firstName = user?.name?.split(' ')[0] || 'Student';
    const avatarSrc = user?.photo;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-9 w-9 animate-spin text-[#2a3fa4]" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-3">
            <div className="space-y-3 min-w-0">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[#111827] dark:shadow-none">
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {[
                            { id: 'all', label: 'All assignments' },
                            { id: 'approved', label: 'Approved' },
                            { id: 'review', label: 'In review' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setStatTab(tab.id)}
                                className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${
                                    statTab === tab.id
                                        ? 'bg-[#2a3fa4] text-white shadow-sm'
                                        : 'bg-[#f4f7fa] text-slate-500 hover:text-slate-800 dark:bg-[#0f172a] dark:text-slate-400 dark:hover:text-slate-100'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,200px)_1fr] gap-4 items-center">
                        <div
                            className="relative overflow-hidden rounded-xl p-4 text-white min-h-[110px] shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #223688 0%, #2a3fa4 55%, #1D68E3 100%)' }}
                        >
                            <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
                            <div className="absolute -right-2 bottom-4 h-12 w-12 rounded-full bg-rose-400/30 blur-sm" />
                            <img src="/logo.png" alt="" className="h-16 w-16 mb-4 object-contain" />
                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">{PROJECT_NAME}</p>
                            <p className="text-[12px] font-black mt-0.5">{firstName}&apos;s workspace</p>
                            <p className="text-[10px] font-medium text-white/60 mt-2">Academic term {new Date().getFullYear()}</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                                <p className="mb-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">Available</p>
                                <p className="text-lg font-black text-slate-900 dark:text-slate-100">{tabStats.headline}</p>
                                <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">{tabStats.label}</p>
                            </div>
                            <div>
                                <p className="mb-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">Submitted</p>
                                <p className="text-lg font-black text-slate-900 dark:text-slate-100">{stats.projectSubmitted}</p>
                                <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">Projects done</p>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                                <p className="mb-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">Pending</p>
                                <p className="text-lg font-black text-slate-900 dark:text-slate-100">{stats.pending}</p>
                                <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">{tabStats.sub}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[#111827] dark:shadow-none">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">Last activity</h2>
                        <Link to="/student/assignments" className="text-[10px] font-bold text-slate-500 hover:text-[#2a3fa4] dark:text-slate-400 dark:hover:text-blue-300">
                            View all
                        </Link>
                    </div>

                    {recentRows.length === 0 ? (
                        <p className="py-6 text-center text-[12px] font-medium text-slate-500 dark:text-slate-400">No assignments yet.</p>
                    ) : (
                        <div className="space-y-1">
                            {recentRows.map((row) => {
                                const a = row?.assignment || {};
                                const badge = statusBadge(row);
                                const deadline =
                                    a.projectDeadline || a.proposalDeadline || a.deadline;
                                const action = actionLabel(row, canOpenProject);
                                const actionTo = canOpenProject(row)
                                    ? `/student/project/${a._id}`
                                    : `/student/assignments/${a._id}/proposal`;

                                return (
                                    <div
                                        key={a._id}
                                        className="flex flex-col gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[#f8f9fc] dark:hover:bg-[#0f172a] sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-3"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f7fa] dark:bg-[#0f172a]">
                                                <BookOpen className="h-3.5 w-3.5 text-[#2a3fa4]" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-[12px] font-bold text-slate-900 dark:text-slate-100">{a.title}</p>
                                                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{formatDate(deadline)}</p>
                                            </div>
                                        </div>
                                        <Link
                                            to={actionTo}
                                            className="text-xs font-bold text-slate-600 hover:text-[#2a3fa4] dark:text-slate-300 dark:hover:text-blue-300 sm:text-right"
                                        >
                                            {action}
                                        </Link>
                                        <Link
                                            to={`/student/assignments/${a._id}`}
                                            className="hidden text-xs font-semibold text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 sm:inline"
                                        >
                                            Details
                                        </Link>
                                        <span
                                            className={`self-start sm:self-center text-[10px] font-black uppercase px-3 py-1 rounded-lg whitespace-nowrap ${badge.cls}`}
                                        >
                                            {badge.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[#111827] dark:shadow-none">
                    <div className="mb-1 flex items-center gap-2">
                        {avatarSrc ? (
                            <img
                                src={avatarSrc}
                                alt={user?.name}
                                className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-md"
                            />
                        ) : (
                            <div
                                className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-black text-white shadow-md"
                                style={{ background: BRAND_GRADIENT }}
                            >
                                {(user?.name || 'S').charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Welcome back,</p>
                            <p className="truncate text-[12px] font-black text-slate-900 dark:text-slate-100">{user?.name || 'Student'}</p>
                        </div>
                    </div>
                    <Link
                        to="/student/profile"
                        className="inline-block mt-3 text-[10px] font-bold text-[#2a3fa4] hover:underline"
                    >
                        View profile
                    </Link>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_4px_20px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[#111827] dark:shadow-none">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Submitted</p>
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50">
                                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                            </span>
                        </div>
                        <p className="text-lg font-black text-slate-900 dark:text-slate-100">{stats.projectSubmitted}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_4px_20px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[#111827] dark:shadow-none">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Pending</p>
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-50">
                                <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />
                            </span>
                        </div>
                        <p className="text-lg font-black text-slate-900 dark:text-slate-100">{stats.pending}</p>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[#111827] dark:shadow-none">
                    <h3 className="mb-3 text-[12px] font-black text-slate-900 dark:text-slate-100">Submission flow</h3>
                    <div className="flex items-center justify-center py-1">
                        <div className="relative h-28 w-28">
                            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="18" />
                                {submittedPct > 0 && (
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        fill="none"
                                        stroke="#2a3fa4"
                                        strokeWidth="18"
                                        strokeLinecap="butt"
                                        strokeDasharray={`${(submittedPct / 100) * 251.2} 251.2`}
                                    />
                                )}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-base font-black text-slate-900 dark:text-slate-100">{submittedPct}%</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#2a3fa4]" />
                                Submitted
                            </span>
                            <span className="font-black text-slate-900 dark:text-slate-100">{submittedPct}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#dbeafe]" />
                                Remaining
                            </span>
                            <span className="font-black text-slate-900 dark:text-slate-100">{remainingPct}%</span>
                        </div>
                    </div>
                </div>

                <Link
                    to="/student/assignments"
                    className="flex items-center gap-2 rounded-xl bg-[#f4f7fa] p-3 text-[12px] font-bold text-slate-700 transition hover:bg-[#eef1f6] dark:bg-[#111827] dark:text-slate-100 dark:hover:bg-[#162033]"
                >
                    <FileText className="h-3.5 w-3.5 text-[#2a3fa4]" />
                    Browse all assignments
                </Link>
            </div>
        </div>
    );
};

export default StudentHomeDashboard;
