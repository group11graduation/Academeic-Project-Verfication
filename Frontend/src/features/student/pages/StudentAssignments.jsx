import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import studentService from '../../../services/studentService';
import { getApiOrigin } from '../../../lib/api';
import {
    FileText,
    Calendar,
    CheckCircle2,
    AlertCircle,
    Download,
    User,
    Users,
    Loader2,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Rocket,
    Search,
} from 'lucide-react';
import { Z_SHELL, Z_SHELL_INNER, Z_CARD, Z_INPUT, Z_LINK } from '../../../shared/ui/zendentaLayout';
import { usePageSearch } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';
import {
    getProjectTeacherFeedbackEntries,
    getProjectWorkflowStatus,
    getWorkflowBadgeClasses,
    formatTeacherScoreDisplay,
} from '../../../shared/utils/projectWorkflowStatus';

const isFinalProjectAssignment = (row) => {
    const a = row?.assignment || {};
    if (String(a.assignmentType || '').toLowerCase() === 'final') return true;
    if (String(a.assignmentType || '').toLowerCase() === 'normal') return false;
    const text = `${a.title || ''} ${a.description || ''}`.toLowerCase();
    return Boolean(
        a.projectPhaseOpen ||
            text.includes('final project') ||
            text.includes('capstone') ||
            text.includes('graduation project')
    );
};

const isCollaborativeRow = (row) => {
    const a = row?.assignment || {};
    return Boolean(
        a.isCollaborative ||
            a.coTeacherId ||
            (a.frontendTeacherId && a.backendTeacherId) ||
            (Array.isArray(a.collabSubjects) && a.collabSubjects.length > 1)
    );
};

const getCollabKey = (assignment = {}) => {
    const fe = String(assignment.frontendSubject?._id || assignment.frontendSubject || '');
    const be = String(assignment.backendSubject?._id || assignment.backendSubject || '');
    if (fe || be) return `collab:${fe}:${be}`;
    return `collab-assignment:${String(assignment._id || '')}`;
};

