import React, { useState, useRef, useEffect } from 'react';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';
import {
    ArrowLeft,
    User,
    Users,
    Plus,
    Minus,
    FileSpreadsheet,
    Shuffle,
    Info,
    CheckCircle2,
    ArrowRight,
    Download,
    Loader2
} from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import teacherService from '../../../services/teacherService';

const GroupConfiguration = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const classRef = (id || '').trim();
    const fileInputRef = useRef(null);

    const [projectType, setProjectType] = useState('group'); // 'individual' or 'group'
    const [groupCapacity, setGroupCapacity] = useState(4);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [groupAssignments, setGroupAssignments] = useState([]);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
    const [importSummary, setImportSummary] = useState(null);
    const [exportingFile, setExportingFile] = useState(false);
    const [importingFile, setImportingFile] = useState(false);

    useEffect(() => {
        if (!classRef) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await teacherService.getGroupAssignmentsForClass(classRef);
                if (cancelled || !res.success || !Array.isArray(res.data)) return;
                if (res.data.length) {
                    setGroupAssignments(res.data);
                    setSelectedAssignmentId((prev) => {
                        if (prev && res.data.some((x) => String(x._id) === String(prev))) return prev;
                        return String(res.data[0]._id);
                    });
                } else {
                    setGroupAssignments([]);
                    setSelectedAssignmentId('');
                }
            } catch {
                /* ignore */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [classRef]);

    const handleIncrement = () => setGroupCapacity(prev => Math.min(prev + 1, 10));
    const handleDecrement = () => setGroupCapacity(prev => Math.max(prev - 1, 2));

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !classRef) return;
        setSelectedFile(file.name);
        if (!selectedAssignmentId) {
            await appWarning('No group-mode assignment found for this class, or assignments are still loading.');
            return;
        }
        const lower = file.name.toLowerCase();
        const isXlsx = lower.endsWith('.xlsx') || lower.endsWith('.xls');
        try {
            setImportingFile(true);
            let res;
            if (isXlsx) {
                const buf = await file.arrayBuffer();
                const xlsxBase64 = teacherService.arrayBufferToBase64(buf);
                res = await teacherService.importGroups(selectedAssignmentId, { xlsxBase64 });
            } else {
                const csv = await file.text();
                res = await teacherService.importGroups(selectedAssignmentId, { csv });
            }
            if (res.success) {
                setImportSummary(res.data);
            }
        } catch (error) {
            const msg = error.response?.data?.message || error.message || 'Import failed';
            await appError(msg);
        } finally {
            setImportingFile(false);
        }
    };

    const handleExportCsv = async () => {
        if (!selectedAssignmentId) return;
        try {
            setExportingFile(true);
            const res = await teacherService.exportGroups(selectedAssignmentId, 'csv');
            if (res.success && res.data?.csv) {
                const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = res.data.filename || 'groups.csv';
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            const msg = error.response?.data?.message || error.message || 'Export failed';
            await appError(msg);
        } finally {
            setExportingFile(false);
        }
    };

    const handleExportXlsx = async () => {
        if (!selectedAssignmentId) return;
        try {
            setExportingFile(true);
            const res = await teacherService.exportGroups(selectedAssignmentId, 'xlsx');
            if (res.success && res.data?.xlsxBase64) {
                teacherService.downloadXlsxFromBase64(res.data.filename, res.data.xlsxBase64);
            }
        } catch (error) {
            const msg = error.response?.data?.message || error.message || 'Export failed';
            await appError(msg);
        } finally {
            setExportingFile(false);
        }
    };

    const handleGenerate = async () => {
        if (!classRef) return;
        setIsGenerating(true);
        try {
            const body = {
                type: projectType,
                groupSize: projectType === 'group' ? groupCapacity : 1,
            };
            if (selectedAssignmentId) body.assignmentId = selectedAssignmentId;
            const response = await teacherService.generateGroups(classRef, body);
            if (response.success) {
                navigate('/teacher/projects');
            }
        } catch (error) {
            const msg = error.response?.data?.message || error.message || 'Generation failed';
            await appError(msg);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-3 sm:p-4 md:p-6 lg:p-10 max-w-[1600px] mx-auto min-h-screen transition-colors bg-white dark:bg-[#0B1120] safe-area-px">
            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            />

            {/* Header */}
            <header className="mb-8 md:mb-12">
                <Link
                    to={`/teacher/classes/${id || ''}`}
                    className="flex items-center gap-2 text-slate-400 dark:text-slate-500 hover:text-[#1D68E3] dark:hover:text-blue-400 transition-colors mb-6 group w-fit"
                >
                    <div className="bg-white dark:bg-[#0F172A] p-2 rounded-xl border border-slate-100 dark:border-white/5 shadow-xl group-hover:border-blue-200 dark:group-hover:border-blue-900 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 transition-all">
                        <ArrowLeft className="h-4 w-4" />
                    </div>
                    <span className="text-[12px] font-black uppercase tracking-widest">Back to Overview</span>
                </Link>
                <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-slate-100 mb-2 tracking-tight">Group Configuration</h1>
                <p className="text-slate-500 dark:text-slate-500 text-sm md:text-base font-medium">Configure how projects are structured and managed for {classRef || 'this class'}.</p>
            </header>

            <div className="max-w-[1000px]">
                <div className="bg-white dark:bg-[#0F172A] rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden">
                    <div className="px-6 md:px-10 pt-8 pb-2 space-y-2">
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Group assignment</label>
                        <select
                            value={selectedAssignmentId}
                            onChange={(e) => setSelectedAssignmentId(e.target.value)}
                            disabled={!groupAssignments.length}
                            className="w-full max-w-md bg-slate-50 dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 dark:text-slate-100"
                        >
                            {!groupAssignments.length ? (
                                <option value="">No group-mode assignments</option>
                            ) : (
                                groupAssignments.map((a) => (
                                    <option key={a._id} value={a._id}>{a.title}</option>
                                ))
                            )}
                        </select>
                    </div>
                    {importSummary && (
                        <div className="mx-6 md:mx-10 mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm font-bold text-amber-800 dark:text-amber-200">
                            Import: {importSummary.createdGroups?.length ?? 0} group(s) created.
                            {(importSummary.rejectedStudentRows?.length ?? 0) > 0 &&
                                ` ${importSummary.rejectedStudentRows.length} row(s) rejected (ID not on roster or duplicate).`}
                        </div>
                    )}
                    <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6 sm:space-y-8 md:space-y-12">
                        {/* Project Type Section */}
                        <section>
                            <h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 mb-6 uppercase tracking-wider">Project Type</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {/* Individual Card */}
                                <div
                                    onClick={() => setProjectType('individual')}
                                    className={`p-6 md:p-8 rounded-[24px] border-2 transition-all cursor-pointer flex items-center gap-5 ${projectType === 'individual'
                                        ? 'border-blue-500 bg-blue-500/10'
                                        : 'border-slate-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-white/10 bg-slate-50 dark:bg-[#0B1120]'
                                        }`}
                                >
                                    <div className={`p-4 rounded-2xl transition-colors ${projectType === 'individual' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-[#0F172A] text-slate-400 dark:text-slate-500'}`}>
                                        <User className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-black text-slate-800 dark:text-slate-100">Individual Projects</h3>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight">Single Student Workflows</p>
                                    </div>
                                    {projectType === 'individual' && (
                                        <div className="h-6 w-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
                                            <CheckCircle2 className="h-4 w-4 text-white" />
                                        </div>
                                    )}
                                </div>

                                {/* Group Card */}
                                <div
                                    onClick={() => setProjectType('group')}
                                    className={`p-6 md:p-8 rounded-[24px] border-2 transition-all cursor-pointer flex items-center gap-5 ${projectType === 'group'
                                        ? 'border-blue-500 bg-blue-500/10'
                                        : 'border-slate-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-white/10 bg-slate-50 dark:bg-[#0B1120]'
                                        }`}
                                >
                                    <div className={`p-4 rounded-2xl transition-colors ${projectType === 'group' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-[#0F172A] text-slate-400 dark:text-slate-500'}`}>
                                        <Users className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-black text-slate-800 dark:text-slate-100">Group Projects</h3>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight">Team Collaboration</p>
                                    </div>
                                    {projectType === 'group' && (
                                        <div className="h-6 w-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
                                            <CheckCircle2 className="h-4 w-4 text-white" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Group-specific sections */}
                        {projectType === 'group' && (
                            <>
                                {/* Group Capacity Section */}
                                <section className="p-6 md:p-8 bg-slate-50 dark:bg-[#0B1120] rounded-[28px] border border-dashed border-slate-200 dark:border-white/10 transition-colors">
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                        <div className="max-w-[500px]">
                                            <h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 mb-2">Set Group Capacity</h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-500 font-bold leading-relaxed">
                                                Specify the ideal size for student teams. Groups will be auto-generated based on this number.
                                            </p>
                                        </div>
                                        <div className="bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 rounded-2xl p-2.5 flex items-center gap-6 shadow-xl self-center md:self-auto">
                                            <button
                                                onClick={handleDecrement}
                                                className="p-3 bg-slate-50 dark:bg-[#0B1120] hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white rounded-xl text-slate-400 dark:text-slate-600 transition-all shadow-xl"
                                            >
                                                <Minus className="h-4 w-4" />
                                            </button>
                                            <span className="text-2xl font-black text-slate-800 dark:text-slate-100 w-8 text-center">{groupCapacity}</span>
                                            <button
                                                onClick={handleIncrement}
                                                className="p-3 bg-slate-50 dark:bg-[#0B1120] hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white rounded-xl text-slate-400 dark:text-slate-600 transition-all shadow-xl"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                {/* Group Creation Method */}
                                <section>
                                    <h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 mb-6 uppercase tracking-wider">Group Creation Method</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                        {/* Import via Excel */}
                                        <div className={`bg-white dark:bg-[#0F172A] border p-8 rounded-[32px] flex flex-col items-start shadow-2xl transition-all duration-500 ${selectedFile ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                                            <div className={`${selectedFile ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-emerald-500/10 text-emerald-500'} p-4 rounded-2xl mb-6 transition-all`}>
                                                {selectedFile ? <CheckCircle2 className="h-7 w-7" /> : <FileSpreadsheet className="h-7 w-7" />}
                                            </div>
                                            <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 mb-3 tracking-tight">Import via Excel</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-500 font-bold mb-8 flex-1 leading-relaxed">
                                                {selectedFile ? (
                                                    <span className="text-emerald-500 flex items-center gap-2">
                                                        Selected: <span className="italic">{selectedFile}</span>
                                                    </span>
                                                ) : (
                                                    'Upload CSV or Excel (.xlsx, .xls; first sheet) with columns groupName, studentId, role (export first for a template). Unknown student IDs are skipped; valid rows still form groups.'
                                                )}
                                            </p>
                                            <div className="w-full flex flex-col gap-3">
                                                <button
                                                    type="button"
                                                    onClick={handleExportCsv}
                                                    disabled={!selectedAssignmentId || exportingFile || importingFile}
                                                    className="w-full py-4 border-2 rounded-[20px] font-black flex items-center justify-center gap-2 border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-100 disabled:opacity-40 uppercase tracking-widest text-sm"
                                                >
                                                    {exportingFile ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                                                    Export CSV template
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleExportXlsx}
                                                    disabled={!selectedAssignmentId || exportingFile || importingFile}
                                                    className="w-full py-4 border-2 rounded-[20px] font-black flex items-center justify-center gap-2 border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-100 disabled:opacity-40 uppercase tracking-widest text-sm"
                                                >
                                                    {exportingFile ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                                                    Export Excel template
                                                </button>
                                                <button
                                                    onClick={handleUploadClick}
                                                    disabled={importingFile || exportingFile}
                                                    className={`w-full py-4.5 border-2 rounded-[20px] font-black flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-sm ${selectedFile ? 'border-emerald-500/30 bg-slate-50 dark:bg-[#0B1120] text-emerald-500' : 'border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#0B1120] text-slate-700 dark:text-slate-100'} disabled:opacity-50`}
                                                >
                                                    {importingFile ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className={`${selectedFile ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-600'} text-lg`}>↑</span>}
                                                    {selectedFile ? 'Import another file' : 'Upload file'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Auto-Generate */}
                                        <div className="bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 p-8 rounded-[32px] flex flex-col items-start shadow-2xl hover:border-blue-500/30 transition-all">
                                            <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-4 rounded-2xl mb-6 shadow-sm">
                                                <Shuffle className="h-7 w-7" />
                                            </div>
                                            <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 mb-3 tracking-tight">Auto-Generate</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-500 font-bold mb-8 flex-1 leading-relaxed">
                                                Automatically assign students into groups of {groupCapacity} based on enrollment.
                                            </p>
                                            <button
                                                onClick={handleGenerate}
                                                disabled={isGenerating || !groupAssignments.length}
                                                className="w-full py-4.5 bg-blue-600 text-white rounded-[20px] font-black flex items-center justify-center gap-3 hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 uppercase tracking-widest text-sm"
                                            >
                                                {isGenerating ? (
                                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                ) : (
                                                    <>✨ Generate Randomly</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                {/* Bottom Note */}
                                <div className="p-6 md:p-8 bg-blue-500/5 rounded-[28px] flex gap-5 border border-blue-500/10 transition-colors">
                                    <div className="h-10 w-10 bg-blue-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                                        <Info className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-blue-600 dark:text-blue-400 mb-1.5 uppercase tracking-wider text-sm">Important Note</h4>
                                        <p className="text-[13px] md:text-sm text-blue-600/60 dark:text-blue-200/60 font-medium leading-relaxed">
                                            Updating group configurations while projects are active might affect current student assignments. We recommend making changes before the project start date.
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="px-6 md:px-10 py-8 bg-slate-50 dark:bg-[#0B1120] border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-end gap-6 md:gap-8">
                        <button 
                            onClick={() => navigate(`/teacher/classes/${classRef}`)}
                            className="text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest text-[12px] hover:text-[#1D68E3] dark:hover:text-white transition-colors"
                        >
                            Discard Changes
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !groupAssignments.length}
                            className="w-full sm:w-auto bg-blue-600 text-white px-10 py-4.5 rounded-[20px] font-black flex items-center justify-center gap-3 shadow-2xl shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-sm disabled:opacity-50"
                        >
                            {isGenerating ? 'Processing...' : <>Save & Generate <ArrowRight className="h-5 w-5" /></>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GroupConfiguration;
