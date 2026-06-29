import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, FolderKanban, Loader2, Rocket } from 'lucide-react';
import studentService from '../../../services/studentService';
import { Z_SHELL, Z_SHELL_INNER, Z_CARD, Z_LINK } from '../../../shared/ui/zendentaLayout';
import { BRAND } from '../../../shared/ui/brandTheme';

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

const statusBadge = (row) => {
    if (row?.latestProjectSubmission) {
        return { label: 'Submitted', cls: 'bg-emerald-100 text-emerald-700' };
    }
    const s = row?.proposal?.status;
    if (s === 'teacher_approved') return { label: 'Ready to submit', cls: 'bg-blue-100 text-blue-700' };
    if (s === 'pending_teacher_approval') return { label: 'In review', cls: 'bg-amber-100 text-amber-800' };
    if (s === 'teacher_rejected' || s === 'requirements_rejected') {
        return { label: 'Declined', cls: 'bg-rose-100 text-rose-700' };
    }
    return { label: 'Proposal needed', cls: 'bg-slate-100 text-slate-600' };
};

const StudentProjectsList = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await studentService.getAssignments();
                if (res.success) {
                    const list = Array.isArray(res.data) ? res.data : res.data?.assignments || [];
                    setRows(list.filter(isFinalProjectAssignment));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const sortedRows = useMemo(
        () =>
            [...rows].sort((a, b) =>
                String(a?.assignment?.title || '').localeCompare(String(b?.assignment?.title || ''))
            ),
        [rows]
    );

    if (loading) {
        return (
            <div className={`${Z_SHELL} items-center justify-center py-24`}>
                <Loader2 className="h-9 w-9 animate-spin text-[#2a3fa4]" />
            </div>
        );
    }

    return (
        <div className={Z_SHELL}>
            <div className={Z_SHELL_INNER}>
                <p className="mb-4 max-w-2xl text-[12px] leading-relaxed text-slate-600">
                    Final projects and capstone work. Open a project to upload code, manage your abstract, and track
                    teacher feedback.
                </p>

                {sortedRows.length === 0 ? (
                    <div className={`${Z_CARD} p-6 text-center`}>
                        <FolderKanban className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                        <p className="text-[13px] font-bold text-slate-700">No project assignments yet</p>
                        <p className="mt-1.5 text-[12px] text-slate-500">
                            When your teacher publishes a final project, it will appear here.
                        </p>
                        <Link
                            to="/student/assignments"
                            className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
                            style={{ backgroundColor: BRAND.primary }}
                        >
                            <BookOpen className="h-4 w-4" /> Browse assignments
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sortedRows.map((row) => {
                            const a = row?.assignment || {};
                            const badge = statusBadge(row);
                            const canOpen =
                                Boolean(row?.latestProjectSubmission) || row?.proposal?.status === 'teacher_approved';
                            const target = canOpen
                                ? `/student/project/${a._id}`
                                : `/student/assignments/${a._id}/proposal`;

                            return (
                                <Link
                                    key={a._id}
                                    to={target}
                                    className={`${Z_CARD} group flex flex-col gap-3 p-4 transition hover:shadow-md sm:flex-row sm:items-center`}
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef1f6] text-[#2a3fa4]">
                                            <Rocket className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-slate-900">{a.title}</p>
                                            <p className="text-xs font-semibold text-slate-500">
                                                {a.subject?.name || 'Subject'}
                                                {a.subject?.code ? ` · ${a.subject.code}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        className={`self-start rounded-lg px-2.5 py-1 text-[11px] font-black uppercase ${badge.cls}`}
                                    >
                                        {badge.label}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs font-bold text-[#2a3fa4] group-hover:underline">
                                        Open <ChevronRight className="h-4 w-4" />
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                )}

                <p className="mt-6 text-xs font-semibold text-slate-500">
                    Need a normal assignment instead?{' '}
                    <Link to="/student/assignments" className={Z_LINK}>
                        Go to assignments
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default StudentProjectsList;
