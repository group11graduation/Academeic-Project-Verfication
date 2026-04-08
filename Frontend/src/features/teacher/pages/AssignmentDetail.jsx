import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft, Download, Calendar, Users,
    CheckCircle2, Clock, FileText, Loader2, ClipboardCheck
} from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { getApiOrigin } from '../../../lib/api';

const AssignmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all | submitted | pending

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await teacherService.getAssignmentById(id);
                if (res.success) setData(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [id]);

    const formatDate = (d) =>
        d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

    const formatDateTime = (d) =>
        d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    const isPast = (d) => d && new Date(d) < new Date();

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B1120]">
            <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
        </div>
    );

    if (!data) return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B1120]">
            <p className="text-slate-500 font-bold">Assignment not found.</p>
        </div>
    );

    const students = Array.isArray(data.students) ? data.students : [];
    const submitted = students.filter(s => s.submitted);
    const pending = students.filter(s => !s.submitted);
    const total = students.length;
    const deadline = data.proposalDeadline || data.projectDeadline || data.deadline;
    const classLabel =
        (Array.isArray(data.classNames) && data.classNames.length > 0 && data.classNames.join(', ')) ||
        (Array.isArray(data.assignedClasses) && data.assignedClasses.length > 0 && data.assignedClasses.join(', ')) ||
        [data.class?.code, data.class?.name].filter(Boolean).join(' · ') ||
        '—';
    const apiOrigin = getApiOrigin();
    const submittedCount = submitted.length;
    const pct = total > 0 ? Math.round((submittedCount / total) * 100) : 0;

    const filteredStudents = filter === 'submitted'
        ? submitted
        : filter === 'pending'
            ? pending
            : students;

    return (
        <div className="p-4 md:p-10 max-w-[1400px] mx-auto min-h-screen">
            {/* Back */}
            <button
                onClick={() => navigate('/teacher/assignments')}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold text-sm mb-8 group transition-colors"
            >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                Back to Assignments
            </button>

            {/* Header Card */}
            <div className="bg-white dark:bg-[#0F172A] rounded-[28px] border border-slate-100 dark:border-white/5 p-6 md:p-8 mb-6 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-start gap-6">
                    {/* Icon */}
                    <div className="bg-blue-500/10 p-5 rounded-2xl self-start">
                        <FileText className="h-8 w-8 text-blue-400" />
                    </div>

                    <div className="flex-1">
                        <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">
                            {data.title || 'Assignment'}
                        </h1>
                        <p className="text-slate-400 text-sm font-medium mb-4">
                            {data.subject?.name} · {data.class?.code || data.class?.name}
                        </p>
                        <Link
                            to={`/teacher/assignments/${id}/proposals`}
                            className="inline-flex items-center gap-2 text-sm font-black text-[#1D68E3] hover:underline mb-4"
                        >
                            <ClipboardCheck className="h-4 w-4" />
                            Review proposals
                        </Link>

                        <div className="flex flex-wrap gap-4 text-sm font-bold">
                            {/* Classes */}
                            <div className="flex items-center gap-2 text-slate-500">
                                <Users className="h-4 w-4" />
                                <span>{classLabel}</span>
                            </div>
                            {/* Deadline */}
                            <div className={`flex items-center gap-2 ${isPast(deadline) ? 'text-rose-400' : 'text-slate-500'}`}>
                                <Calendar className="h-4 w-4" />
                                <span>Deadline: {deadline ? formatDate(deadline) : 'None'}</span>
                                {isPast(deadline) && <span className="text-xs bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full font-black">Closed</span>}
                            </div>
                        </div>
                    </div>

                    {data.assignmentFile ? (
                        <a
                            href={`${apiOrigin}${data.assignmentFile}`}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 bg-[#1D68E3] text-white font-bold text-sm px-5 py-3 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 whitespace-nowrap self-start"
                        >
                            <Download className="h-4 w-4" /> Download File
                        </a>
                    ) : null}
                </div>

                {/* Progress Bar */}
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">File submission progress</span>
                        <span className="text-sm font-black text-slate-700 dark:text-slate-200">{submittedCount} / {total} students</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1.5">
                        <span className="text-[11px] font-bold text-emerald-500">{submittedCount} submitted</span>
                        <span className="text-[11px] font-bold text-amber-500">{pending.length} pending</span>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total Students', value: total, icon: <Users className="h-5 w-5" />, color: 'blue' },
                    { label: 'Submitted', value: submittedCount, icon: <CheckCircle2 className="h-5 w-5" />, color: 'emerald' },
                    { label: 'Pending', value: pending.length, icon: <Clock className="h-5 w-5" />, color: 'amber' }
                ].map(stat => (
                    <div key={stat.label} className="bg-white dark:bg-[#0F172A] rounded-[20px] border border-slate-100 dark:border-white/5 p-5 text-center">
                        <div className={`inline-flex p-2.5 rounded-xl mb-3 bg-${stat.color}-500/10 text-${stat.color}-400`}>
                            {stat.icon}
                        </div>
                        <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{stat.value}</p>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-5">
                {['all', 'submitted', 'pending'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === tab ? 'bg-[#1D68E3] text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-[#0F172A] text-slate-500 border border-slate-100 dark:border-white/5 hover:border-blue-400'}`}
                    >
                        {tab === 'all' ? `All (${total})` : tab === 'submitted' ? `Submitted (${submittedCount})` : `Pending (${pending.length})`}
                    </button>
                ))}
            </div>

            {/* Submissions Table */}
            <div className="bg-white dark:bg-[#0F172A] rounded-[28px] border border-slate-100 dark:border-white/5 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-white/5">
                                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">Student</th>
                                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">Class</th>
                                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">Submitted At</th>
                                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">File</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold text-sm">
                                        {total === 0
                                            ? 'No per-student file roster is loaded for this assignment. Use “Review proposals” for proposal workflow status.'
                                            : 'No students in this view.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((s, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                        {/* Name */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-black">
                                                    {s.studentName?.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{s.studentName}</span>
                                            </div>
                                        </td>
                                        {/* Class */}
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full">
                                                {s.classId}
                                            </span>
                                        </td>
                                        {/* Status */}
                                        <td className="px-6 py-4">
                                            {s.submitted ? (
                                                <span className="flex items-center gap-1.5 text-xs font-black text-emerald-500">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-xs font-black text-amber-500">
                                                    <Clock className="h-3.5 w-3.5" /> Pending
                                                </span>
                                            )}
                                        </td>
                                        {/* Submitted At */}
                                        <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                                            {s.submittedAt ? formatDateTime(s.submittedAt) : '—'}
                                        </td>
                                        {/* Download */}
                                        <td className="px-6 py-4">
                                            {s.submitted && s.submissionFile ? (
                                                <a
                                                    href={`${apiOrigin}${s.submissionFile}`}
                                                    download
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-1.5 text-xs font-black text-[#1D68E3] hover:text-blue-700 transition-colors"
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                    {s.originalFileName || 'Download'}
                                                </a>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-700 text-xs font-bold">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AssignmentDetail;
