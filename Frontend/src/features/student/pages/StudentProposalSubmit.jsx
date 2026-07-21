import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, X, Send, Save, UploadCloud, ChevronRight } from 'lucide-react';
import studentService from '../../../services/studentService';
import { getApiErrorMessage } from '../../../shared/utils/apiErrors';
import MatchedSimilarProjectPanel from '../components/MatchedSimilarProjectPanel';
import { Z_SHELL, Z_SHELL_INNER, Z_CARD, Z_BTN_PRIMARY, Z_BTN_SECONDARY, Z_LINK, Z_INPUT } from '../../../shared/ui/zendentaLayout';
import { DEADLINE_DUE_STUDENT_MESSAGE } from '../../../shared/utils/assignmentDeadlines';
import { evaluateProposalRequirementCoverage } from '../../../shared/utils/techRequirements';

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
    const [recommendation, setRecommendation] = useState(null);
    const [suggestedFeatures, setSuggestedFeatures] = useState([]);
    const [matchedSimilarProject, setMatchedSimilarProject] = useState(null);
    const [error, setError] = useState(null);
    const [proposalFile, setProposalFile] = useState(null);
    const [inputMode, setInputMode] = useState('text'); // text | file
    const [parsingFile, setParsingFile] = useState(false);
    const [fileParseError, setFileParseError] = useState(null);
    const [parsedFileLabel, setParsedFileLabel] = useState('');
    const proposalFileInputRef = useRef(null);

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
                    setRecommendation(p.recommendation || p.aiRecommendationText || null);
                    setSuggestedFeatures(
                        Array.isArray(p.suggestedFeatures) && p.suggestedFeatures.length
                            ? p.suggestedFeatures
                            : Array.isArray(p.aiSuggestedFeatures)
                              ? p.aiSuggestedFeatures
                              : []
                    );
                    setMatchedSimilarProject(p.matchedSimilarProject || null);
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

    const clearAttachedProposalFile = () => {
        setProposalFile(null);
        setFileParseError(null);
        setParsedFileLabel('');
        if (proposalFileInputRef.current) {
            proposalFileInputRef.current.value = '';
        }
    };

    const applyParsedProposalToForm = (parsed, { replace = false } = {}) => {
        if (!parsed) return;
        if (replace) {
            setTitle(String(parsed.title || '').trim());
            setDescription(String(parsed.description || '').trim());
            const nextFeatures = Array.isArray(parsed.features)
                ? parsed.features.map((f) => String(f || '').trim()).filter(Boolean)
                : [];
            setFeatures(nextFeatures.length ? nextFeatures : ['']);
            return;
        }
        if (parsed.title) setTitle(parsed.title);
        if (parsed.description) setDescription(parsed.description);
        if (Array.isArray(parsed.features) && parsed.features.length) {
            setFeatures(parsed.features);
        }
    };

    const addFeature = () => {
        setFeatures([...features, '']);
        if (proposalFile) clearAttachedProposalFile();
    };
    const removeFeature = (i) => {
        setFeatures(features.filter((_, j) => j !== i));
        if (proposalFile) clearAttachedProposalFile();
    };
    const setFeature = (i, v) => {
        const next = [...features];
        next[i] = v;
        setFeatures(next);
        if (proposalFile) clearAttachedProposalFile();
    };

    const addSuggestedFeature = (featureText) => {
        const value = String(featureText || '').trim();
        if (!value) return;
        const existing = features.map((f) => String(f || '').trim().toLowerCase()).filter(Boolean);
        if (existing.includes(value.toLowerCase())) return;
        const cleaned = features.map((f) => String(f || '').trim()).filter(Boolean);
        setFeatures([...cleaned, value]);
        if (proposalFile) clearAttachedProposalFile();
    };

    const buildSubmitPayload = (finalize) => ({
        title,
        description,
        features: features.map((f) => f.trim()).filter(Boolean),
        groupId: row?.group?._id || undefined,
        finalize,
        contentSource: inputMode === 'file' && proposalFile ? 'file' : 'form',
        file: inputMode === 'file' && proposalFile ? proposalFile : undefined,
    });

    const syncProposalFromResponse = (data) => {
        const p = data?.proposal;
        if (p) {
            setRow((prev) => ({ ...prev, proposal: p }));
            setTitle(p.title || '');
            setDescription(p.description || '');
            setFeatures(p.features?.length ? p.features : ['']);
            return;
        }
        if (data?.parsed) {
            applyParsedProposalToForm(data.parsed, { replace: true });
        }
    };

    const handleProposalFileChange = async (e) => {
        const input = e.target;
        const file = input.files?.[0] || null;
        setFileParseError(null);
        setMessage(null);

        if (!file) {
            clearAttachedProposalFile();
            return;
        }

        setProposalFile(file);
        setParsingFile(true);
        try {
            const res = await studentService.parseProposalFile(assignmentId, file);
            if (res.success && res.data?.parsed) {
                applyParsedProposalToForm(res.data.parsed, { replace: true });
                const modified = file.lastModified
                    ? new Date(file.lastModified).toLocaleString()
                    : 'just now';
                setParsedFileLabel(`${file.name} (${modified})`);
                setMessage(`Loaded content from "${file.name}". Review the fields below, then submit.`);
            } else {
                setProposalFile(null);
                setParsedFileLabel('');
                setFileParseError(res.message || 'Could not parse this file.');
            }
        } catch (err) {
            setProposalFile(null);
            setParsedFileLabel('');
            setFileParseError(err.response?.data?.message || 'Could not parse this file.');
        } finally {
            setParsingFile(false);
            if (input) input.value = '';
        }
    };

    const saveDraft = async () => {
        setError(null);
        setRecommendation(null);
        setSuggestedFeatures([]);
        setSubmitting(true);
        try {
            const payload = buildSubmitPayload(false);
            const res = payload.file
                ? await studentService.submitProposalWithFile(assignmentId, payload)
                : await studentService.submitProposal(assignmentId, payload);
            if (res.success) {
                setMessage('Draft saved.');
                syncProposalFromResponse(res.data);
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
        if (!canSubmitFinal) {
            setError('Proposal does not satisfy teacher requirements yet. Please fix the missing items first.');
            return;
        }
        setSubmitting(true);
        try {
            const payload = buildSubmitPayload(true);
            const res = payload.file
                ? await studentService.submitProposalWithFile(assignmentId, payload)
                : await studentService.submitProposal(assignmentId, payload);
            if (res.success) {
                const unchangedMessage = 'This same proposal was already submitted before.';
                const responseMessage = res.data?.message || '';
                const proposalStatus = res.data?.proposal?.status || '';
                const isRejection =
                    responseMessage === unchangedMessage ||
                    proposalStatus === 'requirements_rejected' ||
                    proposalStatus === 'requirements_review' ||
                    proposalStatus === 'ai_rejected_same_semester' ||
                    /^rejected automatically:/i.test(responseMessage);

                syncProposalFromResponse(res.data);
                setRecommendation(res.data?.recommendation || res.data?.proposal?.aiRecommendationText || null);
                setSuggestedFeatures(
                    Array.isArray(res.data?.suggestedFeatures) && res.data.suggestedFeatures.length
                        ? res.data.suggestedFeatures
                        : Array.isArray(res.data?.proposal?.aiSuggestedFeatures)
                          ? res.data.proposal.aiSuggestedFeatures
                          : []
                );
                setMatchedSimilarProject(res.data?.matchedSimilarProject || res.data?.proposal?.matchedSimilarProject || null);

                if (isRejection) {
                    setMessage(null);
                    setError(
                        res.data?.recommendation ||
                            responseMessage ||
                            'Your proposal was not accepted. Update title, description, or features and try again.'
                    );
                } else {
                    setMessage(responseMessage || 'Submitted.');
                    setError(null);
                }
                await load();
            } else {
                setError(res.message || 'Submission failed');
            }
        } catch (e) {
            setError(
                getApiErrorMessage(
                    e,
                    'Submission failed. AI analysis can take 1–3 minutes — keep this page open and try again.'
                )
            );
        } finally {
            setSubmitting(false);
        }
    };

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
                    <p className="text-slate-600">Assignment not found or not in your enrollment.</p>
                    <Link to="/student/assignments" className={`${Z_LINK} mt-4 inline-block`}>
                        Back to assignments
                    </Link>
                </div>
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
    const normalizedFeatures = features.map((f) => String(f || '').trim()).filter(Boolean);
    const hasAnyTextInput =
        Boolean(String(title || '').trim()) ||
        Boolean(String(description || '').trim()) ||
        normalizedFeatures.length > 0;
    const requirementCheck = evaluateProposalRequirementCoverage(assignment, {
        title,
        description,
        features: normalizedFeatures,
    });
    const showRequirementWarning =
        requirementCheck.hasRules &&
        hasAnyTextInput &&
        (!requirementCheck.passed || requirementCheck.advisoryOnly);
    const canSubmitFinal = !lockedByApproval && beforeDeadline && requirementCheck.passed;

    if (!canEdit) {
        return (
            <div className={Z_SHELL}>
                <div className={Z_SHELL_INNER}>
                    <p className="text-sm font-bold text-slate-900 mb-2">
                        Only the group leader can submit the proposal for this assignment.
                    </p>
                    <Link to="/student/assignments" className={Z_LINK}>
                        Back to assignments
                    </Link>
                </div>
            </div>
        );
    }

    if (!assignment.proposalPhaseOpen) {
        return (
            <div className={Z_SHELL}>
                <div className={Z_SHELL_INNER}>
                    <div className={`${Z_CARD} p-4 text-slate-600`}>Proposal phase is closed for this assignment.</div>
                </div>
            </div>
        );
    }

    if (isWaitingTeacherApproval && !beforeDeadline) {
        return (
            <div className={Z_SHELL}>
                <div className={Z_SHELL_INNER}>
                    <div className={`${Z_CARD} border-amber-200 bg-amber-50 px-4 py-3`}>
                        <p className="text-sm font-bold text-amber-900 mb-1.5">Proposal sent. Waiting for teacher approval.</p>
                        <p className="text-sm font-semibold text-amber-800 mb-4">{DEADLINE_DUE_STUDENT_MESSAGE}</p>
                        <button
                            type="button"
                            onClick={() => navigate('/student/assignments')}
                            className={Z_BTN_PRIMARY}
                        >
                            Back to assignments
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!beforeDeadline) {
        return (
            <div className={Z_SHELL}>
                <div className={Z_SHELL_INNER}>
                    <div className={`${Z_CARD} border-rose-200 bg-rose-50 px-4 py-3`}>
                        <p className="text-sm font-bold text-rose-900 mb-1.5">Proposal deadline due</p>
                        <p className="text-sm font-semibold text-rose-800 mb-1">
                            {proposalDeadlineDate ? proposalDeadlineDate.toLocaleString() : 'Deadline passed'}
                        </p>
                        <p className="text-sm font-semibold text-rose-800 mb-4">{DEADLINE_DUE_STUDENT_MESSAGE}</p>
                        <button
                            type="button"
                            onClick={() => navigate(`/student/assignments/${assignmentId}`)}
                            className={Z_BTN_PRIMARY}
                        >
                            Back to assignment
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${Z_SHELL} flex-1`}>
            <div className={Z_SHELL_INNER}>
                <nav className="mb-4 flex flex-wrap items-center gap-1 text-[13px] font-semibold text-slate-500">
                    <Link to="/student/assignments" className={Z_LINK}>
                        Assignments
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <Link to={`/student/assignments/${assignmentId}`} className={`${Z_LINK} max-w-[12rem] truncate`} title={assignment.title}>
                        {assignment.title}
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="text-slate-800">Proposal</span>
                </nav>

                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        type="button"
                        onClick={() => navigate(`/student/assignments/${assignmentId}`)}
                        className="flex w-fit items-center gap-1.5 text-[12px] font-semibold text-slate-500 transition hover:text-slate-800"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to assignment
                    </button>
                </div>

                <p className="text-[12px] text-slate-600 mb-4">{assignment.title}</p>

                {showRequirementWarning && (
                    <div
                        className={`mb-6 rounded-xl px-4 py-3 text-sm ${
                            requirementCheck.passed
                                ? 'border border-amber-200 bg-amber-50 text-amber-900'
                                : 'border border-rose-200 bg-rose-50 text-rose-800'
                        }`}
                    >
                        <p className="font-black uppercase tracking-wider text-[11px] mb-1.5">
                            Teacher Requirement Check
                        </p>
                        {!!requirementCheck.requirementText && (
                            <p className="font-semibold mb-2">
                                Requirement: {requirementCheck.requirementText}
                            </p>
                        )}
                        {requirementCheck.tooShort ? (
                            <p className="font-semibold mb-2">
                                Write a real project description in full sentences. Casual chat or only
                                typing technology names (for example “PHP MySQL”) will be rejected by the AI.
                            </p>
                        ) : requirementCheck.passed ? (
                            <p className="font-semibold mb-2">
                                You can submit. The AI will check whether your proposal meaningfully matches
                                the teacher requirements (paraphrase is OK; unrelated English is not).
                            </p>
                        ) : (
                            <p className="font-semibold mb-2">
                                Fix the issues below before final submit.
                            </p>
                        )}
                        {requirementCheck.disallowedMentionedTech.length > 0 && (
                            <p className="font-semibold">
                                Disallowed technologies detected: {requirementCheck.disallowedMentionedTech.join(', ')}
                            </p>
                        )}
                        {requirementCheck.advisoryOnly && requirementCheck.passed && (
                            <p className="mt-1 text-[12px] font-medium opacity-90">
                                Tip: explain how you use{' '}
                                {[
                                    ...requirementCheck.missingAllowedTech,
                                    ...requirementCheck.missingImplicitTerms,
                                ]
                                    .filter(Boolean)
                                    .join(', ') || 'the required technologies'}{' '}
                                in context — do not only list the words.
                            </p>
                        )}
                    </div>
                )}

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

                <div className="mb-4 inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
                    <button
                        type="button"
                        onClick={() => {
                            setInputMode('text');
                            clearAttachedProposalFile();
                        }}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg ${inputMode === 'text' ? 'bg-[#1D68E3] text-white' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                        Fill form
                    </button>
                    <button
                        type="button"
                        onClick={() => setInputMode('file')}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg ${inputMode === 'file' ? 'bg-[#1D68E3] text-white' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                        Upload proposal file
                    </button>
                </div>

                {inputMode === 'file' && (
                    <div className={`${Z_CARD} mb-4 p-3`}>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                            Structured proposal file (.txt, .md, .json, .csv, .docx)
                        </label>
                        <input
                            ref={proposalFileInputRef}
                            type="file"
                            accept=".txt,.md,.json,.csv,.docx,text/plain,text/markdown,application/json,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={handleProposalFileChange}
                            disabled={parsingFile || lockedByApproval}
                            className={`${Z_INPUT} text-[12px]`}
                        />
                        {parsingFile && (
                            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-[#1D68E3]" /> Extracting title, description, and features…
                            </p>
                        )}
                        {proposalFile && !parsingFile && (
                            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-2">
                                <UploadCloud className="h-4 w-4 text-[#1D68E3]" />
                                {parsedFileLabel || proposalFile.name}
                            </p>
                        )}
                        {fileParseError && (
                            <p className="mt-2 text-sm font-semibold text-rose-600">{fileParseError}</p>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                            Uploading replaces the form below with the new file content. If you edit and save the same filename, choose the file again to reload it.
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            Supports structured labels (Title:, Description:, Features:) or sections like Project Overview and Proposed Functionality with bullet points. `.docx` supported.
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
                        Your proposal did not meaningfully match teacher requirements and was automatically rejected.
                        Casual English or only listing technology names is not enough — rewrite in full sentences that address the requirements.
                        {proposal?.requirementCheckSummary ? ` ${proposal.requirementCheckSummary}` : ''}
                    </div>
                )}

                {proposal?.status === 'requirements_review' && (
                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                        Borderline requirement match — waiting for teacher review.
                        {proposal?.requirementCheckSummary ? ` ${proposal.requirementCheckSummary}` : ''}
                    </div>
                )}

                {proposal?.status === 'ai_flagged_previous_semester' && matchedSimilarProject ? (
                    <MatchedSimilarProjectPanel
                        match={matchedSimilarProject}
                        recommendation={recommendation}
                        suggestedFeatures={suggestedFeatures}
                        onAddFeature={addSuggestedFeature}
                    />
                ) : proposal?.status === 'ai_flagged_previous_semester' ? (
                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                        <p>
                            This idea resembles an approved project from a previous semester. You can optionally add extra
                            features to make your project more original before teacher review.
                        </p>
                        <Link
                            to="/gallery"
                            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#1D68E3] px-4 py-2 text-xs font-bold text-white hover:bg-[#1a4dcc]"
                        >
                            Browse verified projects
                        </Link>
                    </div>
                ) : null}

                {proposal?.status === 'ai_flagged_previous_semester' &&
                !matchedSimilarProject &&
                (recommendation || suggestedFeatures.length > 0) ? (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                        <p className="font-bold mb-1">Optional feature recommendations</p>
                        {recommendation && <p className="font-semibold mb-2">{recommendation}</p>}
                        {suggestedFeatures.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {suggestedFeatures.map((feat) => (
                                    <button
                                        key={feat}
                                        type="button"
                                        onClick={() => addSuggestedFeature(feat)}
                                        className="rounded-full border border-amber-300 bg-white dark:bg-amber-950 px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900"
                                    >
                                        + {feat}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : null}

                {proposal?.teacherComment && (
                    <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-200 mb-1.5">
                            Teacher feedback
                        </p>
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
                            {proposal.teacherComment}
                        </p>
                    </div>
                )}

                {(proposal?.teacherProposalScore != null || (proposal?.teacherVsAi && proposal.teacherVsAi !== 'not_set')) && (
                    <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                            Teacher review (separate from AI similarity)
                        </p>
                        {proposal.teacherProposalScore != null && (
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Teacher quality score: {proposal.teacherProposalScore} / 100
                            </p>
                        )}
                        {proposal.teacherVsAi && proposal.teacherVsAi !== 'not_set' && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                {proposal.teacherVsAi === 'aligns' && 'Your teacher agreed with the AI risk assessment.'}
                                {proposal.teacherVsAi === 'stricter' && 'Your teacher applied a stricter standard than the AI hint.'}
                                {proposal.teacherVsAi === 'lenient' && 'Your teacher considered the AI too harsh and accepted the direction of your work.'}
                            </p>
                        )}
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

                <div className={`${Z_CARD} space-y-4 p-4`}>
                    {inputMode === 'file' && (
                        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 text-[12px] font-semibold text-blue-800 dark:text-blue-200">
                            Upload a file above to auto-fill the fields below. You can edit title, description, and each feature before saving or submitting.
                        </div>
                    )}
                    <div>
                        <label className="block text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-1.5">Title</label>
                        <input
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                if (proposalFile) clearAttachedProposalFile();
                            }}
                            className={`${Z_INPUT} text-slate-900 dark:text-slate-900 placeholder:text-slate-400`}
                            placeholder="Project title"
                            disabled={lockedByApproval}
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => {
                                setDescription(e.target.value);
                                if (proposalFile) clearAttachedProposalFile();
                            }}
                            rows={5}
                            className={`${Z_INPUT} text-slate-900 dark:text-slate-900 placeholder:text-slate-400 resize-y`}
                            placeholder="Describe the project scope"
                            disabled={lockedByApproval}
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[12px] font-bold text-slate-700 dark:text-slate-200">Features</label>
                            <button
                                type="button"
                                onClick={addFeature}
                                className="text-[12px] font-bold text-[#1D68E3] flex items-center gap-1"
                            >
                                <Plus className="h-3.5 w-3.5" /> Add feature
                            </button>
                        </div>
                        {features.map((f, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                                <input
                                    value={f}
                                    onChange={(e) => setFeature(i, e.target.value)}
                                    className={`${Z_INPUT} flex-1 text-slate-900 dark:text-slate-900 placeholder:text-slate-400`}
                                    placeholder={`Feature ${i + 1}`}
                                    disabled={lockedByApproval}
                                />
                                {features.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeFeature(i)}
                                        className="p-1.5 text-rose-500"
                                        disabled={lockedByApproval}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                        <button
                            type="button"
                            disabled={submitting || lockedByApproval || !beforeDeadline}
                            onClick={saveDraft}
                            className={Z_BTN_SECONDARY}
                        >
                            <Save className="h-4 w-4" />
                            Save draft
                        </button>
                        <button
                            type="button"
                            disabled={submitting || !canSubmitFinal}
                            onClick={submitFinal}
                            className={Z_BTN_PRIMARY}
                        >
                            {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            {submitting
                                ? 'Running AI check…'
                                : alreadyFinalSubmitted
                                  ? 'Update & Resubmit'
                                  : 'Submit for AI & teacher review'}
                        </button>
                    </div>
                    {submitting && (
                        <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            AI similarity analysis can take 1–3 minutes. Keep this page open until it finishes.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudentProposalSubmit;
