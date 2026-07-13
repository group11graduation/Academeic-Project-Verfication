import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, Loader2, Lock, Save, Send, Trash2, Users } from 'lucide-react';
import { appConfirm, appSuccess } from '../../../lib/appDialog';
import { useAuth } from '../../../context/authContext';
import teacherService from '../../../services/teacherService';
import TeacherCollaborationPanel from '../components/TeacherCollaborationPanel';
import { Z_BTN_BACK, Z_BTN_INDIGO, Z_FORM_CARD, Z_INPUT, Z_LABEL, Z_TEXTAREA } from '../../../shared/ui/zendentaLayout';

const emptyTechBlock = () => ({
    requirementText: '',
    description: '',
    requiredKeywordsText: '',
    allowedTechnologiesText: '',
    requirementFile: '',
    originalFileName: '',
});

const blockToForm = (block = {}) => ({
    requirementText: block.requirementText || '',
    description: block.description || '',
    requiredKeywordsText: (block.requiredKeywords || []).join(', '),
    allowedTechnologiesText: (block.allowedTechnologies || []).join(', '),
    requirementFile: block.requirementFile || '',
    originalFileName: block.originalFileName || '',
});

const buildTechPayload = (block) => ({
    requirementText: block.requirementText.trim(),
    description: block.description.trim(),
    requiredKeywords: block.requiredKeywordsText
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    allowedTechnologies: block.allowedTechnologiesText
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    requirementFile: block.requirementFile || '',
    originalFileName: block.originalFileName || '',
});

const isSectionComplete = (block) =>
    Boolean(block.requirementFile) ||
    Boolean(block.requirementText.trim()) ||
    Boolean(block.allowedTechnologiesText.trim());

const teacherLabel = (teacher) => teacher?.name || teacher?.email || 'Teacher';

