import React, { useState, useEffect, useRef, useMemo } from 'react';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';
import {
    Search,
    Users,
    ArrowRight,
    BookOpen,
    Loader2,
    Layout,
    Download,
    FileUp,
    Pencil,
    Plus,
    Trash2,
    X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import teacherService from '../../../services/teacherService';
import { assetUrl } from '../../../lib/api';
import { usePageSearch } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';

const ProjectsOverview = () => {
    const navigate = useNavigate();
    const [groupedData, setGroupedData] = useState([]);
    const [loading, setLoading] = useState(true);
    const { query: searchTerm, setQuery: setSearchTerm } = usePageSearch('Search projects…');
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
    const [teamEditorOpen, setTeamEditorOpen] = useState(false);
    const [teamEditorLoading, setTeamEditorLoading] = useState(false);
    const [teamEditorSaving, setTeamEditorSaving] = useState(false);
    const [teamEditorStudents, setTeamEditorStudents] = useState([]);
    const [teamEditorGroups, setTeamEditorGroups] = useState([]);
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
        setTeamEditorOpen(false);
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

    const openTeamEditor = async () => {
        if (!createForm.classCode) {
            await appWarning('Select a class first.');
            return;
        }
        try {
            setTeamEditorOpen(true);
            setTeamEditorLoading(true);
            const res = await teacherService.getClassTemplateGroupsEditor(createForm.classCode);
            if (!res.success) throw new Error(res.message || 'Could not load class teams');
            const data = res.data || {};
            setTeamEditorStudents(data.students || []);
            setTeamEditorGroups(
                (data.groups || []).map((group, index) => ({
                    id: group._id || `team-${Date.now()}-${index}`,
                    name: group.name || `Group ${index + 1}`,
                    members: (group.members || []).map((member) => ({
                        ...member,
                        role: member.role === 'leader' ? 'leader' : 'member',
                    })),
                })),
            );
        } catch (error) {
            setTeamEditorOpen(false);
            await appError(error.response?.data?.message || error.message || 'Could not load class teams');
        } finally {
            setTeamEditorLoading(false);
        }
    };

    const addEditorTeam = () => {
        const id = `new-${Date.now()}-${teamEditorGroups.length}`;
        setTeamEditorGroups((groups) => [
            ...groups,
            {
                id,
                name: `Group ${groups.length + 1}`,
                members: [],
            },
        ]);
        return id;
    };

    const assignUnassignedToNewTeam = (userId) => {
        const student = teamEditorStudents.find((row) => String(row.userId) === String(userId));
        if (!student) return;
        const newId = `new-${Date.now()}-${teamEditorGroups.length}`;
        setTeamEditorGroups((groups) => {
            const removed = groups.map((group) => ({
                ...group,
                members: group.members.filter((member) => String(member.userId) !== String(userId)),
            }));
            return [
                ...removed,
                {
                    id: newId,
                    name: `Group ${removed.length + 1}`,
                    members: [{ ...student, role: 'leader' }],
                },
            ];
        });
    };

    const renameEditorTeam = (groupId, name) => {
        setTeamEditorGroups((groups) =>
            groups.map((group) => (group.id === groupId ? { ...group, name } : group)),
        );
    };

    const moveEditorStudent = (userId, targetGroupId) => {
        const student = teamEditorStudents.find((row) => String(row.userId) === String(userId));
        if (!student) return;
        setTeamEditorGroups((groups) => {
            const removed = groups.map((group) => {
                const members = group.members.filter((member) => String(member.userId) !== String(userId));
                if (members.length && !members.some((member) => member.role === 'leader')) {
                    members[0] = { ...members[0], role: 'leader' };
                }
                return { ...group, members };
            });
            if (!targetGroupId) return removed;
            return removed.map((group) => {
                if (group.id !== targetGroupId) return group;
                return {
                    ...group,
                    members: [
                        ...group.members,
                        {
                            ...student,
                            role: group.members.length === 0 ? 'leader' : 'member',
                        },
                    ],
                };
            });
        });
    };

    const setEditorLeader = (groupId, userId) => {
        setTeamEditorGroups((groups) =>
            groups.map((group) =>
                group.id === groupId
                    ? {
                          ...group,
                          members: group.members.map((member) => ({
                              ...member,
                              role: String(member.userId) === String(userId) ? 'leader' : 'member',
                          })),
                      }
                    : group,
            ),
        );
    };

    const removeEditorTeam = async (groupId) => {
        const group = teamEditorGroups.find((row) => row.id === groupId);
        const ok = await appConfirm(
            group?.members?.length
                ? `Remove ${group.name || 'this team'}? Its students will become unassigned. Click Save teams to apply - they can then be moved or generated into new teams.`
                : `Remove ${group?.name || 'this empty team'}? Click Save teams to apply.`,
        );
        if (!ok) return;
        setTeamEditorGroups((groups) => groups.filter((row) => row.id !== groupId));
    };

    const removeAllEditorTeams = async () => {
        if (!teamEditorGroups.length) return;
        const memberCount = teamEditorGroups.reduce((sum, group) => sum + (group.members?.length || 0), 0);
        const ok = await appConfirm(
            memberCount
                ? `Delete all ${teamEditorGroups.length} class team(s) for ${createForm.classCode}? All ${memberCount} student(s) will become unassigned. Click Save teams to apply. Related group-mode assignment teams that match these class teams may also be removed.`
                : `Delete all ${teamEditorGroups.length} empty team(s) for ${createForm.classCode}? Click Save teams to apply.`,
        );
        if (!ok) return;
        setTeamEditorGroups([]);
    };

    const saveTeamEditor = async () => {
        const nonEmptyGroups = teamEditorGroups.filter((group) => group.members.length > 0);
        const names = nonEmptyGroups.map((group) => group.name.trim().toLowerCase());
        if (new Set(names).size !== names.length) {
            await appWarning('Every team must have a unique name.');
            return;
        }
        try {
            setTeamEditorSaving(true);
            const proposedGroups = nonEmptyGroups.map((group, index) => ({
                groupName: group.name.trim() || `Group ${index + 1}`,
                members: group.members.map((member) => ({
                    studentId: member.studentId,
                    role: member.role === 'leader' ? 'leader' : 'member',
                })),
            }));
            const res = await teacherService.commitClassTemplateGroups(
                createForm.classCode,
                proposedGroups,
            );
            if (!res.success) throw new Error(res.message || 'Could not save teams');
            await refreshProjectsList();
            setTeamEditorOpen(false);
            setImportPreview(null);
            setImportSummary(null);
            setGenerateSummary(null);
            const savedCount = res.data?.createdGroups?.length ?? proposedGroups.length;
            await appSuccess(
                savedCount === 0
                    ? `All class teams for ${createForm.classCode} were removed. Students are unassigned for future assignments.` +
                          (res.data?.assignmentGroupsDeleted
                              ? ` Also cleared ${res.data.assignmentGroupsDeleted} related assignment team(s).`
                              : '')
                    : `Saved ${savedCount} team(s).` +
                          (res.data?.assignmentGroupsDeleted
                              ? ` Removed ${res.data.assignmentGroupsDeleted} deleted team(s); their students are unassigned.`
                              : ' Existing assignment groups were updated in place when students were added.'),
            );
        } catch (error) {
            await appError(error.response?.data?.message || error.message || 'Could not save teams');
        } finally {
            setTeamEditorSaving(false);
        }
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
            await appError(error.response?.data?.message || error.message || 'Export failed');
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
            await appError(error.response?.data?.message || error.message || 'Export failed');
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
            await appError(error.response?.data?.message || error.message || 'Preview failed');
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
            await appError(error.response?.data?.message || error.message || 'Could not apply import');
        } finally {
            setApplyingImport(false);
        }
    };

    const handleDeleteGroupCard = async (group, event) => {
        event?.stopPropagation?.();
        const label = group?.title || `Group ${group?.assignmentNumber || ''}`.trim() || 'this group';
        const ok = await appConfirm(
            `Delete ${label}? Its students will become unassigned and can be moved into other teams.`,
            { danger: true, confirmLabel: 'Delete group' },
        );
        if (!ok) return;
        try {
            const res = await teacherService.deleteGroup(group._id);
            if (!res.success) throw new Error(res.message || 'Could not delete group');
            await refreshProjectsList();
            await appSuccess(res.data?.message || 'Group deleted. Students are now unassigned.');
        } catch (error) {
            await appError(error.response?.data?.message || error.message || 'Could not delete group');
        }
    };

    const handleCreateGroups = async () => {
        if (!createForm.classCode) {
            await appWarning('Select class first.');
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
            await appError(error.response?.data?.message || error.message || 'Could not create groups');
        } finally {
            setCreating(false);
        }
    };

    const editorGroupByUser = useMemo(() => {
        const map = new Map();
        for (const group of teamEditorGroups) {
            for (const member of group.members) {
                map.set(String(member.userId), group.id);
            }
        }
        return map;
    }, [teamEditorGroups]);

    const editorUnassignedStudents = useMemo(
        () =>
            teamEditorStudents.filter(
                (student) => !editorGroupByUser.has(String(student.userId)),
            ),
        [teamEditorStudents, editorGroupByUser],
    );

    if (loading) {
        return (
            <div className="min-h-[40vh] flex items-center justify-center">
                <Loader2 className="h-7 w-7 text-[var(--brand-primary)] animate-spin" />
            </div>
        );
    }

    const filteredData = groupedData.map(cls => ({
        ...cls,
        projects: cls.projects.filter(p => {
            // Student Projects page shows group teams only
            const projectType = p.type || 'group';
            const matchesGroup = projectType === 'group';
            const matchesSearch = matchesSearchQuery(
                searchTerm,
                p.title,
                ...(p.members || []).flatMap((m) => [m.name, m.studentId])
            );
            return matchesGroup && matchesSearch;
        })
    })).filter(cls => cls.projects.length > 0);

    const hasAnyProjects = filteredData.length > 0;

    return (
        <div className="space-y-3 text-[13px] antialiased [font-family:var(--sv-font-sans)]">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[var(--border)] dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                    <div className="bg-[var(--brand-primary)] p-2 rounded-lg">
                        <BookOpen className="h-4 w-4 text-white" />
                    </div>
                    <h1 className="text-[1.15rem] font-bold tracking-tight text-[var(--brand-primary)] sm:text-[1.25rem]">Student Projects</h1>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-[220px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg py-2 pl-9 pr-3 text-[12px] focus:ring-2 focus:ring-blue-500/10 font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={scrollToCreateForm}
                        className="bg-[var(--brand-primary)] text-white px-3 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wide hover:brightness-110 transition-all whitespace-nowrap"
                    >
                        Create New
                    </button>
                </div>
            </header>

            <section
                id="teacher-create-groups"
                ref={createFormSectionRef}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm"
            >
                <div className="flex items-start gap-2 mb-3">
                    <div className="rounded-lg bg-[var(--brand-primary)]/10 p-2 text-[var(--brand-primary)] dark:text-blue-400 shrink-0">
                        <Users className="h-4 w-4" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                            Create groups
                        </h2>
                        <p className="text-[11px] font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)] mt-0.5 leading-snug">
                            Build teams for the class before creating an assignment. When you later create a group-mode assignment for this class, these teams copy automatically.
                        </p>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                        <label htmlFor="create-groups-class" className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                            Class
                        </label>
                        <select
                            id="create-groups-class"
                            value={createForm.classCode}
                            onChange={(e) => setCreateForm((p) => ({ ...p, classCode: e.target.value }))}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[12px] text-[var(--text-primary)]"
                        >
                            <option value="">Select class</option>
                            {myClasses.map((c) => (
                                <option key={c.code} value={c.code}>
                                    {c.code} - {c.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] px-3 py-2">
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)] leading-relaxed">
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
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] dark:hover:bg-white/5 disabled:opacity-50"
                        >
                            {exportingFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            Export CSV
                        </button>
                        <button
                            type="button"
                            onClick={handleExportXlsx}
                            disabled={!createForm.classCode || exportingFile || importingFile || applyingImport}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] dark:hover:bg-white/5 disabled:opacity-50"
                        >
                            {exportingFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            Export Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => importInputRef.current?.click()}
                            disabled={!createForm.classCode || importingFile || exportingFile || applyingImport}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] dark:hover:bg-white/5 disabled:opacity-50"
                        >
                            {importingFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                            Preview import
                        </button>
                        <button
                            type="button"
                            onClick={openTeamEditor}
                            disabled={!createForm.classCode || teamEditorLoading || creating || applyingImport}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/70 dark:bg-blue-950/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--brand-primary)] dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50"
                        >
                            {teamEditorLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                            Edit teams
                        </button>
                    </div>

                    {importPreview && (
                        <div className="md:col-span-2 rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/80 dark:bg-blue-950/25 p-3 text-[12px]">
                            <p className="font-bold text-[var(--text-primary)] mb-1">
                                Preview ready - {importPreview.proposedGroups?.length ?? 0} team(s),{' '}
                                {(importPreview.proposedGroups || []).reduce((n, g) => n + (g.members?.length || 0), 0)} roster row(s). Nothing is saved until you apply.
                            </p>
                            {(importPreview.rejectedStudentRows?.length ?? 0) > 0 && (
                                <div className="mt-2 text-xs font-bold text-blue-900 dark:text-blue-200">
                                    <p className="mb-1">Would be skipped (not on roster or duplicate in file):</p>
                                    <ul className="max-h-28 overflow-y-auto list-disc pl-4 font-mono">
                                        {importPreview.rejectedStudentRows.slice(0, 20).map((r, i) => (
                                            <li key={i}>{r.studentId} - {r.reason}</li>
                                        ))}
                                    </ul>
                                    {importPreview.rejectedStudentRows.length > 20 && (
                                        <p className="mt-1">…and {importPreview.rejectedStudentRows.length - 20} more</p>
                                    )}
                                </div>
                            )}
                            {(importPreview.skippedGroups?.length ?? 0) > 0 && (
                                <p className="mt-2 text-xs text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                                    Skipped in file (no valid students): {importPreview.skippedGroups.map((s) => s.groupName).join(', ')}
                                </p>
                            )}
                            {!(importPreview.proposedGroups?.length > 0) && (
                                <p className="mt-2 text-xs font-bold text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                                    No teams to save - every row was skipped or invalid. Fix the file and preview again.
                                </p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={handleApplyImport}
                                    disabled={applyingImport || !(importPreview.proposedGroups?.length > 0)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {applyingImport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                    Apply import
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setImportPreview(null)}
                                    disabled={applyingImport}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)] hover:bg-[var(--bg-card)] dark:hover:bg-white/5 disabled:opacity-50"
                                >
                                    Discard preview
                                </button>
                            </div>
                        </div>
                    )}

                    {importSummary && !importPreview && (
                        <div className="md:col-span-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-[12px]">
                            <p className="font-bold text-[var(--text-primary)] mb-2">
                                Import complete: {importSummary.createdGroups?.length ?? 0} group(s) created.
                                {(importSummary.templateGroupsRemoved ?? importSummary.orphanGroupsRemoved ?? 0) > 0 &&
                                    ` Replaced ${importSummary.templateGroupsRemoved ?? importSummary.orphanGroupsRemoved} previous class team row(s).`}
                            </p>
                            {(importSummary.rejectedStudentRows?.length ?? 0) > 0 && (
                                <div className="mt-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                                    <p className="mb-1">Rejected (not on roster or duplicate):</p>
                                    <ul className="max-h-28 overflow-y-auto list-disc pl-4 font-mono">
                                        {importSummary.rejectedStudentRows.slice(0, 20).map((r, i) => (
                                            <li key={i}>{r.studentId} - {r.reason}</li>
                                        ))}
                                    </ul>
                                    {importSummary.rejectedStudentRows.length > 20 && (
                                        <p className="mt-1">…and {importSummary.rejectedStudentRows.length - 20} more</p>
                                    )}
                                </div>
                            )}
                            {(importSummary.skippedGroups?.length ?? 0) > 0 && (
                                <p className="mt-2 text-xs text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                                    Skipped (no valid students): {importSummary.skippedGroups.map((s) => s.groupName).join(', ')}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="md:col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/30 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] dark:text-[var(--text-secondary)] mb-1">
                            Auto-generate (system)
                        </p>
                        <p className="text-xs font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)] leading-relaxed">
                            Adds teams only for students <strong>not already in a group</strong> (class templates or assignment groups).
                            Existing teams are kept. The last new team may be smaller if the count does not divide evenly.
                        </p>
                    </div>

                    {generateSummary && !importPreview && (
                        <div className="md:col-span-2 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/90 dark:bg-emerald-950/25 p-3 text-[12px]">
                            <p className="font-bold text-emerald-900 dark:text-emerald-100">
                                {generateSummary.type === 'individual'
                                    ? generateSummary.createdCount > 0
                                        ? `Created ${generateSummary.createdCount} individual assignment(s) for unassigned student(s).`
                                        : generateSummary.message || 'All students are already assigned.'
                                    : generateSummary.createdCount > 0
                                        ? `Created ${generateSummary.createdCount} new team(s) for ${generateSummary.unassignedStudentCount ?? 'unassigned'} student(s), up to ${generateSummary.groupSize} per team.${
                                              generateSummary.skippedAlreadyGrouped
                                                  ? ` ${generateSummary.skippedAlreadyGrouped} student(s) already in groups were skipped.`
                                                  : ''
                                          }`
                                        : generateSummary.message || 'All students are already assigned to groups.'}
                            </p>
                        </div>
                    )}

                    <div>
                        <label htmlFor="create-groups-type" className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                            Type
                        </label>
                        <select
                            id="create-groups-type"
                            value={createForm.type}
                            onChange={(e) => setCreateForm((p) => ({ ...p, type: e.target.value }))}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[12px] text-[var(--text-primary)]"
                        >
                            <option value="group">Group</option>
                            <option value="individual">Individual</option>
                        </select>
                    </div>

                    {createForm.type === 'group' && (
                        <div>
                            <label htmlFor="create-groups-size" className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                                Group size
                            </label>
                            <input
                                id="create-groups-size"
                                type="number"
                                min={2}
                                max={10}
                                value={createForm.groupSize}
                                onChange={(e) => setCreateForm((p) => ({ ...p, groupSize: e.target.value }))}
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[12px] text-[var(--text-primary)]"
                            />
                        </div>
                    )}
                </div>

                <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-3">
                    <button
                        type="button"
                        onClick={resetCreateFormFields}
                        disabled={creating || exportingFile || importingFile || applyingImport}
                        className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12px] font-bold text-[var(--text-secondary)] disabled:opacity-50"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={handleCreateGroups}
                        disabled={creating || !createForm.classCode || applyingImport || importingFile}
                        className="px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white text-[12px] font-bold hover:brightness-110 disabled:opacity-60"
                    >
                        {creating ? 'Generating…' : createForm.type === 'individual' ? 'Generate individuals' : 'Generate teams'}
                    </button>
                </div>
            </section>

            {!hasAnyProjects ? (
                <div className="bg-[var(--bg-card)] rounded-xl border-2 border-dashed border-[var(--border)] p-8 text-center">
                    <div className="w-12 h-12 bg-[var(--bg-elevated)] rounded-full flex items-center justify-center mx-auto mb-3">
                        <Layout className="h-6 w-6 text-slate-300 dark:text-[var(--text-primary)]" />
                    </div>
                    <h2 className="text-base font-bold text-[var(--text-primary)] mb-1">No group projects found</h2>
                    <p className="text-[12px] text-[var(--text-secondary)] mb-4 max-w-md mx-auto">Try adjusting your search or create a new student group assignment.</p>
                    <button
                        type="button"
                        onClick={scrollToCreateForm}
                        className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wide hover:brightness-110 transition-all"
                    >
                        Set up groups
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredData.map(cls => (
                        <section key={cls.code} className="space-y-2">
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-5 bg-[var(--brand-primary)] rounded-full" />
                                    <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">{cls.code}: {cls.title}</h2>
                                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-[var(--brand-primary)] dark:text-blue-400 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                        {cls.semester || 'Semester 1'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {cls.projects.map((group) => (
                                        <div key={group._id} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden flex flex-col group hover:border-blue-500/30 transition-all">
                                            <div className="p-3 pb-2">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="text-[10px] font-bold text-[var(--brand-primary)] dark:text-blue-400 uppercase tracking-wider">Group {group.assignmentNumber}</h4>
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider ${group.status.toLowerCase() === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}>
                                                        {group.status.toUpperCase()}
                                                    </span>
                                                </div>
                                                <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-3 leading-tight line-clamp-2 min-h-[36px]">
                                                    {group.title}
                                                </h3>

                                                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                                                    {group.members.slice(0, 3).map((member, i) => (
                                                        <div key={i} className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-md bg-[var(--bg-elevated)] flex items-center justify-center text-[9px] font-bold text-[var(--text-primary)] uppercase overflow-hidden border border-[var(--border)]">
                                                                {member.photo && member.photo !== 'default-student.jpg' ? (
                                                                    <img src={assetUrl(member.photo.startsWith('http') ? member.photo : `/uploads/${member.photo}`)} className="w-full h-full object-cover" alt="" />
                                                                ) : member.name[0]}
                                                            </div>
                                                            <span className="text-[11px] font-bold text-[var(--text-secondary)] dark:text-[var(--text-secondary)] truncate">
                                                                {member.isLeader ? (
                                                                    <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-primary)] dark:text-blue-400">
                                                                        Leader
                                                                    </span>
                                                                ) : null}
                                                                {member.name}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {group.members.length > 3 && (
                                                        <p className="text-[10px] font-bold text-[var(--text-secondary)] pl-8 uppercase tracking-wider">+{group.members.length - 3} more</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-auto px-3 py-2 bg-[var(--bg-elevated)] border-t border-[var(--border)] flex items-center justify-between gap-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">SIMILARITY</span>
                                                    <span className={`text-sm font-bold ${group.similarityLevel === 'High' ? 'text-rose-600' : 'text-emerald-500'}`}>
                                                        {group.similarity}%
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDeleteGroupCard(group, e)}
                                                        className="p-2 bg-[var(--bg-card)] rounded-lg border border-[var(--border)] text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                                                        title="Delete group"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/teacher/groups/${group._id}`)}
                                                        className="p-2 bg-[var(--bg-card)] rounded-lg border border-[var(--border)] text-[var(--brand-primary)] dark:text-blue-400 hover:bg-[var(--brand-primary)] hover:text-white transition-all"
                                                    >
                                                        <ArrowRight className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                        </section>
                    ))}
                </div>
            )}

            {teamEditorOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
                    <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-4">
                            <div>
                                <h2 className="text-base font-bold text-[var(--text-primary)]">
                                    Edit class teams - {createForm.classCode}
                                </h2>
                                <p className="mt-1 text-xs font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                                    Rename teams, move students, and choose leaders. Existing assignment/project groups remain unchanged; these teams are used for future assignments.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => !teamEditorSaving && setTeamEditorOpen(false)}
                                className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] dark:hover:bg-white/5 dark:hover:text-white"
                                aria-label="Close team editor"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 space-y-4 overflow-y-auto p-4">
                            {teamEditorLoading ? (
                                <div className="flex min-h-56 items-center justify-center gap-2 text-sm font-bold text-[var(--text-secondary)]">
                                    <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-primary)]" />
                                    Loading class teams…
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {teamEditorGroups.length === 0 ? (
                                            <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-xs font-medium text-[var(--text-secondary)] md:col-span-2">
                                                No teams - add a team, or assign students below. Click Save teams to clear all class teams permanently.
                                            </p>
                                        ) : null}
                                        {teamEditorGroups.map((group) => (
                                            <section
                                                key={group.id}
                                                className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
                                            >
                                                <div className="mb-3 flex items-center gap-2">
                                                    <input
                                                        value={group.name}
                                                        onChange={(event) => renameEditorTeam(group.id, event.target.value)}
                                                        maxLength={80}
                                                        className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
                                                        aria-label="Team name"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeEditorTeam(group.id)}
                                                        className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                        title="Remove team"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>

                                                {group.members.length === 0 ? (
                                                    <p className="rounded-lg border border-dashed border-[var(--border)] p-3 text-center text-xs font-medium text-[var(--text-secondary)]">
                                                        Empty team - move an unassigned student here.
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {group.members.map((member) => (
                                                            <div
                                                                key={member.userId}
                                                                className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-2"
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-xs font-bold text-[var(--text-primary)]">
                                                                            {member.name}
                                                                        </p>
                                                                        <p className="truncate text-[10px] font-mono text-[var(--text-secondary)]">
                                                                            {member.studentId || member.email}
                                                                        </p>
                                                                    </div>
                                                                    <label className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                                                                        <input
                                                                            type="radio"
                                                                            name={`leader-${group.id}`}
                                                                            checked={member.role === 'leader'}
                                                                            onChange={() => setEditorLeader(group.id, member.userId)}
                                                                        />
                                                                        Leader
                                                                    </label>
                                                                </div>
                                                                <select
                                                                    value={group.id}
                                                                    onChange={(event) => {
                                                                        if (event.target.value !== group.id) {
                                                                            moveEditorStudent(member.userId, event.target.value);
                                                                        }
                                                                    }}
                                                                    className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[11px] font-bold text-[var(--text-primary)]"
                                                                    aria-label={`Move ${member.name}`}
                                                                >
                                                                    <option value="">Unassigned</option>
                                                                    {teamEditorGroups.map((target) => (
                                                                        <option key={target.id} value={target.id}>
                                                                            {target.name || 'Unnamed team'}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </section>
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={addEditorTeam}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#2f4aad]/40 px-3 py-2 text-xs font-bold text-[var(--brand-primary)] hover:bg-blue-50 dark:hover:bg-blue-950/20"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add team
                                        </button>
                                        <button
                                            type="button"
                                            onClick={removeAllEditorTeams}
                                            disabled={!teamEditorGroups.length || teamEditorSaving}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Delete all groups
                                        </button>
                                    </div>

                                    <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
                                        <h3 className="text-xs font-bold text-amber-900 dark:text-amber-100">
                                            Unassigned students ({editorUnassignedStudents.length})
                                        </h3>
                                        <p className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-200/70">
                                            Choose an existing team to add the student there, or create a new team for them. Saving updates the original team - it does not copy members into a duplicate group.
                                        </p>
                                        {editorUnassignedStudents.length > 0 && (
                                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                {editorUnassignedStudents.map((student) => (
                                                    <div
                                                        key={student.userId}
                                                        className="rounded-lg border border-amber-200 bg-[var(--bg-card)] p-2 dark:border-amber-800/30"
                                                    >
                                                        <p className="truncate text-xs font-bold text-[var(--text-primary)]">
                                                            {student.name}
                                                        </p>
                                                        <p className="truncate text-[10px] font-mono text-[var(--text-secondary)]">
                                                            {student.studentId || student.email}
                                                        </p>
                                                        <select
                                                            value=""
                                                            onChange={(event) => {
                                                                const value = event.target.value;
                                                                if (!value) return;
                                                                if (value === '__new__') {
                                                                    assignUnassignedToNewTeam(student.userId);
                                                                    return;
                                                                }
                                                                moveEditorStudent(student.userId, value);
                                                            }}
                                                            className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[11px] font-bold text-[var(--text-primary)]"
                                                        >
                                                            <option value="">Choose team…</option>
                                                            <option value="__new__">+ Create new team</option>
                                                            {teamEditorGroups.map((group) => (
                                                                <option key={group.id} value={group.id}>
                                                                    Add to {group.name || 'Unnamed team'}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                </>
                            )}
                        </div>

                        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] p-4">
                            <button
                                type="button"
                                onClick={() => setTeamEditorOpen(false)}
                                disabled={teamEditorSaving}
                                className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 dark:hover:bg-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveTeamEditor}
                                disabled={teamEditorLoading || teamEditorSaving}
                                className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                {teamEditorSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                                Save teams
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectsOverview;
