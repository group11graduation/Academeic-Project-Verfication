import React, { useEffect, useMemo, useRef, useState } from 'react';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';
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
    EyeOff,
    Copy,
    Check,
    User,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import adminStudentService from '../../../services/adminStudentService';
import adminClassService from '../../../services/adminClassService';
import { adminAcademicService } from '../../../services/adminAcademicService';
import { resolveUploadUrl } from '../../../services/adminTeacherService';
import {
    readSpreadsheetFileAsCsvText,
    normalizeStudentImportRow,
    parseStudentCsvToRecords,
    validateStudentImportRows,
} from '../../../lib/spreadsheetImport';
import { usePageSearch } from '../../../context/shellSearchContext';
import { copyTextToClipboard } from '../../../shared/utils/clipboard';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';

const AdminStudents = () => {
    const location = useLocation();
    const [mode, setMode] = useState('list'); // list | add | import | edit
    const { query: searchQuery, setQuery: setSearchQuery } = usePageSearch('Search students…');
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
        photo: '',
    });
    const [editing, setEditing] = useState(false);
    const [editError, setEditError] = useState('');
    const [editTargetId, setEditTargetId] = useState('');
    const [editForm, setEditForm] = useState({
        name: '',
        email: '',
        classId: '',
        faculty: '',
        photo: '',
    });
    const [uploadingAddPhoto, setUploadingAddPhoto] = useState(false);
    const [uploadingEditPhoto, setUploadingEditPhoto] = useState(false);
    const addPhotoInputRef = useRef(null);
    const editPhotoInputRef = useRef(null);
    const [deletingId, setDeletingId] = useState('');

    // Import state
    const [csvText, setCsvText] = useState('');
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState('');
    const [importResult, setImportResult] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [facultyStructureNames, setFacultyStructureNames] = useState([]);
    const [copiedStudentId, setCopiedStudentId] = useState('');

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

    const handleCopyPasscode = async (studentId, passcode) => {
        if (!passcode) return;
        try {
            await copyTextToClipboard(passcode);
            setCopiedStudentId(studentId);
            window.setTimeout(() => {
                setCopiedStudentId((current) => (current === studentId ? '' : current));
            }, 2000);
        } catch (error) {
            console.error('Failed to copy passcode:', error);
            await appError('Failed to copy passcode.');
        }
    };

    const handlePhotoUpload = async (file, mode) => {
        if (!file) return;
        const setUploading = mode === 'add' ? setUploadingAddPhoto : setUploadingEditPhoto;
        const setForm = mode === 'add' ? setAddForm : setEditForm;
        const inputRef = mode === 'add' ? addPhotoInputRef : editPhotoInputRef;

        setUploading(true);
        try {
            const imageUrl = await adminStudentService.uploadProfileImage(file);
            setForm((prev) => ({ ...prev, photo: resolveUploadUrl(imageUrl) }));
        } catch (error) {
            console.error('Failed to upload photo:', error);
            await appWarning('Failed to upload image. Please try again.');
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const renderPhotoField = ({ form, mode, uploading }) => (
        <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Profile Image</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="h-14 w-14 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                    {uploading ? (
                        <Loader2 className="h-5 w-5 text-[#1D68E3] animate-spin" />
                    ) : form.photo ? (
                        <img src={form.photo} alt="Student" className="h-full w-full object-cover" />
                    ) : (
                        <User className="h-6 w-6 text-slate-400" />
                    )}
                </div>
                <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={mode === 'add' ? addPhotoInputRef : editPhotoInputRef}
                            onChange={(e) => handlePhotoUpload(e.target.files?.[0], mode)}
                        />
                        <button
                            type="button"
                            onClick={() => (mode === 'add' ? addPhotoInputRef : editPhotoInputRef).current?.click()}
                            disabled={uploading}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[12px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                        >
                            <Upload className="h-3.5 w-3.5" />
                            {uploading ? 'Uploading...' : 'Upload Image'}
                        </button>
                        <span className="text-[11px] font-medium text-slate-400">or paste image URL</span>
                    </div>
                    <input
                        type="text"
                        value={form.photo}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (mode === 'add') setAddForm((p) => ({ ...p, photo: value }));
                            else setEditForm((p) => ({ ...p, photo: value }));
                        }}
                        placeholder="https://example.com/photo.jpg"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100"
                    />
                </div>
            </div>
        </div>
    );

    const uniqueClasses = [...new Set(students.map((s) => s.classId).filter(Boolean))].sort();
    const uniqueFaculties = [...new Set(students.map((s) => s.academicInfo?.faculty).filter(Boolean))].sort();

    const facultyFilterOptions = useMemo(() => {
        const set = new Set(facultyStructureNames);
        uniqueFaculties.forEach((f) => set.add(f));
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [facultyStructureNames, uniqueFaculties]);

    const filteredStudents = students.filter((student) => {
        const matchesSearch = matchesSearchQuery(
            searchQuery,
            student.name,
            student.studentId,
            student.classId,
            student.email
        );

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
                photo: addForm.photo || undefined,
            };
            const res = await adminStudentService.registerStudent(payload);
            if (!res.success) throw new Error(res.message || 'Failed to add student');
            await loadStudents();
            setMode('list');
            setAddForm((prev) => ({ ...prev, name: '', email: '', photo: '' }));
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
            photo: student.photo || '',
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
                photo: editForm.photo || undefined,
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
        const shouldDelete = await appConfirm({
            message: 'Are you sure you want to delete this student?',
            danger: true,
            confirmLabel: 'Delete',
        });
        if (!shouldDelete) return;
        setDeletingId(studentId);
        try {
            const res = await adminStudentService.deleteStudent(studentId);
            if (!res.success) throw new Error(res.message || 'Failed to delete student');
            await loadStudents();
        } catch (err) {
            await appError(err.response?.data?.message || err.message || 'Failed to delete student.');
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
        const rows = parseStudentCsvToRecords(csvText).map(normalizeStudentImportRow);
        if (!rows.length) {
            setImportError('Add CSV with header and at least one row (name, email, studentId required).');
            return;
        }
        const validationError = validateStudentImportRows(rows);
        if (validationError) {
            await appWarning(validationError);
            return;
        }
        setImporting(true);
        try {
            const res = await adminStudentService.importStudents(rows);
            if (!res.success) throw new Error(res.message || 'Import failed');
            setImportResult(res.data);
            await loadStudents();
        } catch (err) {
            setImportError(err.userMessage || err.response?.data?.message || err.message || 'Import failed');
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
            await appError(message);
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[40vh] flex flex-col items-center justify-center">
                <Loader2 className="h-7 w-7 text-[#1D68E3] animate-spin mb-2" />
                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Loading students...</p>
            </div>
        );
    }

    return (
        <div className="font-sans text-[13px] transition-colors min-w-0 max-w-full">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-3 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none">Students</h1>
                        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Directory</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={submitExport}
                            disabled={exporting}
                            className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg font-bold text-[12px] disabled:opacity-60 whitespace-nowrap"
                        >
                            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            {exporting ? 'Exporting...' : 'Export CSV'}
                        </button>
                        <Link
                            to="/admin/students/new"
                            className="inline-flex items-center gap-1.5 bg-[#1D68E3] text-white px-3 py-1.5 rounded-lg font-bold text-[12px] whitespace-nowrap"
                        >
                            <Plus className="h-3.5 w-3.5 stroke-[3px]" /> Add Student
                        </Link>
                        <button
                            type="button"
                            onClick={() => setMode('import')}
                            className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg font-bold text-[12px] whitespace-nowrap"
                        >
                            <Upload className="h-3.5 w-3.5" /> Import Students
                        </button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
                    <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, ID or class..."
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-3 text-[12px] focus:ring-2 focus:ring-blue-500/10 outline-none font-medium text-slate-700 dark:text-slate-200"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="relative w-full sm:w-[130px] shrink-0">
                        <select
                            value={classFilter}
                            onChange={(e) => setClassFilter(e.target.value)}
                            className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-3 pr-8 text-[12px] font-semibold text-slate-700 dark:text-slate-200"
                        >
                            <option value="">Classes</option>
                            {uniqueClasses.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative w-full sm:w-[160px] shrink-0">
                        <select
                            value={facultyFilter}
                            onChange={(e) => setFacultyFilter(e.target.value)}
                            className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-3 pr-8 text-[12px] font-semibold text-slate-700 dark:text-slate-200"
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
            </div>

            {mode === 'add' && (
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-black text-slate-900 dark:text-slate-100">Add New Student</h2>
                        <button type="button" onClick={() => setMode('list')} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-500 hover:text-slate-800">
                            <ArrowLeft className="h-3.5 w-3.5" /> Back to list
                        </button>
                    </div>
                    <form onSubmit={submitAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Full Name</label>
                            <input value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100" />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Email</label>
                            <input type="email" value={addForm.email} onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100" />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Class</label>
                            <select value={addForm.classId} onChange={(e) => setAddForm((p) => ({ ...p, classId: e.target.value, faculty: classes.find((c) => c.code === e.target.value)?.faculty || p.faculty }))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100">
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
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100"
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
                        {renderPhotoField({ form: addForm, mode: 'add', uploading: uploadingAddPhoto })}
                        {addError && (
                            <div className="md:col-span-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700">
                                {addError}
                            </div>
                        )}
                        <div className="md:col-span-2 flex justify-end">
                            <button disabled={adding} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D68E3] px-4 py-2 text-[12px] font-black text-white disabled:opacity-60">
                                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                {adding ? 'Saving...' : 'Save Student'}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {mode === 'edit' && (
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-black text-slate-900 dark:text-slate-100">Update Student</h2>
                        <button type="button" onClick={() => setMode('list')} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-500 hover:text-slate-800">
                            <ArrowLeft className="h-3.5 w-3.5" /> Back to list
                        </button>
                    </div>
                    <form onSubmit={submitEdit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Full Name</label>
                            <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100" />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Email</label>
                            <input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100" />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Class</label>
                            <select value={editForm.classId} onChange={(e) => setEditForm((p) => ({ ...p, classId: e.target.value, faculty: classes.find((c) => c.code === e.target.value)?.faculty || p.faculty }))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100">
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
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100"
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
                        {renderPhotoField({ form: editForm, mode: 'edit', uploading: uploadingEditPhoto })}
                        {editError && (
                            <div className="md:col-span-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700">
                                {editError}
                            </div>
                        )}
                        <div className="md:col-span-2 flex justify-end">
                            <button disabled={editing} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D68E3] px-4 py-2 text-[12px] font-black text-white disabled:opacity-60">
                                {editing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                                {editing ? 'Updating...' : 'Update Student'}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {mode === 'import' && (
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-black text-slate-900 dark:text-slate-100">Import Students</h2>
                        <button type="button" onClick={() => setMode('list')} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-500 hover:text-slate-800">
                            <ArrowLeft className="h-3.5 w-3.5" /> Back to list
                        </button>
                    </div>
                    <div className="space-y-3">
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            onChange={onCsvFile}
                            className="block w-full text-[12px] text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:font-bold file:bg-blue-50 file:text-blue-700"
                        />
                        <textarea
                            value={csvText}
                            onChange={(e) => setCsvText(e.target.value)}
                            rows={8}
                            placeholder={`name,email,studentId,classCode,faculty,phone,dob,gender,highSchoolName,graduationYear\nDemo Student,demo@student.com,ST-2026-001,CA229,Engineering,+252610000000,2003-05-25,Male,Jabir School,2022\n\nOr upload .csv / .xlsx — Excel is parsed automatically.`}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 p-3 font-mono text-[12px] text-slate-900 dark:text-slate-100"
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
                            <button onClick={submitImport} disabled={importing || !csvText.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D68E3] px-4 py-2 text-[12px] font-black text-white disabled:opacity-60">
                                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                {importing ? 'Importing...' : 'Run Import'}
                            </button>
                        </div>
                    </div>
                </section>
            )}

            <div className="flex items-center gap-3 pt-2 mb-2">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Showing <span className="font-black text-slate-700 dark:text-slate-200">{filteredStudents.length}</span> of {students.length} students
                </p>
            </div>

            <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden min-w-0">
                <div className="overflow-x-auto max-w-full">
                <table className="w-full min-w-[720px] text-left">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">#</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 text-center">Photo</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Student Name</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Student ID</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Class</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Faculty</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 text-center">Passcode</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/90">
                        {filteredStudents.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-[12px] text-slate-400 font-medium">No students match the selected filters.</td>
                            </tr>
                        ) : (
                            filteredStudents.map((student, index) => (
                                <tr key={student.studentId || index} className="group hover:bg-blue-50/30 transition-colors">
                                    <td className="px-3 py-2 text-[12px] font-bold text-slate-400">{index + 1}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex justify-center">
                                            <Link to={`/admin/students/${student.studentId || ''}`} state={{ from: location.pathname }}>
                                                <img src={student.photo || 'https://via.placeholder.com/150'} alt={student.name || 'Student'} className="h-8 w-8 rounded-full object-cover border border-white shadow-sm" />
                                            </Link>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <Link to={`/admin/students/${student.studentId || ''}`} state={{ from: location.pathname }} className="text-[12px] font-bold text-slate-800 hover:text-[#1D68E3]">
                                            {student.name || 'Unknown Student'}
                                        </Link>
                                    </td>
                                    <td className="px-3 py-2"><span className="text-[12px] font-bold tracking-wide text-slate-500 dark:text-slate-400">{student.studentId || 'N/A'}</span></td>
                                    <td className="px-3 py-2">
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
                                    <td className="px-3 py-2"><span className="text-[12px] font-semibold text-slate-600">{student.academicInfo?.faculty || 'N/A'}</span></td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-col items-center gap-1.5">
                                            {student.passcode ? (
                                                <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                                                    <span className="font-mono text-[12px] font-black tracking-wider text-slate-700 dark:text-slate-300">
                                                        {revealedPasscodes[student.studentId] ? student.passcode : '••••••'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyPasscode(student.studentId, student.passcode)}
                                                        className="text-slate-500 transition-colors hover:text-[#1D68E3] dark:text-slate-400 dark:hover:text-blue-300"
                                                        title="Copy passcode"
                                                    >
                                                        {copiedStudentId === student.studentId ? (
                                                            <Check className="h-4 w-4 text-emerald-500" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => togglePasscode(student.studentId)}
                                                        className="text-slate-500 transition-colors hover:text-[#1D68E3] dark:text-slate-400 dark:hover:text-blue-300"
                                                        title={revealedPasscodes[student.studentId] ? 'Hide passcode' : 'Show passcode'}
                                                    >
                                                        {revealedPasscodes[student.studentId] ? (
                                                            <EyeOff className="h-4 w-4" />
                                                        ) : (
                                                            <Eye className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => handleGeneratePasscode(student.studentId)} className="flex items-center gap-1.5 text-[#1D68E3] bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-[10px] text-[12px] font-bold">
                                                    <Plus className="h-3.5 w-3.5 stroke-[3px]" /> Generate
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => startEdit(student)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
    );
};

export default AdminStudents;