const toDateTimeLocal = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const CollaborativeAssignmentCreate = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const currentUserId = String(user?._id || user?.id || '');

    const [catalog, setCatalog] = useState([]);
    const [collaborators, setCollaborators] = useState([]);
    const [drafts, setDrafts] = useState([]);
    const [draft, setDraft] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [startingDraft, setStartingDraft] = useState(false);
    const [uploadingSection, setUploadingSection] = useState('');
    const [notice, setNotice] = useState(null);

    const [coTeacherId, setCoTeacherId] = useState('');
    const [myRole, setMyRole] = useState('frontend');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [catalogIndex, setCatalogIndex] = useState(0);
    const [subjectId, setSubjectId] = useState('');
    const [selectedClassIds, setSelectedClassIds] = useState([]);
    const [submissionMode, setSubmissionMode] = useState('single');
    const [proposalDeadline, setProposalDeadline] = useState('');
    const [projectDeadline, setProjectDeadline] = useState('');
    const [frontend, setFrontend] = useState(emptyTechBlock);
    const [backend, setBackend] = useState(emptyTechBlock);

    const frontendFileRef = useRef(null);
    const backendFileRef = useRef(null);

    const draftId = searchParams.get('draft');

    const showNotice = useCallback((title, message) => {
        setNotice({ title, message });
    }, []);

    const applyDraftToForm = useCallback((row, catalogRows = []) => {
        setDraft(row);
        setTitle(row.title || '');
        setDescription(row.description || '');
        setSubjectId(row.subject?._id || row.subject || '');
        setSubmissionMode(row.submissionMode || 'single');
        setProposalDeadline(toDateTimeLocal(row.proposalDeadline));
        setProjectDeadline(toDateTimeLocal(row.projectDeadline));
        setFrontend(blockToForm(row.frontendTechRequirements));
        setBackend(blockToForm(row.backendTechRequirements));

        const classIds = (row.classes?.length ? row.classes : row.class ? [row.class] : []).map((c) =>
            String(c?._id || c)
        );
        setSelectedClassIds(classIds.filter(Boolean));

        const rowClassId = String(row.class?._id || row.class || '');
        if (rowClassId && catalogRows.length) {
            const idx = catalogRows.findIndex((entry) => String(entry.class?._id) === rowClassId);
            if (idx >= 0) setCatalogIndex(idx);
        }
    }, []);

    const reloadCollaborators = useCallback(async () => {
        const collabRes = await teacherService.getAcceptedCollaborators();
        if (collabRes.success) {
            const partners = collabRes.data || [];
            setCollaborators(partners);
            setCoTeacherId((prev) =>
                prev && partners.some((p) => String(p.teacherId) === String(prev))
                    ? prev
                    : String(partners[0]?.teacherId || '')
            );
        }
    }, []);

    const reloadDrafts = useCallback(async () => {
        const res = await teacherService.listCollaborativeDrafts();
        const rows = res.success ? res.data || [] : [];
        setDrafts(rows);
        return rows;
    }, []);

    const loadDraft = useCallback(async (id, catalogRows = []) => {
        if (!id) return false;
        try {
            const res = await teacherService.getCollaborativeDraft(id);
            if (res.success) {
                applyDraftToForm(res.data, catalogRows);
                return true;
            }
        } catch (err) {
            const status = err.response?.status;
            if (status === 403 || status === 404) {
                setSearchParams({}, { replace: true });
                setDraft(null);
                showNotice(
                    'Draft unavailable',
                    err.response?.data?.message || 'This collaborative draft is no longer available to your account.'
                );
            } else {
                console.error(err);
            }
        }
        return false;
    }, [applyDraftToForm, setSearchParams, showNotice]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const catalogRes = await teacherService.getCatalog();
                const rows = catalogRes.success ? catalogRes.data || [] : [];
                if (cancelled) return;
                setCatalog(rows);
                if (rows.length && rows[0].subjects?.length) setSubjectId(rows[0].subjects[0]._id);
                await Promise.all([reloadCollaborators(), reloadDrafts()]);
                if (cancelled) return;
                if (draftId) await loadDraft(draftId, rows);
            } catch (err) {
                console.error(err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [draftId, loadDraft, reloadCollaborators, reloadDrafts]);

    const selectedCatalogRow = catalog[catalogIndex] || null;
    const defaultSubjectId = selectedCatalogRow?.subjects?.[0]?._id || '';
    const activeSubjectId = subjectId || defaultSubjectId;

    const compatibleClassOptions = useMemo(() => {
        if (!selectedCatalogRow || !activeSubjectId) return [];
        return catalog.filter((row) => {
            const sameSemester =
                String(row?.semester?._id || row?.semester || '') ===
                String(selectedCatalogRow?.semester?._id || selectedCatalogRow?.semester || '');
            const sameAcademicYear =
                String(row?.academicYear?._id || row?.academicYear || '') ===
                String(selectedCatalogRow?.academicYear?._id || selectedCatalogRow?.academicYear || '');
            const hasSubject = (row?.subjects || []).some((s) => String(s._id) === String(activeSubjectId));
            return sameSemester && sameAcademicYear && hasSubject;
        });
    }, [activeSubjectId, catalog, selectedCatalogRow]);

    useEffect(() => {
        const row = catalog[catalogIndex];
        if (row?.subjects?.length) {
            setSubjectId((prev) => (row.subjects.some((s) => s._id === prev) ? prev : row.subjects[0]._id));
        } else {
            setSubjectId('');
        }
    }, [catalogIndex, catalog]);

    useEffect(() => {
        setSelectedClassIds((prev) => {
            const validIds = compatibleClassOptions.map((row) => String(row.class?._id || ''));
            const kept = prev.filter((id) => validIds.includes(String(id)));
            if (kept.length) return kept;
            const defaultId = selectedCatalogRow?.class?._id ? [String(selectedCatalogRow.class._id)] : [];
            return defaultId.filter((id) => validIds.includes(id));
        });
    }, [compatibleClassOptions, selectedCatalogRow]);

    const myDraftRole = useMemo(() => {
        if (!draft || !currentUserId) return null;
        if (String(draft.frontendTeacherId?._id || draft.frontendTeacherId) === currentUserId) return 'frontend';
        if (String(draft.backendTeacherId?._id || draft.backendTeacherId) === currentUserId) return 'backend';
        return null;
    }, [draft, currentUserId]);

    const frontendTeacher = draft?.frontendTeacherId;
    const backendTeacher = draft?.backendTeacherId;
    const frontendDone = isSectionComplete(frontend);
    const backendDone = isSectionComplete(backend);
    const defaultClassId = selectedCatalogRow?.class?._id ? String(selectedCatalogRow.class._id) : '';
    const activeClassIds = selectedClassIds.length > 0 ? selectedClassIds : defaultClassId ? [defaultClassId] : [];
    const readyToPublish = Boolean(title.trim()) && frontendDone && backendDone && activeClassIds.length > 0 && activeSubjectId;
    const missingPublishItems = [
        !title.trim() ? 'title' : '',
        !activeSubjectId ? 'subject' : '',
        activeClassIds.length === 0 ? 'at least one class' : '',
        !frontendDone ? 'frontend requirements' : '',
        !backendDone ? 'backend requirements' : '',
    ].filter(Boolean);

    const handleToggleClass = (classId) => {
        setSelectedClassIds((prev) =>
            prev.includes(String(classId)) ? prev.filter((id) => id !== String(classId)) : [...prev, String(classId)]
        );
    };

    const handleStartDraft = async () => {
        if (!coTeacherId) {
            showNotice('Select a co-teacher', 'Choose an accepted collaboration partner before starting the draft.');
            return;
        }
        try {
            setStartingDraft(true);
            const res = await teacherService.createCollaborativeDraft({ coTeacherId, myRole });
            if (res.success) {
                setSearchParams({ draft: res.data._id });
                applyDraftToForm(res.data, catalog);
                await reloadDrafts();
            }
        } catch (err) {
            showNotice('Draft not started', err.response?.data?.message || 'Could not start collaborative draft.');
        } finally {
            setStartingDraft(false);
        }
    };

    const buildSavePayload = () => {
        const row = selectedCatalogRow;

        const payload = {
            title: title.trim(),
            description: description.trim(),
            submissionMode,
            proposalDeadline: proposalDeadline || null,
            projectDeadline: projectDeadline || null,
        };

        if (row) {
            if (activeSubjectId) payload.subjectId = activeSubjectId;
            payload.semesterId = row.semester?._id || row.semester || '';
            payload.academicYearId = row.academicYear?._id || row.academicYear || '';
            if (activeClassIds.length > 0) {
                payload.classId = row.class._id;
                payload.classIds = activeClassIds;
            } else if (row.class?._id) {
                payload.classId = row.class._id;
            }
        }

        if (myDraftRole === 'frontend') {
            payload.frontendTechRequirements = buildTechPayload(frontend);
        } else if (myDraftRole === 'backend') {
            payload.backendTechRequirements = buildTechPayload(backend);
        }

        return payload;
    };

    const handleSaveProgress = async ({ silent = false } = {}) => {
        if (!draft?._id) return false;
        const payload = buildSavePayload();

        try {
            setSaving(true);
            const res = await teacherService.updateCollaborativeDraft(draft._id, payload);
            if (res.success) {
                if (payload.classId) {
                    applyDraftToForm(res.data, catalog);
                } else {
                    setDraft(res.data);
                    setTitle(res.data.title || title);
                    setDescription(res.data.description || description);
                    setSubmissionMode(res.data.submissionMode || submissionMode);
                    setProposalDeadline(toDateTimeLocal(res.data.proposalDeadline) || proposalDeadline);
                    setProjectDeadline(toDateTimeLocal(res.data.projectDeadline) || projectDeadline);
                    setFrontend(blockToForm(res.data.frontendTechRequirements));
                    setBackend(blockToForm(res.data.backendTechRequirements));
                }
                await reloadDrafts();
                if (!silent) {
                    await appSuccess('Progress saved. Your co-teacher can continue their section.');
                }
            }
            return res.success;
        } catch (err) {
            showNotice('Progress not saved', err.response?.data?.message || 'Could not save progress.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteDraft = async (draftIdToDelete = draft?._id) => {
        if (!draftIdToDelete) return;
        if (
            !(await appConfirm({
                message:
                    'Delete this collaborative assignment draft? Both you and your co-teacher will lose this draft. This cannot be undone.',
                danger: true,
                confirmLabel: 'Delete draft',
            }))
        ) {
            return;
        }
        try {
            setDeleting(true);
            const res = await teacherService.deleteCollaborativeDraft(draftIdToDelete);
            if (res.success) {
                if (String(draftIdToDelete) === String(draft?._id) || String(draftIdToDelete) === String(draftId)) {
                    setSearchParams({}, { replace: true });
                    setDraft(null);
                }
                await reloadDrafts();
                showNotice('Draft deleted', 'The collaborative draft was removed. Start a new one when you are ready.');
            }
        } catch (err) {
            showNotice('Delete failed', err.response?.data?.message || 'Could not delete draft.');
        } finally {
            setDeleting(false);
        }
    };

    const handleSectionFile = async (section, file) => {
        if (!draft?._id || !file) return;
        try {
            setUploadingSection(section);
            const res = await teacherService.uploadCollaborativeDraftSectionFile(draft._id, section, file);
            if (res.success) {
                setDraft(res.data);
                setFrontend(blockToForm(res.data.frontendTechRequirements));
                setBackend(blockToForm(res.data.backendTechRequirements));
            }
        } catch (err) {
            showNotice('File not uploaded', err.response?.data?.message || 'Could not upload requirements file.');
        } finally {
            setUploadingSection('');
        }
    };

    const handlePublish = async () => {
        if (!draft?._id) return;
        if (!readyToPublish) {
            showNotice(
                'Not ready to publish',
                `Complete and save: ${missingPublishItems.join(', ')}. Both teachers must finish their tech sections.`
            );
            return;
        }
        try {
            setPublishing(true);
            const saved = await handleSaveProgress({ silent: true });
            if (!saved) return;
            await loadDraft(draft._id, catalog);
            const res = await teacherService.publishCollaborativeDraft(draft._id);
            if (res.success) {
                await appSuccess('Collaborative assignment published.');
                navigate('/teacher/assignments');
            }
        } catch (err) {
            showNotice('Publish failed', err.response?.data?.message || 'Could not publish collaborative assignment.');
        } finally {
            setPublishing(false);
        }
    };

    const renderTechSection = (sectionKey, label, value, onChange, accentClass, editable, ownerTeacher) => (
        <div className={`rounded-lg border p-3 space-y-2 ${accentClass}`}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wider">{label}</p>
                <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isSectionComplete(value) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                    }`}
                >
                    {isSectionComplete(value) ? <Check className="h-3 w-3" /> : null}
                    {isSectionComplete(value) ? 'Complete' : 'Pending'}
                </span>
            </div>
            <p className="text-[10px] text-slate-500">
                {editable ? 'Your section — upload your requirements file below.' : `Filled by ${teacherLabel(ownerTeacher)}.`}
                {!editable && <Lock className="inline h-3 w-3 ml-1 -mt-0.5" />}
            </p>

            <div>
                <label className={Z_LABEL}>Requirements file *</label>
                {value.originalFileName ? (
                    <p className="text-[11px] font-semibold text-slate-700 mb-1">{value.originalFileName}</p>
                ) : null}
                <input
                    type="file"
                    disabled={!editable || Boolean(uploadingSection)}
                    ref={sectionKey === 'frontend' ? frontendFileRef : backendFileRef}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSectionFile(sectionKey, file);
                    }}
                    className={`${Z_INPUT} ${!editable ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
            </div>

            <div>
                <label className={Z_LABEL}>Requirements text</label>
                <textarea
                    value={value.requirementText}
                    onChange={(e) => onChange({ ...value, requirementText: e.target.value })}
                    rows={3}
                    disabled={!editable}
                    placeholder="Example: React SPA with routing, forms, and API integration."
                    className={`${Z_TEXTAREA} ${!editable ? 'opacity-70 cursor-not-allowed' : ''}`}
                />
            </div>
            <div>
                <label className={Z_LABEL}>Short description (optional)</label>
                <input
                    type="text"
                    value={value.description}
                    onChange={(e) => onChange({ ...value, description: e.target.value })}
                    disabled={!editable}
                    className={`${Z_INPUT} ${!editable ? 'opacity-70 cursor-not-allowed' : ''}`}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className={Z_LABEL}>Required keywords (optional)</label>
                    <input
                        type="text"
                        value={value.requiredKeywordsText}
                        onChange={(e) => onChange({ ...value, requiredKeywordsText: e.target.value })}
                        disabled={!editable}
                        placeholder="dashboard, auth, routing"
                        className={`${Z_INPUT} ${!editable ? 'opacity-70 cursor-not-allowed' : ''}`}
                    />
                </div>
                <div>
                    <label className={Z_LABEL}>Allowed technologies (optional)</label>
                    <input
                        type="text"
                        value={value.allowedTechnologiesText}
                        onChange={(e) => onChange({ ...value, allowedTechnologiesText: e.target.value })}
                        disabled={!editable}
                        placeholder="react, vite, typescript"
                        className={`${Z_INPUT} ${!editable ? 'opacity-70 cursor-not-allowed' : ''}`}
                    />
                </div>
            </div>
        </div>
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
            <button type="button" onClick={() => navigate('/teacher/assignments')} className={`mb-3 ${Z_BTN_BACK}`}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Assignments
            </button>

            <div className={Z_FORM_CARD}>
                <div className="flex items-start gap-2.5 mb-4">
                    <div className="rounded-lg bg-indigo-500/10 p-2">
                        <Users className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-900 dark:text-slate-100">Collaborative Assignment</h1>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Frontend and backend teachers each fill their own requirements. Either teacher can complete shared fields and publish once both sections are done.
                        </p>
                    </div>
                </div>

                <TeacherCollaborationPanel
                    onAcceptedChange={() => {
                        reloadCollaborators();
                        reloadDrafts();
                    }}
                    draftActive={Boolean(draft)}
                />

                {catalog.length === 0 ? (
                    <p className="text-slate-500 text-sm mt-4">No class/subject assignments found. Ask admin to assign classes first.</p>
                ) : collaborators.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/30 p-3 text-[11px] text-slate-600 dark:text-slate-400">
                        Once a colleague <strong>accepts</strong> your request above, you can start a collaborative assignment draft.
                    </div>
                ) : (
                    <>
                        {drafts.length > 0 && !draft && (
                            <div className="mt-4 rounded-lg border border-slate-200 p-3 space-y-2 dark:border-white/10">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Continue a draft</p>
                                {drafts.map((row) => {
                                    const partner =
                                        String(row.initiatedBy?._id || row.initiatedBy) === currentUserId
                                            ? row.coTeacherId
                                            : row.initiatedBy;
                                    return (
                                        <div
                                            key={row._id}
                                            className="flex items-stretch gap-2 rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSearchParams({ draft: row._id });
                                                    loadDraft(row._id, catalog);
                                                }}
                                                className="flex-1 text-left px-3 py-2 text-[11px] hover:bg-slate-50 dark:hover:bg-slate-900/40"
                                            >
                                                <span className="font-bold text-slate-800 dark:text-slate-100">
                                                    {row.title?.trim() || 'Untitled draft'}
                                                </span>
                                                <span className="text-slate-500"> · with {teacherLabel(partner)}</span>
                                                <span className="block text-[10px] text-slate-500 mt-0.5">
                                                    Frontend {row.frontendSectionComplete ? 'done' : 'pending'} · Backend{' '}
                                                    {row.backendSectionComplete ? 'done' : 'pending'}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                disabled={deleting}
                                                onClick={() => handleDeleteDraft(row._id)}
                                                className="shrink-0 px-2.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-l border-slate-200 dark:border-white/10"
                                                title="Delete draft (either teacher)"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {!draft ? (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 space-y-3">
                        <div>
                            <label className={Z_LABEL}>Co-teacher *</label>
                            <select value={coTeacherId} onChange={(e) => setCoTeacherId(e.target.value)} className={Z_INPUT}>
                                {collaborators.map((c) => (
                                    <option key={String(c.teacherId)} value={String(c.teacherId)}>
                                        {c.name || c.email} {c.email ? `(${c.email})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={Z_LABEL}>Your role on this assignment *</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <label
                                    className={`rounded-lg border px-3 py-2 text-[11px] font-semibold cursor-pointer ${
                                        myRole === 'frontend' ? 'border-sky-400 bg-sky-50 text-sky-900' : 'border-slate-200'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="myRole"
                                        value="frontend"
                                        checked={myRole === 'frontend'}
                                        onChange={() => setMyRole('frontend')}
                                        className="mr-2"
                                    />
                                    I handle Frontend requirements
                                </label>
                                <label
                                    className={`rounded-lg border px-3 py-2 text-[11px] font-semibold cursor-pointer ${
                                        myRole === 'backend' ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-slate-200'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="myRole"
                                        value="backend"
                                        checked={myRole === 'backend'}
                                        onChange={() => setMyRole('backend')}
                                        className="mr-2"
                                    />
                                    I handle Backend requirements
                                </label>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">
                                Your partner will fill the other tech section. Shared details can be completed by either of you.
                            </p>
                        </div>
                        <button type="button" onClick={handleStartDraft} disabled={startingDraft} className={Z_BTN_INDIGO}>
                            {startingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                            Start collaborative draft
                        </button>
                    </div>
                        ) : (
                    <div className="space-y-3 mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
                        <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 text-[11px] text-slate-700 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-slate-300">
                            <p className="font-bold text-slate-900 dark:text-slate-100 mb-1">Partnership</p>
                            <p>
                                Frontend: <strong>{teacherLabel(frontendTeacher)}</strong>
                                {myDraftRole === 'frontend' ? ' (you)' : ''} — {frontendDone ? 'complete' : 'pending'}
                            </p>
                            <p>
                                Backend: <strong>{teacherLabel(backendTeacher)}</strong>
                                {myDraftRole === 'backend' ? ' (you)' : ''} — {backendDone ? 'complete' : 'pending'}
                            </p>
                        </div>

                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Shared details (either teacher)</p>

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
                            <select value={activeSubjectId} onChange={(e) => setSubjectId(e.target.value)} required className={Z_INPUT}>
                                {(catalog[catalogIndex]?.subjects || []).map((s) => (
                                    <option key={s._id} value={s._id}>
                                        {s.code} - {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={Z_LABEL}>Classes for this project *</label>
                            <div className="rounded-lg border border-slate-200 dark:border-white/10 p-2.5 space-y-1.5 bg-white dark:bg-[#0B1120]">
                                {compatibleClassOptions.map((row) => {
                                    const classId = String(row.class?._id || '');
                                    return (
                                        <label key={classId} className="flex items-center gap-2 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                                            <input
                                                type="checkbox"
                                                checked={activeClassIds.includes(classId)}
                                                onChange={() => handleToggleClass(classId)}
                                            />
                                            <span>
                                                {row.class?.code || row.class?.name} - {row.class?.name || 'Class'}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className={Z_LABEL}>Title *</label>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={Z_INPUT} />
                        </div>

                        <div>
                            <label className={Z_LABEL}>Description (optional)</label>
                            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={Z_TEXTAREA} />
                        </div>

                        {renderTechSection(
                            'frontend',
                            'Frontend tech requirements',
                            frontend,
                            setFrontend,
                            'border-sky-200 dark:border-sky-900/40 bg-sky-50/40 dark:bg-sky-950/20',
                            myDraftRole === 'frontend',
                            frontendTeacher
                        )}
                        {renderTechSection(
                            'backend',
                            'Backend tech requirements',
                            backend,
                            setBackend,
                            'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20',
                            myDraftRole === 'backend',
                            backendTeacher
                        )}

                        <div>
                            <label className={Z_LABEL}>Submission mode (optional)</label>
                            <select value={submissionMode} onChange={(e) => setSubmissionMode(e.target.value)} className={Z_INPUT}>
                                <option value="single">Single student</option>
                                <option value="group">Group (leader submits)</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className={Z_LABEL}>Proposal deadline (optional)</label>
                                <input
                                    type="datetime-local"
                                    value={proposalDeadline}
                                    onChange={(e) => setProposalDeadline(e.target.value)}
                                    className={Z_INPUT}
                                />
                            </div>
                            <div>
                                <label className={Z_LABEL}>Project deadline (optional)</label>
                                <input
                                    type="datetime-local"
                                    value={projectDeadline}
                                    onChange={(e) => setProjectDeadline(e.target.value)}
                                    className={Z_INPUT}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => handleSaveProgress()}
                                disabled={saving || publishing || deleting}
                                className={Z_BTN_INDIGO}
                            >
                                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                Save progress
                            </button>
                            <button
                                type="button"
                                onClick={handlePublish}
                                disabled={publishing || saving || deleting || !readyToPublish}
                                className={`${Z_BTN_INDIGO} bg-[#2a3fa4] hover:bg-[#223688] disabled:opacity-50`}
                                title={
                                    readyToPublish
                                        ? 'Saves latest changes, then publishes'
                                        : `Complete first: ${missingPublishItems.join(', ')}`
                                }
                            >
                                {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                Publish assignment
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDeleteDraft()}
                                disabled={deleting || saving || publishing}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:bg-transparent dark:text-rose-300 dark:hover:bg-rose-950/30"
                                title="Either teacher can delete this draft"
                            >
                                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                Delete draft
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-500">
                            Save progress anytime so your partner can continue. Publish saves automatically first, then creates the assignment when both sections are complete.
                        </p>
                        {!readyToPublish && (
                            <p className="text-[10px] text-amber-700 dark:text-amber-300">
                                Missing before publish: {missingPublishItems.join(', ') || 'waiting for saved draft refresh'}.
                                {drafts.length > 1 ? ' Reopen this page to continue the most recently updated collaborative draft.' : ''}
                            </p>
                        )}
                    </div>
                        )}
                    </>
                )}
            </div>

            {notice && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="collab-notice-title"
                >
                    <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#0B1120]">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                                <AlertCircle className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 id="collab-notice-title" className="text-sm font-black text-slate-900 dark:text-slate-100">
                                    {notice.title}
                                </h2>
                                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{notice.message}</p>
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end">
                            <button type="button" onClick={() => setNotice(null)} className={`${Z_BTN_INDIGO} w-auto px-5`}>
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CollaborativeAssignmentCreate;
