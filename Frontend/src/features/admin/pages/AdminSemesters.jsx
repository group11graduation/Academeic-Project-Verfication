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
            <div className="admin-page min-h-[40vh] flex items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#1e56e3]" />
            </div>
        );
    }

    return (
        <div className="admin-page font-sans text-[13px] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#1e56e3]">
                        <CalendarRange className="h-4 w-4" />
                    </div>
                    <div>
                        <h1 className="text-base font-extrabold text-slate-900 leading-none">Semesters</h1>
                        <p className="text-[11px] text-slate-500 mt-0.5">Manage academic years, structure, and terms.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowYearForm((v) => !v)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">New Year</span>
                    </button>
                    <select
                        value={selectedYearId}
                        onChange={(e) => setSelectedYearId(e.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-800 bg-white"
                    >
                        <option value="">Select year</option>
                        {academicYears.map((y) => (
                            <option key={y._id} value={y._id}>
                                {y.label}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => setShowCreateForm(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e56e3] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-blue-700"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Semester
                    </button>
                </div>
            </div>

            {showYearForm && (
                <form
                    onSubmit={handleCreateAcademicYear}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                >
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-black text-slate-900">New Academic Year</h2>
                        <button
                            type="button"
                            onClick={() => setShowYearForm(false)}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Close
                        </button>
                    </div>

                    <div>
                        <label className="block mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Label</label>
                        <input
                            value={yearForm.label}
                            onChange={(e) => setYearForm((f) => ({ ...f, label: e.target.value }))}
                            placeholder="e.g. 2025/2026"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-800"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                            <label className="block mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Start Date</label>
                            <input
                                type="date"
                                value={yearForm.startDate}
                                onChange={(e) => setYearForm((f) => ({ ...f, startDate: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-800"
                            />
                        </div>
                        <div>
                            <label className="block mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">End Date</label>
                            <input
                                type="date"
                                value={yearForm.endDate}
                                onChange={(e) => setYearForm((f) => ({ ...f, endDate: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-800"
                            />
                        </div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                        <input
                            type="checkbox"
                            checked={yearForm.isCurrent}
                            onChange={(e) => setYearForm((f) => ({ ...f, isCurrent: e.target.checked }))}
                            className="h-3.5 w-3.5 rounded border-slate-300"
                        />
                        Set as current academic year
                    </label>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setShowYearForm(false)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={yearSubmitting}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e56e3] px-4 py-1.5 text-[12px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {yearSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            {yearSubmitting ? 'Creating...' : 'Create Year'}
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
                            <h3 className="text-[13px] font-black text-slate-900">{f.name}</h3>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {(f.departments || []).map((d) => (
                                    <span key={`${f.name}-${d}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                        {d}
                                    </span>
                                ))}
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
                                    <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-slate-600 ring-1 ring-slate-200 shrink-0">
                                        Order {s.order ?? 0}
                                    </span>
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
                    onSubmit={handleCreateSemester}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                >
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-black text-slate-900">New Semester Registration</h2>
                        <button
                            type="button"
                            onClick={() => setShowCreateForm(false)}
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
                            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-800"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setShowCreateForm(false)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e56e3] px-4 py-1.5 text-[12px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            {submitting ? 'Creating...' : 'Create Semester'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default AdminSemesters;
