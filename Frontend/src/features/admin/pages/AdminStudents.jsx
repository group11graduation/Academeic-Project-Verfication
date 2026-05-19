import React, { useEffect, useMemo, useState } from 'react';
import {
    Search,
    Plus,
    Pencil,
    Trash2,
    ChevronDown,
    Loader2,
    Upload,
    Download,
    ArrowLeft,
    AlertCircle,
    CheckCircle2,
    Eye,
    EyeOff
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import adminStudentService from '../../../services/adminStudentService';
import adminClassService from '../../../services/adminClassService';
import { adminAcademicService } from '../../../services/adminAcademicService';
import {
    readSpreadsheetFileAsCsvText,
    normalizeStudentImportRow,
    parseCsvToRecords,
} from '../../../lib/spreadsheetImport';

const AdminStudents = () => {
    const location = useLocation();
    const [mode, setMode] = useState('list'); // list | add | import | edit
    const [searchQuery, setSearchQuery] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [facultyFilter, setFacultyFilter] = useState('');
    const [students, setStudents] = useState([]);
    const [revealedPasscodes, setRevealedPasscodes] = useState({});
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Add form state
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState('');
    const [addForm, setAddForm] = useState({
        name: '',
        email: '',
        classId: '',
        faculty: '',
    });
    const [editing, setEditing] = useState(false);
    const [editError, setEditError] = useState('');
    const [editTargetId, setEditTargetId] = useState('');
    const [editForm, setEditForm] = useState({
        name: '',
        email: '',
        classId: '',
        faculty: '',
    });
    const [deletingId, setDeletingId] = useState('');

    // Import state
    const [csvText, setCsvText] = useState('');
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState('');
    const [importResult, setImportResult] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [facultyStructureNames, setFacultyStructureNames] = useState([]);

    const loadStudents = async () => {
        const response = await adminStudentService.getStudents();
        if (response.success) {
            setStudents(response.data || []);
        }
    };

    useEffect(() => {
        const boot = async () => {
            try {
                const [studentRes, classRes, stRes] = await Promise.all([
                    adminStudentService.getStudents(),
                    adminClassService.getClasses(),
                    adminAcademicService.getAcademicStructure(),
                ]);
                if (studentRes.success) setStudents(studentRes.data || []);
                if (classRes.success) {
                    setClasses(classRes.data || []);
                    if ((classRes.data || []).length > 0) {
                        setAddForm((prev) => ({
                            ...prev,
                            classId: prev.classId || classRes.data[0].code,
                            faculty: prev.faculty || classRes.data[0].faculty || '',
                        }));
                    }
                }
                if (stRes.success) {
                    const names = (stRes.data?.faculties || []).map((f) => f.name).filter(Boolean);
                    setFacultyStructureNames(names);
                }
            } catch (error) {
                console.error('Failed to fetch students/classes:', error);
            } finally {
                setLoading(false);
            }
        };
        boot();
    }, []);

    const handleGeneratePasscode = async (studentId) => {
        try {
            const response = await adminStudentService.generatePasscode(studentId);
            if (response.success) {
                setStudents((prev) => prev.map((s) => (
                    s.studentId === studentId ? { ...s, passcode: response.data.passcode } : s
                )));
            }
        } catch (error) {
            console.error('Failed to generate passcode:', error);
        }
    };

    const togglePasscode = (studentId) => {
        setRevealedPasscodes((prev) => ({
            ...prev,
            [studentId]: !prev[studentId],
        }));
    };

    const uniqueClasses = [...new Set(students.map((s) => s.classId).filter(Boolean))].sort();
    const uniqueFaculties = [...new Set(students.map((s) => s.academicInfo?.faculty).filter(Boolean))].sort();

    const facultyFilterOptions = useMemo(() => {
        const set = new Set(facultyStructureNames);
        uniqueFaculties.forEach((f) => set.add(f));
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [facultyStructureNames, uniqueFaculties]);

    const filteredStudents = students.filter((student) => {
        const matchesSearch =
            (student.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (student.studentId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (student.classId || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchesClass = classFilter ? student.classId === classFilter : true;
        const matchesFaculty = facultyFilter ? student.academicInfo?.faculty === facultyFilter : true;
        return matchesSearch && matchesClass && matchesFaculty;
    });

    const selectedClass = useMemo(
        () => classes.find((c) => c.code === addForm.classId),
        [classes, addForm.classId]
    );

    const submitAdd = async (e) => {
        e.preventDefault();
        setAddError('');
        if (!addForm.name.trim() || !addForm.email.trim() || !addForm.classId) {
            setAddError('Name, email, and class are required.');
            return;
        }
        setAdding(true);
        try {
            const generatedStudentId = `ST-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
            const generatedPasscode = Math.floor(100000 + Math.random() * 900000).toString();
            const payload = {
                studentId: generatedStudentId,
                name: addForm.name.trim(),
                email: addForm.email.trim(),
                password: generatedPasscode,
                passcode: generatedPasscode,
                classId: addForm.classId,
                academicInfo: {
                    faculty: addForm.faculty || selectedClass?.faculty || '',
                },
            };
            const res = await adminStudentService.registerStudent(payload);
            if (!res.success) throw new Error(res.message || 'Failed to add student');
            await loadStudents();
            setMode('list');
            setAddForm((prev) => ({ ...prev, name: '', email: '' }));
        } catch (err) {
            setAddError(err.response?.data?.message || err.message || 'Failed to add student.');
        } finally {
            setAdding(false);
        }
    };

    const startEdit = (student) => {
        setEditError('');
        setEditTargetId(student.studentId || '');
        setEditForm({
            name: student.name || '',
            email: student.email || '',
            classId: student.classId || '',
            faculty: student.academicInfo?.faculty || '',
        });
        setMode('edit');
    };

    const submitEdit = async (e) => {
        e.preventDefault();
        setEditError('');
        if (!editTargetId) {
            setEditError('Invalid student selected.');
            return;
        }
        if (!editForm.name.trim() || !editForm.email.trim() || !editForm.classId) {
            setEditError('Name, email, and class are required.');
            return;
        }
        setEditing(true);
        try {
            const payload = {
                name: editForm.name.trim(),
                email: editForm.email.trim(),
                classId: editForm.classId,
                academicInfo: {
                    faculty: editForm.faculty || classes.find((c) => c.code === editForm.classId)?.faculty || '',
                },
            };
            const res = await adminStudentService.updateStudent(editTargetId, payload);
            if (!res.success) throw new Error(res.message || 'Failed to update student');
            await loadStudents();
            setMode('list');
        } catch (err) {
            setEditError(err.response?.data?.message || err.message || 'Failed to update student.');
        } finally {
            setEditing(false);
        }
    };

    const handleDeleteStudent = async (studentId) => {
        const shouldDelete = window.confirm('Are you sure you want to delete this student?');
        if (!shouldDelete) return;
        setDeletingId(studentId);
        try {
            const res = await adminStudentService.deleteStudent(studentId);
            if (!res.success) throw new Error(res.message || 'Failed to delete student');
            await loadStudents();
        } catch (err) {
            window.alert(err.response?.data?.message || err.message || 'Failed to delete student.');
        } finally {
            setDeletingId('');
        }
    };

    const onCsvFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportError('');
        setImportResult(null);
        try {
            const text = await readSpreadsheetFileAsCsvText(file);
            setCsvText(text);
        } catch (err) {
            setCsvText('');
            setImportError(err.message || 'Could not read file. Use CSV or a valid Excel (.xlsx) file.');
        }
        e.target.value = '';
    };

    const submitImport = async () => {
        setImportError('');
        setImportResult(null);
        const rows = parseCsvToRecords(csvText).map(normalizeStudentImportRow);
        if (!rows.length) {
            setImportError('Add CSV with header and at least one row.');
            return;
        }
        setImporting(true);
        try {
            const res = await adminStudentService.importStudents(rows);
            if (!res.success) throw new Error(res.message || 'Import failed');
            setImportResult(res.data);
            await loadStudents();
        } catch (err) {
            setImportError(err.response?.data?.message || err.message || 'Import failed');
        } finally {
            setImporting(false);
        }
    };

    const submitExport = async () => {
        setExporting(true);
        try {
            const { blob, filename } = await adminStudentService.exportStudents('csv', {
                search: searchQuery,
                classId: classFilter,
                faculty: facultyFilter,
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Failed to export students';
            window.alert(message);
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] dark:bg-slate-900 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Loading students...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB] p-4 md:p-10 font-sans">
            <div className="max-w-[1600px] mx-auto">
            <div className="mb-6 md:mb-8">
                <h1 className="text-[18px] md:text-[20px] font-extrabold text-slate-800 tracking-tight">Manage Students</h1>
                <p className="text-[12px] text-slate-500 font-medium">Student directory and passcodes</p>
            </div>

            <div className="flex flex-col lg:flex-row items-center gap-3 border-b border-slate-100 px-5 py-4">
                <div className="relative w-full lg:w-[280px] shrink-0">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by name, ID or class..."
                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-[13px] focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400 outline-none font-medium text-slate-700"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                    <div className="relative w-[130px] shrink-0">
                        <select
                            value={classFilter}
                            onChange={(e) => setClassFilter(e.target.value)}
                            className="w-full appearance-none bg-white border border-slate-200 rounded-xl py-2.5 pl-3 pr-8 text-[12px] font-semibold text-slate-700"
                        >
                            <option value="">Classes</option>
                            {uniqueClasses.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative w-[160px] shrink-0">
                        <select
                            value={facultyFilter}
                            onChange={(e) => setFacultyFilter(e.target.value)}
                            className="w-full appearance-none bg-white border border-slate-200 rounded-xl py-2.5 pl-3 pr-8 text-[12px] font-semibold text-slate-700"
                        >
                            <option value="">Faculties</option>
                            {facultyFilterOptions.map((fac) => (
                                <option key={fac} value={fac}>
                                    {fac}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                <div className="flex items-center justify-end w-full gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={submitExport}
                        disabled={exporting}
                        className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl font-bold text-[12px] disabled:opacity-60"
                    >
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {exporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('add')}
                        className="flex items-center gap-1.5 bg-[#1D68E3] text-white px-3.5 py-2.5 rounded-xl font-bold text-[12px]"
                    >
                        <Plus className="h-4 w-4 stroke-[3px]" /> Add Student
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('import')}
                        className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl font-bold text-[12px]"
                    >
                        <Upload className="h-4 w-4" /> Import Students
                    </button>
                </div>
            </div>

            {mode === 'add' && (
                <section className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Add New Student</h2>
                        <button type="button" onClick={() => setMode('list')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800">
                            <ArrowLeft className="h-4 w-4" /> Back to list
                        </button>
                    </div>
                    <form onSubmit={submitAdd} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Full Name</label>
                            <input value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Email</label>
                            <input type="email" value={addForm.email} onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Class</label>
                            <select value={addForm.classId} onChange={(e) => setAddForm((p) => ({ ...p, classId: e.target.value, faculty: classes.find((c) => c.code === e.target.value)?.faculty || p.faculty }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900">
                                {(classes || []).map((c) => (
                                    <option key={c._id} value={c.code}>{c.code} {c.name ? `- ${c.name}` : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Faculty</label>
                            <select
                                value={addForm.faculty}
                                onChange={(e) => setAddForm((p) => ({ ...p, faculty: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                            >
                                <option value="">Select faculty</option>
                                {(() => {
                                    const set = new Set(facultyStructureNames);
                                    if (selectedClass?.faculty) set.add(selectedClass.faculty);
                                    if (addForm.faculty) set.add(addForm.faculty);
                                    return [...set].sort((a, b) => a.localeCompare(b));
                                })().map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {addError && (
                            <div className="md:col-span-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700">
                                {addError}
                            </div>
                        )}
                        <div className="md:col-span-2 flex justify-end">
                            <button disabled={adding} className="inline-flex items-center gap-2 rounded-xl bg-[#1D68E3] px-6 py-3 text-sm font-black text-white disabled:opacity-60">
                                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                {adding ? 'Saving...' : 'Save Student'}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {mode === 'edit' && (
                <section className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Update Student</h2>
                        <button type="button" onClick={() => setMode('list')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800">
                            <ArrowLeft className="h-4 w-4" /> Back to list
                        </button>
                    </div>
                    <form onSubmit={submitEdit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Full Name</label>
                            <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Email</label>
                            <input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Class</label>
                            <select value={editForm.classId} onChange={(e) => setEditForm((p) => ({ ...p, classId: e.target.value, faculty: classes.find((c) => c.code === e.target.value)?.faculty || p.faculty }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900">
                                {(classes || []).map((c) => (
                                    <option key={c._id} value={c.code}>{c.code} {c.name ? `- ${c.name}` : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Faculty</label>
                            <select
                                value={editForm.faculty}
                                onChange={(e) => setEditForm((p) => ({ ...p, faculty: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                            >
                                <option value="">Select faculty</option>
                                {(() => {
                                    const set = new Set(facultyStructureNames);
                                    const cls = classes.find((c) => c.code === editForm.classId);
                                    if (cls?.faculty) set.add(cls.faculty);
                                    if (editForm.faculty) set.add(editForm.faculty);
                                    return [...set].sort((a, b) => a.localeCompare(b));
                                })().map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {editError && (
                            <div className="md:col-span-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700">
                                {editError}
                            </div>
                        )}
                        <div className="md:col-span-2 flex justify-end">
                            <button disabled={editing} className="inline-flex items-center gap-2 rounded-xl bg-[#1D68E3] px-6 py-3 text-sm font-black text-white disabled:opacity-60">
                                {editing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                                {editing ? 'Updating...' : 'Update Student'}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {mode === 'import' && (
                <section className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Import Students</h2>
                        <button type="button" onClick={() => setMode('list')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800">
                            <ArrowLeft className="h-4 w-4" /> Back to list
                        </button>
                    </div>
                    <div className="space-y-4">
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            onChange={onCsvFile}
                            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:px-4 file:py-2 file:font-bold file:bg-blue-50 file:text-blue-700"
                        />
                        <textarea
                            value={csvText}
                            onChange={(e) => setCsvText(e.target.value)}
                            rows={10}
                            placeholder={`name,email,studentId,classCode,faculty\nDemo Student,demo@student.com,ST-2026-001,CA223_A,Computer Science\n\nOr upload .csv / .xlsx — Excel is parsed automatically.`}
                            className="w-full rounded-xl border border-slate-200 p-4 font-mono text-sm text-slate-900"
                        />
                        {importError && (
                            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700">
                                <AlertCircle className="h-4 w-4 mt-0.5" /> {importError}
                            </div>
                        )}
                        {importResult && (
                            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-800">
                                <CheckCircle2 className="h-4 w-4 mt-0.5" />
                                Created {importResult.created?.length || 0} / Failed {importResult.failed?.length || 0}
                            </div>
                        )}
                        <div className="flex justify-end">
                            <button onClick={submitImport} disabled={importing || !csvText.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#1D68E3] px-6 py-3 text-sm font-black text-white disabled:opacity-60">
                                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {importing ? 'Importing...' : 'Run Import'}
                            </button>
                        </div>
                    </div>
                </section>
            )}

            <div className="flex items-center gap-4 px-5 pt-3">
                <p className="text-[12px] font-semibold text-slate-500">
                    Showing <span className="text-slate-700 font-black">{filteredStudents.length}</span> of {students.length} students
                </p>
            </div>

            <div className="px-5 pb-5 pt-3">
            <div className="rounded-2xl border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left">
                    <thead>
                        <tr className="border-b border-slate-100 bg-white">
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">#</th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 text-center">Photo</th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Student Name</th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Student ID</th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Class</th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Faculty</th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 text-center">Passcode</th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/90">
                        {filteredStudents.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-12 text-[13px] text-slate-400 font-medium">No students match the selected filters.</td>
                            </tr>
                        ) : (
                            filteredStudents.map((student, index) => (
                                <tr key={student.studentId || index} className="group hover:bg-blue-50/30 transition-colors">
                                    <td className="px-5 py-3.5 text-[12px] font-bold text-slate-400">{index + 1}</td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex justify-center">
                                            <Link to={`/admin/students/${student.studentId || ''}`} state={{ from: location.pathname }}>
                                                <img src={student.photo || 'https://via.placeholder.com/150'} alt={student.name || 'Student'} className="h-10 w-10 rounded-full object-cover border border-white shadow-sm" />
                                            </Link>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <Link to={`/admin/students/${student.studentId || ''}`} state={{ from: location.pathname }} className="text-[13px] font-bold text-slate-800 hover:text-[#1D68E3]">
                                            {student.name || 'Unknown Student'}
                                        </Link>
                                    </td>
                                    <td className="px-5 py-3.5"><span className="text-[12px] font-bold text-slate-500 tracking-wide">{student.studentId || 'N/A'}</span></td>
                                    <td className="px-5 py-3.5">
                                        {student.classId || student.classCode ? (
                                            <Link
                                                to={`/admin/classes/${encodeURIComponent(student.classId || student.classCode)}`}
                                                className="text-[12px] font-bold text-[#1D68E3] hover:underline"
                                            >
                                                {student.classId || student.classCode}
                                            </Link>
                                        ) : (
                                            <span className="text-[12px] font-semibold text-slate-400">No class</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5"><span className="text-[12px] font-semibold text-slate-600">{student.academicInfo?.faculty || 'N/A'}</span></td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex flex-col items-center gap-1.5">
                                            {student.passcode ? (
                                                <button
                                                    type="button"
                                                    onClick={() => togglePasscode(student.studentId)}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 transition-colors"
                                                    title={revealedPasscodes[student.studentId] ? 'Hide passcode' : 'Show passcode'}
                                                >
                                                    <span className="text-[14px] font-black text-slate-700 dark:text-slate-300 font-mono tracking-wider">
                                                        {revealedPasscodes[student.studentId] ? student.passcode : '••••••'}
                                                    </span>
                                                    {revealedPasscodes[student.studentId] ? (
                                                        <EyeOff className="h-4 w-4 text-slate-500" />
                                                    ) : (
                                                        <Eye className="h-4 w-4 text-slate-500" />
                                                    )}
                                                </button>
                                            ) : (
                                                <button onClick={() => handleGeneratePasscode(student.studentId)} className="flex items-center gap-1.5 text-[#1D68E3] bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-[10px] text-[12px] font-bold">
                                                    <Plus className="h-3.5 w-3.5 stroke-[3px]" /> Generate
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => startEdit(student)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                                            >
                                                <Pencil className="h-3.5 w-3.5" /> Update
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteStudent(student.studentId)}
                                                disabled={deletingId === student.studentId}
                                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-60"
                                            >
                                                {deletingId === student.studentId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </div>
            </div>
            </div>
            </div>
        </div>
    );
};

export default AdminStudents;
