import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft, Download, Calendar, Users,
    CheckCircle2, Clock, FileText, Loader2, ClipboardCheck, MessageSquare, AlertTriangle, XCircle, BarChart2
} from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { getApiOrigin } from '../../../lib/api';

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
        requirements_rejected: 'Requirements rejected'
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
    const [openProposalId, setOpenProposalId] = useState(null);
    const [reviewBusyKey, setReviewBusyKey] = useState(null);
    const [commentByProposal, setCommentByProposal] = useState({});
    const [evalScoreByProposal, setEvalScoreByProposal] = useState({});
    const [vsAiByProposal, setVsAiByProposal] = useState({});
    const [catalog, setCatalog] = useState([]);
    const [savingAssignment, setSavingAssignment] = useState(false);
    const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        assignmentType: 'normal',
        classAssignmentMode: 'single',
        requirementText: '',
        requiredKeywordsText: '',
        allowedTechnologiesText: '',
        proposalDeadline: '',
        projectDeadline: '',
        selectedClassIds: []
    });

    useEffect(() => {
        const fetch = async () => {
            try {
                const [res, pRes, cRes] = await Promise.all([
                    teacherService.getAssignmentById(id),
                    teacherService.getProposalsForAssignment(id),
                    teacherService.getCatalog()
                ]);
                if (res.success) {
                    setData(res.data);
                    setEditForm({
                        title: res.data?.title || '',
                        description: res.data?.description || '',
                        assignmentType: res.data?.assignmentType || 'normal',
                        classAssignmentMode: res.data?.classAssignmentMode || ((res.data?.classes || []).length > 1 ? 'multiple' : 'single'),
                        requirementText: res.data?.requirementText || '',
                        requiredKeywordsText: Array.isArray(res.data?.requiredKeywords) ? res.data.requiredKeywords.join(', ') : '',
                        allowedTechnologiesText: Array.isArray(res.data?.allowedTechnologies) ? res.data.allowedTechnologies.join(', ') : '',
                        proposalDeadline: res.data?.proposalDeadline ? new Date(res.data.proposalDeadline).toISOString().slice(0, 16) : '',
                        projectDeadline: res.data?.projectDeadline ? new Date(res.data.projectDeadline).toISOString().slice(0, 16) : '',
                        selectedClassIds: Array.isArray(res.data?.classes) && res.data.classes.length
                            ? res.data.classes.map((c) => String(c._id || c))
                            : res.data?.class?._id
                                ? [String(res.data.class._id)]
                                : []
                    });
                }
                if (pRes.success) {
                    const rows = pRes.data || [];
                    setProposals(rows);
                    setOpenProposalId(rows[0]?._id || null);
                }
                if (cRes.success) setCatalog(cRes.data || []);
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
        if (!openProposalId) return;
        const p = proposals.find((x) => x._id === openProposalId);
        if (!p) return;
        setEvalScoreByProposal((prev) => ({
            ...prev,
            [p._id]:
                p.teacherProposalScore != null && p.teacherProposalScore !== undefined
                    ? String(p.teacherProposalScore)
                    : '',
        }));
        setVsAiByProposal((prev) => ({
            ...prev,
            [p._id]:
                p.teacherVsAi && ['aligns', 'stricter', 'lenient', 'not_set'].includes(p.teacherVsAi)
                    ? p.teacherVsAi
                    : 'not_set',
        }));
    }, [openProposalId, proposals]);

    const buildReviewPayload = (proposalId) => {
        const n = String(evalScoreByProposal[proposalId] || '').trim();
        const num = n === '' ? undefined : Number(n);
        return {
            comment: (commentByProposal[proposalId] || '').trim(),
            teacherProposalScore:
                num !== undefined && !Number.isNaN(num) && num >= 0 && num <= 100 ? num : undefined,
            vsAi: vsAiByProposal[proposalId] || 'not_set',
        };
    };

    const formatDate = (d) =>
        d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

    const formatDateTime = (d) =>
        d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    const isPast = (d) => d && new Date(d) < new Date();
    const students = Array.isArray(data?.students) ? data.students : [];
    const submitted = students.filter(s => s.submitted);
    const pending = students.filter(s => !s.submitted);
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

    const compatibleClassOptions = useMemo(() => {
        if (!data?.subject?._id) return [];
        const semesterId = String(data?.semester?._id || data?.semester || '');
        const academicYearId = String(data?.academicYear?._id || data?.academicYear || '');
        return (catalog || []).filter((row) => {
            const hasSubject = (row?.subjects || []).some((s) => String(s._id) === String(data.subject._id));
            const sameSemester = String(row?.semester?._id || row?.semester || '') === semesterId;
            const sameAcademicYear = String(row?.academicYear?._id || row?.academicYear || '') === academicYearId;
            return hasSubject && sameSemester && sameAcademicYear;
        });
    }, [catalog, data]);

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

    const handleUploadRequirementFile = async (file) => {
        if (!file) return;
        try {
            setUploadingRequirement(true);
            const res = await teacherService.uploadAssignmentRequirements(id, file);
            if (res.success) {
                setData(res.data);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to upload requirements file.');
        } finally {
            setUploadingRequirement(false);
        }
    };

    const handleToggleClass = (classId) => {
        if (editForm.classAssignmentMode === 'single') {
            setEditForm((prev) => ({ ...prev, selectedClassIds: [String(classId)] }));
            return;
        }
        setEditForm((prev) => ({
            ...prev,
            selectedClassIds: prev.selectedClassIds.includes(String(classId))
                ? prev.selectedClassIds.filter((id) => id !== String(classId))
                : [...prev.selectedClassIds, String(classId)]
        }));
    };

    const handleSaveAssignment = async () => {
        if (!editForm.title.trim()) return alert('Title is required.');
        if (editForm.selectedClassIds.length === 0) return alert('Select at least one class.');
        try {
            setSavingAssignment(true);
            const res = await teacherService.updateAssignment(id, {
                title: editForm.title.trim(),
                description: editForm.description.trim(),
                assignmentType: editForm.assignmentType,
                classAssignmentMode: editForm.classAssignmentMode,
                requirementText: editForm.requirementText.trim(),
                requiredKeywordsText: editForm.requiredKeywordsText.trim(),
                allowedTechnologiesText: editForm.allowedTechnologiesText.trim(),
                proposalDeadline: editForm.proposalDeadline || null,
                projectDeadline: editForm.projectDeadline || null,
                classIds: editForm.selectedClassIds
            });
            if (res.success) setData(res.data);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update assignment.');
        } finally {
            setSavingAssignment(false);
        }
    };

    const runReview = async (proposalId, action) => {
        const busyKey = `${proposalId}:${action}`;
        setReviewBusyKey(busyKey);
        try {
            const payload = { action, ...buildReviewPayload(proposalId) };
            const r = await teacherService.reviewProposal(proposalId, payload);
            if (r.success) {
                setCommentByProposal((prev) => ({ ...prev, [proposalId]: '' }));
                const refreshed = await teacherService.getProposalsForAssignment(id);
                if (refreshed.success) setProposals(refreshed.data || []);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Review action failed');
        } finally {
            setReviewBusyKey(null);
        }
    };

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
                            {data.subject?.name} · {classLabel}
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
                <div className="mt-4 flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
                        {uploadingRequirement ? 'Uploading...' : (data.assignmentFile ? 'Replace requirements file' : 'Upload requirements file')}
                        <input
                            type="file"
                            className="hidden"
                            onChange={(e) => handleUploadRequirementFile(e.target.files?.[0])}
                        />
                    </label>
                    {data.originalFileName ? (
                        <span className="text-xs font-bold text-slate-500">Current file: {data.originalFileName}</span>
                    ) : (
                        <span className="text-xs font-bold text-slate-400">No requirements file uploaded yet.</span>
                    )}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 dark:border-white/10 p-4 md:p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Edit assignment details</h2>
                        <button
                            type="button"
                            onClick={handleSaveAssignment}
                            disabled={savingAssignment}
                            className="px-4 py-2 rounded-xl bg-[#1D68E3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
                        >
                            {savingAssignment ? 'Saving...' : 'Save assignment'}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Title</label>
                            <input
                                type="text"
                                value={editForm.title}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-3 text-sm font-bold"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Description</label>
                            <textarea
                                rows={3}
                                value={editForm.description}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-3 text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Assignment type</label>
                            <select
                                value={editForm.assignmentType}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, assignmentType: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-3 text-sm font-bold"
                            >
                                <option value="normal">Normal assignment</option>
                                <option value="final">Final assignment</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Class assignment mode</label>
                            <select
                                value={editForm.classAssignmentMode}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setEditForm((prev) => ({
                                        ...prev,
                                        classAssignmentMode: next,
                                        selectedClassIds: next === 'single' ? prev.selectedClassIds.slice(0, 1) : prev.selectedClassIds
                                    }));
                                }}
                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-3 text-sm font-bold"
                            >
                                <option value="single">Single class</option>
                                <option value="multiple">Multiple classes</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Classes for this project</label>
                            <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-2 bg-white dark:bg-[#0B1120]">
                                {compatibleClassOptions.map((row) => {
                                    const classId = String(row.class?._id || '');
                                    return (
                                        <label key={classId} className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                                            <input
                                                type="checkbox"
                                                checked={editForm.selectedClassIds.includes(classId)}
                                                onChange={() => handleToggleClass(classId)}
                                            />
                                            <span>{row.class?.code || row.class?.name} - {row.class?.name || 'Class'}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Teacher requirements</label>
                            <textarea
                                rows={3}
                                value={editForm.requirementText}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, requirementText: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-3 text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Required keywords</label>
                            <input
                                type="text"
                                value={editForm.requiredKeywordsText}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, requiredKeywordsText: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-3 text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Allowed technologies</label>
                            <input
                                type="text"
                                value={editForm.allowedTechnologiesText}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, allowedTechnologiesText: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-3 text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Proposal deadline</label>
                            <input
                                type="datetime-local"
                                value={editForm.proposalDeadline}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, proposalDeadline: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-3 text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Project deadline</label>
                            <input
                                type="datetime-local"
                                value={editForm.projectDeadline}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, projectDeadline: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-3 text-sm font-bold"
                            />
                        </div>
                    </div>
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

            {/* Actual proposal review in this page */}
            <div className="mt-6 bg-white dark:bg-[#0F172A] rounded-[28px] border border-slate-100 dark:border-white/5 p-6 md:p-7 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                    <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Proposal review in this page</h2>
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        {proposals.length} proposals
                    </span>
                </div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4">
                    Term: {data?.academicYear?.label || '—'} · {data?.semester?.name || 'Semester'} — same AI + teacher
                    review fields as the full proposal review page.
                </p>
                {loadingProposals ? (
                    <div className="py-8 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-[#1D68E3] animate-spin" />
                    </div>
                ) : proposals.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-500">No proposals submitted yet for this assignment.</p>
                ) : (
                    <div className="space-y-4">
                        {proposals.map((p) => {
                            const open = openProposalId === p._id;
                            return (
                                <div key={p._id} className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 md:p-5">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-black text-slate-900 dark:text-slate-100">{proposalStudentLabel(p)}</p>
                                            <p className="text-xs font-bold text-slate-500">{proposalStatusLabel(p.status)}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setOpenProposalId((prev) => (prev === p._id ? null : p._id))}
                                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                                        >
                                            {open ? 'Hide review' : 'Open review'}
                                        </button>
                                    </div>

                                    {open && (
                                        <div className="mt-4">
                                            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 mb-1">{p.title || 'Untitled proposal'}</h3>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap mb-3">{p.description || 'No description'}</p>
                                            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 mb-3">
                                                {(p.features || []).map((f, idx) => <li key={idx}>{f}</li>)}
                                            </ul>

                                            {p.teacherComment && (
                                                <div className="mb-3 text-xs font-semibold text-amber-700 dark:text-amber-300 inline-flex items-start gap-2">
                                                    <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                                                    {p.teacherComment}
                                                </div>
                                            )}

                                            <div className="mb-4 rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/25 p-3">
                                                <div className="flex items-center gap-2 text-violet-900 dark:text-violet-200 text-[10px] font-black uppercase tracking-widest mb-1.5">
                                                    <BarChart2 className="h-3.5 w-3.5" />
                                                    AI similarity (advisory)
                                                </div>
                                                {p.aiSummary && (
                                                    <p className="text-[11px] font-mono text-violet-800/90 dark:text-violet-200/80 mb-2 break-words">
                                                        {p.aiSummary}
                                                    </p>
                                                )}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                    <div className="rounded-lg bg-white/80 dark:bg-slate-900/60 border border-violet-100 dark:border-violet-900/40 px-2.5 py-1.5">
                                                        <p className="text-[9px] font-bold text-slate-500 uppercase">Same semester (max)</p>
                                                        <p className="font-black text-slate-900 dark:text-white">
                                                            {Number.isFinite(p.aiSameSemesterMaxScore)
                                                                ? `${Math.round(Number(p.aiSameSemesterMaxScore) * 100)}%`
                                                                : '—'}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-lg bg-white/80 dark:bg-slate-900/60 border border-violet-100 dark:border-violet-900/40 px-2.5 py-1.5">
                                                        <p className="text-[9px] font-bold text-slate-500 uppercase">Legacy / other term (max)</p>
                                                        <p className="font-black text-slate-900 dark:text-white">
                                                            {Number.isFinite(p.aiPreviousSemesterMaxScore)
                                                                ? `${Math.round(Number(p.aiPreviousSemesterMaxScore) * 100)}%`
                                                                : '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                                        Your score (0–100, optional)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={evalScoreByProposal[p._id] ?? ''}
                                                        onChange={(e) =>
                                                            setEvalScoreByProposal((prev) => ({ ...prev, [p._id]: e.target.value }))
                                                        }
                                                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-3 py-2 text-sm"
                                                        placeholder="e.g. 78"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                                        Compared to AI
                                                    </label>
                                                    <select
                                                        value={vsAiByProposal[p._id] ?? 'not_set'}
                                                        onChange={(e) =>
                                                            setVsAiByProposal((prev) => ({ ...prev, [p._id]: e.target.value }))
                                                        }
                                                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-3 py-2 text-sm"
                                                    >
                                                        <option value="not_set">Not specified</option>
                                                        <option value="aligns">I agree with the AI risk picture</option>
                                                        <option value="stricter">I am stricter than the AI hint</option>
                                                        <option value="lenient">The AI is too harsh — I accept this work</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <>
                                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                                    Written feedback (student-visible on approve / reject / revision)
                                                </label>
                                                <textarea
                                                    value={commentByProposal[p._id] || ''}
                                                    onChange={(e) => setCommentByProposal((prev) => ({ ...prev, [p._id]: e.target.value }))}
                                                    rows={2}
                                                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-3 py-2.5 text-sm mb-2"
                                                    placeholder="Optional comment for this student..."
                                                />
                                                <button
                                                    type="button"
                                                    disabled={!!reviewBusyKey || !(commentByProposal[p._id] || '').trim()}
                                                    onClick={() => runReview(p._id, 'comment')}
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-xs font-bold disabled:opacity-50 mb-3"
                                                >
                                                    <MessageSquare className="h-4 w-4" /> Send feedback only
                                                </button>
                                            </>
                                            {(p.status === 'pending_teacher_approval' || p.status === 'revision_required') && (
                                                <>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={!!reviewBusyKey}
                                                            onClick={() => runReview(p._id, 'approve')}
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                                                        >
                                                            <CheckCircle2 className="h-4 w-4" /> Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={!!reviewBusyKey}
                                                            onClick={() => runReview(p._id, 'revision')}
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold disabled:opacity-50"
                                                        >
                                                            <AlertTriangle className="h-4 w-4" /> Revision
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={!!reviewBusyKey}
                                                            onClick={() => runReview(p._id, 'reject')}
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-50"
                                                        >
                                                            <XCircle className="h-4 w-4" /> Reject
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssignmentDetail;
