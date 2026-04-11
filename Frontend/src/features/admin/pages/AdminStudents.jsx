import React, { useEffect, useMemo, useState } from 'react';
import {
    Search,
    Plus,
    ChevronDown,
    Loader2,
    Upload,
    ArrowLeft,
    AlertCircle,
    CheckCircle2,
    Eye,
    EyeOff
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import adminStudentService from '../../../services/adminStudentService';
import adminClassService from '../../../services/adminClassService';

function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^\ufeff/, ''));
    return lines.slice(1).map((line) => {
        const cells = line.split(',').map((c) => c.trim());
        const row = {};
        headers.forEach((h, i) => {
            row[h] = cells[i] ?? '';
        });
        return row;
    });
}

function normalizeImportRow(raw) {
    return {
        name: raw.name || '',
        email: raw.email || '',
        studentId: raw.studentid || raw.student_id || raw.id || '',
        password: raw.password || '',
        passcode: raw.passcode || '',
        classCode: raw.classcode || raw.class || '',
        classId: raw.classid || '',
        faculty: raw.faculty || '',
        program: raw.program || '',
        score: raw.score || raw.currentscore || '',
        gpa: raw.gpa || raw.currentgpa || '',
    };
}

const AdminStudents = () => {
    const location = useLocation();
    const [mode, setMode] = useState('list'); // list | add | import
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

    // Import state
    const [csvText, setCsvText] = useState('');
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState('');
    const [importResult, setImportResult] = useState(null);

    const loadStudents = async () => {
        const response = await adminStudentService.getStudents();
        if (response.success) {
            setStudents(response.data || []);
        }
    };

    useEffect(() => {
        const boot = async () => {
            try {
                const [studentRes, classRes] = await Promise.all([
                    adminStudentService.getStudents(),
                    adminClassService.getClasses(),
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

    const onCsvFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setCsvText(String(reader.result || ''));
            setImportResult(null);
            setImportError('');
        };
        reader.readAsText(file);
    };

    const submitImport = async () => {
        setImportError('');
        setImportResult(null);
        const rows = parseCsv(csvText).map(normalizeImportRow);
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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] dark:bg-slate-900 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Loading students...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB] dark:bg-[#0F172A]/30 p-4 md:p-10 font-sans transition-colors">
            <div className="flex flex-col lg:flex-row items-center gap-4 mb-6 md:mb-8">
                <div className="relative w-full lg:w-[320px] shrink-0">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search by name, ID or class..."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-[16px] py-3 pl-14 pr-6 text-[14px] focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none font-medium text-slate-700 dark:text-slate-200 shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                    <div className="relative w-[140px] shrink-0">
                        <select
                            value={classFilter}
                            onChange={(e) => setClassFilter(e.target.value)}
                            className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[16px] py-3 pl-5 pr-10 text-[14px] font-semibold text-slate-700 dark:text-slate-200"
                        >
                            <option value="">Classes</option>
                            {uniqueClasses.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative w-[180px] shrink-0">
                        <select
                            value={facultyFilter}
                            onChange={(e) => setFacultyFilter(e.target.value)}
                            className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[16px] py-3 pl-5 pr-10 text-[14px] font-semibold text-slate-700 dark:text-slate-200"
                        >
                            <option value="">Faculties</option>
                            {uniqueFaculties.map((fac) => <option key={fac} value={fac}>{fac}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                <div className="flex items-center justify-end w-full gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => setMode('add')}
                        className="flex items-center gap-2 bg-[#1D68E3] text-white px-5 py-3 rounded-[16px] font-bold text-[14px]"
                    >
                        <Plus className="h-4 w-4 stroke-[3px]" /> Add Student
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('import')}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-[16px] font-bold text-[14px]"
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
                            <input value={addForm.faculty} onChange={(e) => setAddForm((p) => ({ ...p, faculty: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
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

            {mode === 'import' && (
                <section className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Import Students</h2>
                        <button type="button" onClick={() => setMode('list')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800">
                            <ArrowLeft className="h-4 w-4" /> Back to list
                        </button>
                    </div>
                    <div className="space-y-4">
                        <input type="file" accept=".csv,text/csv" onChange={onCsvFile} className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:px-4 file:py-2 file:font-bold file:bg-blue-50 file:text-blue-700" />
                        <textarea
                            value={csvText}
                            onChange={(e) => setCsvText(e.target.value)}
                            rows={10}
                            placeholder={`name,email,studentId,classCode,faculty\nDemo Student,demo@student.com,ST-2026-001,CA223_A,Computer Science`}
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

            <div className="flex items-center gap-4 mb-4">
                <p className="text-[13px] font-semibold text-slate-400 dark:text-slate-500">
                    Showing <span className="text-slate-700 dark:text-slate-300 font-black">{filteredStudents.length}</span> of {students.length} students
                </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden mb-10">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-50 dark:border-slate-800 uppercase tracking-[0.1em] text-[11px] font-black text-slate-400 dark:text-slate-500">
                            <th className="px-10 py-6">#</th>
                            <th className="px-6 py-6 text-center">PHOTO</th>
                            <th className="px-6 py-6">STUDENT NAME</th>
                            <th className="px-6 py-6">STUDENT ID</th>
                            <th className="px-6 py-6">CLASS</th>
                            <th className="px-6 py-6">FACULTY</th>
                            <th className="px-6 py-6 text-center">PASSCODE</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {filteredStudents.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-16 text-slate-400 font-medium">No students match the selected filters.</td>
                            </tr>
                        ) : (
                            filteredStudents.map((student, index) => (
                                <tr key={student.studentId || index} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-10 py-7 text-[14px] font-bold text-slate-300 dark:text-slate-600">{index + 1}</td>
                                    <td className="px-6 py-7">
                                        <div className="flex justify-center">
                                            <Link to={`/admin/students/${student.studentId || ''}`} state={{ from: location.pathname }}>
                                                <img src={student.photo || 'https://via.placeholder.com/150'} alt={student.name || 'Student'} className="h-12 w-12 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-md" />
                                            </Link>
                                        </div>
                                    </td>
                                    <td className="px-6 py-7">
                                        <Link to={`/admin/students/${student.studentId || ''}`} state={{ from: location.pathname }} className="text-[16px] font-bold text-[#0F172A] dark:text-slate-200 hover:text-[#1D68E3]">
                                            {student.name || 'Unknown Student'}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-7"><span className="text-[14px] font-bold text-slate-400 tracking-wide">{student.studentId || 'N/A'}</span></td>
                                    <td className="px-6 py-7">
                                        <Link to={`/admin/classes/${student.classId}`} className="text-[14px] font-bold text-[#1D68E3] hover:underline">{student.classId}</Link>
                                    </td>
                                    <td className="px-6 py-7"><span className="text-[14px] font-bold text-slate-500">{student.academicInfo?.faculty || 'N/A'}</span></td>
                                    <td className="px-6 py-7">
                                        <div className="flex flex-col items-center gap-1.5">
                                            {student.passcode ? (
                                                <button
                                                    type="button"
                                                    onClick={() => togglePasscode(student.studentId)}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 hover:bg-slate-100 transition-colors"
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
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminStudents;
