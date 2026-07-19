import React, { useState } from 'react';
import { ArrowLeft, Upload, Loader2, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import adminTeacherService from '../../../services/adminTeacherService';
import {
    readSpreadsheetFileAsCsvText,
    normalizeTeacherImportRow,
    parseCsvToRecords,
} from '../../../lib/spreadsheetImport';

const AdminTeacherImport = () => {
    const navigate = useNavigate();
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const onFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError('');
        setResult(null);
        try {
            const csv = await readSpreadsheetFileAsCsvText(file);
            setText(csv);
        } catch (err) {
            setText('');
            setError(err.message || 'Could not read file. Use CSV or Excel (.xlsx).');
        }
        e.target.value = '';
    };

    const handleSubmit = async () => {
        setError('');
        setResult(null);
        const rows = parseCsvToRecords(text).map((raw) => {
            const n = normalizeTeacherImportRow(raw);
            return {
                name: n.name,
                email: n.email,
                teacherId: n.teacherId || n.employeeId,
                employeeId: n.employeeId || n.teacherId,
                password: n.password,
                passcode: n.passcode,
                faculty: n.faculty,
                department: n.department,
                phone: n.phone,
                skills: n.skills,
            };
        });
        if (!rows.length) {
            setError('Add a CSV/Excel with a header row and at least one data row (name, email required).');
            return;
        }
        setSubmitting(true);
        try {
            const res = await adminTeacherService.importTeachers(rows);
            if (res.success) {
                setResult(res.data);
            } else {
                setError(res.message || 'Import failed');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Import failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="w-full font-sans text-[13px]">
            <button
                type="button"
                onClick={() => navigate('/admin/teachers')}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-600 hover:text-slate-900 mb-3"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to teachers
            </button>

            <h1 className="text-base font-extrabold text-slate-900 tracking-tight mb-1">Import teachers</h1>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                Upload CSV/Excel or paste rows below. Columns:{' '}
                <code className="text-[10px] bg-slate-200/80 px-1 py-0.5 rounded">
                    name, email, teacherId, faculty, department, phone, skills
                </code>
                . Missing faculties and departments are added automatically to Academic Structure.
                If <code className="text-[10px]">teacherId</code> or <code className="text-[10px]">password</code> are omitted,
                the system auto-generates them.
            </p>

            <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60 p-4 space-y-3">
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">CSV or Excel file</label>
                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls,text/csv"
                        onChange={onFile}
                        className="block w-full text-[12px] text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:bg-blue-50 file:text-blue-700"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Or paste CSV</label>
                    <textarea
                        value={text}
                        onChange={(e) => {
                            setText(e.target.value);
                            setResult(null);
                            setError('');
                        }}
                        rows={10}
                        placeholder={`name,email,teacherId,faculty,department,phone,skills
Dr. Amina Cali,amina@academy.edu,TC-2026-0002,Business Administration,Accounting,+252611000002,Accounting|Finance`}
                        className="w-full rounded-lg border border-slate-200 p-3 text-[12px] font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                </div>

                {error && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-50 text-red-800 px-3 py-2 text-[12px] font-semibold">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}

                {result && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-[12px] text-emerald-900">
                        <div className="flex items-center gap-2 font-bold mb-2">
                            <CheckCircle2 className="h-5 w-5" />
                            Import finished: {result.created?.length ?? 0} created, {result.failed?.length ?? 0} failed (of{' '}
                            {result.total ?? 0} rows)
                        </div>
                        {(result.structure?.facultiesAdded > 0 || result.structure?.departmentsAdded > 0) && (
                            <p className="mb-2 text-[11px] font-semibold text-emerald-800">
                                Academic structure updated: {result.structure.facultiesAdded || 0} facult
                                {(result.structure.facultiesAdded || 0) === 1 ? 'y' : 'ies'},{' '}
                                {result.structure.departmentsAdded || 0} department
                                {(result.structure.departmentsAdded || 0) === 1 ? '' : 's'} added.
                            </p>
                        )}
                        {result.failed?.length > 0 && (
                            <ul className="list-disc pl-5 mt-2 space-y-1 text-[13px] font-medium text-red-800">
                                {result.failed.slice(0, 15).map((f, i) => (
                                    <li key={i}>
                                        Row {f.index + 1}: {f.message}
                                        {f.email ? ` (${f.email})` : ''}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {result.created?.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-emerald-200/80">
                                <p className="text-[12px] font-bold uppercase tracking-wide text-emerald-800 mb-2">
                                    Login passcodes (copy and share with each teacher)
                                </p>
                                <div className="max-h-56 overflow-y-auto rounded-lg border border-emerald-100 bg-white/80 divide-y divide-emerald-100">
                                    {result.created.map((c, i) => (
                                        <div key={`${c._id ?? c.email ?? i}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
                                            <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={c.email}>
                                                {c.email}
                                            </span>
                                            <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-900">
                                                {c.loginPasscode ?? '—'}
                                            </code>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const t = String(c.loginPasscode ?? '');
                                                    if (t) navigator.clipboard.writeText(t);
                                                }}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                                Copy
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || !text.trim()}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-[12px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {submitting ? 'Importing…' : 'Run import'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminTeacherImport;
