import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import studentService from '../../../services/studentService';
import { getApiOrigin } from '../../../lib/api';
import { useAuth } from '../../../context/authContext';
import {
    Download,
    FileText,
    CheckCircle2,
    Loader2,
    ChevronRight,
    Printer,
} from 'lucide-react';
import { Z_SHELL, Z_SHELL_INNER, Z_CARD, Z_BTN_PRIMARY, Z_BTN_SECONDARY, Z_LINK } from '../../../shared/ui/zendentaLayout';
import {
    DEADLINE_DUE_STUDENT_MESSAGE,
    isProposalPhaseComplete,
    shouldShowNormalDeadlineWarning,
    shouldShowProjectDeadlineWarning,
    shouldShowProposalDeadlineWarning,
} from '../../../shared/utils/assignmentDeadlines';
import {
    getProjectTeacherFeedbackEntries,
    getProjectWorkflowStatus,
    getWorkflowBadgeClasses,
} from '../../../shared/utils/projectWorkflowStatus';
import StudentProjectFeedbackPanel from '../../../shared/components/StudentProjectFeedbackPanel';
import StudentContactTeacherPanel from '../../../shared/components/StudentContactTeacherPanel';
import StudentTeacherInfoPanel, {
    resolveAssignmentTeachers,
} from '../../../shared/components/StudentTeacherInfoPanel';

function DetailRow({ label, value }) {
    return (
        <div className="grid grid-cols-1 gap-1 border-b border-slate-50 py-3 last:border-0 sm:grid-cols-[minmax(0,140px)_1fr] sm:gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
            <span className="text-sm font-semibold text-slate-900 break-words">{value ?? '—'}</span>
        </div>
    );
}

function proposalStatusLabel(row) {
    const status = row?.proposal?.status || 'not_submitted';
    if (status === 'teacher_approved') return 'Approved';
    if (status === 'pending_teacher_approval' || status === 'submitted' || status === 'pending') return 'Pending teacher';
    if (status === 'ai_rejected_same_semester') return 'Rejected (AI — same semester)';
    if (status === 'requirements_rejected') return 'Rejected (requirements)';
    if (status === 'ai_flagged_previous_semester') return 'Flagged (previous semester)';
    if (status === 'teacher_rejected') return 'Rejected (teacher)';
    if (status === 'draft') return 'Draft';
    return 'No proposal';
}

const StudentAssignmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [row, setRow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [normalFile, setNormalFile] = useState(null);
    const [uploadingNormal, setUploadingNormal] = useState(false);
    const [normalUploadMsg, setNormalUploadMsg] = useState('');
    const [normalUploadErr, setNormalUploadErr] = useState('');
    const [tab, setTab] = useState('workspace');

    useEffect(() => {
        window.scrollTo(0, 0);
        const fetchAssignment = async () => {
            try {
                const response = await studentService.getAssignment(id);
                if (response.success) setRow(response.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchAssignment();
    }, [id]);

    if (loading) {
        return (
            <div className={`${Z_SHELL} flex flex-1 items-center justify-center`}>
                <Loader2 className="h-10 w-10 animate-spin text-[#1e56e3]" />
            </div>
        );
    }

    if (!row?.assignment) {
        return (
            <div className={Z_SHELL}>
                <div className={Z_SHELL_INNER}>
                    <h2 className="text-lg font-bold text-slate-500">Assignment not found</h2>
                    <button type="button" onClick={() => navigate('/student/assignments')} className={`${Z_LINK} mt-4`}>
                        Back to assignments
                    </button>
                </div>
            </div>
        );
    }

    const assignment = row.assignment;
    const isNormalAssignment = String(assignment?.assignmentType || 'normal') === 'normal';
    const assignmentTeachers = resolveAssignmentTeachers(assignment);
    const teacherName =
        assignmentTeachers.length > 1
            ? assignmentTeachers.map((t) => `${t.name}${t.roleLabel ? ` (${t.roleLabel})` : ''}`).join(' · ')
            : assignmentTeachers[0]?.name || assignment?.teacher?.name || '—';
    const isCollaborativeAssignment = assignmentTeachers.length > 1 || Boolean(assignment?.isCollaborative || assignment?.coTeacherId);
    const subjectLabel = assignment?.subject?.name
        ? `${assignment.subject.name}${assignment.subject?.code ? ` (${assignment.subject.code})` : ''}`
        : '—';
    const proposalDeadline = assignment?.proposalDeadline ? new Date(assignment.proposalDeadline).toLocaleString() : null;
    const projectDeadline = assignment?.projectDeadline ? new Date(assignment.projectDeadline).toLocaleString() : null;
    const effectiveDeadline = projectDeadline || proposalDeadline;
    const teacherFileUrl = assignment?.assignmentFile ? `${getApiOrigin()}${assignment.assignmentFile}` : null;
    const teacherFileName = assignment?.originalFileName || assignment?.title || 'Teacher requirements file';
    const proposalApprovedOrProjectUploaded = Boolean(
        row?.latestProjectSubmission || row?.proposal?.status === 'teacher_approved'
    );
    const workflow = !isNormalAssignment ? getProjectWorkflowStatus(row) : null;
    const teacherFeedbackEntries = !isNormalAssignment ? getProjectTeacherFeedbackEntries(row) : [];
    const normalDeadlineClosed = isNormalAssignment && (row?.submissionDeadlinePassed || row?.normalSubmissionAllowed === false);
    const showNormalDeadlineBanner = isNormalAssignment && shouldShowNormalDeadlineWarning(row);
    const showProposalDeadlineBanner = !isNormalAssignment && shouldShowProposalDeadlineWarning(row);
    const showProjectDeadlineBanner = !isNormalAssignment && shouldShowProjectDeadlineWarning(row);
    const proposalPhaseComplete = isProposalPhaseComplete(row);
    const projectSubmitted = Boolean(row?.latestProjectSubmission);
    const anyDeadlinePassed = Boolean(
        row?.proposalDeadlinePassed || row?.projectDeadlinePassed || row?.submissionDeadlinePassed
    );
    const showContactDeadlineHint =
        showProposalDeadlineBanner || showProjectDeadlineBanner || showNormalDeadlineBanner || anyDeadlinePassed;

    const handleNormalUpload = async () => {
        if (normalDeadlineClosed) {
            setNormalUploadErr(DEADLINE_DUE_STUDENT_MESSAGE);
            return;
        }
        if (!normalFile) {
            setNormalUploadErr('Choose a file first.');
            return;
        }
        setNormalUploadErr('');
        setNormalUploadMsg('');
        setUploadingNormal(true);
        try {
            const res = await studentService.submitNormalAssignmentFile(assignment._id, normalFile);
            if (res.success) {
                const sub = res.data;
                setRow((prev) => ({ ...prev, latestNormalSubmission: sub }));
                setNormalUploadMsg(
                    sub?.plagiarismFlag
                        ? `Submitted. Similarity is high (${Math.round((Number(sub.plagiarismScore || 0)) * 100)}%).`
                        : `Submitted successfully. Similarity: ${Math.round((Number(sub?.plagiarismScore || 0)) * 100)}%.`
                );
                setNormalFile(null);
            }
        } catch (err) {
            setNormalUploadErr(err.response?.data?.message || 'Failed to upload assignment file.');
        } finally {
            setUploadingNormal(false);
        }
    };

    const displayTitle = assignment.title || 'Assignment';
    const studentName = user?.name || 'Student';

    return (
        <div className={`${Z_SHELL} flex-1`}>
            <div className={Z_SHELL_INNER}>
                <nav className="mb-4 flex flex-wrap items-center gap-1 text-[13px] font-semibold text-slate-500">
                    <Link to="/student/assignments" className={Z_LINK}>
                        Assignments
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="max-w-[min(100%,20rem)] truncate text-slate-800" title={displayTitle}>
                        {displayTitle}
                    </span>
                </nav>

                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        type="button"
                        onClick={() => navigate('/student/assignments')}
                        className="w-fit text-sm font-semibold text-slate-500 transition hover:text-slate-800"
                    >
                        ← Back to list
                    </button>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className={Z_BTN_SECONDARY}
                        >
                            <Printer className="h-4 w-4" />
                            Print
                        </button>
                        {teacherFileUrl ? (
                            <a href={teacherFileUrl} download target="_blank" rel="noreferrer" className={Z_BTN_PRIMARY}>
                                <Download className="h-4 w-4" />
                                Requirements file
                            </a>
                        ) : null}
                    </div>
                </div>

                <StudentTeacherInfoPanel
                    teachers={assignmentTeachers}
                    assignmentTitle={displayTitle}
                />

                {showNormalDeadlineBanner ? (
                    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                        <p className="font-bold">Submission deadline due</p>
                        <p className="mt-1">{DEADLINE_DUE_STUDENT_MESSAGE}</p>
                    </div>
                ) : null}

                {showProposalDeadlineBanner ? (
                    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                        <p className="font-bold">Proposal deadline due</p>
                        <p className="mt-1">{DEADLINE_DUE_STUDENT_MESSAGE}</p>
                    </div>
                ) : null}

                {showProjectDeadlineBanner ? (
                    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                        <p className="font-bold">Project deadline due</p>
                        <p className="mt-1">{DEADLINE_DUE_STUDENT_MESSAGE}</p>
                    </div>
                ) : null}

                <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <div className={`${Z_CARD} p-4`}>
                        <div className="flex flex-col items-center text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#1e56e3] to-[#3b74ff] text-lg font-bold text-white shadow-md">
                                {displayTitle.charAt(0).toUpperCase()}
                            </div>
                            <h2 className="mt-3 text-base font-bold leading-snug text-slate-900">{displayTitle}</h2>
                            <p className="mt-0.5 text-[12px] text-slate-500">{subjectLabel}</p>
                            <div className="mt-4 grid w-full grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                                <div className="rounded-lg bg-slate-50 py-1.5 text-center">
                                    <p className="text-base font-bold text-slate-900">
                                        {isNormalAssignment
                                            ? row?.latestNormalSubmission
                                                ? '1'
                                                : '0'
                                            : row?.latestProjectSubmission
                                              ? '1'
                                              : '0'}
                                    </p>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Your uploads</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 py-1.5 text-center">
                                    <p className="text-base font-bold text-slate-900">
                                        {assignment.projectDeadline || assignment.proposalDeadline
                                            ? new Date(
                                                  assignment.projectDeadline || assignment.proposalDeadline
                                              ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                            : '—'}
                                    </p>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Next deadline</p>
                                </div>
                            </div>
                            {!isNormalAssignment && workflow ? (
                                <span
                                    className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${getWorkflowBadgeClasses(workflow.tone)}`}
                                >
                                    {workflow.label}
                                </span>
                            ) : null}
                            {!isNormalAssignment ? (
                                <Link to={`/student/assignments/${assignment._id}/proposal`} className={`${Z_BTN_PRIMARY} mt-4 w-full`}>
                                    Open proposal
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTab('workspace');
                                        document.getElementById('normal-upload-anchor')?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className={`${Z_BTN_PRIMARY} mt-4 w-full`}
                                >
                                    {row?.latestNormalSubmission ? 'Replace upload' : 'Submit file'}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className={`${Z_CARD} p-4`}>
                        <h2 className="text-[12px] font-bold text-slate-900">Assignment details</h2>
                        <p className="mb-3 text-[11px] text-slate-500">Information from your teacher.</p>
                        {assignmentTeachers.length ? (
                            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                                <StudentTeacherInfoPanel
                                    teachers={assignmentTeachers}
                                    compact
                                    embedded
                                />
                            </div>
                        ) : null}
                        <div>
                            {!assignmentTeachers.length ? (
                                <DetailRow label="Teacher" value={teacherName} />
                            ) : null}
                            <DetailRow label="Subject" value={subjectLabel} />
                            <DetailRow
                                label="Type"
                                value={
                                    isCollaborativeAssignment
                                        ? 'Collaborative final (2 teachers · proposal + project)'
                                        : isNormalAssignment
                                          ? 'Normal (file upload)'
                                          : 'Final (proposal + project)'
                                }
                            />
                            <DetailRow label="Proposal deadline" value={proposalDeadline || '—'} />
                            <DetailRow label="Project deadline" value={projectDeadline || '—'} />
                            {!isNormalAssignment ? <DetailRow label="Proposal status" value={proposalStatusLabel(row)} /> : null}
                        </div>
                    </div>

                    <div className={`${Z_CARD} flex flex-col p-4`}>
                        <div className="mb-2 flex items-start justify-between gap-2">
                            <h2 className="text-[12px] font-bold text-slate-900">Notes</h2>
                            <span className="text-xs font-semibold text-[#1e56e3]">{studentName}</span>
                        </div>
                        {teacherFeedbackEntries.length ? (
                            <StudentProjectFeedbackPanel entries={teacherFeedbackEntries} />
                        ) : row?.proposal?.teacherComment && !row?.latestProjectSubmission ? (
                            <div className="flex-1 rounded-lg border border-blue-100 bg-blue-50/80 p-3 text-sm leading-relaxed text-blue-950">
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">Proposal feedback</p>
                                {row.proposal.teacherComment}
                            </div>
                        ) : (
                            <ul className="flex-1 space-y-2 text-sm text-slate-600">
                                <li className="flex gap-2">
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1e56e3]" />
                                    <span>
                                        {isNormalAssignment
                                            ? 'Upload one file per assignment. Similarity is checked only against classmates on the same task.'
                                            : 'Submit your proposal first. After teacher approval you can upload your project ZIP.'}
                                    </span>
                                </li>
                                {assignment?.requirementText ? (
                                    <li className="flex gap-2">
                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                        <span className="line-clamp-6">Requirements summary: {assignment.requirementText}</span>
                                    </li>
                                ) : null}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-5 lg:gap-4">
                    <div className="lg:col-span-3">
                        <div className={`${Z_CARD} flex min-h-[280px] flex-col overflow-hidden`}>
                            <div className="flex flex-wrap gap-1 border-b border-slate-100 px-2 pt-1.5">
                                {[
                                    { id: 'workspace', label: isNormalAssignment ? 'Submit work' : 'Workflow' },
                                    { id: 'activity', label: 'Activity' },
                                    { id: 'requirements', label: 'Requirements' },
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
                            <div className="min-h-0 flex-1 bg-white p-3 md:p-4">
                                {tab === 'activity' && (
                                    <div className="relative pl-6">
                                        <div className="absolute bottom-2 left-[11px] top-2 w-0.5 bg-[#1e56e3]/20" />
                                        <ul className="space-y-6">
                                            <li className="relative">
                                                <span className="absolute -left-1 top-1.5 flex h-3 w-3 -translate-x-[1.125rem] items-center justify-center rounded-full border-2 border-white bg-[#1e56e3] shadow" />
                                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Assignment</p>
                                                <p className="mt-1 font-bold text-slate-900">{displayTitle}</p>
                                                <p className="mt-1 text-sm text-slate-600">Teacher: {teacherName}</p>
                                            </li>
                                            {effectiveDeadline ? (
                                                <li className="relative">
                                                    <span className="absolute -left-1 top-1.5 flex h-3 w-3 -translate-x-[1.125rem] items-center justify-center rounded-full border-2 border-white bg-[#1e56e3] shadow" />
                                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Deadlines</p>
                                                    {proposalDeadline ? (
                                                        <p className="mt-1 text-sm text-slate-600">Proposal: {proposalDeadline}</p>
                                                    ) : null}
                                                    {projectDeadline ? (
                                                        <p className="mt-1 text-sm text-slate-600">Project: {projectDeadline}</p>
                                                    ) : null}
                                                </li>
                                            ) : null}
                                            {!isNormalAssignment && row?.proposal?.status ? (
                                                <li className="relative">
                                                    <span className="absolute -left-1 top-1.5 flex h-3 w-3 -translate-x-[1.125rem] items-center justify-center rounded-full border-2 border-white bg-[#1e56e3] shadow" />
                                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Proposal</p>
                                                    <p className="mt-1 font-bold text-slate-900">{proposalStatusLabel(row)}</p>
                                                </li>
                                            ) : null}
                                            {isNormalAssignment && row?.latestNormalSubmission ? (
                                                <li className="relative">
                                                    <span className="absolute -left-1 top-1.5 flex h-3 w-3 -translate-x-[1.125rem] items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow" />
                                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Latest file</p>
                                                    <p className="mt-1 font-bold text-slate-900">{row.latestNormalSubmission.originalFilename}</p>
                                                    <p className="mt-1 text-sm text-slate-600">
                                                        Similarity: {Math.round((Number(row.latestNormalSubmission.plagiarismScore || 0)) * 100)}%
                                                    </p>
                                                </li>
                                            ) : null}
                                        </ul>
                                    </div>
                                )}

                                {tab === 'requirements' && (
                                    <div className="space-y-4 text-sm">
                                        <div>
                                            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Teacher instructions</p>
                                            <p className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-4 text-slate-700">
                                                {assignment?.requirementText?.trim() || 'No requirement text was provided for this assignment.'}
                                            </p>
                                        </div>
                                        {Array.isArray(assignment?.requiredKeywords) && assignment.requiredKeywords.length > 0 ? (
                                            <div>
                                                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Required keywords</p>
                                                <p className="text-slate-800">{assignment.requiredKeywords.join(', ')}</p>
                                            </div>
                                        ) : null}
                                        {Array.isArray(assignment?.allowedTechnologies) && assignment.allowedTechnologies.length > 0 ? (
                                            <div>
                                                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Allowed technologies</p>
                                                <p className="text-slate-800">{assignment.allowedTechnologies.join(', ')}</p>
                                            </div>
                                        ) : null}
                                    </div>
                                )}

                                {tab === 'workspace' && (
                                    <div className="space-y-6">
                                        {isNormalAssignment ? (
                                            <div id="normal-upload-anchor" className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                                                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#1e56e3]">
                                                    Normal assignment
                                                </div>
                                                <h3 className="text-sm font-bold text-slate-900">Upload your file</h3>
                                                <p className="mt-1 text-[12px] text-slate-600">
                                                    Allowed: pdf, docx, txt, md, json, csv, Jupyter (.ipynb), and common code files.
                                                </p>
                                                <input
                                                    type="file"
                                                    onChange={(e) => setNormalFile(e.target.files?.[0] || null)}
                                                    disabled={normalDeadlineClosed}
                                                    className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={uploadingNormal || !normalFile || normalDeadlineClosed}
                                                    onClick={handleNormalUpload}
                                                    className={`${Z_BTN_PRIMARY} mt-3`}
                                                >
                                                    {uploadingNormal ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                                    {uploadingNormal ? 'Uploading…' : 'Submit assignment'}
                                                </button>
                                                {normalUploadErr ? <p className="mt-3 text-sm font-semibold text-rose-600">{normalUploadErr}</p> : null}
                                                {normalUploadMsg ? <p className="mt-3 text-sm font-semibold text-emerald-700">{normalUploadMsg}</p> : null}
                                                {row?.latestNormalSubmission ? (
                                                    <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                                                        <p className="text-xs font-bold text-slate-800">
                                                            Latest: {row.latestNormalSubmission.originalFilename}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            Similarity: {Math.round((Number(row.latestNormalSubmission.plagiarismScore || 0)) * 100)}%
                                                            {row.latestNormalSubmission.plagiarismFlag ? ' (high similarity flag)' : ''}
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <div className="grid gap-4 md:grid-cols-2">
                                                {showProposalDeadlineBanner ? (
                                                    <div className={`${Z_CARD} border-rose-200 bg-rose-50/80 p-4 opacity-95`}>
                                                        <div className="text-[10px] font-bold uppercase tracking-widest text-rose-700">Step 1 (closed)</div>
                                                        <h3 className="mt-1.5 text-sm font-bold text-slate-900">Proposal</h3>
                                                        <p className="mt-1 text-[12px] text-rose-800">{DEADLINE_DUE_STUDENT_MESSAGE}</p>
                                                    </div>
                                                ) : proposalPhaseComplete ? (
                                                    <Link
                                                        to={`/student/assignments/${assignment._id}/proposal`}
                                                        className={`${Z_CARD} border-emerald-200 bg-emerald-50/50 p-4 transition hover:border-emerald-300 hover:shadow-md`}
                                                    >
                                                        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Step 1 (done)</div>
                                                        <h3 className="mt-1.5 text-sm font-bold text-slate-900">Proposal</h3>
                                                        <p className="mt-1 text-[12px] text-slate-600">Submitted — view your proposal details.</p>
                                                    </Link>
                                                ) : (
                                                    <Link
                                                        to={`/student/assignments/${assignment._id}/proposal`}
                                                        className={`${Z_CARD} border-slate-200 p-4 transition hover:border-[#1e56e3]/35 hover:shadow-md`}
                                                    >
                                                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#1e56e3]">Step 1</div>
                                                        <h3 className="mt-1.5 text-sm font-bold text-slate-900">Proposal</h3>
                                                        <p className="mt-1 text-[12px] text-slate-600">Describe your idea for AI and teacher review.</p>
                                                    </Link>
                                                )}
                                                {proposalApprovedOrProjectUploaded ? (
                                                    projectSubmitted ? (
                                                        <Link
                                                            to={`/student/project/${assignment._id}`}
                                                            className={`${Z_CARD} border-emerald-200 bg-emerald-50/50 p-4 transition hover:border-emerald-300 hover:shadow-md`}
                                                        >
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Step 2 (done)</div>
                                                            <h3 className="mt-1.5 text-sm font-bold text-slate-900">Project ZIP</h3>
                                                            <p className="mt-1 text-[12px] text-slate-600">
                                                                Submitted — view project and teacher feedback.
                                                            </p>
                                                        </Link>
                                                    ) : showProjectDeadlineBanner ? (
                                                        <div className={`${Z_CARD} border-rose-200 bg-rose-50/80 p-4 opacity-95`}>
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-rose-700">Step 2 (closed)</div>
                                                            <h3 className="mt-1.5 text-sm font-bold text-slate-900">Project ZIP</h3>
                                                            <p className="mt-1 text-[12px] text-rose-800">{DEADLINE_DUE_STUDENT_MESSAGE}</p>
                                                        </div>
                                                    ) : (
                                                        <Link
                                                            to={`/student/project/${assignment._id}`}
                                                            className={`${Z_CARD} border-emerald-200 bg-emerald-50/50 p-4 transition hover:border-emerald-300 hover:shadow-md`}
                                                        >
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Step 2</div>
                                                            <h3 className="mt-1.5 text-sm font-bold text-slate-900">Project ZIP</h3>
                                                            <p className="mt-1 text-[12px] text-slate-600">Upload your final project archive.</p>
                                                        </Link>
                                                    )
                                                ) : (
                                                    <div className={`${Z_CARD} border-dashed border-slate-200 bg-slate-50 p-4 opacity-90`}>
                                                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Step 2 (locked)</div>
                                                        <h3 className="mt-1.5 text-sm font-bold text-slate-800">Project ZIP</h3>
                                                        <p className="mt-1 text-[12px] text-slate-600">Available after teacher approves your proposal.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {!isNormalAssignment && row.latestProjectSubmission ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                                                    <div>
                                                        <p className="text-sm font-bold text-emerald-900">
                                                            Project submitted: {row.latestProjectSubmission.originalFilename}
                                                        </p>
                                                        <p className="text-xs text-emerald-800">
                                                            {new Date(row.latestProjectSubmission.createdAt).toLocaleString()}
                                                            {row.latestProjectSubmission.teacherPreviewedAt
                                                                ? ` · Teacher previewed ${new Date(row.latestProjectSubmission.teacherPreviewedAt).toLocaleString()}`
                                                                : ' · Waiting for teacher preview'}
                                                        </p>
                                                    </div>
                                                </div>
                                                {teacherFeedbackEntries.length ? (
                                                    <StudentProjectFeedbackPanel entries={teacherFeedbackEntries} />
                                                ) : null}
                                            </div>
                                        ) : !isNormalAssignment ? (
                                            <p className="text-sm font-medium text-slate-500">
                                                No project file yet. Complete the proposal step first.
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <div className={`${Z_CARD} p-4`}>
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <h2 className="text-[12px] font-bold text-slate-900">Files / documents</h2>
                            </div>
                            <ul className="space-y-2">
                                {teacherFileUrl ? (
                                    <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
                                            <FileText className="h-5 w-5 text-[#1e56e3]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-slate-900">{teacherFileName}</p>
                                            <p className="text-xs font-medium text-slate-500">Teacher requirements</p>
                                        </div>
                                        <a
                                            href={teacherFileUrl}
                                            download
                                            target="_blank"
                                            rel="noreferrer"
                                            className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-[#1e56e3]"
                                            title="Download"
                                        >
                                            <Download className="h-4 w-4" />
                                        </a>
                                    </li>
                                ) : (
                                    <li className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs font-semibold text-slate-400">
                                        No teacher file attached.
                                    </li>
                                )}
                                {row?.latestNormalSubmission?.originalFilename ? (
                                    <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3 ring-1 ring-slate-100">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-100">
                                            <FileText className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-slate-900">{row.latestNormalSubmission.originalFilename}</p>
                                            <p className="text-xs font-medium text-slate-500">Your submission</p>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase text-slate-400">On server</span>
                                    </li>
                                ) : null}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    <StudentContactTeacherPanel
                        assignmentId={assignment._id}
                        assignmentTitle={displayTitle}
                        teacherName={teacherName}
                        teachers={assignmentTeachers}
                        showDeadlineHint={showContactDeadlineHint}
                    />
                </div>
            </div>
        </div>
    );
};

export default StudentAssignmentDetail;
