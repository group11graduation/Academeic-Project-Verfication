import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, X, Send, Save, UploadCloud } from 'lucide-react';
import studentService from '../../../services/studentService';
import StudentHeader from '../components/StudentHeader';

const StudentProposalSubmit = () => {
    const { assignmentId } = useParams();
    const navigate = useNavigate();
    const [row, setRow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [features, setFeatures] = useState(['']);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [proposalFile, setProposalFile] = useState(null);
    const [inputMode, setInputMode] = useState('text'); // text | file

    const load = async () => {
        setLoading(true);
        try {
            const res = await studentService.getAssignment(assignmentId);
            if (res.success) {
                setRow(res.data);
                const p = res.data.proposal;
                if (p) {
                    setTitle(p.title || '');
                    setDescription(p.description || '');
                    setFeatures(p.features?.length ? p.features : ['']);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [assignmentId]);

    const addFeature = () => setFeatures([...features, '']);
    const removeFeature = (i) => setFeatures(features.filter((_, j) => j !== i));
    const setFeature = (i, v) => {
        const next = [...features];
        next[i] = v;
        setFeatures(next);
    };

    const saveDraft = async () => {
        setError(null);
        setSubmitting(true);
        try {
            const payload = {
                title,
                description,
                features: features.map((f) => f.trim()).filter(Boolean),
                groupId: row?.group?._id || undefined,
                finalize: false,
                file: proposalFile || undefined,
            };
            const res = proposalFile
                ? await studentService.submitProposalWithFile(assignmentId, payload)
                : await studentService.submitProposal(assignmentId, payload);
            if (res.success) {
                setMessage('Draft saved.');
                const p = res.data?.proposal;
                if (p) setRow((prev) => ({ ...prev, proposal: p }));
            }
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to save');
        } finally {
            setSubmitting(false);
        }
    };

    const submitFinal = async () => {
        setError(null);
        setMessage(null);
        setSubmitting(true);
        try {
            const payload = {
                title,
                description,
                features: features.map((f) => f.trim()).filter(Boolean),
                groupId: row?.group?._id || undefined,
                finalize: true,
                file: proposalFile || undefined,
            };
            const res = proposalFile
                ? await studentService.submitProposalWithFile(assignmentId, payload)
                : await studentService.submitProposal(assignmentId, payload);
            if (res.success) {
                setMessage(res.data?.message || 'Submitted.');
                const p = res.data?.proposal;
                if (p) setRow((prev) => ({ ...prev, proposal: p }));
            }
        } catch (e) {
            setError(e.response?.data?.message || 'Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    if (!row?.assignment) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] p-10">
                <p className="text-slate-600 dark:text-slate-300">Assignment not found or not in your enrollment.</p>
                <Link to="/student" className="text-[#1D68E3] font-bold mt-4 inline-block">
                    Back
                </Link>
            </div>
        );
    }

    const { assignment, proposal, isGroupLeader, group } = row;
    const isGroup = assignment.submissionMode === 'group';
    const canEdit = !isGroup || isGroupLeader;
    const isWaitingTeacherApproval = proposal?.status === 'pending_teacher_approval';
    const now = new Date();
    const proposalDeadlineDate = assignment?.proposalDeadline ? new Date(assignment.proposalDeadline) : null;
    const beforeDeadline = !proposalDeadlineDate || now <= proposalDeadlineDate;
    const alreadyFinalSubmitted = Boolean(proposal && proposal.status && proposal.status !== 'draft');
    const lockedByApproval = proposal?.status === 'teacher_approved';

    if (!canEdit) {
        return (
            <div className="min-h-screen bg-[#F8FAFB]">
                <StudentHeader />
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <p className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                        Only the group leader can submit the proposal for this assignment.
                    </p>
                    <Link to="/student" className="text-[#1D68E3] font-bold">
                        Back to dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (!assignment.proposalPhaseOpen) {
        return (
            <div className="min-h-screen bg-[#F8FAFB]">
                <StudentHeader />
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-16 text-slate-600 dark:text-slate-300">
                    Proposal phase is closed for this assignment.
                </div>
            </div>
        );
    }

    if (isWaitingTeacherApproval && !beforeDeadline) {
        return (
            <div className="min-h-screen bg-[#F8FAFB]">
                <StudentHeader />
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5">
                        <p className="text-lg font-black text-amber-900 mb-2">Proposal sent. Waiting for teacher approval.</p>
                        <p className="text-sm font-semibold text-amber-800 mb-4">
                            Proposal deadline has passed. You cannot update proposal now unless teacher requests revision.
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate('/student/assignments')}
                            className="rounded-xl bg-[#1D68E3] text-white px-5 py-2.5 text-sm font-black"
                        >
                            Back to assignments
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB] dark:bg-[#0F172A]">
            <StudentHeader />
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <button
                    type="button"
                    onClick={() => navigate('/student')}
                    className="flex items-center gap-2 text-slate-500 font-bold text-sm mb-6"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Dashboard
                </button>

                <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Submit proposal</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-8">{assignment.title}</p>

                {alreadyFinalSubmitted && (
                    <div className="mb-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-4 py-3 text-sm font-semibold">
                        Proposal already submitted. You cannot create another proposal.
                        {beforeDeadline && !lockedByApproval ? ' You can update and resubmit this same proposal before deadline.' : ''}
                    </div>
                )}
                {isWaitingTeacherApproval && beforeDeadline && (
                    <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-4 py-3 text-sm font-semibold">
                        Proposal is pending teacher review. Before deadline, you can still update and resubmit it.
                    </div>
                )}
                {lockedByApproval && (
                    <div className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 px-4 py-3 text-sm font-semibold">
                        Proposal is approved by teacher and now locked for editing.
                    </div>
                )}

                <div className="mb-6 inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900">
                    <button
                        type="button"
                        onClick={() => setInputMode('text')}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg ${inputMode === 'text' ? 'bg-[#1D68E3] text-white' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                        Fill form
                    </button>
                    <button
                        type="button"
                        onClick={() => setInputMode('file')}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg ${inputMode === 'file' ? 'bg-[#1D68E3] text-white' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                        Upload proposal file
                    </button>
                </div>

                {inputMode === 'file' && (
                    <div className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                            Structured proposal file (.txt, .md, .json, .csv, .docx)
                        </label>
                        <input
                            type="file"
                            accept=".txt,.md,.json,.csv,.docx,text/plain,text/markdown,application/json,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(e) => setProposalFile(e.target.files?.[0] || null)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                        />
                        {proposalFile && (
                            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-2">
                                <UploadCloud className="h-4 w-4 text-[#1D68E3]" /> {proposalFile.name}
                            </p>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                            Example structure: Title:, Description:, Features: (one per line with -). Word `.docx` also supported.
                        </p>
                    </div>
                )}

                {group && (
                    <div className="mb-6 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Group: {group.name} — you are the leader.
                    </div>
                )}

                {proposal?.status === 'ai_rejected_same_semester' && (
                    <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
                        This proposal was rejected for similarity with another project in the same semester. Please
                        change the idea, description, and features before submitting again.
                    </div>
                )}

                {proposal?.status === 'requirements_rejected' && (
                    <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
                        Your proposal did not match teacher requirements and was automatically rejected before AI similarity checks.
                        {proposal?.requirementCheckSummary ? ` ${proposal.requirementCheckSummary}` : ''}
                    </div>
                )}

                {proposal?.status === 'ai_flagged_previous_semester' && (
                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                        This idea resembles an approved project from a previous semester. Add at least{' '}
                        <strong>two new features</strong> that were not in your previous list, then submit again for
                        teacher review.
                    </div>
                )}

                {proposal?.teacherComment && (
                    <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-200 mb-1.5">
                            Teacher Feedback To Student
                        </p>
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
                            {proposal.teacherComment}
                        </p>
                    </div>
                )}

                {error && (
                    <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-200 px-4 py-3 text-sm font-semibold">
                        {error}
                    </div>
                )}
                {message && (
                    <div className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 px-4 py-3 text-sm font-semibold">
                        {message}
                    </div>
                )}

                <div className="space-y-6 bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    {inputMode === 'text' ? (
                        <>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Title</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-white px-4 py-3 text-sm text-slate-900 dark:text-slate-900 placeholder:text-slate-400"
                            placeholder="Project title"
                            disabled={lockedByApproval}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={5}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-white px-4 py-3 text-sm text-slate-900 dark:text-slate-900 placeholder:text-slate-400"
                            placeholder="Describe the project scope"
                            disabled={lockedByApproval}
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Features</label>
                            <button
                                type="button"
                                onClick={addFeature}
                                className="text-sm font-bold text-[#1D68E3] flex items-center gap-1"
                            >
                                <Plus className="h-4 w-4" /> Add feature
                            </button>
                        </div>
                        {features.map((f, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                                <input
                                    value={f}
                                    onChange={(e) => setFeature(i, e.target.value)}
                                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm bg-white dark:bg-white text-slate-900 dark:text-slate-900 placeholder:text-slate-400"
                                    placeholder={`Feature ${i + 1}`}
                                    disabled={lockedByApproval}
                                />
                                {features.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeFeature(i)}
                                        className="p-2 text-rose-500"
                                        disabled={lockedByApproval}
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                        </>
                    ) : (
                        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-sm font-semibold text-blue-800 dark:text-blue-200">
                            Proposal file mode enabled. You can leave text fields empty. System reads file and extracts Title, Description, and Features.
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3 pt-4">
                        <button
                            type="button"
                            disabled={submitting || lockedByApproval || !beforeDeadline}
                            onClick={saveDraft}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-600 font-bold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            <Save className="h-4 w-4" />
                            Save draft
                        </button>
                        <button
                            type="button"
                            disabled={submitting || lockedByApproval || !beforeDeadline}
                            onClick={submitFinal}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1D68E3] text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                            {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            {alreadyFinalSubmitted ? 'Update & Resubmit' : 'Submit for AI & teacher review'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentProposalSubmit;
