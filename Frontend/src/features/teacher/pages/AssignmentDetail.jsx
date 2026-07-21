import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';
import {
    ArrowLeft, Download, Calendar, Users,
    CheckCircle2, Clock, FileText, Loader2, ClipboardCheck, ChevronRight, Pencil
} from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { getApiOrigin } from '../../../lib/api';
import { assignmentRequirementsComplete } from '../../../shared/utils/assignmentRequirements';
import { isDeadlinePassed } from '../../../shared/utils/assignmentDeadlines';

const proposalStatusLabel = (s) => {
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
        requirements_review: 'Requirements — needs your review',
    };
    return map[s] || s;
};

const proposalStudentLabel = (p) => {
    const name = p?.submittedBy?.name || 'Student';
    const sid = p?.submittedBy?.studentId || p?.submittedBy?.email || '';
    return sid ? `${name} (${sid})` : name;
};

const AssignmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all | submitted | pending
    const [uploadingRequirement, setUploadingRequirement] = useState(false);
    const [proposals, setProposals] = useState([]);
    const [loadingProposals, setLoadingProposals] = useState(true);
    const [normalBundle, setNormalBundle] = useState(null);
    const [loadingNormal, setLoadingNormal] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            try {
                const [res, pRes] = await Promise.all([
                    teacherService.getAssignmentById(id),
                    teacherService.getProposalsForAssignment(id),
                ]);
                if (res.success) {
                    setData(res.data);
                }
                if (pRes.success) {
                    const rows = pRes.data || [];
                    setProposals(rows);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
                setLoadingProposals(false);
            }
        };
        fetch();
    }, [id]);

    useEffect(() => {
        if (!id || !data) return;
        if (String(data.assignmentType || 'normal') !== 'normal') {
            setNormalBundle(null);
            return;
        }
        let cancelled = false;
        setLoadingNormal(true);
        teacherService
            .getNormalSubmissionsForAssignment(id)
            .then((res) => {
                if (!cancelled && res.success) setNormalBundle(res.data);
                else if (!cancelled) setNormalBundle(null);
            })
            .catch(() => {
                if (!cancelled) setNormalBundle(null);
            })
            .finally(() => {
                if (!cancelled) setLoadingNormal(false);
            });
        return () => {
            cancelled = true;
        };
    }, [id, data?._id, data?.assignmentType]);

    const formatDate = (d) =>
        d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

    const formatDateTime = (d) =>
        d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    const isPast = (d) => d && new Date(d) < new Date();

    const isNormalAssignment =
        Boolean(data) && String(data.assignmentType || 'normal') === 'normal';

    const students = useMemo(() => {
        if (isNormalAssignment && normalBundle?.students) {
            return (normalBundle.students || []).map((row) => ({
                studentName: row.name || row.email || 'Student',
                studentIdLabel: row.studentId || '',
                classId: row.classCode || '—',
                submitted: row.submitted,
                submittedAt: row.submission?.createdAt,
                submissionFile: row.submission?.downloadPath,
                originalFileName: row.submission?.originalFilename,
                plagiarismScore: row.submission?.plagiarismScore,
                plagiarismFlag: row.submission?.plagiarismFlag,
                plagiarismMethod: row.submission?.plagiarismMethod || '',
                matchedPeerLabel: row.submission?.matchedPeerLabel || '',
            }));
        }
        return Array.isArray(data?.students) ? data.students : [];
    }, [isNormalAssignment, normalBundle, data?.students]);

    const submitted = students.filter((s) => s.submitted);
    const pending = students.filter((s) => !s.submitted);
    const total = students.length;
    const deadline = data?.proposalDeadline || data?.projectDeadline || data?.deadline;
    const classLabel =
        (Array.isArray(data?.classNames) && data.classNames.length > 0 && data.classNames.join(', ')) ||
        (Array.isArray(data?.assignedClasses) && data.assignedClasses.length > 0 && data.assignedClasses.join(', ')) ||
        [data?.class?.code, data?.class?.name].filter(Boolean).join(' · ') ||
        '—';
    const apiOrigin = getApiOrigin();
    const submittedCount = submitted.length;
    const pct = total > 0 ? Math.round((submittedCount / total) * 100) : 0;
    const filteredStudents = filter === 'submitted'
        ? submitted
        : filter === 'pending'
            ? pending
            : students;

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

    const requirementsComplete = assignmentRequirementsComplete(data);
    const proposalDeadlinePassed = !isNormalAssignment && isDeadlinePassed(data.proposalDeadline);
    const projectOrSubmissionDeadlinePassed = isDeadlinePassed(data.projectDeadline);

    const handleUploadRequirementFile = async (file) => {
        if (!file) return;
        try {
            setUploadingRequirement(true);
            const res = await teacherService.uploadAssignmentRequirements(id, file);
            if (res.success) setData(res.data);
        } catch (err) {
            await appError(err.response?.data?.message || 'Failed to upload requirements file.');
        } finally {
            setUploadingRequirement(false);
        }
    };

    return (
        <div className="p-3 sm:p-4 md:p-6 lg:p-10 max-w-[1400px] mx-auto min-h-screen safe-area-px">
            {/* Back */}
            <button
                onClick={() => navigate('/teacher/assignments')}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold text-sm mb-8 group transition-colors"
            >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                Back to Assignments
            </button>

            {!requirementsComplete && (
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    Students cannot submit until requirements are complete.{' '}
                    <button
                        type="button"
                        onClick={() => navigate(`/teacher/assignments/${id}/edit`)}
                        className="font-black text-amber-950 underline hover:no-underline dark:text-amber-100"
                    >
                        Edit assignment
                    </button>{' '}
                    to add requirement text and technologies, or upload a requirements file.
                </div>
            )}

            {proposalDeadlinePassed ? (
                <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                    Proposal deadline has passed — students cannot submit or update proposals.{' '}
                    <button
                        type="button"
                        onClick={() => navigate(`/teacher/assignments/${id}/edit`)}
                        className="font-black text-rose-950 underline hover:no-underline dark:text-rose-100"
                    >
                        Edit assignment
                    </button>{' '}
                    to set a new future proposal deadline and extend the window.
                </div>
            ) : null}

            {projectOrSubmissionDeadlinePassed ? (
                <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                    {isNormalAssignment ? 'Submission deadline has passed' : 'Project deadline has passed'} — students
                    cannot upload.{' '}
                    <button
                        type="button"
                        onClick={() => navigate(`/teacher/assignments/${id}/edit`)}
                        className="font-black text-rose-950 underline hover:no-underline dark:text-rose-100"
                    >
                        Edit assignment
                    </button>{' '}
                    to add extra days or time.
                </div>
            ) : null}

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
                            {data.subject?.name} · {classLabel}
                        </p>
                        <div className="flex flex-wrap gap-4 mb-4">
                            <button
                                type="button"
                                onClick={() => navigate(`/teacher/assignments/${id}/edit`)}
                                className="inline-flex items-center gap-2 text-sm font-black text-[#1D68E3] hover:underline"
                            >
                                <Pencil className="h-4 w-4" />
                                Edit assignment
                            </button>
                            <Link
                                to={`/teacher/assignments/${id}/proposals`}
                                className="inline-flex items-center gap-2 text-sm font-black text-[#1D68E3] hover:underline"
                            >
                                <ClipboardCheck className="h-4 w-4" />
                                Review proposals
                            </Link>
                            {isNormalAssignment && (
                                <Link
                                    to={`/teacher/assignments/${id}/normal-students`}
                                    className="inline-flex items-center gap-2 text-sm font-black text-slate-600 dark:text-slate-300 hover:underline"
                                >
                                    <Users className="h-4 w-4" />
                                    Student cards & extracted text
                                </Link>
                            )}
                        </div>

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
                            download={data.originalFileName || true}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 bg-[#1D68E3] text-white font-bold text-sm px-5 py-3 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 whitespace-nowrap self-start"
                        >
                            <Download className="h-4 w-4" /> Download requirements
                        </a>
                    ) : null}
                </div>

                {/* Assignment content the teacher created (same info students see) */}
                <div className="mt-6 rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] p-4 md:p-5 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">Your assignment details</h2>
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                            {isNormalAssignment ? 'Normal' : 'Final'}
                        </span>
                        {data.submissionMode ? (
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300">
                                {data.submissionMode === 'group' ? 'Group' : 'Single'}
                            </span>
                        ) : null}
                    </div>

                    {data.description ? (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Description</p>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{data.description}</p>
                        </div>
                    ) : null}

                    {data.requirementText ? (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                {isNormalAssignment ? 'Instructions for students' : 'Teacher requirements'}
                            </p>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{data.requirementText}</p>
                        </div>
                    ) : null}

                    {!isNormalAssignment && Array.isArray(data.allowedTechnologies) && data.allowedTechnologies.length > 0 ? (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Allowed technologies</p>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{data.allowedTechnologies.join(', ')}</p>
                        </div>
                    ) : null}

                    {!isNormalAssignment && Array.isArray(data.requiredKeywords) && data.requiredKeywords.length > 0 ? (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Required keywords</p>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{data.requiredKeywords.join(', ')}</p>
                        </div>
                    ) : null}

                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Requirements file</p>
                        {data.assignmentFile ? (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-3 py-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-[#1D68E3]">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                                        {data.originalFileName || 'Requirements document'}
                                    </p>
                                    <p className="text-xs font-medium text-slate-500">Attached when you created / updated this assignment</p>
                                </div>
                                <a
                                    href={`${apiOrigin}${data.assignmentFile}`}
                                    download={data.originalFileName || true}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1D68E3] px-3.5 py-2 text-xs font-black text-white hover:bg-blue-700"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                </a>
                            </div>
                        ) : (
                            <p className="text-xs font-bold text-slate-400">No requirements file uploaded yet.</p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-white dark:hover:bg-white/5">
                                {uploadingRequirement
                                    ? 'Uploading...'
                                    : data.assignmentFile
                                      ? 'Replace file'
                                      : 'Upload requirements file'}
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => handleUploadRequirementFile(e.target.files?.[0])}
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {isNormalAssignment && normalBundle?.plagiarismExplained && (
                    <div className="mt-6 rounded-2xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/90 dark:bg-blue-950/25 px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                        <span className="font-black text-slate-900 dark:text-white">Normal assignment & plagiarism: </span>
                        {normalBundle.plagiarismExplained}
                        {Number(normalBundle.flaggedCount) > 0 && (
                            <span className="block mt-2 font-bold text-rose-700 dark:text-rose-400">
                                {normalBundle.flaggedCount} submission(s) flagged (≥85% similarity vs another student on this same assignment).
                            </span>
                        )}
                    </div>
                )}

                {/* Progress Bar */}
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                            {isNormalAssignment ? 'Normal assignment uploads (one file per student)' : 'File submission progress'}
                        </span>
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
            <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="app-chip-scroll mb-5">
                {['all', 'submitted', 'pending'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`shrink-0 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === tab ? 'bg-[#1D68E3] text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-[#0F172A] text-slate-500 border border-slate-100 dark:border-white/5 hover:border-blue-400'}`}
                    >
                        {tab === 'all' ? `All (${total})` : tab === 'submitted' ? `Submitted (${submittedCount})` : `Pending (${pending.length})`}
                    </button>
                ))}
            </div>

            {/* Submissions Table */}
            <div className="app-table-shell shadow-xl relative">
                {loadingNormal && isNormalAssignment && (
                    <div className="absolute inset-0 z-10 bg-white/70 dark:bg-[#0B1120]/70 flex items-center justify-center rounded-[inherit]">
                        <Loader2 className="h-8 w-8 text-[#1D68E3] animate-spin" />
                    </div>
                )}
                <div className="app-table-wrap">
                    <table className="app-table">
                        <thead>
                            <tr className="app-table-headrow">
                                <th className="app-table-th">Student</th>
                                <th className="app-table-th">Class</th>
                                <th className="app-table-th">Status</th>
                                {isNormalAssignment && (
                                    <>
                                        <th className="app-table-th">Similarity vs peers</th>
                                        <th className="app-table-th">Closest peer match</th>
                                    </>
                                )}
                                <th className="app-table-th">Submitted At</th>
                                <th className="app-table-th">File</th>
                            </tr>
                        </thead>
                        <tbody className="app-table-body">
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={isNormalAssignment ? 7 : 5} className="app-table-empty font-bold text-sm">
                                        {loadingNormal && isNormalAssignment
                                            ? 'Loading class roster and submissions…'
                                            : total === 0
                                                ? isNormalAssignment
                                                    ? 'No students matched this assignment’s class(es). Check that student profiles use the correct class code, or wait for uploads.'
                                                    : 'No per-student file roster is loaded for this assignment. Use “Review proposals” for proposal workflow status.'
                                                : 'No students in this view.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((s, idx) => (
                                    <tr key={`${s.studentName}-${s.studentIdLabel || idx}`} className="app-table-row">
                                        {/* Name */}
                                        <td className="app-table-td">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-black">
                                                    {s.studentName?.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{s.studentName}</span>
                                                    {s.studentIdLabel ? (
                                                        <span className="text-[11px] font-semibold text-slate-400">{s.studentIdLabel}</span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </td>
                                        {/* Class */}
                                        <td className="app-table-td">
                                            <span className="text-xs font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full">
                                                {s.classId}
                                            </span>
                                        </td>
                                        {/* Status */}
                                        <td className="app-table-td">
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
                                        {isNormalAssignment && (
                                            <>
                                                <td className="app-table-td text-sm">
                                                    {s.submitted ? (
                                                        <span
                                                            className={`font-black ${s.plagiarismFlag ? 'text-rose-600' : 'text-slate-600'}`}
                                                            title={s.plagiarismMethod || ''}
                                                        >
                                                            {Math.round((Number(s.plagiarismScore ?? 0)) * 100)}%
                                                            {s.plagiarismFlag ? (
                                                                <span className="ml-1 text-[10px] uppercase tracking-wide text-rose-500">High</span>
                                                            ) : null}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="app-table-td text-xs text-slate-500 font-medium max-w-[140px] truncate" title={s.matchedPeerLabel || ''}>
                                                    {s.submitted && s.matchedPeerLabel ? s.matchedPeerLabel : '—'}
                                                </td>
                                            </>
                                        )}
                                        {/* Submitted At */}
                                        <td className="app-table-td text-sm text-slate-500 font-medium">
                                            {s.submittedAt ? formatDateTime(s.submittedAt) : '—'}
                                        </td>
                                        {/* Download */}
                                        <td className="app-table-td">
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

            {/* Proposal roster — same pattern as normal assignment student list */}
            <div className="mt-6 bg-white dark:bg-[#0F172A] rounded-[28px] border border-slate-100 dark:border-white/5 p-6 md:p-7 shadow-xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Student proposals</h2>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                            Open each student for full review — extracted-style proposal text, AI signals, and approve / revision / reject.
                        </p>
                    </div>
                    <Link
                        to={`/teacher/assignments/${id}/proposals`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D68E3] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                    >
                        Open full proposal roster
                    </Link>
                </div>
                {loadingProposals ? (
                    <div className="py-8 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-[#1D68E3] animate-spin" />
                    </div>
                ) : proposals.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-500">No proposals submitted yet for this assignment.</p>
                ) : (
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                        <ul className="divide-y divide-slate-100 dark:divide-white/10">
                            {proposals.map((p) => (
                                <li key={p._id}>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/teacher/assignments/${id}/proposals/${p._id}`)}
                                        className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/5 md:px-5"
                                    >
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1D68E3] to-[#3b74ff] text-sm font-bold text-white">
                                            {(p.submittedBy?.name || p.submittedBy?.email || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-slate-900 dark:text-slate-100">{proposalStudentLabel(p)}</p>
                                            <p className="text-xs font-semibold text-slate-500 truncate">{p.title || 'Untitled proposal'}</p>
                                        </div>
                                        <span className="hidden sm:inline text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                                            {proposalStatusLabel(p.status)}
                                        </span>
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

export default AssignmentDetail;
