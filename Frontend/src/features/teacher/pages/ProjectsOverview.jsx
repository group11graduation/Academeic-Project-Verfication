import React, { useState, useEffect, useRef } from 'react';
import {
    Search,
    Users,
    ArrowRight,
    BookOpen,
    Loader2,
    ChevronDown,
    Layout,
    Download,
    FileUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import teacherService from '../../../services/teacherService';

const ProjectsOverview = () => {
    const navigate = useNavigate();
    const [groupedData, setGroupedData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('group'); // 'individual' or 'group'
    const [expandedClasses, setExpandedClasses] = useState({});
    const [myClasses, setMyClasses] = useState([]);
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({
        classCode: '',
        type: 'group',
        groupSize: 4,
    });
    const [exportingFile, setExportingFile] = useState(false);
    const [importingFile, setImportingFile] = useState(false);
    const [applyingImport, setApplyingImport] = useState(false);
    const [importPreview, setImportPreview] = useState(null);
    const [importSummary, setImportSummary] = useState(null);
    const [generateSummary, setGenerateSummary] = useState(null);
    const importInputRef = useRef(null);
    const createFormSectionRef = useRef(null);

    useEffect(() => {
        const fetchAllGroups = async () => {
            try {
                const response = await teacherService.getAllGroups();
                if (response.success) {
                    setGroupedData(response.data);
                }
                const clsRes = await teacherService.getMyClasses();
                if (clsRes.success) {
                    const rows = clsRes.data || [];
                    setMyClasses(rows);
                    if (rows.length > 0) {
                        setCreateForm((prev) => ({ ...prev, classCode: prev.classCode || rows[0].code }));
                    }
                }
            } catch (error) {
                console.error("Failed to fetch all groups:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllGroups();
    }, []);

    useEffect(() => {
        setImportPreview(null);
        setImportSummary(null);
        setGenerateSummary(null);
    }, [createForm.classCode]);

    const scrollToCreateForm = () => {
        createFormSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const resetCreateFormFields = () => {
        if (creating || exportingFile || importingFile || applyingImport) return;
        setCreateForm({ classCode: createForm.classCode, type: 'group', groupSize: 4 });
        setImportSummary(null);
        setImportPreview(null);
        setGenerateSummary(null);
    };

    const refreshProjectsList = async () => {
        const response = await teacherService.getAllGroups();
        if (response.success) setGroupedData(response.data || []);
    };

    const handleExportCsv = async () => {
        if (!createForm.classCode) return;
        try {
            setExportingFile(true);
            const res = await teacherService.exportClassTemplateGroups(createForm.classCode, 'csv');
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
            alert(error.response?.data?.message || error.message || 'Export failed');
        } finally {
            setExportingFile(false);
        }
    };

    const handleExportXlsx = async () => {
        if (!createForm.classCode) return;
        try {
            setExportingFile(true);
            const res = await teacherService.exportClassTemplateGroups(createForm.classCode, 'xlsx');
            if (res.success && res.data?.xlsxBase64) {
                teacherService.downloadXlsxFromBase64(res.data.filename, res.data.xlsxBase64);
            }
        } catch (error) {
            alert(error.response?.data?.message || error.message || 'Export failed');
        } finally {
            setExportingFile(false);
        }
    };

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !createForm.classCode) return;
        const lower = file.name.toLowerCase();
        const isXlsx = lower.endsWith('.xlsx') || lower.endsWith('.xls');
        try {
            setImportingFile(true);
            setImportSummary(null);
            setImportPreview(null);
            setGenerateSummary(null);
            let res;
            if (isXlsx) {
                const buf = await file.arrayBuffer();
                const xlsxBase64 = teacherService.arrayBufferToBase64(buf);
                res = await teacherService.previewClassTemplateGroups(createForm.classCode, { xlsxBase64 });
            } else {
                const csv = await file.text();
                res = await teacherService.previewClassTemplateGroups(createForm.classCode, { csv });
            }
            if (res.success) {
                setImportPreview(res.data);
            }
        } catch (error) {
            alert(error.response?.data?.message || error.message || 'Preview failed');
        } finally {
            setImportingFile(false);
        }
    };

    const handleApplyImport = async () => {
        if (!createForm.classCode || !importPreview || !Array.isArray(importPreview.proposedGroups)) return;
        try {
            setApplyingImport(true);
            const res = await teacherService.commitClassTemplateGroups(
                createForm.classCode,
                importPreview.proposedGroups,
            );
            if (res.success) {
                setImportSummary(res.data);
                setImportPreview(null);
                setGenerateSummary(null);
                await refreshProjectsList();
            }
        } catch (error) {
            alert(error.response?.data?.message || error.message || 'Could not apply import');
        } finally {
            setApplyingImport(false);
        }
    };

    const toggleClassExpansion = (classCode) => {
        setExpandedClasses(prev => ({
            ...prev,
            [classCode]: !prev[classCode]
        }));
    };

    const handleCreateGroups = async () => {
        if (!createForm.classCode) {
            alert('Select class first.');
            return;
        }
        try {
            setCreating(true);
            const body = {
                type: createForm.type,
                groupSize: createForm.type === 'group' ? Number(createForm.groupSize || 4) : 1,
            };
            const res = await teacherService.generateClassTemplateGroups(createForm.classCode, body);
            if (!res.success) throw new Error(res.message || 'Failed to create groups');
            await refreshProjectsList();
            setImportSummary(null);
            setImportPreview(null);
            if (res.data) setGenerateSummary(res.data);
        } catch (error) {
            console.error('Failed to create groups:', error);
            alert(error.response?.data?.message || error.message || 'Could not create groups');
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B1120]">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    const filteredData = groupedData.map(cls => ({
        ...cls,
        projects: cls.projects.filter(p => {
            // Default to 'group' if type is missing (older data)
            const projectType = p.type || 'group';
            const matchesTab = projectType === activeTab;
            const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.members.some(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                p.members.some(m => m.studentId && m.studentId.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesTab && matchesSearch;
        })
    })).filter(cls => cls.projects.length > 0);

    const hasAnyProjects = filteredData.length > 0;

    return (
        <div className="min-h-screen bg-transparent p-4 md:p-10 max-w-[1600px] mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-[#1D68E3] p-3 rounded-2xl shadow-xl shadow-blue-500/20">
                        <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Student Projects</h1>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-[320px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-600" />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500/10 transition-all font-bold shadow-xl text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={scrollToCreateForm}
                        className="bg-[#2a3fa4] text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#223688] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg whitespace-nowrap"
                    >
                        Create New
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex items-center gap-10 mb-10 border-b border-slate-100 dark:border-white/5 pb-0.5">
                {[
                    { id: 'individual', label: 'Individual', icon: Users },
                    { id: 'group', label: 'Group', icon: Layout }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-3 px-2 py-4 relative transition-all ${activeTab === tab.id ? 'text-[#1D68E3]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? 'opacity-100' : 'opacity-50'}`} />
                        <span className="text-sm font-black tracking-wide uppercase">{tab.label}</span>
                        {activeTab === tab.id && (
                            <div className="absolute bottom-[-1px] left-0 right-0 h-1 bg-[#1D68E3] rounded-full shadow-[0_-2px_10px_rgba(29,104,227,0.3)]"></div>
                        )}
                    </button>
                ))}
            </div>

            <section
                id="teacher-create-groups"
                ref={createFormSectionRef}
                className="mb-10 rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F172A] p-6 md:p-8 shadow-xl"
            >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-[#1D68E3]/10 p-3 text-[#1D68E3] dark:text-blue-400">
                            <Users className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                                Create groups
                            </h2>
                            <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                Build teams for the class before creating an assignment. When you later create a group-mode assignment for this class, these teams copy automatically.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 md:gap-6">
                    <div className="md:col-span-2">
                        <label htmlFor="create-groups-class" className="block text-[12px] font-black uppercase tracking-wider text-slate-500 mb-2">
                            Class
                        </label>
                        <select
                            id="create-groups-class"
                            value={createForm.classCode}
                            onChange={(e) => setCreateForm((p) => ({ ...p, classCode: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-2.5 text-sm text-slate-900 dark:text-white"
                        >
                            <option value="">Select class</option>
                            {myClasses.map((c) => (
                                <option key={c.code} value={c.code}>
                                    {c.code} — {c.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-2 rounded-xl bg-slate-50 dark:bg-[#0B1120] border border-slate-100 dark:border-white/10 px-4 py-3">
                        <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                            Use <strong className="font-mono">.csv</strong> or <strong className="font-mono">.xlsx</strong> (first sheet). Columns:{' '}
                            <span className="font-mono">groupName</span>, <span className="font-mono">studentId</span>,{' '}
                            <span className="font-mono">role</span>. Student IDs must match roster enrolment for this class.{' '}
                            <strong>Choose a file for preview first</strong>, then click <strong>Apply import</strong> to save teams to this class (or discard the preview). Unknown IDs are skipped in the preview; valid rows still form teams.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2 md:col-span-2">
                        <input
                            ref={importInputRef}
                            type="file"
                            accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                            className="hidden"
                            onChange={handleImportFile}
                        />
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            disabled={!createForm.classCode || exportingFile || importingFile || applyingImport}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
                        >
                            {exportingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Export CSV
                        </button>
                        <button
                            type="button"
                            onClick={handleExportXlsx}
                            disabled={!createForm.classCode || exportingFile || importingFile || applyingImport}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
                        >
                            {exportingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Export Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => importInputRef.current?.click()}
                            disabled={!createForm.classCode || importingFile || exportingFile || applyingImport}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
                        >
                            {importingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                            Preview import
                        </button>
                    </div>

                    {importPreview && (
                        <div className="md:col-span-2 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/80 dark:bg-blue-950/25 p-4 text-sm">
                            <p className="font-black text-slate-800 dark:text-slate-100 mb-1">
                                Preview ready — {importPreview.proposedGroups?.length ?? 0} team(s),{' '}
                                {(importPreview.proposedGroups || []).reduce((n, g) => n + (g.members?.length || 0), 0)} roster row(s). Nothing is saved until you apply.
                            </p>
                            {(importPreview.rejectedStudentRows?.length ?? 0) > 0 && (
                                <div className="mt-2 text-xs font-bold text-blue-900 dark:text-blue-200">
                                    <p className="mb-1">Would be skipped (not on roster or duplicate in file):</p>
                                    <ul className="max-h-28 overflow-y-auto list-disc pl-4 font-mono">
                                        {importPreview.rejectedStudentRows.slice(0, 20).map((r, i) => (
                                            <li key={i}>{r.studentId} — {r.reason}</li>
                                        ))}
                                    </ul>
                                    {importPreview.rejectedStudentRows.length > 20 && (
                                        <p className="mt-1">…and {importPreview.rejectedStudentRows.length - 20} more</p>
                                    )}
                                </div>
                            )}
                            {(importPreview.skippedGroups?.length ?? 0) > 0 && (
                                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                                    Skipped in file (no valid students): {importPreview.skippedGroups.map((s) => s.groupName).join(', ')}
                                </p>
                            )}
                            {!(importPreview.proposedGroups?.length > 0) && (
                                <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                                    No teams to save — every row was skipped or invalid. Fix the file and preview again.
                                </p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={handleApplyImport}
                                    disabled={applyingImport || !(importPreview.proposedGroups?.length > 0)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#1D68E3] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {applyingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    Apply import
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setImportPreview(null)}
                                    disabled={applyingImport}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-white/5 disabled:opacity-50"
                                >
                                    Discard preview
                                </button>
                            </div>
                        </div>
                    )}

                    {importSummary && !importPreview && (
                        <div className="md:col-span-2 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
                            <p className="font-black text-slate-800 dark:text-slate-100 mb-2">
                                Import complete: {importSummary.createdGroups?.length ?? 0} group(s) created.
                                {(importSummary.templateGroupsRemoved ?? importSummary.orphanGroupsRemoved ?? 0) > 0 &&
                                    ` Replaced ${importSummary.templateGroupsRemoved ?? importSummary.orphanGroupsRemoved} previous class team row(s).`}
                            </p>
                            {(importSummary.rejectedStudentRows?.length ?? 0) > 0 && (
                                <div className="mt-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                                    <p className="mb-1">Rejected (not on roster or duplicate):</p>
                                    <ul className="max-h-28 overflow-y-auto list-disc pl-4 font-mono">
                                        {importSummary.rejectedStudentRows.slice(0, 20).map((r, i) => (
                                            <li key={i}>{r.studentId} — {r.reason}</li>
                                        ))}
                                    </ul>
                                    {importSummary.rejectedStudentRows.length > 20 && (
                                        <p className="mt-1">…and {importSummary.rejectedStudentRows.length - 20} more</p>
                                    )}
                                </div>
                            )}
                            {(importSummary.skippedGroups?.length ?? 0) > 0 && (
                                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                                    Skipped (no valid students): {importSummary.skippedGroups.map((s) => s.groupName).join(', ')}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/30 px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                            Auto-generate (system)
                        </p>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                            The server loads <strong>every student</strong> linked to this class (roster profiles that list this class code, plus{' '}
                            <strong>active enrollments</strong> in this class), shuffles the list, then builds teams using the{' '}
                            <strong>group size</strong> you set below. The last team may be smaller if the count does not divide evenly. This replaces existing class-level teams for the selected class.
                        </p>
                    </div>

                    {generateSummary && !importPreview && (
                        <div className="md:col-span-2 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/90 dark:bg-emerald-950/25 p-4 text-sm">
                            <p className="font-black text-emerald-900 dark:text-emerald-100">
                                {generateSummary.type === 'individual'
                                    ? `Created ${generateSummary.createdCount} individual assignment(s) from ${generateSummary.studentCount ?? 'all'} student(s).`
                                    : `Created ${generateSummary.createdCount} team(s) from ${generateSummary.studentCount ?? 'all'} student(s), up to ${generateSummary.groupSize} students per team (last team may be smaller).`}
                            </p>
                        </div>
                    )}

                    <div>
                        <label htmlFor="create-groups-type" className="block text-[12px] font-black uppercase tracking-wider text-slate-500 mb-2">
                            Type
                        </label>
                        <select
                            id="create-groups-type"
                            value={createForm.type}
                            onChange={(e) => setCreateForm((p) => ({ ...p, type: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-2.5 text-sm text-slate-900 dark:text-white"
                        >
                            <option value="group">Group</option>
                            <option value="individual">Individual</option>
                        </select>
                    </div>

                    {createForm.type === 'group' && (
                        <div>
                            <label htmlFor="create-groups-size" className="block text-[12px] font-black uppercase tracking-wider text-slate-500 mb-2">
                                Group size
                            </label>
                            <input
                                id="create-groups-size"
                                type="number"
                                min={2}
                                max={10}
                                value={createForm.groupSize}
                                onChange={(e) => setCreateForm((p) => ({ ...p, groupSize: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] px-4 py-2.5 text-sm text-slate-900 dark:text-white"
                            />
                        </div>
                    )}
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 dark:border-white/5 pt-6">
                    <button
                        type="button"
                        onClick={resetCreateFormFields}
                        disabled={creating || exportingFile || importingFile || applyingImport}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={handleCreateGroups}
                        disabled={creating || !createForm.classCode || applyingImport || importingFile}
                        className="px-5 py-2 rounded-xl bg-[#2a3fa4] text-white text-sm font-bold hover:bg-[#223688] disabled:opacity-60"
                    >
                        {creating ? 'Generating…' : createForm.type === 'individual' ? 'Generate individuals' : 'Generate teams'}
                    </button>
                </div>
            </section>

            {!hasAnyProjects ? (
                <div className="bg-white dark:bg-[#0F172A] rounded-[40px] border-2 border-dashed border-slate-100 dark:border-white/5 p-12 md:p-24 text-center">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-[#0B1120] rounded-full flex items-center justify-center mx-auto mb-8">
                        <Layout className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3">No {activeTab} projects found</h2>
                    <p className="text-slate-500 mb-10 max-w-md mx-auto font-medium">Try adjusting your search or create a new student group assignment.</p>
                    <button
                        type="button"
                        onClick={scrollToCreateForm}
                        className="bg-[#2a3fa4] text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#223688] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                    >
                        Set up groups
                    </button>
                </div>
            ) : (
                <div className="space-y-12">
                    {filteredData.map(cls => (
                        <section key={cls.code} className="space-y-6">
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className="w-1.5 h-8 bg-[#1D68E3] rounded-full"></div>
                                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{cls.code}: {cls.title}</h2>
                                    <span className="px-3 py-1 bg-blue-50 dark:bg-blue-500/10 text-[#1D68E3] dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                                        {cls.semester || 'Semester 1'}
                                    </span>
                                </div>
                            </div>

                            {activeTab === 'individual' ? (
                                <div className="app-table-shell">
                                    <div className="app-table-wrap">
                                        <table className="app-table">
                                            <thead>
                                                <tr className="app-table-headrow">
                                                    <th className="app-table-th">Student</th>
                                                    <th className="app-table-th text-center">Student ID</th>
                                                    <th className="app-table-th">Project Title</th>
                                                    <th className="app-table-th text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="app-table-body">
                                                {(expandedClasses[cls.code] ? cls.projects : cls.projects.slice(0, 5)).map((project, idx) => {
                                                    const student = project.members[0] || {};
                                                    return (
                                                        <tr key={project._id} className="app-table-row group">
                                                            <td className="app-table-td">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 flex items-center justify-center overflow-hidden shadow-sm">
                                                                        {student.photo && student.photo !== 'default-student.jpg' ? (
                                                                            <img src={student.photo.startsWith('http') ? student.photo : `http://localhost:5000/uploads/${student.photo}`} className="w-full h-full object-cover" alt="" />
                                                                        ) : <span className="text-lg font-black text-slate-400 uppercase">{student.name?.[0]}</span>}
                                                                    </div>
                                                                    <span className="text-[15px] font-bold text-slate-700 dark:text-slate-200">{student.name || 'Unknown Student'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="app-table-td text-center">
                                                                <span className="text-[13px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">ID: {student.studentId || 'N/A'}</span>
                                                            </td>
                                                            <td className="app-table-td">
                                                                <span className="text-[15px] font-bold text-[#1D68E3] dark:text-blue-400 hover:underline cursor-pointer transition-all">{project.title}</span>
                                                            </td>
                                                            <td className="app-table-td text-right">
                                                                <button 
                                                                    onClick={() => navigate(`/teacher/groups/${project._id}`)}
                                                                    className="text-xs font-black text-[#1D68E3] dark:text-blue-400 uppercase tracking-widest hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                                                                >
                                                                    View Progress
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    {cls.projects.length > 5 && (
                                        <button 
                                            onClick={() => toggleClassExpansion(cls.code)}
                                            className="w-full py-6 border-t border-slate-50 dark:border-white/5 flex items-center justify-center gap-2 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-all hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                                        >
                                            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${expandedClasses[cls.code] ? 'rotate-180' : ''}`} />
                                            {expandedClasses[cls.code] ? 'See Less' : `See More Students (${cls.projects.length - 5})`}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {cls.projects.map((group) => (
                                        <div key={group._id} className="bg-white dark:bg-[#0F172A] rounded-[40px] border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col group hover:border-blue-500/30 transition-all duration-300">
                                            <div className="p-8 pb-6">
                                                <div className="flex justify-between items-start mb-6">
                                                    <h4 className="text-[12px] font-black text-[#1D68E3] dark:text-blue-400 uppercase tracking-widest">Group {group.assignmentNumber}</h4>
                                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest ${group.status.toLowerCase() === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-slate-50 dark:bg-[#0B1120] text-slate-400 dark:text-slate-600'}`}>
                                                        {group.status.toUpperCase()}
                                                    </span>
                                                </div>
                                                <h3 className="text-[18px] font-black text-slate-800 dark:text-slate-100 mb-8 leading-tight line-clamp-2 min-h-[52px]">
                                                    {group.title}
                                                </h3>

                                                <div className="space-y-4 pt-6 border-t border-slate-50 dark:border-white/5">
                                                    {group.members.slice(0, 3).map((member, i) => (
                                                        <div key={i} className="flex items-center gap-4">
                                                            <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-[#0B1120] flex items-center justify-center text-[10px] font-black text-slate-700 dark:text-slate-100 uppercase overflow-hidden border border-slate-100 dark:border-white/5 shadow-sm">
                                                                {member.photo && member.photo !== 'default-student.jpg' ? (
                                                                    <img src={member.photo.startsWith('http') ? member.photo : `http://localhost:5000/uploads/${member.photo}`} className="w-full h-full object-cover" alt="" />
                                                                ) : member.name[0]}
                                                            </div>
                                                            <span className="text-[14px] font-bold text-slate-500 dark:text-slate-400">{member.name}</span>
                                                        </div>
                                                    ))}
                                                    {group.members.length > 3 && (
                                                        <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 pl-12 uppercase tracking-widest">+{group.members.length - 3} more</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-auto px-8 py-6 bg-slate-50/50 dark:bg-[#0B1120] border-t border-slate-50 dark:border-white/5 flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">SIMILARITY</span>
                                                    <span className={`text-[17px] font-black ${group.similarityLevel === 'High' ? 'text-rose-600' : 'text-emerald-500'}`}>
                                                        {group.similarity}%
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={() => navigate(`/teacher/groups/${group._id}`)}
                                                    className="p-3 bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-100 dark:border-white/5 text-[#1D68E3] dark:text-blue-400 hover:bg-[#1D68E3] hover:text-white transition-all shadow-xl"
                                                >
                                                    <ArrowRight className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProjectsOverview;
