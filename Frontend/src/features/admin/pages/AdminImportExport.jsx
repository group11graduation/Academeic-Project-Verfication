import React, { useState } from 'react';
import { FileSpreadsheet, Upload, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import adminStudentService from '../../../services/adminStudentService';
import adminTeacherService from '../../../services/adminTeacherService';

/**
 * Placeholder for CSV/Excel import & export (Phase 6+).
 * Backend will use xlsx/csv-parse and secured upload pipelines.
 */
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
            window.alert(message);
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
            window.alert(message);
        } finally {
            setExportingKey('');
        }
    };

    return (
        <div className="w-full font-sans">
            <div className="flex items-center gap-3 mb-6">
                <FileSpreadsheet className="h-8 w-8 text-[#1D68E3]" />
                <div>
                    <h1 className="text-2xl font-extrabold text-[#0F172A] dark:text-white">Import & Export</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Teachers and students bulk import/export (CSV or Excel).
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                    <Upload className="h-10 w-10 text-slate-400 mx-auto mb-4" />
                    <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Import students</h2>
                    <p className="text-sm text-slate-500 mb-4">
                        Upload CSV/Excel to create student accounts in bulk.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/admin/students/import')}
                        className="px-5 py-2.5 rounded-[12px] bg-blue-600 text-white font-bold text-sm hover:bg-blue-700"
                    >
                        Open Student Import
                    </button>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200 dark:border-slate-800 p-8 text-center">
                    <Download className="h-10 w-10 text-slate-400 mx-auto mb-4" />
                    <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Export directory</h2>
                    <p className="text-sm text-slate-500 mb-4">
                        Export current student directory (CSV or Excel).
                    </p>
                    <div className="flex items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleExportStudents('csv')}
                            disabled={!!exportingKey}
                            className="px-4 py-2.5 rounded-[12px] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm disabled:opacity-60"
                        >
                            {exportingKey === 'students-csv' ? 'Exporting...' : 'Students CSV'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleExportStudents('xlsx')}
                            disabled={!!exportingKey}
                            className="px-4 py-2.5 rounded-[12px] bg-blue-600 text-white font-bold text-sm disabled:opacity-60"
                        >
                            {exportingKey === 'students-xlsx' ? 'Exporting...' : 'Students Excel'}
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                    <Upload className="h-10 w-10 text-slate-400 mx-auto mb-4" />
                    <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Import teachers</h2>
                    <p className="text-sm text-slate-500 mb-4">
                        Upload CSV/Excel to create teacher accounts in bulk.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/admin/teachers/import')}
                        className="px-5 py-2.5 rounded-[12px] bg-blue-600 text-white font-bold text-sm hover:bg-blue-700"
                    >
                        Open Teacher Import
                    </button>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200 dark:border-slate-800 p-8 text-center">
                    <Download className="h-10 w-10 text-slate-400 mx-auto mb-4" />
                    <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Export teachers</h2>
                    <p className="text-sm text-slate-500 mb-4">
                        Export current teacher directory (CSV or Excel).
                    </p>
                    <div className="flex items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleExportTeachers('csv')}
                            disabled={!!exportingKey}
                            className="px-4 py-2.5 rounded-[12px] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm disabled:opacity-60"
                        >
                            {exportingKey === 'teachers-csv' ? 'Exporting...' : 'Teachers CSV'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleExportTeachers('xlsx')}
                            disabled={!!exportingKey}
                            className="px-4 py-2.5 rounded-[12px] bg-blue-600 text-white font-bold text-sm disabled:opacity-60"
                        >
                            {exportingKey === 'teachers-xlsx' ? 'Exporting...' : 'Teachers Excel'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminImportExport;
