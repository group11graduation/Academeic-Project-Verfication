import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, X, Send, Save } from 'lucide-react';
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
            const res = await studentService.submitProposal(assignmentId, {
                title,
                description,
                features: features.map((f) => f.trim()).filter(Boolean),
                groupId: row?.group?._id || undefined,
                finalize: false
            });
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
            const res = await studentService.submitProposal(assignmentId, {
                title,
                description,
                features: features.map((f) => f.trim()).filter(Boolean),
                groupId: row?.group?._id || undefined,
                finalize: true
            });
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

    if (!canEdit) {
        return (
            <div className="min-h-screen bg-[#F8FAFB]">
                <StudentHeader />
                <div className="max-w-[720px] mx-auto px-6 py-16">
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
                <div className="max-w-[720px] mx-auto px-6 py-16 text-slate-600 dark:text-slate-300">
                    Proposal phase is closed for this assignment.
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB] dark:bg-[#0F172A]">
            <StudentHeader />
            <div className="max-w-[800px] mx-auto px-6 py-10">
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

                {proposal?.status === 'ai_flagged_previous_semester' && (
                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                        This idea resembles an approved project from a previous semester. Add at least{' '}
                        <strong>two new features</strong> that were not in your previous list, then submit again for
                        teacher review.
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
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Title</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm"
                            placeholder="Project title"
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
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm"
                            placeholder="Describe the project scope"
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
                                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm"
                                    placeholder={`Feature ${i + 1}`}
                                />
                                {features.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeFeature(i)}
                                        className="p-2 text-rose-500"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-3 pt-4">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={saveDraft}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-600 font-bold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            <Save className="h-4 w-4" />
                            Save draft
                        </button>
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={submitFinal}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1D68E3] text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                            {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            Submit for AI & teacher review
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentProposalSubmit;
