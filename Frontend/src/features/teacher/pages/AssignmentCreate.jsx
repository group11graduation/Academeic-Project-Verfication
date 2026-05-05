import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import teacherService from '../../../services/teacherService';

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
    const [requirementText, setRequirementText] = useState('');
    const [requiredKeywordsText, setRequiredKeywordsText] = useState('');
    const [allowedTechnologiesText, setAllowedTechnologiesText] = useState('');
    const [requirementsFile, setRequirementsFile] = useState(null);

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

    const handleCreate = async (e) => {
        e.preventDefault();
        const row = selectedCatalogRow;
        if (!row || !subjectId) return alert('Select class context and subject.');
        if (selectedClassIds.length === 0) return alert('Select at least one class.');
        if (!title.trim()) return alert('Title is required.');

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
            fd.append('submissionMode', submissionMode);
            fd.append('assignmentType', assignmentType);
            fd.append('classAssignmentMode', classAssignmentMode);
            fd.append('proposalPhaseOpen', 'true');
            fd.append('projectPhaseOpen', 'false');
            if (proposalDeadline) fd.append('proposalDeadline', proposalDeadline);
            if (projectDeadline) fd.append('projectDeadline', projectDeadline);
            if (requirementText.trim()) fd.append('requirementText', requirementText.trim());
            if (requiredKeywordsText.trim()) fd.append('requiredKeywordsText', requiredKeywordsText.trim());
            if (allowedTechnologiesText.trim()) fd.append('allowedTechnologiesText', allowedTechnologiesText.trim());
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
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B1120]">
                <Loader2 className="h-10 w-10 text-[#2a3fa4] animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-10 max-w-[900px] mx-auto min-h-screen">
            <button
                type="button"
                onClick={() => navigate('/teacher/assignments')}
                className="mb-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
                <ArrowLeft className="h-4 w-4" /> Back to Assignments
            </button>

            <div className="bg-white dark:bg-[#0F172A] rounded-[24px] border border-slate-200 dark:border-white/10 p-8 shadow-sm">
                <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">New Assignment</h1>
                <p className="text-sm text-slate-500 mt-1 mb-6">Must exist before students can submit proposals.</p>

                {catalog.length === 0 ? (
                    <p className="text-slate-500 text-sm">No class/subject assignments found. Ask admin to assign classes and subjects.</p>
                ) : (
                    <form onSubmit={handleCreate} className="space-y-5">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Base class & term</label>
                            <select
                                value={catalogIndex}
                                onChange={(e) => setCatalogIndex(Number(e.target.value))}
                                className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                            >
                                {catalog.map((row, i) => (
                                    <option key={i} value={i}>
                                        {row.class?.code} - {row.semester?.name || 'Sem'} ({row.academicYear?.label || 'Year'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Subject *</label>
                            <select
                                value={subjectId}
                                onChange={(e) => setSubjectId(e.target.value)}
                                required
                                className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                            >
                                {(catalog[catalogIndex]?.subjects || []).map((s) => (
                                    <option key={s._id} value={s._id}>
                                        {s.code} - {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Assignment type</label>
                            <select
                                value={assignmentType}
                                onChange={(e) => setAssignmentType(e.target.value)}
                                className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                            >
                                <option value="normal">Normal assignment</option>
                                <option value="final">Final assignment</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Class assignment mode</label>
                            <select
                                value={classAssignmentMode}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setClassAssignmentMode(next);
                                    if (next === 'single' && selectedClassIds.length > 1) {
                                        setSelectedClassIds(selectedClassIds.slice(0, 1));
                                    }
                                }}
                                className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                            >
                                <option value="single">Single class</option>
                                <option value="multiple">Multiple classes</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Classes for this project *</label>
                            <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-2 bg-white dark:bg-[#0B1120]">
                                {compatibleClassOptions.map((row) => {
                                    const classId = String(row.class?._id || '');
                                    const checked = selectedClassIds.includes(classId);
                                    return (
                                        <label key={classId} className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
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
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Teacher requirements (optional)</label>
                            <textarea
                                value={requirementText}
                                onChange={(e) => setRequirementText(e.target.value)}
                                rows={4}
                                placeholder="Example: Must include authentication, dashboard, and API integration."
                                className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Required keywords (optional)</label>
                                <input
                                    type="text"
                                    value={requiredKeywordsText}
                                    onChange={(e) => setRequiredKeywordsText(e.target.value)}
                                    placeholder="authentication, api, dashboard"
                                    className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Allowed technologies (optional)</label>
                                <input
                                    type="text"
                                    value={allowedTechnologiesText}
                                    onChange={(e) => setAllowedTechnologiesText(e.target.value)}
                                    placeholder="react, node, mongodb"
                                    className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Requirements file (optional)</label>
                            <input
                                type="file"
                                onChange={(e) => setRequirementsFile(e.target.files?.[0] || null)}
                                className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                            />
                            <p className="mt-2 text-xs text-slate-500">You can upload now or later from assignment detail page.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Submission mode</label>
                            <select
                                value={submissionMode}
                                onChange={(e) => setSubmissionMode(e.target.value)}
                                className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                            >
                                <option value="single">Single student</option>
                                <option value="group">Group (leader submits)</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 mb-2">Proposal deadline</label>
                                <input
                                    type="datetime-local"
                                    value={proposalDeadline}
                                    onChange={(e) => setProposalDeadline(e.target.value)}
                                    className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 mb-2">Project deadline</label>
                                <input
                                    type="datetime-local"
                                    value={projectDeadline}
                                    onChange={(e) => setProjectDeadline(e.target.value)}
                                    className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-[#2a3fa4] text-white font-black text-sm py-3.5 rounded-2xl hover:bg-[#223688] disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><Plus className="h-4 w-4" /> Create assignment</>}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AssignmentCreate;
