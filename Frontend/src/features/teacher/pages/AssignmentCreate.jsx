import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Save } from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { Z_BTN_BACK, Z_BTN_SUBMIT, Z_FORM_CARD, Z_INPUT, Z_LABEL, Z_TEXTAREA } from '../../../shared/ui/zendentaLayout';
import { validateAssignmentRequirementsForm } from '../../../shared/utils/assignmentRequirements';
import {
    datetimeLocalMin,
    isDeadlinePassed,
    validateAssignmentDeadlinesForm,
} from '../../../shared/utils/assignmentDeadlines';

const AssignmentCreate = () => {
    const navigate = useNavigate();
    const { id: editId } = useParams();
    const isEdit = Boolean(editId);
    const [catalog, setCatalog] = useState([]);
    const [existingAssignment, setExistingAssignment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formPopulated, setFormPopulated] = useState(false);

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
    const [formError, setFormError] = useState('');
    const requirementsFileInputRef = useRef(null);
    const editInitialCatalogIndex = useRef(null);
    const initialDeadlinesRef = useRef({
        proposal: null,
        project: null,
        normal: null,
    });

    const deadlineMin = useMemo(() => datetimeLocalMin(), []);

    const isNormal = assignmentType === 'normal';
    const isFinal = assignmentType === 'final';
    const hasExistingRequirementsFile = isEdit && Boolean(existingAssignment?.assignmentFile);
    const hideFinalTypedRequirements = isFinal && (Boolean(requirementsFile) || hasExistingRequirementsFile);

    const prevAssignmentTypeRef = useRef(assignmentType);
    useEffect(() => {
        if (isEdit && !formPopulated) return;
        const typeChanged = prevAssignmentTypeRef.current !== assignmentType;
        prevAssignmentTypeRef.current = assignmentType;
        if (assignmentType === 'normal') {
            setSubmissionMode('single');
            setClassAssignmentMode('single');
            setProposalDeadline('');
            setProjectDeadline('');
            setRequiredKeywordsText('');
            setAllowedTechnologiesText('');
            // Only clear the chosen file when actually switching type,
            // otherwise picking a file would immediately reset it.
            if (!isEdit && typeChanged) {
                setDescription('');
                setRequirementsFile(null);
                if (requirementsFileInputRef.current) requirementsFileInputRef.current.value = '';
            }
        } else if (assignmentType === 'final' && requirementsFile) {
            setRequirementText('');
            setRequiredKeywordsText('');
            setAllowedTechnologiesText('');
        }
    }, [assignmentType, isEdit, formPopulated, requirementsFile]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setFormError('');
            try {
                const [cRes, aRes] = await Promise.all([
                    teacherService.getCatalog(),
                    isEdit && editId ? teacherService.getAssignmentById(editId) : Promise.resolve(null),
                ]);
                if (cancelled) return;

                const rows = cRes.success ? cRes.data || [] : [];
                setCatalog(rows);

                if (isEdit) {
                    if (!aRes?.success || !aRes?.data) {
                        setFormError('Assignment not found.');
                        return;
                    }
                    if (aRes.data.isCollaborative) {
                        setFormError('Collaborative assignments are managed from the collaborative assignment workflow.');
                        return;
                    }

                    const a = aRes.data;
                    const type = String(a.assignmentType || 'normal');
                    const hasFile = Boolean(a.assignmentFile);
                    const semId = String(a.semester?._id || a.semester || '');
                    const primaryClassId = String(a.class?._id || a.classes?.[0]?._id || '');

                    const idx = rows.findIndex(
                        (row) =>
                            String(row.class?._id) === primaryClassId &&
                            String(row.semester?._id || row.semester || '') === semId
                    );
                    if (idx >= 0) {
                        setCatalogIndex(idx);
                        editInitialCatalogIndex.current = idx;
                    }

                    setExistingAssignment(a);
                    setSubjectId(String(a.subject?._id || ''));
                    setTitle(a.title || '');
                    setDescription(a.description || '');
                    setAssignmentType(type);
                    setClassAssignmentMode(a.classAssignmentMode || ((a.classes || []).length > 1 ? 'multiple' : 'single'));
                    setSubmissionMode(a.submissionMode || 'single');
                    setRequirementText(type === 'final' && hasFile ? '' : (a.requirementText || ''));
                    setRequiredKeywordsText(
                        type === 'final' && hasFile
                            ? ''
                            : Array.isArray(a.requiredKeywords)
                              ? a.requiredKeywords.join(', ')
                              : ''
                    );
                    setAllowedTechnologiesText(
                        type === 'final' && hasFile
                            ? ''
                            : Array.isArray(a.allowedTechnologies)
                              ? a.allowedTechnologies.join(', ')
                              : ''
                    );
                    setProposalDeadline(a.proposalDeadline ? new Date(a.proposalDeadline).toISOString().slice(0, 16) : '');
                    setProjectDeadline(a.projectDeadline ? new Date(a.projectDeadline).toISOString().slice(0, 16) : '');
                    setNormalSubmissionDeadline(
                        type === 'normal' && a.projectDeadline
                            ? new Date(a.projectDeadline).toISOString().slice(0, 16)
                            : ''
                    );
                    initialDeadlinesRef.current = {
                        proposal: a.proposalDeadline || null,
                        project: a.projectDeadline || null,
                        normal: type === 'normal' ? a.projectDeadline || null : null,
                    };
                    setSelectedClassIds(
                        Array.isArray(a.classes) && a.classes.length
                            ? a.classes.map((c) => String(c._id || c))
                            : a.class?._id
                              ? [String(a.class._id)]
                              : []
                    );
                    setFormPopulated(true);
                } else if (rows.length && rows[0].subjects?.length) {
                    setSubjectId(rows[0].subjects[0]._id);
                }
            } catch (err) {
                if (!cancelled) setFormError(err.response?.data?.message || 'Failed to load assignment form.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [editId, isEdit]);

    useEffect(() => {
        const row = catalog[catalogIndex];
        if (isEdit && editInitialCatalogIndex.current === catalogIndex) return;
        if (row?.subjects?.length) {
            setSubjectId((prev) => (row.subjects.some((s) => s._id === prev) ? prev : row.subjects[0]._id));
        } else if (!isEdit) {
            setSubjectId('');
        }
    }, [catalogIndex, catalog, isEdit]);

    const selectedCatalogRow = catalog[catalogIndex] || null;

    const selectedSubject = useMemo(() => {
        if (!subjectId) return null;
        const fromCatalog = (selectedCatalogRow?.subjects || []).find((s) => String(s._id) === String(subjectId));
        if (fromCatalog) return fromCatalog;
        if (existingAssignment?.subject && String(existingAssignment.subject._id || existingAssignment.subject) === String(subjectId)) {
            return existingAssignment.subject;
        }
        return null;
    }, [subjectId, selectedCatalogRow, existingAssignment]);

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
        setFormError('');
        const row = selectedCatalogRow;
        if (!row || !subjectId) return setFormError('Select class context and subject.');
        if (selectedClassIds.length === 0) return setFormError('Select at least one class.');
        if (!title.trim()) return setFormError('Title is required.');

        const requirementsError = validateAssignmentRequirementsForm({
            assignmentType,
            requirementText,
            allowedTechnologiesText,
            requirementsFile,
            hasExistingFile: hasExistingRequirementsFile,
            subject: selectedSubject,
            title: title.trim(),
            description: description.trim(),
        });
        if (requirementsError) return setFormError(requirementsError);

        const deadlineError = validateAssignmentDeadlinesForm({
            assignmentType,
            proposalDeadline,
            projectDeadline,
            normalSubmissionDeadline,
            isEdit,
            initialProposalDeadline: initialDeadlinesRef.current.proposal,
            initialProjectDeadline: initialDeadlinesRef.current.project,
            initialNormalDeadline: initialDeadlinesRef.current.normal,
        });
        if (deadlineError) return setFormError(deadlineError);

        const typedRequirementsPayload =
            isFinal && (requirementsFile || hasExistingRequirementsFile)
                ? {}
                : {
                      requirementText: requirementText.trim(),
                      requiredKeywordsText: isFinal ? requiredKeywordsText.trim() : '',
                      allowedTechnologiesText: isFinal ? allowedTechnologiesText.trim() : '',
                  };

        try {
            setSubmitting(true);

            if (isEdit) {
                const body = {
                    subjectId,
                    title: title.trim(),
                    description: description.trim(),
                    submissionMode: isNormal ? 'single' : submissionMode,
                    assignmentType,
                    classAssignmentMode: isNormal ? 'single' : classAssignmentMode,
                    classIds: selectedClassIds,
                    proposalPhaseOpen: isNormal ? false : true,
                    projectPhaseOpen: isNormal ? true : false,
                    proposalDeadline: isFinal && proposalDeadline ? proposalDeadline : null,
                    projectDeadline: isNormal
                        ? normalSubmissionDeadline || null
                        : isFinal && projectDeadline
                          ? projectDeadline
                          : null,
                    ...typedRequirementsPayload,
                };
                const res = await teacherService.updateAssignment(editId, body);
                if (requirementsFile) {
                    await teacherService.uploadAssignmentRequirements(editId, requirementsFile);
                }
                if (res.success) navigate(`/teacher/assignments/${editId}`);
                return;
            }

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
            setFormError(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} assignment.`);
        } finally {
            setSubmitting(false);
        }
    };

    const passedProposalDeadline = isEdit && isFinal && isDeadlinePassed(existingAssignment?.proposalDeadline);
    const passedProjectOrNormalDeadline =
        isEdit &&
        isDeadlinePassed(
            isNormal ? existingAssignment?.projectDeadline : existingAssignment?.projectDeadline
        );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-7 w-7 text-[#2a3fa4] animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl">
            <button
                type="button"
                onClick={() => navigate(isEdit ? `/teacher/assignments/${editId}` : '/teacher/assignments')}
                className={`mb-3 ${Z_BTN_BACK}`}
            >
                <ArrowLeft className="h-3.5 w-3.5" /> {isEdit ? 'Back to assignment' : 'Back to Assignments'}
            </button>

            <div className={Z_FORM_CARD}>
                <h1 className="text-base font-black text-slate-900 dark:text-slate-100">
                    {isEdit ? 'Edit Assignment' : 'New Assignment'}
                </h1>
                <p className="text-[11px] text-slate-500 mt-0.5 mb-4">
                    {isNormal
                        ? 'Normal assignments: each student uploads one file. Set an optional submission deadline; students still see it on their assignment list and detail page.'
                        : 'Final assignments: students submit proposals first, then projects. Set deadlines and optional AI requirement checks below.'}
                </p>

                {catalog.length === 0 ? (
                    <p className="text-slate-500 text-sm">No class/subject assignments found. Ask admin to assign classes and subjects.</p>
                ) : (
                    <form onSubmit={handleCreate} className="space-y-3">
                        {formError && (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                                {formError}
                            </div>
                        )}

                        {passedProposalDeadline ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                                <p className="font-bold">Proposal deadline has passed.</p>
                                <p className="mt-1 font-semibold">
                                    Students cannot submit proposals. Set a new future date below to extend the deadline.
                                </p>
                            </div>
                        ) : null}

                        {passedProjectOrNormalDeadline ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                                <p className="font-bold">
                                    {isNormal ? 'Submission deadline has passed.' : 'Project deadline has passed.'}
                                </p>
                                <p className="mt-1 font-semibold">
                                    Students cannot upload. Set a new future date below to extend the deadline.
                                </p>
                            </div>
                        ) : null}

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
                                        min={deadlineMin}
                                        className={`${Z_INPUT} max-w-md`}
                                    />
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        Must be after the current date and time. Shown to students as the due date. Leave empty for no fixed deadline.
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
                                        Optional PDF or document. Students can download it from their assignment page.
                                    </p>
                                    {requirementsFile && (
                                        <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                            Selected: {requirementsFile.name}
                                            <button
                                                type="button"
                                                onClick={clearRequirementsFileChoice}
                                                className="font-bold text-rose-600 hover:underline"
                                            >
                                                Remove
                                            </button>
                                        </p>
                                    )}
                                    {hasExistingRequirementsFile && !requirementsFile && (
                                        <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                            Current file: {existingAssignment?.originalFileName || 'requirements document'}
                                        </p>
                                    )}
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
                                        {hasExistingRequirementsFile && (
                                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                                Current file: {existingAssignment?.originalFileName || 'requirements document'}
                                            </p>
                                        )}
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
                                                Teacher requirements (proposal / project) *
                                            </label>
                                            <textarea
                                                value={requirementText}
                                                onChange={(e) => setRequirementText(e.target.value)}
                                                rows={4}
                                                required={isFinal && !requirementsFile}
                                                placeholder="Example: Must include authentication, dashboard, and API integration."
                                                className={Z_INPUT}
                                            />
                                            <p className="mt-1 text-[11px] text-slate-500">
                                                Required together with allowed technologies, unless you upload a requirements file.
                                            </p>
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
                                                Allowed technologies *
                                            </label>
                                            <input
                                                type="text"
                                                value={allowedTechnologiesText}
                                                onChange={(e) => setAllowedTechnologiesText(e.target.value)}
                                                required={isFinal && !requirementsFile}
                                                placeholder="react, node, mongodb"
                                                className={Z_INPUT}
                                            />
                                            <p className="mt-1 text-[11px] text-slate-500">
                                                Required for final assignments unless you upload a requirements file.
                                            </p>
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
                                            min={deadlineMin}
                                            className={Z_INPUT}
                                        />
                                        <p className="mt-1 text-[11px] text-slate-500">Must be after the current date and time.</p>
                                    </div>
                                    <div>
                                        <label className={Z_LABEL}>Project deadline</label>
                                        <input
                                            type="datetime-local"
                                            value={projectDeadline}
                                            onChange={(e) => setProjectDeadline(e.target.value)}
                                            min={deadlineMin}
                                            className={Z_INPUT}
                                        />
                                        <p className="mt-1 text-[11px] text-slate-500">Must be on or after the proposal deadline.</p>
                                    </div>
                                </div>
                            </>
                        )}

                        <button type="submit" disabled={submitting} className={Z_BTN_SUBMIT}>
                            {submitting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {isEdit ? 'Saving...' : 'Creating...'}
                                </>
                            ) : isEdit ? (
                                <>
                                    <Save className="h-3.5 w-3.5" /> Save changes
                                </>
                            ) : (
                                <>
                                    <Plus className="h-3.5 w-3.5" /> Create assignment
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AssignmentCreate;
