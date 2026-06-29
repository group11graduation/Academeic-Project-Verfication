import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { Z_BTN_BACK, Z_BTN_SUBMIT, Z_FORM_CARD, Z_INPUT, Z_LABEL, Z_TEXTAREA } from '../../../shared/ui/zendentaLayout';

const AssignmentCreate = () => {
    const navigate = useNavigate();
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [catalogIndex, setCatalogIndex] = useState(0);
    const [subjectId, setSubjectId] = useState('');
    const [selectedClassIds, setSelectedClassIds] = useState([]);
    const [assignmentType, setAssignmentType] = useState('normal');
    const [classAssignmentMode, setClassAssignmentMode] = useState('single');
    const [submissionMode, setSubmissionMode] = useState('single');
    const [proposalDeadline, setProposalDeadline] = useState('');
    const [projectDeadline, setProjectDeadline] = useState('');
    const [normalSubmissionDeadline, setNormalSubmissionDeadline] = useState('');
    const [requirementText, setRequirementText] = useState('');
    const [requiredKeywordsText, setRequiredKeywordsText] = useState('');
    const [allowedTechnologiesText, setAllowedTechnologiesText] = useState('');
    const [requirementsFile, setRequirementsFile] = useState(null);
    const requirementsFileInputRef = useRef(null);

    const isNormal = assignmentType === 'normal';
    const isFinal = assignmentType === 'final';
    const hideFinalTypedRequirements = isFinal && Boolean(requirementsFile);

    useEffect(() => {
        if (assignmentType === 'normal') {
            setSubmissionMode('single');
            setClassAssignmentMode('single');
            setProposalDeadline('');
            setProjectDeadline('');
            setRequiredKeywordsText('');
            setAllowedTechnologiesText('');
            setDescription('');
            setRequirementsFile(null);
            if (requirementsFileInputRef.current) requirementsFileInputRef.current.value = '';
        } else if (assignmentType === 'final' && requirementsFile) {
            setRequirementText('');
            setRequiredKeywordsText('');
            setAllowedTechnologiesText('');
        }
    }, [assignmentType]);

    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const res = await teacherService.getCatalog();
                if (res.success) {
                    const rows = res.data || [];
                    setCatalog(rows);
                    if (rows.length && rows[0].subjects?.length) setSubjectId(rows[0].subjects[0]._id);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadCatalog();
    }, []);

    useEffect(() => {
        const row = catalog[catalogIndex];
        if (row?.subjects?.length) {
            setSubjectId((prev) => row.subjects.some((s) => s._id === prev) ? prev : row.subjects[0]._id);
        } else {
            setSubjectId('');
        }
    }, [catalogIndex, catalog]);

    const selectedCatalogRow = catalog[catalogIndex] || null;

    const compatibleClassOptions = useMemo(() => {
        if (!selectedCatalogRow || !subjectId) return [];
        return catalog.filter((row) => {
            const sameSemester = String(row?.semester?._id || row?.semester || '') === String(selectedCatalogRow?.semester?._id || selectedCatalogRow?.semester || '');
            const sameAcademicYear = String(row?.academicYear?._id || row?.academicYear || '') === String(selectedCatalogRow?.academicYear?._id || selectedCatalogRow?.academicYear || '');
            const hasSubject = (row?.subjects || []).some((s) => String(s._id) === String(subjectId));
            return sameSemester && sameAcademicYear && hasSubject;
        });
    }, [catalog, selectedCatalogRow, subjectId]);

    useEffect(() => {
        setSelectedClassIds((prev) => {
            const validIds = compatibleClassOptions.map((row) => String(row.class?._id || ''));
            const kept = prev.filter((id) => validIds.includes(String(id)));
            if (kept.length) return kept;
            const defaultId = selectedCatalogRow?.class?._id ? [String(selectedCatalogRow.class._id)] : [];
            return defaultId.filter((id) => validIds.includes(id));
        });
    }, [compatibleClassOptions, selectedCatalogRow]);

    const handleToggleClass = (classId) => {
        if (classAssignmentMode === 'single') {
            setSelectedClassIds([String(classId)]);
            return;
        }
        setSelectedClassIds((prev) =>
            prev.includes(String(classId))
                ? prev.filter((id) => id !== String(classId))
                : [...prev, String(classId)]
        );
    };

    const clearRequirementsFileChoice = () => {
        setRequirementsFile(null);
        if (requirementsFileInputRef.current) requirementsFileInputRef.current.value = '';
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const row = selectedCatalogRow;
        if (!row || !subjectId) return alert('Select class context and subject.');
        if (selectedClassIds.length === 0) return alert('Select at least one class.');
        if (!title.trim()) return alert('Title is required.');
        if (assignmentType === 'normal' && !requirementText.trim()) {
            return alert('Instructions for students are required for a normal assignment.');
        }

        try {
            setSubmitting(true);
            const fd = new FormData();
            fd.append('classId', row.class._id);
            selectedClassIds.forEach((classId) => fd.append('classIds', classId));
            fd.append('subjectId', subjectId);
            fd.append('semesterId', row.semester?._id || row.semester || '');
            fd.append('academicYearId', row.academicYear?._id || row.academicYear || '');
            fd.append('title', title.trim());
            fd.append('description', description.trim());
            fd.append('submissionMode', assignmentType === 'normal' ? 'single' : submissionMode);
            fd.append('assignmentType', assignmentType);
            fd.append('classAssignmentMode', classAssignmentMode);
            if (assignmentType === 'normal') {
                fd.append('proposalPhaseOpen', 'false');
                fd.append('projectPhaseOpen', 'true');
            } else {
                fd.append('proposalPhaseOpen', 'true');
                fd.append('projectPhaseOpen', 'false');
            }
            if (assignmentType === 'normal' && normalSubmissionDeadline) {
                fd.append('projectDeadline', normalSubmissionDeadline);
            }
            if (assignmentType === 'final' && proposalDeadline) fd.append('proposalDeadline', proposalDeadline);
            if (assignmentType === 'final' && projectDeadline) fd.append('projectDeadline', projectDeadline);
            if (requirementText.trim()) fd.append('requirementText', requirementText.trim());
            if (assignmentType === 'final' && !requirementsFile && requiredKeywordsText.trim()) {
                fd.append('requiredKeywordsText', requiredKeywordsText.trim());
            }
            if (assignmentType === 'final' && !requirementsFile && allowedTechnologiesText.trim()) {
                fd.append('allowedTechnologiesText', allowedTechnologiesText.trim());
            }
            if (requirementsFile) fd.append('requirementsFile', requirementsFile);

            const res = await teacherService.createAssignment(fd);
            if (res.success) navigate('/teacher/assignments');
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to create assignment.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-7 w-7 text-[#2a3fa4] animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl">
            <button type="button" onClick={() => navigate('/teacher/assignments')} className={`mb-3 ${Z_BTN_BACK}`}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Assignments
            </button>

            <div className={Z_FORM_CARD}>
                <h1 className="text-base font-black text-slate-900 dark:text-slate-100">New Assignment</h1>
                <p className="text-[11px] text-slate-500 mt-0.5 mb-4">
                    {isNormal
                        ? 'Normal assignments: each student uploads one file. Set an optional submission deadline; students still see it on their assignment list and detail page.'
                        : 'Final assignments: students submit proposals first, then projects. Set deadlines and optional AI requirement checks below.'}
                </p>

                {catalog.length === 0 ? (
                    <p className="text-slate-500 text-sm">No class/subject assignments found. Ask admin to assign classes and subjects.</p>
                ) : (
                    <form onSubmit={handleCreate} className="space-y-3">
                        <div>
                            <label className={Z_LABEL}>Base class & term</label>
                            <select
                                value={catalogIndex}
                                onChange={(e) => setCatalogIndex(Number(e.target.value))}
                                className={Z_INPUT}
                            >
                                {catalog.map((row, i) => (
                                    <option key={i} value={i}>
                                        {row.class?.code} - {row.semester?.name || 'Sem'} ({row.academicYear?.label || 'Year'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={Z_LABEL}>Subject *</label>
                            <select
                                value={subjectId}
                                onChange={(e) => setSubjectId(e.target.value)}
                                required
                                className={Z_INPUT}
                            >
                                {(catalog[catalogIndex]?.subjects || []).length === 0 && (
                                    <option value="">No subjects linked to this class</option>
                                )}
                                {(catalog[catalogIndex]?.subjects || []).map((s) => (
                                    <option key={s._id} value={s._id}>
                                        {s.code} - {s.name}
                                    </option>
                                ))}
                            </select>
                            {(catalog[catalogIndex]?.subjects || []).length > 1 && (
                                <p className="mt-2 text-xs text-slate-500">
                                    Choose which class subject this assignment is for ({catalog[catalogIndex].subjects.length} available).
                                </p>
                            )}
                        </div>

                        <div>
                            <label className={Z_LABEL}>Assignment type</label>
                            <select
                                value={assignmentType}
                                onChange={(e) => setAssignmentType(e.target.value)}
                                className={Z_INPUT}
                            >
                                <option value="normal">Normal assignment</option>
                                <option value="final">Final assignment</option>
                            </select>
                        </div>

                        {isNormal ? (
                            <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/25 p-3 space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-wider text-[#2a3fa4] dark:text-blue-300">
                                    Normal assignment — requirements only
                                </p>
                                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 -mt-1">
                                    Students upload one file per assignment. Use the fields below for what they must submit; other proposal/project options are hidden.
                                </p>

                                {compatibleClassOptions.length > 1 ? (
                                    <div>
                                        <label className={Z_LABEL}>
                                            Class for this assignment *
                                        </label>
                                        <select
                                            value={selectedClassIds[0] || ''}
                                            onChange={(e) => setSelectedClassIds(e.target.value ? [e.target.value] : [])}
                                            required
                                            className={Z_INPUT}
                                        >
                                            <option value="">Select a class…</option>
                                            {compatibleClassOptions.map((row) => {
                                                const classId = String(row.class?._id || '');
                                                return (
                                                    <option key={classId} value={classId}>
                                                        {row.class?.code || row.class?.name} — {row.class?.name || 'Class'}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                ) : compatibleClassOptions.length === 1 ? (
                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                        Class:{' '}
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {compatibleClassOptions[0].class?.code} — {compatibleClassOptions[0].class?.name}
                                        </span>
                                    </p>
                                ) : (
                                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                                        No class matches this subject and term. Change base class or subject above.
                                    </p>
                                )}

                                <div>
                                    <label className={Z_LABEL}>
                                        Assignment title *
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        required
                                        placeholder="e.g. Homework 3 — Linear regression"
                                        className={Z_INPUT}
                                    />
                                </div>

                                <div>
                                    <label className={Z_LABEL}>
                                        Instructions for students *
                                    </label>
                                    <textarea
                                        value={requirementText}
                                        onChange={(e) => setRequirementText(e.target.value)}
                                        rows={5}
                                        required
                                        placeholder="What to submit (file types, structure, naming, due behavior, etc.). Students see this on the upload page."
                                        className={Z_TEXTAREA}
                                    />
                                </div>

                                <div>
                                    <label className={Z_LABEL}>
                                        Submission deadline (optional)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={normalSubmissionDeadline}
                                        onChange={(e) => setNormalSubmissionDeadline(e.target.value)}
                                        className={`${Z_INPUT} max-w-md`}
                                    />
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        Shown to students as the due date. Leave empty for no fixed deadline in the system.
                                    </p>
                                </div>

                                <div>
                                    <label className={Z_LABEL}>
                                        Requirements file (optional)
                                    </label>
                                    <input
                                        type="file"
                                        ref={requirementsFileInputRef}
                                        onChange={(e) => setRequirementsFile(e.target.files?.[0] || null)}
                                        className={Z_INPUT}
                                    />
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        Optional PDF or document. You can also upload later from the assignment detail page.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className={Z_LABEL}>Class assignment mode</label>
                                    <select
                                        value={classAssignmentMode}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            setClassAssignmentMode(next);
                                            if (next === 'single' && selectedClassIds.length > 1) {
                                                setSelectedClassIds(selectedClassIds.slice(0, 1));
                                            }
                                        }}
                                        className={Z_INPUT}
                                    >
                                        <option value="single">Single class</option>
                                        <option value="multiple">Multiple classes</option>
                                    </select>
                                </div>

                                <div>
                                    <label className={Z_LABEL}>Classes for this project *</label>
                                    <div className="rounded-lg border border-slate-200 dark:border-white/10 p-2.5 space-y-1.5 bg-white dark:bg-[#0B1120]">
                                        {compatibleClassOptions.map((row) => {
                                            const classId = String(row.class?._id || '');
                                            const checked = selectedClassIds.includes(classId);
                                            return (
                                                <label key={classId} className="flex items-center gap-2 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => handleToggleClass(classId)}
                                                    />
                                                    <span>
                                                        {row.class?.code || row.class?.name} - {row.class?.name || 'Class'}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                        {compatibleClassOptions.length === 0 && (
                                            <p className="text-sm font-medium text-slate-500">No compatible classes found for the selected subject and term.</p>
                                        )}
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">
                                        {classAssignmentMode === 'single'
                                            ? 'Single class mode: choose one class only.'
                                            : 'Multiple class mode: choose one or more classes to publish the same assignment.'}
                                    </p>
                                </div>

                                <div>
                                    <label className={Z_LABEL}>Title *</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        required
                                        className={Z_INPUT}
                                    />
                                </div>

                                <div>
                                    <label className={Z_LABEL}>Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={4}
                                        className={Z_TEXTAREA}
                                    />
                                </div>
                            </>
                        )}

                        {isFinal && (
                            <>
                                <div>
                                    <label className={Z_LABEL}>
                                        Requirements file (optional)
                                    </label>
                                    <input
                                        type="file"
                                        ref={requirementsFileInputRef}
                                        onChange={(e) => {
                                            const f = e.target.files?.[0] || null;
                                            setRequirementsFile(f);
                                            if (f) {
                                                setRequirementText('');
                                                setRequiredKeywordsText('');
                                                setAllowedTechnologiesText('');
                                            }
                                        }}
                                        className={Z_INPUT}
                                    />
                                    <div className="mt-2 flex flex-wrap items-center gap-3">
                                        <p className="text-xs text-slate-500">
                                            If you attach a file, typed requirements and keyword filters are hidden—students follow the document.
                                        </p>
                                        {requirementsFile && (
                                            <button
                                                type="button"
                                                onClick={clearRequirementsFileChoice}
                                                className="text-xs font-bold text-rose-600 hover:underline"
                                            >
                                                Remove file
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {!hideFinalTypedRequirements && (
                                    <>
                                        <div>
                                            <label className={Z_LABEL}>
                                                Teacher requirements (proposal / project)
                                            </label>
                                            <textarea
                                                value={requirementText}
                                                onChange={(e) => setRequirementText(e.target.value)}
                                                rows={4}
                                                placeholder="Example: Must include authentication, dashboard, and API integration."
                                                className={Z_INPUT}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className={Z_LABEL}>
                                                    Required keywords (optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={requiredKeywordsText}
                                                    onChange={(e) => setRequiredKeywordsText(e.target.value)}
                                                    placeholder="authentication, api, dashboard"
                                                    className={Z_INPUT}
                                                />
                                            </div>
                                            <div>
                                                <label className={Z_LABEL}>
                                                    Allowed technologies (optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={allowedTechnologiesText}
                                                    onChange={(e) => setAllowedTechnologiesText(e.target.value)}
                                                    placeholder="react, node, mongodb"
                                                    className={Z_INPUT}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className={Z_LABEL}>Submission mode</label>
                                    <select
                                        value={submissionMode}
                                        onChange={(e) => setSubmissionMode(e.target.value)}
                                        className={Z_INPUT}
                                    >
                                        <option value="single">Single student</option>
                                        <option value="group">Group (leader submits)</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className={Z_LABEL}>Proposal deadline</label>
                                        <input
                                            type="datetime-local"
                                            value={proposalDeadline}
                                            onChange={(e) => setProposalDeadline(e.target.value)}
                                            className={Z_INPUT}
                                        />
                                    </div>
                                    <div>
                                        <label className={Z_LABEL}>Project deadline</label>
                                        <input
                                            type="datetime-local"
                                            value={projectDeadline}
                                            onChange={(e) => setProjectDeadline(e.target.value)}
                                            className={Z_INPUT}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <button type="submit" disabled={submitting} className={Z_BTN_SUBMIT}>
                            {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating...</> : <><Plus className="h-3.5 w-3.5" /> Create assignment</>}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AssignmentCreate;