const StudentAssignments = () => {
    const [rows, setRows] = useState([]);
    const [studentInfo, setStudentInfo] = useState(null);
    const [enrolledSubjects, setEnrolledSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [moduleTab, setModuleTab] = useState('subjects');
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);
    const [selectedCollabKey, setSelectedCollabKey] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const { query, setQuery } = usePageSearch('Search assignments…');

    useEffect(() => {
        const fetchAssignments = async () => {
            try {
                const response = await studentService.getAssignments();
                if (response.success) {
                    const raw = response.data;
                    const list = Array.isArray(raw) ? raw : raw?.assignments || [];
                    setRows(list);
                    setStudentInfo(raw?.class || list[0]?.assignment?.class || null);
                    setEnrolledSubjects(Array.isArray(raw?.subjects) ? raw.subjects : []);
                }
            } catch (err) {
                console.error('Error fetching assignments:', err);
                setError('Failed to load assignments');
            } finally {
                setLoading(false);
            }
        };
        fetchAssignments();
    }, []);

    const subjectNameById = useMemo(() => {
        const map = new Map();
        for (const s of enrolledSubjects) {
            map.set(String(s._id), { name: s.name || 'Subject', code: s.code || 'N/A' });
        }
        for (const r of rows) {
            const a = r?.assignment || {};
            for (const s of [a.subject, a.frontendSubject, a.backendSubject, ...(a.collabSubjects || [])]) {
                if (!s?._id) continue;
                if (!map.has(String(s._id))) {
                    map.set(String(s._id), { name: s.name || 'Subject', code: s.code || 'N/A' });
                }
            }
        }
        return map;
    }, [enrolledSubjects, rows]);

    const regularRows = useMemo(() => rows.filter((r) => !isCollaborativeRow(r)), [rows]);
    const collaborativeRows = useMemo(() => rows.filter((r) => isCollaborativeRow(r)), [rows]);

    const subjects = useMemo(() => {
        if (enrolledSubjects.length > 0) {
            const teacherBySubject = new Map();
            for (const r of regularRows) {
                const sid = String(r?.assignment?.subject?._id || '');
                const teacherName = r?.assignment?.teacher?.name;
                if (sid && teacherName && !teacherBySubject.has(sid)) {
                    teacherBySubject.set(sid, teacherName);
                }
            }
            return enrolledSubjects.map((s) => ({
                _id: String(s._id),
                name: s.name || 'Subject',
                code: s.code || 'N/A',
                teacher: teacherBySubject.get(String(s._id)) || 'Teacher',
            }));
        }

        const map = new Map();
        for (const r of regularRows) {
            const s = r?.assignment?.subject;
            if (s?._id && !map.has(String(s._id))) {
                map.set(String(s._id), {
                    _id: String(s._id),
                    name: s.name || 'Subject',
                    code: s.code || 'N/A',
                    teacher: r?.assignment?.teacher?.name || 'Teacher',
                });
            }
        }
        return Array.from(map.values());
    }, [regularRows, enrolledSubjects]);

    const collabModules = useMemo(() => {
        const map = new Map();
        for (const r of collaborativeRows) {
            const a = r.assignment || {};
            const key = getCollabKey(a);
            if (!map.has(key)) {
                const fe = a.frontendSubject;
                const be = a.backendSubject;
                const subjectsList = [];
                if (fe?._id || fe) {
                    const id = String(fe._id || fe);
                    subjectsList.push({
                        _id: id,
                        name: fe.name || subjectNameById.get(id)?.name || 'Frontend subject',
                        code: fe.code || subjectNameById.get(id)?.code || '',
                        side: 'frontend',
                    });
                }
                if (be?._id || be) {
                    const id = String(be._id || be);
                    subjectsList.push({
                        _id: id,
                        name: be.name || subjectNameById.get(id)?.name || 'Backend subject',
                        code: be.code || subjectNameById.get(id)?.code || '',
                        side: 'backend',
                    });
                }
                if (!subjectsList.length && a.subject?._id) {
                    subjectsList.push({
                        _id: String(a.subject._id),
                        name: a.subject.name || 'Subject',
                        code: a.subject.code || '',
                        side: '',
                    });
                }
                const teacherNames = (a.teachers || []).map((t) => t.name).filter(Boolean);
                if (!teacherNames.length && a.teacher?.name) teacherNames.push(a.teacher.name);
                if (a.coTeacherId?.name) teacherNames.push(a.coTeacherId.name);

                map.set(key, {
                    key,
                    subjects: subjectsList,
                    title: subjectsList.map((s) => s.name).join(' + ') || 'Collaborative subjects',
                    codes: subjectsList.map((s) => s.code).filter(Boolean).join(' · '),
                    teachers: [...new Set(teacherNames)],
                    rows: [],
                });
            }
            map.get(key).rows.push(r);
        }
        return Array.from(map.values());
    }, [collaborativeRows, subjectNameById]);

    const subjectsFiltered = useMemo(() => {
        if (!query.trim()) return subjects;
        return subjects.filter((s) => matchesSearchQuery(query, s.name, s.code, s.teacher));
    }, [subjects, query]);

    const collabModulesFiltered = useMemo(() => {
        if (!query.trim()) return collabModules;
        return collabModules.filter((m) =>
            matchesSearchQuery(query, m.title, m.codes, ...(m.teachers || []), ...m.subjects.map((s) => s.name))
        );
    }, [collabModules, query]);

    const selectedCollabModule = collabModules.find((m) => m.key === selectedCollabKey) || null;

    const rowsForSubject = useMemo(() => {
        if (selectedCollabKey) return selectedCollabModule?.rows || [];
        if (!selectedSubjectId) return [];
        return regularRows.filter((r) => String(r?.assignment?.subject?._id) === String(selectedSubjectId));
    }, [regularRows, selectedSubjectId, selectedCollabKey, selectedCollabModule]);

    const finalRows = useMemo(() => rowsForSubject.filter(isFinalProjectAssignment), [rowsForSubject]);
    const normalRows = useMemo(() => rowsForSubject.filter((r) => !isFinalProjectAssignment(r)), [rowsForSubject]);
    const displayedRows = selectedCategory === 'final' ? finalRows : selectedCategory === 'normal' ? normalRows : [];
    const selectedSubject = subjects.find((s) => String(s._id) === String(selectedSubjectId));
    const moduleSelected = Boolean(selectedSubjectId || selectedCollabKey);

    const displayedRowsFiltered = useMemo(() => {
        if (!query.trim()) return displayedRows;
        return displayedRows.filter((r) => {
            const a = r.assignment || {};
            return matchesSearchQuery(
                query,
                a.title,
                a.teacher?.name,
                a.subject?.code,
                a.frontendSubject?.code,
                a.backendSubject?.code
            );
        });
    }, [displayedRows, query]);

    const getSubjectStats = (subjectId) => {
        const subRows = regularRows.filter((r) => String(r?.assignment?.subject?._id) === String(subjectId));
        const submitted = subRows.filter((r) => {
            if (String(r?.assignment?.assignmentType || 'normal') === 'normal') {
                return Boolean(r?.latestNormalSubmission);
            }
            return Boolean(r?.latestProjectSubmission);
        }).length;
        const finals = subRows.filter((r) => isFinalProjectAssignment(r)).length;
        return { total: subRows.length, submitted, pending: subRows.length - submitted, finals };
    };

    const getCollabStats = (module) => {
        const subRows = module.rows || [];
        const submitted = subRows.filter((r) => {
            if (String(r?.assignment?.assignmentType || 'normal') === 'normal') {
                return Boolean(r?.latestNormalSubmission);
            }
            return Boolean(r?.latestProjectSubmission);
        }).length;
        const finals = subRows.filter((r) => isFinalProjectAssignment(r)).length;
        return { total: subRows.length, submitted, pending: subRows.length - submitted, finals };
    };

    const resetModuleSelection = () => {
        setSelectedSubjectId(null);
        setSelectedCollabKey(null);
        setSelectedCategory(null);
        setQuery('');
    };

    const getDeadlineStatus = (deadline) => {
        if (!deadline) return { label: 'No deadline', color: 'text-slate-500', bg: 'bg-slate-100' };
        const now = new Date();
        const dl = new Date(deadline);
        const days = Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
        if (days < 0) return { label: 'Overdue', color: 'text-rose-700', bg: 'bg-rose-50' };
        if (days <= 3) return { label: `${days}d left`, color: 'text-amber-700', bg: 'bg-amber-50' };
        return { label: `${days}d left`, color: 'text-emerald-700', bg: 'bg-emerald-50' };
    };

    const getSubmissionDeadline = (a) => a?.projectDeadline || a?.proposalDeadline || null;
    const canOpenProjectUpload = (row) => {
        if (String(row?.assignment?.assignmentType || 'normal') === 'normal') return false;
        const proposalStatus = row?.proposal?.status;
        return Boolean(
            row?.latestProjectSubmission ||
                proposalStatus === 'teacher_approved' ||
                (row?.projectSubmissionAllowed && proposalStatus === 'teacher_approved')
        );
    };
    const isProjectSubmitted = (row) => {
        if (String(row?.assignment?.assignmentType || 'normal') === 'normal') {
            return Boolean(row?.latestNormalSubmission);
        }
        return Boolean(row?.latestProjectSubmission);
    };
    const submittedCount = displayedRowsFiltered.filter((r) => isProjectSubmitted(r)).length;
    const pendingCount = displayedRowsFiltered.length - submittedCount;
    const selectedModuleLabel = selectedCollabModule?.title || selectedSubject?.name || 'Module';
    const selectedModuleTeachers = selectedCollabModule
        ? selectedCollabModule.teachers.join(' · ')
        : selectedSubject?.teacher || '';

    if (loading) {
        return (
            <div className={`${Z_SHELL} items-center justify-center py-24`}>
                <Loader2 className="h-10 w-10 animate-spin text-[#1e56e3]" />
            </div>
        );
    }

    return (
        <div className={Z_SHELL}>
            <div className={Z_SHELL_INNER}>
                {(moduleSelected || selectedCategory) && (
                    <nav className="mb-4 flex flex-wrap items-center gap-1 text-[13px] font-semibold text-slate-500">
                        <Link to="/student/assignments" className={Z_LINK}>
                            Assignments
                        </Link>
                        {moduleSelected ? (
                            <>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <button
                                    type="button"
                                    onClick={resetModuleSelection}
                                    className={`${Z_LINK} max-w-[14rem] truncate sm:max-w-xs`}
                                >
                                    {selectedModuleLabel}
                                </button>
                            </>
                        ) : null}
                        {selectedCategory ? (
                            <>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="text-slate-800">
                                    {selectedCategory === 'final' ? 'Final projects' : 'Normal assignments'}
                                </span>
                            </>
                        ) : null}
                    </nav>
                )}

                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="mb-2 flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                {new Date().getFullYear()}
                            </span>
                            {studentInfo?.code ? (
                                <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1e56e3]">
                                    Class {studentInfo.code}
                                </span>
                            ) : null}
                        </div>
                        {!moduleSelected ? (
                            <p className="max-w-2xl text-[12px] leading-relaxed text-slate-600">
                                Browse regular subjects or collaborative subject pairs, then open their assignments.
                            </p>
                        ) : !selectedCategory ? (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={resetModuleSelection}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                                    aria-label="Back to modules"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <p className="text-[12px] font-semibold text-slate-600">
                                    {selectedModuleLabel} — choose category
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (selectedCollabKey) {
                                            resetModuleSelection();
                                            return;
                                        }
                                        setSelectedCategory(null);
                                        setQuery('');
                                    }}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                                    aria-label={selectedCollabKey ? 'Back to collab subjects' : 'Back to categories'}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <p className="text-[12px] text-slate-600">
                                    {selectedCategory === 'final'
                                        ? 'Proposal, AI checks, teacher approval, then project ZIP.'
                                        : 'Upload your work for each task.'}
                                </p>
                            </div>
                        )}
                    </div>
                    {(moduleSelected && selectedCategory) || !moduleSelected ? (
                        <div className="relative w-full md:max-w-sm">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={
                                    !moduleSelected
                                        ? moduleTab === 'collab'
                                            ? 'Search collab subjects…'
                                            : 'Search modules…'
                                        : 'Search assignments…'
                                }
                                className={`${Z_INPUT} pl-10`}
                                disabled={Boolean(moduleSelected && !selectedCategory)}
                            />
                        </div>
                    ) : null}
                </div>

                {!moduleSelected ? (
                    <div className="mb-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setModuleTab('subjects');
                                setQuery('');
                            }}
                            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
                                moduleTab === 'subjects'
                                    ? 'border-[#1e56e3] bg-[#1e56e3] text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            Subjects
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setModuleTab('collab');
                                setQuery('');
                            }}
                            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
                                moduleTab === 'collab'
                                    ? 'border-[#1e56e3] bg-[#1e56e3] text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            Collab subjects
                            {collabModules.length ? (
                                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                                    {collabModules.length}
                                </span>
                            ) : null}
                        </button>
                    </div>
                ) : null}

                {error && (
                    <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                        <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
                        <span className="text-sm font-semibold text-rose-800">{error}</span>
                    </div>
                )}

                {!moduleSelected ? (
                    moduleTab === 'subjects' ? (
                        subjects.length === 0 ? (
                            <div className={`${Z_CARD} p-8 text-center`}>
                                <BookOpen className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                                <h3 className="text-sm font-bold text-slate-500">No modules</h3>
                                <p className="mt-1.5 text-[12px] text-slate-500">You are not enrolled in any subjects yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {subjectsFiltered.map((subject) => {
                                    const stats = getSubjectStats(subject._id);
                                    return (
                                        <button
                                            type="button"
                                            key={subject._id}
                                            onClick={() => {
                                                setSelectedSubjectId(subject._id);
                                                setSelectedCollabKey(null);
                                                setSelectedCategory(null);
                                                setQuery('');
                                            }}
                                            className={`${Z_CARD} p-4 text-left transition hover:border-[#1e56e3]/30 hover:shadow-md`}
                                        >
                                            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#1e56e3]">
                                                <BookOpen className="h-4 w-4" />
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-900">{subject.name}</h3>
                                            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1e56e3]">
                                                {subject.code}
                                            </p>
                                            <div className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
                                                <User className="h-3.5 w-3.5 shrink-0" />
                                                {subject.teacher}
                                            </div>
                                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                                                <div className="flex gap-4 text-center">
                                                    <div>
                                                        <p className="text-base font-bold text-slate-900">{stats.total}</p>
                                                        <p className="text-[10px] font-bold uppercase text-slate-400">All</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-bold text-[#1e56e3]">{stats.finals}</p>
                                                        <p className="text-[10px] font-bold uppercase text-slate-400">Final</p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-slate-300" />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )
                    ) : collabModules.length === 0 ? (
                        <div className={`${Z_CARD} p-8 text-center`}>
                            <Users className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                            <h3 className="text-sm font-bold text-slate-500">No collab subjects</h3>
                            <p className="mt-1.5 text-[12px] text-slate-500">
                                Collaborative assignments that combine frontend and backend subjects will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {collabModulesFiltered.map((module) => {
                                const stats = getCollabStats(module);
                                return (
                                    <button
                                        type="button"
                                        key={module.key}
                                        onClick={() => {
                                            setSelectedCollabKey(module.key);
                                            setSelectedSubjectId(null);
                                            // Collab pairings are final-project only — skip the category step.
                                            setSelectedCategory('final');
                                            setQuery('');
                                        }}
                                        className={`${Z_CARD} p-4 text-left transition hover:border-indigo-300 hover:shadow-md`}
                                    >
                                        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                                            <Users className="h-4 w-4" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600">
                                            Collab subjects
                                        </p>
                                        <h3 className="mt-1 text-sm font-bold text-slate-900">{module.title}</h3>
                                        {module.codes ? (
                                            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1e56e3]">
                                                {module.codes}
                                            </p>
                                        ) : null}
                                        <div className="mt-2 space-y-1">
                                            {module.subjects.map((s) => (
                                                <p
                                                    key={`${module.key}-${s._id}`}
                                                    className="text-[11px] font-semibold text-slate-600"
                                                >
                                                    {s.side === 'frontend'
                                                        ? 'Frontend'
                                                        : s.side === 'backend'
                                                          ? 'Backend'
                                                          : 'Subject'}
                                                    : <span className="text-slate-900">{s.name}</span>
                                                    {s.code ? ` (${s.code})` : ''}
                                                </p>
                                            ))}
                                        </div>
                                        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
                                            <User className="h-3.5 w-3.5 shrink-0" />
                                            {module.teachers.join(' · ') || 'Teachers'}
                                        </div>
                                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                                            <div className="flex gap-4 text-center">
                                                <div>
                                                    <p className="text-base font-bold text-slate-900">{stats.total}</p>
                                                    <p className="text-[10px] font-bold uppercase text-slate-400">All</p>
                                                </div>
                                                <div>
                                                    <p className="text-base font-bold text-[#1e56e3]">{stats.finals}</p>
                                                    <p className="text-[10px] font-bold uppercase text-slate-400">Final</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-300" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )
                ) : !selectedCategory ? (
                    <div className="space-y-3">
                        {selectedCollabModule ? (
                            <div className={`${Z_CARD} border-indigo-100 bg-indigo-50/40 p-3`}>
                                <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600">
                                    Collaborative pairing
                                </p>
                                <p className="mt-1 text-[12px] font-semibold text-slate-700">
                                    {selectedCollabModule.subjects
                                        .map((s) => `${s.name}${s.code ? ` (${s.code})` : ''}`)
                                        .join(' + ')}
                                </p>
                                {selectedModuleTeachers ? (
                                    <p className="mt-1 text-[11px] text-slate-500">Teachers: {selectedModuleTeachers}</p>
                                ) : null}
                            </div>
                        ) : null}
                        <div className={`grid grid-cols-1 gap-3 ${selectedCollabModule ? '' : 'md:grid-cols-2'}`}>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedCategory('final');
                                    setQuery('');
                                }}
                                className={`${Z_CARD} p-4 text-left transition hover:border-[#1e56e3]/30 hover:shadow-md`}
                            >
                                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#1e56e3]">
                                    <Rocket className="h-4 w-4" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900">Final class-based projects</h3>
                                <p className="mt-1.5 text-[12px] text-slate-600">
                                    Proposal, AI review, teacher approval, project ZIP.
                                </p>
                                <p className="mt-3 text-[10px] font-bold uppercase text-slate-500">
                                    {finalRows.length} assignments
                                </p>
                            </button>
                            {!selectedCollabModule ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategory('normal');
                                        setQuery('');
                                    }}
                                    className={`${Z_CARD} p-4 text-left transition hover:border-[#1e56e3]/30 hover:shadow-md`}
                                >
                                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                        <FileText className="h-4 w-4" />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900">Normal assignments</h3>
                                    <p className="mt-1.5 text-[12px] text-slate-600">Regular uploads for this subject.</p>
                                    <p className="mt-3 text-[10px] font-bold uppercase text-slate-500">
                                        {normalRows.length} assignments
                                    </p>
                                </button>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 xl:flex-row">
                        <div className="min-w-0 flex-1 space-y-0">
                            {displayedRowsFiltered.length === 0 ? (
                                <div className={`${Z_CARD} p-8 text-center`}>
                                    <FileText className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                                    <p className="text-[12px] font-semibold text-slate-500">No assignments in this view.</p>
                                </div>
                            ) : (
                                <div className={`${Z_CARD} overflow-hidden`}>
                                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 md:px-4">
                                        <h2 className="text-[12px] font-bold text-slate-900">Assignment list</h2>
                                        <span className="text-[10px] font-semibold text-slate-400">
                                            {displayedRowsFiltered.length} shown
                                        </span>
                                    </div>
                                    <ul className="divide-y divide-slate-100">
                                        {displayedRowsFiltered.map((row) => {
                                            const a = row.assignment || {};
                                            const deadlineStatus = getDeadlineStatus(getSubmissionDeadline(a));
                                            const workflow = getProjectWorkflowStatus(row);
                                            const teacherFeedbackEntries = getProjectTeacherFeedbackEntries(row);
                                            const showOverdue =
                                                getSubmissionDeadline(a) &&
                                                deadlineStatus.label === 'Overdue' &&
                                                !row?.latestProjectSubmission;
                                            const teacherLabel =
                                                (a.teachers || []).map((t) => t.name).filter(Boolean).join(' · ') ||
                                                a.teacher?.name ||
                                                'Teacher';
                                            return (
                                                <li key={a._id} className="px-3 py-3 md:px-4">
                                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                        <div className="flex min-w-0 flex-1 gap-3">
                                                            <div
                                                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                                                    isProjectSubmitted(row)
                                                                        ? 'bg-emerald-50 text-emerald-600'
                                                                        : 'bg-blue-50 text-[#1e56e3]'
                                                                }`}
                                                            >
                                                                {isProjectSubmitted(row) ? (
                                                                    <CheckCircle2 className="h-4 w-4" />
                                                                ) : (
                                                                    <FileText className="h-4 w-4" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <h3 className="text-[13px] font-bold text-slate-900">
                                                                    {a.title || 'Assignment'}
                                                                </h3>
                                                                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                                                                    <span className="flex items-center gap-1">
                                                                        <User className="h-3.5 w-3.5" />
                                                                        {teacherLabel}
                                                                    </span>
                                                                    <span className="flex items-center gap-1">
                                                                        <Calendar className="h-3.5 w-3.5" />
                                                                        {a.createdAt
                                                                            ? new Date(a.createdAt).toLocaleDateString()
                                                                            : '—'}
                                                                    </span>
                                                                </div>
                                                                {isCollaborativeRow(row) ? (
                                                                    <p className="mt-1 text-[10px] font-semibold text-indigo-600">
                                                                        {[a.frontendSubject, a.backendSubject]
                                                                            .filter(Boolean)
                                                                            .map((s) => s.code || s.name)
                                                                            .join(' · ') || 'Collaborative assignment'}
                                                                    </p>
                                                                ) : null}
                                                                <div className="mt-2 flex flex-wrap gap-2">
                                                                    <span
                                                                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getWorkflowBadgeClasses(workflow.tone)}`}
                                                                    >
                                                                        {workflow.label}
                                                                    </span>
                                                                    {showOverdue ? (
                                                                        <span
                                                                            className={`rounded-full border border-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${deadlineStatus.bg} ${deadlineStatus.color}`}
                                                                        >
                                                                            {deadlineStatus.label}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                {teacherFeedbackEntries.length ? (
                                                                    <div className="mt-2 space-y-2">
                                                                        {teacherFeedbackEntries.map((entry) => (
                                                                            <div
                                                                                key={entry.role}
                                                                                className="rounded-lg border border-violet-100 bg-violet-50/80 px-3 py-2 text-xs text-violet-900"
                                                                            >
                                                                                {teacherFeedbackEntries.length > 1 ? (
                                                                                    <p className="mb-1 font-bold uppercase tracking-wide text-violet-700">
                                                                                        {entry.roleLabel}
                                                                                    </p>
                                                                                ) : null}
                                                                                {entry.scoreDisplay || entry.score != null ? (
                                                                                    <p className="mb-1 font-bold">
                                                                                        Score:{' '}
                                                                                        {entry.scoreDisplay ||
                                                                                            formatTeacherScoreDisplay(
                                                                                                entry.score,
                                                                                                entry.scoreMax
                                                                                            )}
                                                                                    </p>
                                                                                ) : null}
                                                                                {entry.comment ? (
                                                                                    <p className="line-clamp-3 whitespace-pre-wrap">
                                                                                        {entry.comment}
                                                                                    </p>
                                                                                ) : null}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 lg:shrink-0">
                                                            <Link
                                                                to={`/student/assignments/${a._id}`}
                                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                                                            >
                                                                Details
                                                            </Link>
                                                            {a.assignmentFile ? (
                                                                <a
                                                                    href={`${getApiOrigin()}${a.assignmentFile}`}
                                                                    download
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
                                                                >
                                                                    <Download className="h-3.5 w-3.5" />
                                                                    File
                                                                </a>
                                                            ) : null}
                                                            {String(a.assignmentType || 'normal') === 'normal' ? (
                                                                <Link
                                                                    to={`/student/assignments/${a._id}`}
                                                                    className="rounded-xl bg-[#1e56e3] px-3 py-2 text-center text-xs font-bold text-white shadow-sm transition hover:bg-[#1a4dcc]"
                                                                >
                                                                    Submit
                                                                </Link>
                                                            ) : canOpenProjectUpload(row) ? (
                                                                <Link
                                                                    to={`/student/project/${a._id}`}
                                                                    className="rounded-xl bg-emerald-600 px-3 py-2 text-center text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                                                                >
                                                                    {row?.latestProjectSubmission
                                                                        ? 'View project'
                                                                        : 'Project'}
                                                                </Link>
                                                            ) : (
                                                                <Link
                                                                    to={`/student/assignments/${a._id}/proposal`}
                                                                    className="rounded-xl bg-[#1e56e3] px-3 py-2 text-center text-xs font-bold text-white shadow-sm transition hover:bg-[#1a4dcc]"
                                                                >
                                                                    Proposal
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="w-full shrink-0 space-y-3 xl:w-[260px]">
                            <div className={`${Z_CARD} p-4`}>
                                <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                    Overview
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-medium text-slate-600">Total</span>
                                        <span className="text-base font-bold text-slate-900">
                                            {displayedRowsFiltered.length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-medium text-slate-600">Submitted</span>
                                        <span className="text-base font-bold text-emerald-600">{submittedCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-medium text-slate-600">Pending</span>
                                        <span className="text-base font-bold text-amber-600">{pendingCount}</span>
                                    </div>
                                </div>
                            </div>
                            {selectedCategory === 'final' ? (
                                <div className={`${Z_CARD} border-slate-800 bg-slate-900 p-4 text-slate-100`}>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-blue-300">
                                        AI verification
                                    </p>
                                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
                                        Proposals are checked for duplication. After teacher approval you can upload your
                                        project ZIP.
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentAssignments;
