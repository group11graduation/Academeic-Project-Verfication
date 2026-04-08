import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Loader2, Plus } from 'lucide-react';
import { adminAcademicService } from '../../../services/adminAcademicService';

const AdminSemesters = () => {
    const [academicYears, setAcademicYears] = useState([]);
    const [selectedYearId, setSelectedYearId] = useState('');
    const [semesters, setSemesters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showYearForm, setShowYearForm] = useState(false);
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
            alert(err.response?.data?.message || err.message || 'Could not save academic structure');
        } finally {
            setStructureSaving(false);
        }
    };

    const handleAddFaculty = async () => {
        const name = newFacultyName.trim();
        if (!name) return;
        const exists = (structure.faculties || []).some((f) => String(f.name).toLowerCase() === name.toLowerCase());
        if (exists) {
            alert('Faculty already exists.');
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

    const selectedYear = useMemo(
        () => academicYears.find((y) => String(y._id) === String(selectedYearId)),
        [academicYears, selectedYearId]
    );

    const handleCreateSemester = async (e) => {
        e.preventDefault();
        if (!selectedYearId) {
            alert('Please select an academic year first.');
            return;
        }
        if (!form.name.trim()) {
            alert('Semester name is required.');
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
            const res = await adminAcademicService.createSemester(payload);
            if (!res.success) throw new Error(res.message || 'Failed to create semester');

            setForm({ name: '', order: 1, startDate: '', endDate: '' });
            setShowCreateForm(false);
            const listRes = await adminAcademicService.getSemesters(selectedYearId);
            if (listRes.success) setSemesters(listRes.data || []);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || err.message || 'Could not create semester');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateAcademicYear = async (e) => {
        e.preventDefault();
        if (!yearForm.label.trim()) {
            alert('Academic year label is required.');
            return;
        }
        try {
            setYearSubmitting(true);
            const payload = {
                label: yearForm.label.trim(),
                startDate: yearForm.startDate || undefined,
                endDate: yearForm.endDate || undefined,
                isCurrent: Boolean(yearForm.isCurrent),
            };
            const res = await adminAcademicService.createAcademicYear(payload);
            if (!res.success) throw new Error(res.message || 'Failed to create academic year');

            const yearsRes = await adminAcademicService.getAcademicYears();
            if (yearsRes.success) {
                setAcademicYears(yearsRes.data || []);
                const newId = res.data?._id;
                if (newId) setSelectedYearId(newId);
            }
            setYearForm({ label: '', startDate: '', endDate: '', isCurrent: false });
            setShowYearForm(false);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || err.message || 'Could not create academic year');
        } finally {
            setYearSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#1e56e3]" />
            </div>
        );
    }

    return (
        <div className="font-sans space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#1e56e3]">
                        <CalendarRange className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900">Semesters</h1>
                        <p className="text-sm text-slate-500">View all semesters in cards and add a new one anytime.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setShowYearForm((v) => !v)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                        <Plus className="h-4 w-4" />
                        New Academic Year
                    </button>
                    <select
                        value={selectedYearId}
                        onChange={(e) => setSelectedYearId(e.target.value)}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-slate-800 bg-white"
                    >
                        <option value="">Select academic year</option>
                        {academicYears.map((y) => (
                            <option key={y._id} value={y._id}>
                                {y.label}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => setShowCreateForm(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#1e56e3] px-4 py-2.5 text-[14px] font-bold text-white hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" />
                        Add New Semester
                    </button>
                </div>
            </div>

            {showYearForm && (
                <form
                    onSubmit={handleCreateAcademicYear}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
                >
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-black text-slate-900">New Academic Year</h2>
                        <button
                            type="button"
                            onClick={() => setShowYearForm(false)}
                            className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Close
                        </button>
                    </div>

                    <div>
                        <label className="block mb-1 text-[13px] font-bold text-slate-600">Label</label>
                        <input
                            value={yearForm.label}
                            onChange={(e) => setYearForm((f) => ({ ...f, label: e.target.value }))}
                            placeholder="e.g. 2025/2026"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-slate-800"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block mb-1 text-[13px] font-bold text-slate-600">Start Date</label>
                            <input
                                type="date"
                                value={yearForm.startDate}
                                onChange={(e) => setYearForm((f) => ({ ...f, startDate: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-slate-800"
                            />
                        </div>
                        <div>
                            <label className="block mb-1 text-[13px] font-bold text-slate-600">End Date</label>
                            <input
                                type="date"
                                value={yearForm.endDate}
                                onChange={(e) => setYearForm((f) => ({ ...f, endDate: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-slate-800"
                            />
                        </div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input
                            type="checkbox"
                            checked={yearForm.isCurrent}
                            onChange={(e) => setYearForm((f) => ({ ...f, isCurrent: e.target.checked }))}
                            className="h-4 w-4 rounded border-slate-300"
                        />
                        Set as current academic year
                    </label>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowYearForm(false)}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={yearSubmitting}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#1e56e3] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {yearSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            {yearSubmitting ? 'Creating...' : 'Create Academic Year'}
                        </button>
                    </div>
                </form>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">Academic Structure</h2>
                        <p className="text-sm text-slate-500">Manage faculties and departments used by classes and subjects filters.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        value={newFacultyName}
                        onChange={(e) => setNewFacultyName(e.target.value)}
                        placeholder="New faculty name"
                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-slate-800"
                    />
                    <button
                        type="button"
                        onClick={handleAddFaculty}
                        disabled={structureSaving}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#1e56e3] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        <Plus className="h-4 w-4" />
                        Add Faculty
                    </button>
                </div>

                <div className="space-y-4">
                    {(structure.faculties || []).map((f) => (
                        <div key={f.name} className="rounded-xl border border-slate-200 p-4">
                            <h3 className="text-[15px] font-black text-slate-900">{f.name}</h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {(f.departments || []).map((d) => (
                                    <span key={`${f.name}-${d}`} className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-bold text-slate-600">
                                        {d}
                                    </span>
                                ))}
                                {(f.departments || []).length === 0 && (
                                    <span className="text-[12px] text-slate-500">No departments yet.</span>
                                )}
                            </div>
                            <div className="mt-3 flex flex-col sm:flex-row gap-2">
                                <input
                                    value={departmentDrafts[f.name] || ''}
                                    onChange={(e) => setDepartmentDrafts((prev) => ({ ...prev, [f.name]: e.target.value }))}
                                    placeholder={`Add department to ${f.name}`}
                                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddDepartment(f.name)}
                                    disabled={structureSaving}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                >
                                    Add Department
                                </button>
                            </div>
                        </div>
                    ))}
                    {(structure.faculties || []).length === 0 && (
                        <p className="text-sm text-slate-500">No faculties yet. Add your first faculty to start structure filtering.</p>
                    )}
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-slate-900 mb-4">
                    {selectedYear ? `Semesters in ${selectedYear.label}` : 'Semesters'}
                </h2>
                {semesters.length === 0 ? (
                    <p className="text-sm text-slate-500">No semesters found for selected year.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {semesters.map((s) => (
                            <div key={s._id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[16px] font-extrabold text-slate-900">{s.name}</p>
                                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">
                                        Order {s.order ?? 0}
                                    </span>
                                </div>
                                <p className="mt-3 text-[12px] font-medium text-slate-500">
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
                    onSubmit={handleCreateSemester}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
                >
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-black text-slate-900">New Semester Registration</h2>
                        <button
                            type="button"
                            onClick={() => setShowCreateForm(false)}
                            className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Close
                        </button>
                    </div>

                    <div>
                        <label className="block mb-1 text-[13px] font-bold text-slate-600">Semester Name</label>
                        <input
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Semester 1"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-slate-800"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block mb-1 text-[13px] font-bold text-slate-600">Order</label>
                            <input
                                type="number"
                                min={1}
                                value={form.order}
                                onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-slate-800"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block mb-1 text-[13px] font-bold text-slate-600">Start Date</label>
                            <input
                                type="date"
                                value={form.startDate}
                                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-slate-800"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block mb-1 text-[13px] font-bold text-slate-600">End Date</label>
                        <input
                            type="date"
                            value={form.endDate}
                            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-slate-800"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowCreateForm(false)}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#1e56e3] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            {submitting ? 'Creating...' : 'Create Semester'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default AdminSemesters;
