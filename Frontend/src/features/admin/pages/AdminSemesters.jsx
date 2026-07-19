import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Check, Edit2, Loader2, Plus, X } from 'lucide-react';
import { adminAcademicService } from '../../../services/adminAcademicService';
import { appError, appWarning } from '../../../lib/appDialog';

function toDateInputValue(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function toDayStart(value) {
    if (!value) return null;
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.getTime();
}

function formatDayLabel(value) {
    if (!value) return '';
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
}

function validateSemesterDates({ startDate, endDate }, year) {
    const semStart = toDayStart(startDate);
    const semEnd = toDayStart(endDate);
    const yearStart = year?.startDate ? toDayStart(toDateInputValue(year.startDate)) : null;
    const yearEnd = year?.endDate ? toDayStart(toDateInputValue(year.endDate)) : null;

    if (semStart && semEnd && semStart > semEnd) {
        return 'Semester start date must be on or before the end date.';
    }

    if (!semStart && !semEnd) return null;

    if (!yearStart || !yearEnd) {
        return `Set start and end dates on academic year "${year?.label || 'selected year'}" before adding semester dates.`;
    }

    if (semStart && semStart < yearStart) {
        return `Semester start date cannot be before the academic year start (${formatDayLabel(toDateInputValue(year.startDate))}).`;
    }
    if (semEnd && semEnd > yearEnd) {
        return `Semester end date cannot be after the academic year end (${formatDayLabel(toDateInputValue(year.endDate))}).`;
    }

    return null;
}

const AdminSemesters = () => {
    const [academicYears, setAcademicYears] = useState([]);
    const [selectedYearId, setSelectedYearId] = useState('');
    const [semesters, setSemesters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showYearForm, setShowYearForm] = useState(false);
    const [editingYearId, setEditingYearId] = useState('');
    const [editingSemesterId, setEditingSemesterId] = useState('');
    const [editingFaculty, setEditingFaculty] = useState(null);
    const [editingDepartment, setEditingDepartment] = useState(null);
    const [yearSubmitting, setYearSubmitting] = useState(false);
    const [yearForm, setYearForm] = useState({
        label: '',
        startDate: '',
        endDate: '',
        isCurrent: false,
    });
    const [form, setForm] = useState({
        name: '',
        order: 1,
        startDate: '',
        endDate: '',
    });
    const [structure, setStructure] = useState({ faculties: [] });
    const [newFacultyName, setNewFacultyName] = useState('');
    const [departmentDrafts, setDepartmentDrafts] = useState({});
    const [structureSaving, setStructureSaving] = useState(false);

    const loadYearsAndSemesters = async (yearId = '') => {
        const [yRes, sRes, stRes] = await Promise.all([
            adminAcademicService.getAcademicYears(),
            adminAcademicService.getSemesters(yearId || undefined),
            adminAcademicService.getAcademicStructure(),
        ]);

        if (yRes.success) {
            setAcademicYears(yRes.data || []);
            if (!selectedYearId && (yRes.data || []).length > 0) {
                setSelectedYearId(yRes.data[0]._id);
            }
        }
        if (sRes.success) {
            setSemesters(sRes.data || []);
        }
        if (stRes.success) {
            setStructure(stRes.data || { faculties: [] });
        }
    };

    const saveStructure = async (nextStructure) => {
        try {
            setStructureSaving(true);
            const res = await adminAcademicService.updateAcademicStructure(nextStructure);
            if (!res.success) throw new Error('Failed to save structure');
            setStructure(res.data || { faculties: [] });
        } catch (err) {
            console.error(err);
            await appError(err.response?.data?.message || err.message || 'Could not save academic structure');
        } finally {
            setStructureSaving(false);
        }
    };

    const handleAddFaculty = async () => {
        const name = newFacultyName.trim();
        if (!name) return;
        const exists = (structure.faculties || []).some((f) => String(f.name).toLowerCase() === name.toLowerCase());
        if (exists) {
            await appWarning('Faculty already exists.');
            return;
        }
        const next = {
            faculties: [...(structure.faculties || []), { name, departments: [] }],
        };
        await saveStructure(next);
        setNewFacultyName('');
    };

    const handleAddDepartment = async (facultyName) => {
        const draft = String(departmentDrafts[facultyName] || '').trim();
        if (!draft) return;
        const next = {
            faculties: (structure.faculties || []).map((f) => {
                if (f.name !== facultyName) return f;
                const departments = Array.isArray(f.departments) ? f.departments : [];
                const exists = departments.some((d) => String(d).toLowerCase() === draft.toLowerCase());
                if (exists) return f;
                return { ...f, departments: [...departments, draft] };
            }),
        };
        await saveStructure(next);
        setDepartmentDrafts((prev) => ({ ...prev, [facultyName]: '' }));
    };

    const handleRenameFaculty = async (oldName, newName) => {
        const trimmed = String(newName || '').trim();
        if (!trimmed) {
            await appWarning('Faculty name is required.');
            return;
        }
        if (trimmed.toLowerCase() === String(oldName).toLowerCase()) {
            setEditingFaculty(null);
            return;
        }
        const exists = (structure.faculties || []).some(
            (f) => String(f.name).toLowerCase() === trimmed.toLowerCase() && f.name !== oldName
        );
        if (exists) {
            await appWarning('Faculty already exists.');
            return;
        }
        const next = {
            faculties: (structure.faculties || []).map((f) =>
                f.name === oldName ? { ...f, name: trimmed } : f
            ),
        };
        await saveStructure(next);
        setDepartmentDrafts((prev) => {
            const nextDrafts = { ...prev };
            if (Object.prototype.hasOwnProperty.call(nextDrafts, oldName)) {
                nextDrafts[trimmed] = nextDrafts[oldName];
                delete nextDrafts[oldName];
            }
            return nextDrafts;
        });
        setEditingFaculty(null);
    };

    const handleRenameDepartment = async (facultyName, oldDepartment, newDepartment) => {
        const trimmed = String(newDepartment || '').trim();
        if (!trimmed) {
            await appWarning('Department name is required.');
            return;
        }
        if (trimmed.toLowerCase() === String(oldDepartment).toLowerCase()) {
            setEditingDepartment(null);
            return;
        }
        const faculty = (structure.faculties || []).find((f) => f.name === facultyName);
        const departments = Array.isArray(faculty?.departments) ? faculty.departments : [];
        const exists = departments.some(
            (d) => String(d).toLowerCase() === trimmed.toLowerCase() && d !== oldDepartment
        );
        if (exists) {
            await appWarning('Department already exists in this faculty.');
            return;
        }
        const next = {
            faculties: (structure.faculties || []).map((f) => {
                if (f.name !== facultyName) return f;
                return {
                    ...f,
                    departments: (f.departments || []).map((d) => (d === oldDepartment ? trimmed : d)),
                };
            }),
        };
        await saveStructure(next);
        setEditingDepartment(null);
    };

    const resetYearForm = () => {
        setYearForm({ label: '', startDate: '', endDate: '', isCurrent: false });
        setEditingYearId('');
    };

    const resetSemesterForm = () => {
        setForm({ name: '', order: 1, startDate: '', endDate: '' });
        setEditingSemesterId('');
    };

    const openCreateYearForm = () => {
        resetYearForm();
        setShowYearForm(true);
    };

    const openEditYearForm = (year) => {
        setEditingYearId(year._id);
        setYearForm({
            label: year.label || '',
            startDate: toDateInputValue(year.startDate),
            endDate: toDateInputValue(year.endDate),
            isCurrent: Boolean(year.isCurrent),
        });
        setShowYearForm(true);
    };

    const openCreateSemesterForm = () => {
        resetSemesterForm();
        setShowCreateForm(true);
    };

    const openEditSemesterForm = (semester) => {
        setEditingSemesterId(semester._id);
        setForm({
            name: semester.name || '',
            order: semester.order ?? 1,
            startDate: toDateInputValue(semester.startDate),
            endDate: toDateInputValue(semester.endDate),
        });
        setShowCreateForm(true);
    };

    useEffect(() => {
        const init = async () => {
            try {
                await loadYearsAndSemesters();
            } catch (err) {
                console.error('Failed to load semesters:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (!selectedYearId) return;
        const refresh = async () => {
            try {
                const res = await adminAcademicService.getSemesters(selectedYearId);
                if (res.success) setSemesters(res.data || []);
            } catch (err) {
                console.error(err);
            }
        };
        refresh();
    }, [selectedYearId]);

    const { selectedYear, yearDateBounds } = useMemo(() => {
        const year = academicYears.find((y) => String(y._id) === String(selectedYearId));
        if (!year?.startDate || !year?.endDate) {
            return { selectedYear: year || null, yearDateBounds: null };
        }
        return {
            selectedYear: year,
            yearDateBounds: {
                min: toDateInputValue(year.startDate),
                max: toDateInputValue(year.endDate),
                label: year.label,
            },
        };
    }, [academicYears, selectedYearId]);

    const handleSaveSemester = async (e) => {
        e.preventDefault();
        if (!selectedYearId) {
            await appWarning('Please select an academic year first.');
            return;
        }
        if (!form.name.trim()) {
            await appWarning('Semester name is required.');
            return;
        }
        const dateError = validateSemesterDates(form, selectedYear);
        if (dateError) {
            await appWarning(dateError);
            return;
        }
        try {
            setSubmitting(true);
            const payload = {
                academicYearId: selectedYearId,
                name: form.name.trim(),
                order: Number(form.order) || 1,
                startDate: form.startDate || undefined,
                endDate: form.endDate || undefined,
            };
            const res = editingSemesterId
                ? await adminAcademicService.updateSemester(editingSemesterId, payload)
                : await adminAcademicService.createSemester(payload);
            if (!res.success) throw new Error(res.message || `Failed to ${editingSemesterId ? 'update' : 'create'} semester`);

            resetSemesterForm();
            setShowCreateForm(false);
            const listRes = await adminAcademicService.getSemesters(selectedYearId);
            if (listRes.success) setSemesters(listRes.data || []);
        } catch (err) {
            console.error(err);
            await appError(err.response?.data?.message || err.message || `Could not ${editingSemesterId ? 'update' : 'create'} semester`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveAcademicYear = async (e) => {
        e.preventDefault();
        if (!yearForm.label.trim()) {
            await appWarning('Academic year label is required.');
            return;
        }
        if (yearForm.startDate && yearForm.endDate) {
            const start = toDayStart(yearForm.startDate);
            const end = toDayStart(yearForm.endDate);
            if (start != null && end != null && start > end) {
                await appWarning('Academic year end date must be on or after the start date.');
                return;
            }
        }
        try {
            setYearSubmitting(true);
            const payload = {
                label: yearForm.label.trim(),
                startDate: yearForm.startDate || undefined,
                endDate: yearForm.endDate || undefined,
                isCurrent: Boolean(yearForm.isCurrent),
            };
            const res = editingYearId
                ? await adminAcademicService.updateAcademicYear(editingYearId, payload)
                : await adminAcademicService.createAcademicYear(payload);
            if (!res.success) throw new Error(res.message || `Failed to ${editingYearId ? 'update' : 'create'} academic year`);

            const yearsRes = await adminAcademicService.getAcademicYears();
            if (yearsRes.success) {
                setAcademicYears(yearsRes.data || []);
                const savedId = editingYearId || res.data?._id;
                if (savedId) setSelectedYearId(savedId);
            }
            resetYearForm();
            setShowYearForm(false);
        } catch (err) {
            console.error(err);
            await appError(err.response?.data?.message || err.message || `Could not ${editingYearId ? 'update' : 'create'} academic year`);
        } finally {
            setYearSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="admin-page min-h-[40vh] flex items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#1e56e3]" />
            </div>
        );
    }

    return (
        <div className="admin-page space-y-4 font-sans text-[13px]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-white/10">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#1e56e3] dark:bg-blue-500/15 dark:text-blue-300">
                        <CalendarRange className="h-4 w-4" />
                    </div>
                    <div>
                        <h1 className="text-base font-extrabold leading-none text-slate-900 dark:text-slate-100">Semesters</h1>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Manage academic years, structure, and terms.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={openCreateYearForm}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-[#162033]"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">New Year</span>
                    </button>
                    <select
                        value={selectedYearId}
                        onChange={(e) => setSelectedYearId(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-800 dark:border-white/10 dark:bg-[#111827] dark:text-slate-100"
                    >
                        <option value="">Select year</option>
                        {academicYears.map((y) => (
                            <option key={y._id} value={y._id}>
                                {y.label}
                            </option>
                        ))}
                    </select>
                    {selectedYear ? (
                        <button
                            type="button"
                            onClick={() => openEditYearForm(selectedYear)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-[#162033]"
                            title="Edit selected academic year"
                        >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Edit Year</span>
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={openCreateSemesterForm}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e56e3] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-blue-700"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Semester
                    </button>
                </div>
            </div>

            {showYearForm && (
                <form
                    onSubmit={handleSaveAcademicYear}
                    className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111827] dark:shadow-none"
                >
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                            {editingYearId ? 'Edit Academic Year' : 'New Academic Year'}
                        </h2>
                        <button
                            type="button"
                            onClick={() => {
                                resetYearForm();
                                setShowYearForm(false);
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-[#162033]"
                        >
                            Close
                        </button>
                    </div>

                    <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Label</label>
                        <input
                            value={yearForm.label}
                            onChange={(e) => setYearForm((f) => ({ ...f, label: e.target.value }))}
                            placeholder="e.g. 2025/2026"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Start Date</label>
                            <input
                                type="date"
                                value={yearForm.startDate}
                                onChange={(e) => setYearForm((f) => ({ ...f, startDate: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">End Date</label>
                            <input
                                type="date"
                                value={yearForm.endDate}
                                min={yearForm.startDate || undefined}
                                onChange={(e) => setYearForm((f) => ({ ...f, endDate: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => {
                                resetYearForm();
                                setShowYearForm(false);
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={yearSubmitting}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e56e3] px-4 py-1.5 text-[12px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {yearSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editingYearId ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                            {yearSubmitting ? 'Saving...' : editingYearId ? 'Update Year' : 'Create Year'}
                        </button>
                    </div>
                </form>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div>
                    <h2 className="text-sm font-black text-slate-900">Academic Structure</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Manage faculties and departments used by classes and subjects filters. Applies to every academic year.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        value={newFacultyName}
                        onChange={(e) => setNewFacultyName(e.target.value)}
                        placeholder="New faculty name"
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-800"
                    />
                    <button
                        type="button"
                        onClick={handleAddFaculty}
                        disabled={structureSaving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e56e3] px-4 py-2 text-[12px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Faculty
                    </button>
                </div>

                <div className="space-y-2">
                    {(structure.faculties || []).map((f) => (
                        <div key={f.name} className="rounded-lg border border-slate-200 p-3">
                            <div className="flex items-center justify-between gap-2">
                                {editingFaculty?.oldName === f.name ? (
                                    <div className="flex flex-1 items-center gap-2">
                                        <input
                                            value={editingFaculty.value}
                                            onChange={(e) => setEditingFaculty((prev) => ({ ...prev, value: e.target.value }))}
                                            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-800"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRenameFaculty(f.name, editingFaculty.value)}
                                            disabled={structureSaving}
                                            className="rounded-lg bg-[#1e56e3] p-1.5 text-white hover:bg-blue-700 disabled:opacity-60"
                                            title="Save faculty name"
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingFaculty(null)}
                                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                                            title="Cancel"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <h3 className="text-[13px] font-black text-slate-900">{f.name}</h3>
                                        <button
                                            type="button"
                                            onClick={() => setEditingFaculty({ oldName: f.name, value: f.name })}
                                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                                            title="Edit faculty"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </button>
                                    </>
                                )}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {(f.departments || []).map((d) => {
                                    const isEditing =
                                        editingDepartment?.facultyName === f.name && editingDepartment?.oldName === d;
                                    return isEditing ? (
                                        <div key={`${f.name}-${d}-edit`} className="inline-flex items-center gap-1">
                                            <input
                                                value={editingDepartment.value}
                                                onChange={(e) =>
                                                    setEditingDepartment((prev) => ({ ...prev, value: e.target.value }))
                                                }
                                                className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRenameDepartment(f.name, d, editingDepartment.value)}
                                                disabled={structureSaving}
                                                className="rounded-full bg-[#1e56e3] p-1 text-white hover:bg-blue-700 disabled:opacity-60"
                                                title="Save department"
                                            >
                                                <Check className="h-3 w-3" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditingDepartment(null)}
                                                className="rounded-full border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                                                title="Cancel"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <span
                                            key={`${f.name}-${d}`}
                                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"
                                        >
                                            {d}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setEditingDepartment({ facultyName: f.name, oldName: d, value: d })
                                                }
                                                className="text-slate-500 hover:text-slate-800"
                                                title="Edit department"
                                            >
                                                <Edit2 className="h-3 w-3" />
                                            </button>
                                        </span>
                                    );
                                })}
                                {(f.departments || []).length === 0 && (
                                    <span className="text-[11px] text-slate-500">No departments yet.</span>
                                )}
                            </div>
                            <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                <input
                                    value={departmentDrafts[f.name] || ''}
                                    onChange={(e) => setDepartmentDrafts((prev) => ({ ...prev, [f.name]: e.target.value }))}
                                    placeholder={`Add department to ${f.name}`}
                                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddDepartment(f.name)}
                                    disabled={structureSaving}
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                >
                                    Add Department
                                </button>
                            </div>
                        </div>
                    ))}
                    {(structure.faculties || []).length === 0 && (
                        <p className="text-[11px] text-slate-500">No faculties yet. Add your first faculty to start structure filtering.</p>
                    )}
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-black text-slate-900 mb-3">
                    {selectedYear ? `Semesters in ${selectedYear.label}` : 'Semesters'}
                </h2>
                {semesters.length === 0 ? (
                    <p className="text-[11px] text-slate-500">No semesters found for selected year.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {semesters.map((s) => (
                            <div key={s._id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[13px] font-extrabold text-slate-900 truncate">{s.name}</p>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-slate-600 ring-1 ring-slate-200">
                                            Order {s.order ?? 0}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => openEditSemesterForm(s)}
                                            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100"
                                            title="Edit semester"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <p className="mt-1.5 text-[10px] font-medium text-slate-500">
                                    {s.startDate ? new Date(s.startDate).toLocaleDateString() : 'No start'} -{' '}
                                    {s.endDate ? new Date(s.endDate).toLocaleDateString() : 'No end'}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showCreateForm && (
                <form
                    onSubmit={handleSaveSemester}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                >
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-black text-slate-900">
                            {editingSemesterId ? 'Edit Semester' : 'New Semester Registration'}
                        </h2>
                        <button
                            type="button"
                            onClick={() => {
                                resetSemesterForm();
                                setShowCreateForm(false);
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Close
                        </button>
                    </div>

                    <div>
                        <label className="block mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Semester Name</label>
                        <input
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Semester 1"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-800"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                            <label className="block mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Order</label>
                            <input
                                type="number"
                                min={1}
                                value={form.order}
                                onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-800"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Start Date</label>
                            <input
                                type="date"
                                value={form.startDate}
                                min={yearDateBounds?.min}
                                max={yearDateBounds?.max}
                                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-800"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">End Date</label>
                        <input
                            type="date"
                            value={form.endDate}
                            min={yearDateBounds?.min}
                            max={yearDateBounds?.max}
                            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-800"
                        />
                    </div>

                    {yearDateBounds ? (
                        <p className="text-[11px] font-medium text-slate-500">
                            Dates must fall within {yearDateBounds.label}: {formatDayLabel(yearDateBounds.min)} – {formatDayLabel(yearDateBounds.max)}.
                        </p>
                    ) : (
                        <p className="text-[11px] font-medium text-amber-700">
                            Add start and end dates to academic year {selectedYear?.label || 'selected year'} before setting semester dates.
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => {
                                resetSemesterForm();
                                setShowCreateForm(false);
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e56e3] px-4 py-1.5 text-[12px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editingSemesterId ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                            {submitting ? 'Saving...' : editingSemesterId ? 'Update Semester' : 'Create Semester'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default AdminSemesters;
