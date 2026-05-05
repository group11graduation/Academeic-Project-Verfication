import React, { useState } from 'react';
import { FileSpreadsheet, Upload, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import adminStudentService from '../../../services/adminStudentService';

/**
 * Placeholder for CSV/Excel import & export (Phase 6+).
 * Backend will use xlsx/csv-parse and secured upload pipelines.
 */
const AdminImportExport = () => {
    const navigate = useNavigate();
    const [exporting, setExporting] = useState(false);

    const handleExportStudents = async () => {
        setExporting(true);
        try {
            const { blob, filename } = await adminStudentService.exportStudentsCsv();
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

    return (
        <div className="w-full font-sans">
            <div className="flex items-center gap-3 mb-6">
                <FileSpreadsheet className="h-8 w-8 text-[#1D68E3]" />
                <div>
                    <h1 className="text-2xl font-extrabold text-[#0F172A] dark:text-white">Import & Export</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Teachers and students — bulk CSV/Excel (coming next phases).
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                    <Upload className="h-10 w-10 text-slate-400 mx-auto mb-4" />
                    <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Import students</h2>
                    <p className="text-sm text-slate-500 mb-4">
                        Upload CSV rows to create student accounts in bulk.
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
                        Export current student directory to CSV.
                    </p>
                    <button
                        type="button"
                        onClick={handleExportStudents}
                        disabled={exporting}
                        className="px-5 py-2.5 rounded-[12px] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm disabled:opacity-60"
                    >
                        {exporting ? 'Exporting...' : 'Export Students CSV'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminImportExport;
