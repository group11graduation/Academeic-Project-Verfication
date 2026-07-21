import React, { useEffect, useState } from 'react';
import { Building2, Check, ChevronDown, ChevronRight, Edit2, Loader2, Plus, Trash2, X } from 'lucide-react';
import { adminAcademicService } from '../../../services/adminAcademicService';
import { appConfirm, appError, appWarning } from '../../../lib/appDialog';

const AdminAcademicStructure = () => {
    const [structure, setStructure] = useState({ faculties: [] });
    const [loading, setLoading] = useState(true);
    const [structureSaving, setStructureSaving] = useState(false);
    const [newFacultyName, setNewFacultyName] = useState('');
    const [departmentDrafts, setDepartmentDrafts] = useState({});
    const [editingFaculty, setEditingFaculty] = useState(null);
    const [editingDepartment, setEditingDepartment] = useState(null);
    /** Faculty names that are expanded (show departments). Empty = all collapsed. */
    const [expandedFaculties, setExpandedFaculties] = useState(() => new Set());

    const isFacultyExpanded = (name) => expandedFaculties.has(name);

    const toggleFaculty = (name) => {
        setExpandedFaculties((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const expandFaculty = (name) => {
        setExpandedFaculties((prev) => {
            if (prev.has(name)) return prev;
            const next = new Set(prev);
            next.add(name);
            return next;
        });
    };

    const expandAll = () => {
        setExpandedFaculties(new Set((structure.faculties || []).map((f) => f.name)));
    };

    const collapseAll = () => {
        setExpandedFaculties(new Set());
    };

    const loadStructure = async () => {
        const res = await adminAcademicService.getAcademicStructure();
        if (res.success) {
            setStructure(res.data || { faculties: [] });
        }
    };

    useEffect(() => {
        const init = async () => {
            try {
                await loadStructure();
            } catch (err) {
                console.error('Failed to load academic structure:', err);
                await appError('Failed to load academic structure');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

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
        await saveStructure({
            faculties: [...(structure.faculties || []), { name, departments: [] }],
        });
        setNewFacultyName('');
        expandFaculty(name);
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
        await saveStructure({
            faculties: (structure.faculties || []).map((f) =>
                f.name === oldName ? { ...f, name: trimmed } : f
            ),
        });
        setDepartmentDrafts((prev) => {
            const nextDrafts = { ...prev };
            if (Object.prototype.hasOwnProperty.call(nextDrafts, oldName)) {
                nextDrafts[trimmed] = nextDrafts[oldName];
                delete nextDrafts[oldName];
            }
            return nextDrafts;
        });
        setExpandedFaculties((prev) => {
            if (!prev.has(oldName)) return prev;
            const next = new Set(prev);
            next.delete(oldName);
            next.add(trimmed);
            return next;
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
        await saveStructure({
            faculties: (structure.faculties || []).map((f) => {
                if (f.name !== facultyName) return f;
                return {
                    ...f,
                    departments: (f.departments || []).map((d) => (d === oldDepartment ? trimmed : d)),
                };
            }),
        });
        setEditingDepartment(null);
    };

    const handleDeleteFaculty = async (facultyName) => {
        const ok = await appConfirm(
            `Delete faculty "${facultyName}" and all its departments from Academic Structure?`,
            { danger: true, confirmLabel: 'Delete faculty' },
        );
        if (!ok) return;
        await saveStructure({
            faculties: (structure.faculties || []).filter(
                (f) => String(f.name).toLowerCase() !== String(facultyName).toLowerCase()
            ),
        });
        setDepartmentDrafts((prev) => {
            const nextDrafts = { ...prev };
            delete nextDrafts[facultyName];
            return nextDrafts;
        });
        setExpandedFaculties((prev) => {
            if (!prev.has(facultyName)) return prev;
            const next = new Set(prev);
            next.delete(facultyName);
            return next;
        });
        if (editingFaculty?.oldName === facultyName) setEditingFaculty(null);
        if (editingDepartment?.facultyName === facultyName) setEditingDepartment(null);
    };

    const handleDeleteDepartment = async (facultyName, departmentName) => {
        const ok = await appConfirm(
            `Delete department "${departmentName}" from ${facultyName}?`,
            { danger: true, confirmLabel: 'Delete department' },
        );
        if (!ok) return;
        await saveStructure({
            faculties: (structure.faculties || []).map((f) => {
                if (f.name !== facultyName) return f;
                return {
                    ...f,
                    departments: (f.departments || []).filter(
                        (d) => String(d).toLowerCase() !== String(departmentName).toLowerCase()
                    ),
                };
            }),
        });
        if (
            editingDepartment?.facultyName === facultyName &&
            editingDepartment?.oldName === departmentName
        ) {
            setEditingDepartment(null);
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
                        <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                        <h1 className="text-base font-extrabold leading-none text-slate-900 dark:text-slate-100">
                            Academic Structure
                        </h1>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            Manage faculties and departments used by classes, subjects, and filters.
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 dark:border-white/10 dark:bg-[#111827] dark:shadow-none">
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        value={newFacultyName}
                        onChange={(e) => setNewFacultyName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddFaculty();
                            }
                        }}
                        placeholder="New faculty name"
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-800 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
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

                {(structure.faculties || []).length > 0 && (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={expandAll}
                            className="text-[10px] font-bold uppercase tracking-wider text-[#1e56e3] hover:underline"
                        >
                            Expand all
                        </button>
                        <span className="text-slate-300">·</span>
                        <button
                            type="button"
                            onClick={collapseAll}
                            className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:underline"
                        >
                            Collapse all
                        </button>
                    </div>
                )}

                <div className="space-y-2">
                    {(structure.faculties || []).map((f) => {
                        const expanded = isFacultyExpanded(f.name);
                        const deptCount = (f.departments || []).length;
                        return (
                        <div key={f.name} className="rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
                            <div className="flex items-center justify-between gap-2 p-3 bg-slate-50/80 dark:bg-[#0f172a]/40">
                                {editingFaculty?.oldName === f.name ? (
                                    <div className="flex flex-1 items-center gap-2">
                                        <input
                                            value={editingFaculty.value}
                                            onChange={(e) => setEditingFaculty((prev) => ({ ...prev, value: e.target.value }))}
                                            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-800 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
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
                                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-[#162033]"
                                            title="Cancel"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => toggleFaculty(f.name)}
                                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                            aria-expanded={expanded}
                                        >
                                            {expanded ? (
                                                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                                            )}
                                            <h3 className="truncate text-[13px] font-black text-slate-900 dark:text-slate-100">
                                                {f.name}
                                            </h3>
                                            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-white/10">
                                                {deptCount} dept{deptCount === 1 ? '' : 's'}
                                            </span>
                                        </button>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setEditingFaculty({ oldName: f.name, value: f.name })}
                                                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-[#162033]"
                                                title="Edit faculty"
                                            >
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteFaculty(f.name)}
                                                disabled={structureSaving}
                                                className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
                                                title="Delete faculty"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {expanded && (
                            <div className="space-y-2 border-t border-slate-200 p-3 dark:border-white/10">
                            <div className="flex flex-wrap gap-1.5">
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
                                                className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-200"
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
                                                className="rounded-full border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
                                                title="Cancel"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <span
                                            key={`${f.name}-${d}`}
                                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                        >
                                            {d}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setEditingDepartment({ facultyName: f.name, oldName: d, value: d })
                                                }
                                                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
                                                title="Edit department"
                                            >
                                                <Edit2 className="h-3 w-3" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteDepartment(f.name, d)}
                                                disabled={structureSaving}
                                                className="text-rose-500 hover:text-rose-700 disabled:opacity-60"
                                                title="Delete department"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </span>
                                    );
                                })}
                                {(f.departments || []).length === 0 && (
                                    <span className="text-[11px] text-slate-500">No departments yet.</span>
                                )}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    value={departmentDrafts[f.name] || ''}
                                    onChange={(e) => setDepartmentDrafts((prev) => ({ ...prev, [f.name]: e.target.value }))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddDepartment(f.name);
                                        }
                                    }}
                                    placeholder={`Add department to ${f.name}`}
                                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddDepartment(f.name)}
                                    disabled={structureSaving}
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-[#162033]"
                                >
                                    Add Department
                                </button>
                            </div>
                            </div>
                            )}
                        </div>
                        );
                    })}
                    {(structure.faculties || []).length === 0 && (
                        <p className="text-[11px] text-slate-500">
                            No faculties yet. Add your first faculty to start structure filtering.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminAcademicStructure;
