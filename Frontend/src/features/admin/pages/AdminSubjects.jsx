import React, { useState, useEffect, useMemo, useRef } from 'react';
import { appConfirm, appError, appWarning } from '../../../lib/appDialog';
import {
    Search,
    Plus,
    BookOpen,
    Monitor,
    Users,
    Edit2,
    Trash2,
    X,
    Loader2,
    MoreVertical,
    ArrowRight,
} from 'lucide-react';
import adminSubjectService from '../../../services/adminSubjectService';
import adminTeacherService from '../../../services/adminTeacherService';
import { adminAcademicService } from '../../../services/adminAcademicService';
import { usePageSearch } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';
import {
    getSubjectDepartments,
    getSubjectFaculties,
} from '../../../shared/utils/subjectTaxonomy';

const CARD_THEMES = [
    { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700' },
    { iconBg: 'bg-violet-50', iconText: 'text-violet-600', badge: 'bg-violet-50 text-violet-700' },
    { iconBg: 'bg-[var(--bg-elevated)]', iconText: 'text-[var(--brand-primary)]', badge: 'bg-[var(--bg-elevated)] text-[var(--brand-primary)]' },
    { iconBg: 'bg-orange-50', iconText: 'text-orange-600', badge: 'bg-orange-50 text-orange-700' },
    { iconBg: 'bg-sky-50', iconText: 'text-sky-600', badge: 'bg-sky-50 text-sky-700' },
    { iconBg: 'bg-rose-50', iconText: 'text-rose-600', badge: 'bg-rose-50 text-rose-700' },
];

function themeForSubject(sub, index) {
    const seed = String(sub?.code || sub?.name || index)
        .split('')
        .reduce((n, ch) => n + ch.charCodeAt(0), 0);
    return CARD_THEMES[seed % CARD_THEMES.length];
}

const emptyForm = () => ({
    _id: null,
    name: '',
    code: '',
    faculties: [],
    departments: [],
    description: '',
    teacherId: '',
});

const AdminSubjects = () => {
    const { query: searchQuery, setQuery: setSearchQuery } = usePageSearch('Search subjects…');
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [academicStructure, setAcademicStructure] = useState({ faculties: [] });
    const [loading, setLoading] = useState(true);
    const [menuOpenId, setMenuOpenId] = useState('');
    const menuRef = useRef(null);

    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!menuOpenId) return undefined;
        const onDocClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpenId('');
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [menuOpenId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [subRes, techRes, structureRes] = await Promise.all([
                adminSubjectService.getSubjects(),
                adminTeacherService.getTeachers(),
                adminAcademicService.getAcademicStructure(),
            ]);

            if (subRes.success) setSubjects(subRes.data);
            if (techRes.success) setTeachers(techRes.data);
            if (structureRes.success) setAcademicStructure(structureRes.data || { faculties: [] });
        } catch (error) {
            console.error('Error fetching data:', error);
            await appError('Failed to load subjects data');
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setFormData(emptyForm());
        setIsEditing(false);
        setShowModal(true);
        setMenuOpenId('');
    };

    const openEditModal = (subject) => {
        setFormData({
            _id: subject._id,
            name: subject.name,
            code: subject.code,
            faculties: getSubjectFaculties(subject),
            departments: getSubjectDepartments(subject),
            description: subject.description || '',
            teacherId: '',
        });
        setIsEditing(true);
        setShowModal(true);
        setMenuOpenId('');
    };

    const toggleFaculty = (name) => {
        const label = String(name || '').trim();
        if (!label) return;
        setFormData((prev) => {
            const selected = prev.faculties.includes(label)
                ? prev.faculties.filter((f) => f !== label)
                : [...prev.faculties, label];
            const allowedDepts = new Set(
                (academicStructure.faculties || [])
                    .filter((f) => selected.includes(f.name))
                    .flatMap((f) => f.departments || [])
            );
            return {
                ...prev,
                faculties: selected,
                departments: prev.departments.filter((d) => allowedDepts.has(d)),
            };
        });
    };

    const toggleDepartment = (name) => {
        const label = String(name || '').trim();
        if (!label) return;
        setFormData((prev) => ({
            ...prev,
            departments: prev.departments.includes(label)
                ? prev.departments.filter((d) => d !== label)
                : [...prev.departments, label],
        }));
    };

    const handleDelete = async (id) => {
        setMenuOpenId('');
        if (
            !(await appConfirm({
                message: 'Are you sure you want to delete this subject?',
                danger: true,
                confirmLabel: 'Delete',
            }))
        )
            return;
        try {
            await adminSubjectService.deleteSubject(id);
            setSubjects(subjects.filter((s) => s._id !== id));
        } catch (err) {
            console.error(err);
            await appError('Failed to delete subject');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newName = String(formData.name || '').trim().toLowerCase();
        const newCode = String(formData.code || '').trim().toLowerCase();
        const duplicate = subjects.find((s) => {
            if (formData._id && String(s._id) === String(formData._id)) return false;
            const existingName = String(s.name || '').trim().toLowerCase();
            const existingCode = String(s.code || '').trim().toLowerCase();
            return (newName && existingName === newName) || (newCode && existingCode === newCode);
        });
        if (duplicate) {
            const sameCode = String(duplicate.code || '').trim().toLowerCase() === newCode;
            await appWarning(
                sameCode
                    ? `A subject with code "${duplicate.code}" already exists (${duplicate.name}).`
                    : `A subject named "${duplicate.name}" already exists (code ${duplicate.code}).`
            );
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                _id: formData._id,
                name: formData.name,
                code: formData.code,
                faculties: formData.faculties,
                departments: formData.departments,
                faculty: formData.faculties[0] || '',
                department: formData.departments[0] || '',
                description: formData.description,
            };

            if (isEditing) {
                await adminSubjectService.updateSubject(formData._id, payload);
            } else {
                await adminSubjectService.createSubject(payload);
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
            await appError(error.response?.data?.message || 'Failed to save subject. Ensure code is unique.');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredSubjects = useMemo(
        () =>
            subjects.filter((sub) =>
                matchesSearchQuery(
                    searchQuery,
                    sub.name,
                    sub.code,
                    sub.teacher?.name,
                    ...getSubjectFaculties(sub),
                    ...getSubjectDepartments(sub)
                )
            ),
        [subjects, searchQuery]
    );

    const facultyOptions = (academicStructure.faculties || []).map((f) => f.name);
    const departmentOptions = (academicStructure.faculties || [])
        .filter((f) => formData.faculties.includes(f.name))
        .flatMap((f) => f.departments || [])
        .filter((d, i, arr) => arr.indexOf(d) === i);
    const filteredTeachersForSubject = teachers || [];

    const groupedSubjects = useMemo(() => {
        return filteredSubjects.reduce((acc, sub) => {
            const faculties = getSubjectFaculties(sub);
            const departments = getSubjectDepartments(sub);
            const facultyList = faculties.length ? faculties : ['Unassigned Faculty'];
            const departmentList = departments.length ? departments : ['Unassigned Department'];
            for (const faculty of facultyList) {
                if (!acc[faculty]) acc[faculty] = {};
                for (const department of departmentList) {
                    if (!acc[faculty][department]) acc[faculty][department] = [];
                    acc[faculty][department].push(sub);
                }
            }
            return acc;
        }, {});
    }, [filteredSubjects]);

    return (
        <div className="admin-page font-sans transition-colors">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-lg font-extrabold leading-[1.2] tracking-tight text-[var(--text-primary)]">
                        Subjects
                    </h1>
                    <p className="mt-0.5 text-[12px] font-normal text-[var(--text-secondary)]">
                        Courses grouped by faculty and department
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-[240px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder="Search subjects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-full border border-[var(--border)] bg-[var(--bg-card)] py-2 pl-9 pr-3 text-[12px] font-normal text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[#2f4aad]/15"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-[12px] font-semibold text-white transition hover:brightness-110"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        New Subject
                    </button>
                </div>
            </div>

            {showModal && (
                <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                                {isEditing ? 'Edit Course / Subject' : 'New Course Registration'}
                            </h2>
                            <p className="mt-0.5 text-[11px] font-normal text-[var(--text-secondary)]">
                                Register course subject and map classes/teachers.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <form id="subjectForm" onSubmit={handleSubmit} className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <div className="flex-1">
                                <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--text-secondary)]">
                                    Course / Subject Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Advanced Calculus"
                                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[#2f4aad]"
                                />
                            </div>
                            <div className="w-full sm:w-[140px]">
                                <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--text-secondary)]">
                                    Code <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="MATH301"
                                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 font-mono text-[12px] uppercase text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[#2f4aad]"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--text-secondary)]">
                                    Faculties
                                    <span className="ml-1 font-normal normal-case tracking-normal text-[var(--text-secondary)]">
                                        (select one or more)
                                    </span>
                                </label>
                                <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2">
                                    {facultyOptions.length === 0 ? (
                                        <p className="px-1 py-1 text-[11px] text-[var(--text-secondary)]">No faculties in academic structure yet.</p>
                                    ) : (
                                        facultyOptions.map((f) => (
                                            <label
                                                key={f}
                                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-normal text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.faculties.includes(f)}
                                                    onChange={() => toggleFaculty(f)}
                                                    className="rounded border-slate-300"
                                                />
                                                <span>{f}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--text-secondary)]">
                                    Departments
                                    <span className="ml-1 font-normal normal-case tracking-normal text-[var(--text-secondary)]">
                                        (select one or more)
                                    </span>
                                </label>
                                <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2">
                                    {formData.faculties.length === 0 ? (
                                        <p className="px-1 py-1 text-[11px] text-[var(--text-secondary)]">Select faculty first.</p>
                                    ) : departmentOptions.length === 0 ? (
                                        <p className="px-1 py-1 text-[11px] text-[var(--text-secondary)]">No departments under selected faculties.</p>
                                    ) : (
                                        departmentOptions.map((d) => (
                                            <label
                                                key={d}
                                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-normal text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.departments.includes(d)}
                                                    onChange={() => toggleDepartment(d)}
                                                    className="rounded border-slate-300"
                                                />
                                                <span>{d}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--text-secondary)]">
                                Teacher (Optional)
                            </label>
                            <select
                                value={formData.teacherId}
                                onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[#2f4aad]"
                            >
                                <option value="">Select Teacher...</option>
                                {filteredTeachersForSubject.map((t) => (
                                    <option key={t._id} value={t._id}>
                                        {t.name} {t.department ? `(${t.department})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="rounded-lg px-4 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="inline-flex min-w-[120px] items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-5 py-1.5 text-[12px] font-semibold text-white hover:brightness-110"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? 'Save' : 'Create'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="flex h-40 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
                </div>
            ) : subjects.length === 0 ? (
                <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-card)] p-10 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-elevated)]">
                        <BookOpen className="h-6 w-6 text-[var(--brand-primary)]" />
                    </div>
                    <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">No subjects found</h3>
                    <p className="mb-4 text-[12px] font-normal text-[var(--text-secondary)]">
                        Create subjects and map them to teachers and classes.
                    </p>
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-[12px] font-semibold text-white hover:brightness-110"
                    >
                        <Plus className="h-3.5 w-3.5" /> Create First Subject
                    </button>
                </div>
            ) : filteredSubjects.length === 0 ? (
                <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-card)] px-6 py-12 text-center text-[13px] font-normal text-[var(--text-secondary)]">
                    No subjects match your search.
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedSubjects).map(([faculty, departments]) =>
                        Object.entries(departments).map(([department, rows]) => (
                            <section key={`${faculty}-${department}`}>
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--brand-primary)]">
                                            <Monitor className="h-5 w-5" strokeWidth={2} />
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="truncate text-[16px] font-semibold leading-[1.2] text-[var(--text-primary)]">
                                                {faculty}
                                            </h2>
                                            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--text-secondary)]">
                                                {department}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--brand-primary)]">
                                        {rows.length} subject{rows.length === 1 ? '' : 's'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                    {rows.map((sub, index) => {
                                        const theme = themeForSubject(sub, index);
                                        const allocCount = Number(sub.classesCount ?? (sub.allocations || []).length) || 0;
                                        const menuKey = `${faculty}-${department}-${sub._id}`;
                                        return (
                                            <div
                                                key={menuKey}
                                                className="group flex flex-col rounded-[1.25rem] bg-[var(--bg-card)] p-5 shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)] ring-1 ring-[var(--border)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-20px_rgba(47,74,173,0.28)]"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex min-w-0 items-start gap-3">
                                                        <div
                                                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${theme.iconBg} ${theme.iconText}`}
                                                        >
                                                            <BookOpen className="h-5 w-5" strokeWidth={2} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="truncate text-[14px] font-semibold leading-[1.2] text-[var(--text-primary)]">
                                                                {sub.name}
                                                            </h3>
                                                            <span
                                                                className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.5px] ${theme.badge}`}
                                                            >
                                                                {sub.code}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="relative shrink-0" ref={menuOpenId === menuKey ? menuRef : null}>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setMenuOpenId((prev) => (prev === menuKey ? '' : menuKey))
                                                            }
                                                            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] dark:hover:bg-white/10"
                                                            aria-label="Subject actions"
                                                        >
                                                            <MoreVertical className="h-4 w-4" />
                                                        </button>
                                                        {menuOpenId === menuKey ? (
                                                            <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-1 shadow-lg">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openEditModal(sub)}
                                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] dark:hover:bg-white/10"
                                                                >
                                                                    <Edit2 className="h-3.5 w-3.5" /> Edit
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDelete(sub._id)}
                                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                <div className="mt-6 flex-1">
                                                    <div className="mb-1 flex items-center gap-1.5">
                                                        <Users className={`h-3.5 w-3.5 ${theme.iconText}`} />
                                                        <p className="text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--text-secondary)]">
                                                            Class allocations
                                                        </p>
                                                    </div>
                                                    <p className="text-[22px] font-extrabold leading-[1.2] text-[var(--text-primary)]">
                                                        {allocCount}
                                                    </p>
                                                    <p className="mt-1 text-[12px] font-normal text-[var(--text-secondary)]">
                                                        {allocCount === 0
                                                            ? 'No classes allocated'
                                                            : allocCount === 1
                                                              ? '1 class allocated'
                                                              : `${allocCount} classes allocated`}
                                                    </p>
                                                    {allocCount > 0 ? (
                                                        <ul className="mt-3 space-y-1">
                                                            {(sub.allocations || []).slice(0, 2).map((alloc, idx) => (
                                                                <li
                                                                    key={idx}
                                                                    className="truncate text-[11px] font-normal text-[var(--text-secondary)]"
                                                                >
                                                                    {alloc.className
                                                                        ? `${alloc.classCode || alloc.classId} · ${alloc.className}`
                                                                        : alloc.classId || alloc.classCode || 'Class'}
                                                                    {alloc.teacher?.name ? ` · ${alloc.teacher.name}` : ''}
                                                                </li>
                                                            ))}
                                                            {allocCount > 2 ? (
                                                                <li className="text-[11px] font-normal text-[var(--text-secondary)]">
                                                                    +{allocCount - 2} more
                                                                </li>
                                                            ) : null}
                                                        </ul>
                                                    ) : null}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(sub)}
                                                    className="mt-5 flex w-full items-center justify-between border-t border-[var(--border)] pt-3 text-[13px] font-semibold text-[var(--brand-primary)] transition hover:text-[#263c96]"
                                                >
                                                    View Details
                                                    <ArrowRight className="h-4 w-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminSubjects;
