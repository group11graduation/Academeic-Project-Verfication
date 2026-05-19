import React, { useState, useEffect, useRef } from 'react';
import {
    Search,
    RotateCw,
    FileUp,
    Download,
    ArrowRight,
    Plus,
    X,
    Users,
    User,
    Loader2,
    AlertTriangle,
    ChevronRight,
    ArrowLeft
} from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import teacherService from '../../../services/teacherService';

const GroupManagement = () => {
    const { id: classCode } = useParams();
    const [groups, setGroups] = useState([]);
    const [groupAssignments, setGroupAssignments] = useState([]);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
    const [importSummary, setImportSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [genType, setGenType] = useState('group'); // 'group' or 'individual'
    const [groupSize, setGroupSize] = useState(4);
    const [generating, setGenerating] = useState(false);
    const [exportingFile, setExportingFile] = useState(false);
    const [importingFile, setImportingFile] = useState(false);
    const importInputRef = useRef(null);

    useEffect(() => {
        if (classCode) {
            loadPage();
        }
    }, [classCode]);

    const loadPage = async () => {
        try {
            setLoading(true);
            setError(null);
            const [gRes, aRes] = await Promise.all([
                teacherService.getGroups(classCode),
                teacherService.getGroupAssignmentsForClass(classCode),
            ]);
            if (gRes.success) setGroups(gRes.data || []);
            else setGroups([]);
            if (aRes.success && Array.isArray(aRes.data) && aRes.data.length) {
                setGroupAssignments(aRes.data);
                setSelectedAssignmentId((prev) => {
                    if (prev && aRes.data.some((x) => String(x._id) === String(prev))) return prev;
                    return String(aRes.data[0]._id);
                });
            } else {
                setGroupAssignments([]);
                setSelectedAssignmentId('');
            }
        } catch (err) {
            console.error('Failed to load group management page:', err);
            setError('Failed to load groups. Please try again.');
        } finally {
            setLoading(false);
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
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Export failed';
            alert(msg);
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
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Export failed';
            alert(msg);
        } finally {
            setExportingFile(false);
        }
    };

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !selectedAssignmentId) return;
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
                await loadPage();
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Import failed';
            alert(msg);
        } finally {
            setImportingFile(false);
        }
    };

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            const body = {
                type: genType,
                groupSize: genType === 'group' ? groupSize : 1,
            };
            if (selectedAssignmentId) body.assignmentId = selectedAssignmentId;
            const res = await teacherService.generateGroups(classCode, body);
            if (res.success) {
                setIsModalOpen(false);
                loadPage();
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to generate groups';
            alert(msg);
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B1120]">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-10 max-w-[1600px] mx-auto min-h-screen bg-white dark:bg-[#0B1120] transition-colors">
            {/* Breadcrumbs & Utility Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="space-y-2">
                    <nav className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4">
                        <Link to="/teacher/classes" className="hover:text-[#1D68E3] transition-colors">Classes</Link>
                        <ChevronRight className="h-3 w-3" />
                        <Link to={`/teacher/classes/${classCode}`} className="hover:text-[#1D68E3] transition-colors">{classCode}</Link>
                        <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                        <span className="text-slate-700 dark:text-slate-100">Project Assignments</span>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link 
                            to={`/teacher/classes/${classCode}`}
                            className="p-2.5 bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-900 transition-all shadow-xl group"
                        >
                            <ArrowLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
                        </Link>
                        <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                            Group Management
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group flex-1 md:flex-none">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-600 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search groups..."
                            className="w-full md:w-[320px] bg-slate-50 dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-slate-700 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-[#1D68E3] text-white p-3.5 rounded-2xl shadow-lg shadow-blue-500/20 hover:scale-[1.05] active:scale-[0.95] transition-all"
                        title="Regenerate Groups"
                    >
                        <RotateCw className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-8 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-6 py-4 text-sm font-bold text-rose-700 dark:text-rose-300">
                    {error}
                </div>
            )}

            {importSummary && (
                <div className="mb-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0F172A] px-6 py-5 relative">
                    <button
                        type="button"
                        onClick={() => setImportSummary(null)}
                        className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        aria-label="Dismiss"
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3">Import result</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                        Created {importSummary.createdGroups?.length ?? 0} group(s).
                        {importSummary.orphanGroupsRemoved > 0
                            ? ` Removed ${importSummary.orphanGroupsRemoved} previous empty group(s) without proposals.`
                            : ''}
                    </p>
                    {(importSummary.rejectedStudentRows?.length > 0) && (
                        <div className="mt-3 text-sm text-amber-700 dark:text-amber-400 font-bold">
                            <p className="mb-1">Rejected student IDs (not on class roster or duplicate row):</p>
                            <ul className="list-disc pl-5 space-y-0.5 font-mono text-xs">
                                {importSummary.rejectedStudentRows.slice(0, 30).map((r, i) => (
                                    <li key={i}>{r.studentId} — {r.reason} {r.groupName ? `(group: ${r.groupName})` : ''}</li>
                                ))}
                            </ul>
                            {importSummary.rejectedStudentRows.length > 30 && (
                                <p className="mt-1 text-xs">…and {importSummary.rejectedStudentRows.length - 30} more</p>
                            )}
                        </div>
                    )}
                    {(importSummary.skippedGroups?.length > 0) && (
                        <p className="mt-2 text-xs font-bold text-slate-500">
                            Skipped groups (no valid students after validation): {importSummary.skippedGroups.map((s) => s.groupName).join(', ')}
                        </p>
                    )}
                </div>
            )}

            <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-end gap-4 mb-10">
                <div className="flex-1 min-w-[220px]">
                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">
                        Group assignment (export / import / generate)
                    </label>
                    <select
                        value={selectedAssignmentId}
                        onChange={(e) => setSelectedAssignmentId(e.target.value)}
                        disabled={!groupAssignments.length}
                        className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 dark:text-slate-100"
                    >
                        {!groupAssignments.length ? (
                            <option value="">No group-mode assignments for this class</option>
                        ) : (
                            groupAssignments.map((a) => (
                                <option key={a._id} value={a._id}>{a.title}</option>
                            ))
                        )}
                    </select>
                </div>
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
                    disabled={!selectedAssignmentId || exportingFile || importingFile}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-slate-700 dark:text-slate-100 font-black text-xs uppercase tracking-wider hover:border-blue-300 disabled:opacity-40"
                >
                    {exportingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Export CSV
                </button>
                <button
                    type="button"
                    onClick={handleExportXlsx}
                    disabled={!selectedAssignmentId || exportingFile || importingFile}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-slate-700 dark:text-slate-100 font-black text-xs uppercase tracking-wider hover:border-blue-300 disabled:opacity-40"
                >
                    {exportingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Export Excel
                </button>
                <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    disabled={!selectedAssignmentId || importingFile || exportingFile}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-slate-700 dark:text-slate-100 font-black text-xs uppercase tracking-wider hover:border-blue-300 disabled:opacity-40"
                >
                    {importingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                    Import file
                </button>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="bg-white dark:bg-[#0F172A] p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Total Groups</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-4xl font-black text-slate-800 dark:text-slate-100 transition-colors">{groups.length}</h3>
                        <div className="text-[10px] font-black px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">ACTIVE</div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0F172A] p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Avg. Size</p>
                    <h3 className="text-4xl font-black text-slate-800 dark:text-slate-100 transition-colors">
                        {groups.length > 0 ? (groups.reduce((acc, g) => acc + g.members.length, 0) / groups.length).toFixed(1) : 0}
                    </h3>
                </div>

                <div className="bg-white dark:bg-[#0F172A] p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl transition-all group overflow-hidden relative sm:col-span-2">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full -mr-24 -mt-24 transition-transform group-hover:scale-110" />
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 h-full">
                        <div>
                            <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">AI Status</p>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 transition-colors leading-tight">
                                Proctored Analysis Complete
                            </h3>
                        </div>
                        <div className="flex items-center gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-500 px-4 py-2 rounded-xl border border-amber-100 dark:border-amber-900/30">
                            <span className="text-[11px] font-black uppercase tracking-wider">Similarity scores verified</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {groups.map((group) => (
                    <div key={group._id} className="bg-white dark:bg-[#0F172A] rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col group/card hover:border-blue-500/30 transition-all duration-300">
                        <div className="p-8 pb-6">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                                        {group.type === 'individual' ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                                    </div>
                                    <h4 className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                        {group.type === 'individual' ? 'Individual' : `Group ${group.assignmentNumber}`}
                                    </h4>
                                </div>
                                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest ${
                                    group.status === 'SUBMITTED' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-500' :
                                    group.status === 'DRAFT' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                                    'bg-slate-100 dark:bg-[#0B1120] text-slate-400 dark:text-slate-600'
                                }`}>
                                    {group.status}
                                </span>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-8 leading-tight min-h-[56px] transition-colors line-clamp-2">
                                {group.title}
                            </h3>

                             <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-white/5">
                                <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-600 tracking-[0.2em] mb-4">Group Members</p>
                                <div className="space-y-4">
                                    {group.members.map((member, i) => (
                                        <div key={i} className="flex items-center gap-4 group/member">
                                            <div className="w-10 h-10 rounded-[12px] bg-slate-50 dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 flex items-center justify-center text-[12px] font-black text-slate-700 dark:text-slate-100 shrink-0 overflow-hidden shadow-sm group-hover/member:border-blue-500/20">
                                                {member.photo && member.photo !== 'default-student.jpg' ? (
                                                    <img
                                                        src={member.photo.startsWith('http') ? member.photo : `http://localhost:5000/uploads/${member.photo}`}
                                                        className="w-full h-full object-cover"
                                                        alt=""
                                                    />
                                                ) : (
                                                    member.name.split(' ').map(n => n[0]).join('')
                                                )}
                                            </div>
                                            <span className="text-[15px] font-bold text-slate-500 dark:text-slate-400 group-hover/member:text-blue-600 dark:group-hover/member:text-blue-400">{member.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto px-8 py-6 bg-slate-50 dark:bg-[#0B1120] border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-600 tracking-widest">Similarity</p>
                                <div className="flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${
                                        group.similarityLevel === 'Low' ? 'bg-emerald-500' :
                                        group.similarityLevel === 'High' ? 'bg-rose-600' :
                                        'bg-amber-500'
                                    }`} />
                                    <p className={`text-base font-black tracking-tight ${
                                        group.similarityLevel === 'Low' ? 'text-emerald-500' :
                                        group.similarityLevel === 'High' ? 'text-rose-600' :
                                        'text-amber-500'
                                    }`}>
                                        {group.similarity}%
                                    </p>
                                </div>
                            </div>
                            <button className="p-3 bg-white dark:bg-[#0F172A] rounded-xl text-blue-600 dark:text-blue-400 border border-slate-100 dark:border-white/5 hover:bg-blue-600 hover:text-white transition-all shadow-xl active:scale-95">
                                <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                ))}

                {groups.length === 0 && (
                    <div className="col-span-full py-24 bg-white dark:bg-[#0F172A] rounded-[40px] border-4 border-dashed border-slate-100 dark:border-white/5 flex flex-col items-center justify-center text-center transition-colors">
                        <div className="p-6 bg-slate-50 dark:bg-[#0B1120] rounded-[32px] mb-6 shadow-xl border border-slate-100 dark:border-white/5">
                            <Plus className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 transition-colors">No Projects Generated</h3>
                        <p className="text-slate-500 dark:text-slate-400 font-bold max-w-[300px] transition-colors">Configure and regenerate project assignments to start managing student work.</p>
                    </div>
                )}
            </div>

            {/* Regeneration Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !generating && setIsModalOpen(false)}></div>
                    <div className="bg-white dark:bg-[#0F172A] rounded-[40px] w-full max-w-[540px] relative z-10 shadow-2xl border border-slate-100 dark:border-white/5 transition-colors overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-10 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-[#0B1120]/50">
                            <div>
                                <h3 className="text-2xl font-black text-[#0F172A] dark:text-white transition-colors tracking-tight">Regenerate Assignments</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-bold mt-1">Configure your project workflow</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white dark:bg-[#0B1120] text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-10 space-y-10">
                            {groupAssignments.length > 0 && (
                                <div>
                                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 block transition-colors">
                                        Assignment
                                    </label>
                                    <select
                                        value={selectedAssignmentId}
                                        onChange={(e) => setSelectedAssignmentId(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 dark:text-slate-100"
                                    >
                                        {groupAssignments.map((a) => (
                                            <option key={a._id} value={a._id}>{a.title}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {groupAssignments.length === 0 && (
                                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                                    Create an active group-mode assignment for this class before generating groups.
                                </p>
                            )}
                            <div>
                                <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6 block transition-colors">Project Type</label>
                                <div className="grid grid-cols-2 gap-6">
                                    <button
                                        onClick={() => setGenType('group')}
                                        className={`p-8 rounded-[32px] border-2 font-black transition-all group relative overflow-hidden ${genType === 'group' ? 'border-[#1D68E3] bg-[#1D68E3] text-white shadow-xl shadow-blue-500/30' : 'border-slate-100 dark:border-white/5 text-slate-500 hover:border-slate-200 dark:hover:border-white/10 bg-white dark:bg-[#0B1120]'}`}
                                    >
                                        <Users className={`h-6 w-6 mb-3 mx-auto ${genType === 'group' ? 'text-white' : 'text-slate-400'}`} />
                                        <span className="block text-sm uppercase tracking-widest">Group</span>
                                    </button>
                                    <button
                                        onClick={() => setGenType('individual')}
                                        className={`p-8 rounded-[32px] border-2 font-black transition-all group relative overflow-hidden ${genType === 'individual' ? 'border-[#1D68E3] bg-[#1D68E3] text-white shadow-xl shadow-blue-500/30' : 'border-slate-100 dark:border-white/5 text-slate-500 hover:border-slate-200 dark:hover:border-white/10 bg-white dark:bg-[#0B1120]'}`}
                                    >
                                        <Users className={`h-6 w-6 mb-3 mx-auto ${genType === 'individual' ? 'text-white' : 'text-slate-400'}`} />
                                        <span className="block text-sm uppercase tracking-widest">Individual</span>
                                    </button>
                                </div>
                            </div>

                            {genType === 'group' && (
                                <div className="animate-in slide-in-from-top-4 duration-500">
                                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6 block transition-colors">Capacity Per Group</label>
                                    <div className="flex flex-wrap items-center gap-4">
                                        {[2, 3, 4, 5, 6].map(size => (
                                            <button
                                                key={size}
                                                onClick={() => setGroupSize(size)}
                                                className={`w-14 h-14 rounded-2xl border-2 font-black transition-all ${groupSize === size ? 'border-[#1D68E3] bg-[#1D68E3] text-white shadow-lg shadow-blue-500/20' : 'border-slate-100 dark:border-white/5 text-slate-500 hover:border-slate-200 dark:hover:border-white/10 bg-white dark:bg-[#0B1120]'}`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-4">
                                <button
                                    onClick={handleGenerate}
                                    disabled={generating || !groupAssignments.length}
                                    className="w-full py-5 bg-[#1D68E3] text-white rounded-[24px] font-black text-base shadow-2xl shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-[0.2em]"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                            Analysis in progress...
                                        </>
                                    ) : (
                                        <>✨ Start AI Generation</>
                                    )}
                                </button>
                                <div className="mt-8 flex items-center justify-center gap-3 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 py-4 rounded-2xl border border-amber-100 dark:border-amber-900/20 px-6">
                                    <AlertTriangle className="h-5 w-5 shrink-0" />
                                    <p className="text-[12px] font-bold leading-relaxed">
                                        Regenerating removes only groups that have no student proposal linked yet. Groups with active proposals are kept.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupManagement;
