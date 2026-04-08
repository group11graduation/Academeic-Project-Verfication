import React from 'react';
import { FileSpreadsheet, Upload, Download } from 'lucide-react';

/**
 * Placeholder for CSV/Excel import & export (Phase 6+).
 * Backend will use xlsx/csv-parse and secured upload pipelines.
 */
const AdminImportExport = () => {
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
                    <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Import teachers / students</h2>
                    <p className="text-sm text-slate-500 mb-4">
                        Drag-and-drop and validation will connect to admin APIs with Multer and row-level checks.
                    </p>
                    <button
                        type="button"
                        disabled
                        className="px-5 py-2.5 rounded-[12px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-sm cursor-not-allowed"
                    >
                        Not available in Phase 1
                    </button>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200 dark:border-slate-800 p-8 text-center">
                    <Download className="h-10 w-10 text-slate-400 mx-auto mb-4" />
                    <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Export directory</h2>
                    <p className="text-sm text-slate-500 mb-4">
                        Export filtered teacher/student lists as CSV for accreditation records.
                    </p>
                    <button
                        type="button"
                        disabled
                        className="px-5 py-2.5 rounded-[12px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-sm cursor-not-allowed"
                    >
                        Not available in Phase 1
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminImportExport;
