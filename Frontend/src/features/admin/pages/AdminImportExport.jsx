import React, { useState } from 'react';
import { FileSpreadsheet, Upload, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import adminStudentService from '../../../services/adminStudentService';
import adminTeacherService from '../../../services/adminTeacherService';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';

const AdminImportExport = () => {
    const navigate = useNavigate();
    const [exportingKey, setExportingKey] = useState('');

    const downloadBlob = ({ blob, filename }) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const handleExportStudents = async (format = 'csv') => {
        setExportingKey(`students-${format}`);
        try {
            const file = await adminStudentService.exportStudents(format);
            downloadBlob(file);
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Failed to export students';
            await appError(message);
        } finally {
            setExportingKey('');
        }
    };

    const handleExportTeachers = async (format = 'csv') => {
        setExportingKey(`teachers-${format}`);
        try {
            const file = await adminTeacherService.exportTeachers(format);
            downloadBlob(file);
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Failed to export teachers';
            await appError(message);
        } finally {
            setExportingKey('');
        }
    };

    const btnPrimary = 'px-3 py-1.5 rounded-lg bg-[#1D68E3] text-white font-bold text-[11px] hover:bg-blue-700 disabled:opacity-60';
    const btnDark = 'px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-[11px] disabled:opacity-60';

    return (
        <div className="font-sans text-[13px]">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#1D68E3]">
                    <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                    <h1 className="text-base font-extrabold text-[#0F172A] dark:text-white leading-none">Import & Export</h1>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Teachers and students bulk import/export (CSV or Excel).
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center">
                    <Upload className="h-7 w-7 text-slate-400 mx-auto mb-2" />
                    <h2 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 mb-1">Import students</h2>
                    <p className="text-[11px] text-slate-500 mb-3 leading-snug">
                        Upload CSV/Excel to create student accounts in bulk.
                    </p>
                    <button type="button" onClick={() => navigate('/admin/students/import')} className={btnPrimary}>
                        Open Student Import
                    </button>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center">
                    <Download className="h-7 w-7 text-slate-400 mx-auto mb-2" />
                    <h2 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 mb-1">Export directory</h2>
                    <p className="text-[11px] text-slate-500 mb-3 leading-snug">
                        Export current student directory (CSV or Excel).
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <button type="button" onClick={() => handleExportStudents('csv')} disabled={!!exportingKey} className={btnDark}>
                            {exportingKey === 'students-csv' ? 'Exporting...' : 'Students CSV'}
                        </button>
                        <button type="button" onClick={() => handleExportStudents('xlsx')} disabled={!!exportingKey} className={btnPrimary}>
                            {exportingKey === 'students-xlsx' ? 'Exporting...' : 'Students Excel'}
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center">
                    <Upload className="h-7 w-7 text-slate-400 mx-auto mb-2" />
                    <h2 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 mb-1">Import teachers</h2>
                    <p className="text-[11px] text-slate-500 mb-3 leading-snug">
                        Upload CSV/Excel to create teacher accounts in bulk.
                    </p>
                    <button type="button" onClick={() => navigate('/admin/teachers/import')} className={btnPrimary}>
                        Open Teacher Import
                    </button>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center">
                    <Download className="h-7 w-7 text-slate-400 mx-auto mb-2" />
                    <h2 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 mb-1">Export teachers</h2>
                    <p className="text-[11px] text-slate-500 mb-3 leading-snug">
                        Export current teacher directory (CSV or Excel).
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <button type="button" onClick={() => handleExportTeachers('csv')} disabled={!!exportingKey} className={btnDark}>
                            {exportingKey === 'teachers-csv' ? 'Exporting...' : 'Teachers CSV'}
                        </button>
                        <button type="button" onClick={() => handleExportTeachers('xlsx')} disabled={!!exportingKey} className={btnPrimary}>
                            {exportingKey === 'teachers-xlsx' ? 'Exporting...' : 'Teachers Excel'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminImportExport;
