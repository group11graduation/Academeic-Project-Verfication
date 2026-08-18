import React, { useState } from 'react';
import { ArrowLeft, Upload, Loader2, CheckCircle2, AlertCircle, Copy, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import adminStudentService from '../../../services/adminStudentService';
import {
    readSpreadsheetFileAsCsvText,
    normalizeStudentImportRow,
    parseStudentCsvToRecords,
    validateStudentImportRows,
    downloadStudentImportTemplate,
    STUDENT_IMPORT_TEMPLATE_HEADERS,
} from '../../../lib/spreadsheetImport';
import { appError, appWarning } from '../../../lib/appDialog';

const AdminStudentImport = () => {
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
        const rows = parseStudentCsvToRecords(text).map(normalizeStudentImportRow);
        if (!rows.length) {
            setError('Add a CSV with a header row and at least one data row (name, email, studentId required).');
            return;
        }
        const validationError = validateStudentImportRows(rows);
        if (validationError) {
            await appWarning(validationError);
            return;
        }
        setSubmitting(true);
        try {
            const res = await adminStudentService.importStudents(rows);
            if (res.success) {
                setResult(res.data);
            } else {
                setError(res.message || 'Import failed');
            }
        } catch (err) {
            setError(err.userMessage || err.response?.data?.message || err.message || 'Import failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="w-full font-sans text-[13px]">
            <button
                type="button"
                onClick={() => navigate('/admin/students')}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-3"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to students
            </button>

            <h1 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight mb-1">Import students</h1>
            <p className="text-[11px] text-[var(--text-secondary)] mb-4 leading-relaxed">
                Download the Excel template, fill in your students, then upload the file (or paste CSV). Required columns:{' '}
                <code className="text-[10px] bg-slate-200/80 px-1 py-0.5 rounded">name, email, studentId</code>. Full
                template headers:{' '}
                <code className="text-[10px] bg-slate-200/80 px-1 py-0.5 rounded">
                    {STUDENT_IMPORT_TEMPLATE_HEADERS.join(', ')}
                </code>
                . If <code className="text-[10px]">classCode</code> is not in the system yet, it is created
                automatically and the student is assigned to it. Optional faculty/department are attached to the
                new class and Academic Structure. Dates: YYYY-MM-DD or DD/MM/YYYY.
            </p>

            <div className="rounded-xl bg-[var(--bg-card)] shadow-sm ring-1 ring-[var(--border)]/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            try {
                                downloadStudentImportTemplate();
                            } catch (err) {
                                setError(err.message || 'Could not download template.');
                            }
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-[12px] font-bold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Download Excel template
                    </button>
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] mb-1">CSV or Excel file</label>
                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls,text/csv"
                        onChange={onFile}
                        className="block w-full text-[12px] text-[var(--text-secondary)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:bg-blue-50 file:text-blue-700"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] mb-1">Or paste CSV</label>
                    <textarea
                        value={text}
                        onChange={(e) => {
                            setText(e.target.value);
                            setResult(null);
                            setError('');
                        }}
                        rows={10}
                        placeholder={`name,email,studentId
Jane Doe,jane@school.edu,S-1001
John Smith,john@school.edu,S-1002`}
                        className="w-full rounded-lg border border-[var(--border)] p-3 text-[12px] font-mono text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/30"
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
                        {(result.classes?.classesAdded > 0 ||
                            result.structure?.facultiesAdded > 0 ||
                            result.structure?.departmentsAdded > 0) && (
                            <p className="text-[12px] font-semibold text-emerald-800 mb-2">
                                {result.classes?.classesAdded > 0 && (
                                    <>
                                        {result.classes.classesAdded} class
                                        {result.classes.classesAdded === 1 ? '' : 'es'} created
                                        {result.classes.codes?.length
                                            ? ` (${result.classes.codes.join(', ')})`
                                            : ''}
                                        .
                                    </>
                                )}{' '}
                                {(result.structure?.facultiesAdded > 0 ||
                                    result.structure?.departmentsAdded > 0) && (
                                    <>
                                        {result.structure.facultiesAdded || 0} faculty /{' '}
                                        {result.structure.departmentsAdded || 0} department
                                        {(result.structure.departmentsAdded || 0) === 1 ? '' : 's'} added to
                                        Academic Structure.
                                    </>
                                )}
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
                                {result.failed.length > 15 && <li>…and {result.failed.length - 15} more</li>}
                            </ul>
                        )}
                        {result.created?.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-emerald-200/80">
                                <p className="text-[12px] font-bold uppercase tracking-wide text-emerald-800 mb-2">
                                    Login passcodes (copy and share with each student)
                                </p>
                                <div className="max-h-56 overflow-y-auto rounded-lg border border-emerald-100 bg-[var(--bg-card)] divide-y divide-emerald-100">
                                    {result.created.map((c, i) => (
                                        <div
                                            key={`${c._id ?? c.email ?? i}`}
                                            className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]"
                                        >
                                            <span className="font-semibold text-[var(--text-primary)] truncate max-w-[200px]" title={c.email}>
                                                {c.email}
                                            </span>
                                            <code className="rounded bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[var(--text-primary)]">
                                                {c.loginPasscode ?? '-'}
                                            </code>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const t = String(c.loginPasscode ?? '');
                                                    if (t) navigator.clipboard.writeText(t);
                                                }}
                                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[12px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                                                title="Copy passcode"
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
                    <button
                        type="button"
                        onClick={() => navigate('/admin/students')}
                        className="rounded-lg border border-[var(--border)] px-4 py-2 text-[12px] font-bold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminStudentImport;
