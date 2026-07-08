import React, { useEffect, useState, useRef, useMemo } from 'react';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';
import { 
    Check,
    Cpu,
    MessageSquare,
    UploadCloud,
    FileText,
    FileArchive,
    Upload,
    Edit2,
    ShieldCheck,
    Loader2
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { DEADLINE_DUE_STUDENT_MESSAGE } from '../../../shared/utils/assignmentDeadlines';
import {
    getProjectTeacherFeedbackEntries,
    getProjectWorkflowStatus,
    getWorkflowBadgeClasses,
    formatWorkflowDate,
} from '../../../shared/utils/projectWorkflowStatus';
import StudentProjectFeedbackPanel from '../../../shared/components/StudentProjectFeedbackPanel';
import { useAuth } from '../../../context/authContext';
import studentService from '../../../services/studentService';
import { getApiOrigin } from '../../../lib/api';
import { Z_SHELL, Z_SHELL_INNER, Z_CARD, Z_BTN_PRIMARY } from '../../../shared/ui/zendentaLayout';

const StudentMyProjectDetail = () => {
    const { user } = useAuth();
    const { id: assignmentId } = useParams();

    const [row, setRow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(null);

    const [isEditingAbstract, setIsEditingAbstract] = useState(false);
    const [abstractText, setAbstractText] = useState('');

    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);
    const zipInputRef = useRef(null);
    const screenshotInputRef = useRef(null);
    const [codeZipBusy, setCodeZipBusy] = useState(false);
    const [codeZipMessage, setCodeZipMessage] = useState('');
    const [selectedZipFile, setSelectedZipFile] = useState(null);
    const [selectedScreenshotFile, setSelectedScreenshotFile] = useState(null);
    const [screenshotBusy, setScreenshotBusy] = useState(false);
    /** '' | static-html | static-html-js */
    const [projectStackHint, setProjectStackHint] = useState('');

    const project = useMemo(() => {
        if (!row?.assignment) return null;
        const a = row.assignment;
        const p = row.proposal;
        const g = row.group;
        let members = [];
        if (g?.leader) {
            members.push({
                _id: g.leader._id || g.leader,
                name: g.leader.name || 'Leader',
                photo: g.leader.photo,
            });
        }
        if (g?.members?.length) {
            for (const m of g.members) {
                const u = m.user;
                if (!u) continue;
                const uid = u._id || u;
                if (members.some((x) => String(x._id) === String(uid))) continue;
                members.push({ _id: uid, name: u.name || 'Member', photo: u.photo });
            }
        }
        if (!members.length && user) {
            members = [{ _id: user._id, name: user.name || 'You', photo: user.photo }];
        }
        return {
            _id: a._id,
            title: a.title,
            classCode:
                (Array.isArray(a.classNames) && a.classNames.length > 0 && a.classNames.join(', ')) ||
                (Array.isArray(a.assignedClasses) && a.assignedClasses.length > 0 && a.assignedClasses.join(', ')) ||
                a.class?.code || a.class?.name,
            type: a.submissionMode,
            status: p?.status || '—',
            description: p?.description || a.description,
            assignmentNumber: a._id ? String(a._id).slice(-6).toUpperCase() : '—',
            members,
            featureTags: Array.isArray(p?.features) ? p.features : [],
            similarity:
                p?.aiPreviousSemesterMaxScore != null
                    ? Math.round(Number(p.aiPreviousSemesterMaxScore) * 100)
                    : 0,
            similarityLevel:
                p?.aiPreviousSemesterMaxScore != null && Number(p.aiPreviousSemesterMaxScore) >= 0.58
                    ? 'Elevated'
                    : 'Low',
        };
    }, [row, user]);

    const workflow = useMemo(() => getProjectWorkflowStatus(row || {}), [row]);
    const teacherFeedbackEntries = useMemo(() => getProjectTeacherFeedbackEntries(row || {}), [row]);
    const feedbackReceived = teacherFeedbackEntries.length > 0;
    const projectSubmitted = Boolean(row?.latestProjectSubmission);
    const teacherPreviewed = Boolean(row?.latestProjectSubmission?.teacherPreviewedAt);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [assignmentId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (!assignmentId) {
                    setAccessDenied('Open this page from the dashboard by choosing an assignment.');
                    setRow(null);
                    setLoading(false);
                    return;
                }
                setLoading(true);
                setAccessDenied(null);
                const accessRes = await studentService.getProjectAccess(assignmentId);
                if (cancelled) return;
                if (!accessRes.success) {
                    setAccessDenied(accessRes.message || 'Could not verify project access.');
                    setRow(null);
                    setLoading(false);
                    return;
                }
                const payload = accessRes.data;
                if (!payload?.allowed) {
                    setAccessDenied(payload?.reason || 'You cannot access project submission yet.');
                    setRow(null);
                    setLoading(false);
                    return;
                }
                const assignRes = await studentService.getAssignment(assignmentId);
                if (cancelled) return;
                if (!assignRes.success) {
                    setAccessDenied(assignRes.message || 'Could not load assignment.');
                    setRow(null);
                    setLoading(false);
                    return;
                }
                setRow(assignRes.data);
                const p = assignRes.data?.proposal;
                const a = assignRes.data?.assignment;
                setAbstractText(
                    p?.description || p?.title || a?.description || 'No description provided.'
                );
            } catch (e) {
                if (!cancelled) {
                    setAccessDenied(e.response?.data?.message || e.message || 'Something went wrong.');
                    setRow(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [assignmentId]);

    const handleFileUpload = async (file) => {
        if (!file) return;
        setIsUploading(true);
        try {
            await appError('Optional asset uploads are not connected to the API. Use “Project code (.zip)” below for teacher sandbox preview.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const onZipFilePicked = (file) => {
        if (!file) {
            setSelectedZipFile(null);
            return;
        }
        const name = (file.name || '').toLowerCase();
        if (!name.endsWith('.zip')) {
            setCodeZipMessage('Please choose a .zip file only.');
            setSelectedZipFile(null);
            return;
        }
        setCodeZipMessage('');
        setSelectedZipFile(file);
    };

    const handleProjectZipUpload = async () => {
        if (!selectedZipFile || !assignmentId) return;
        if (row?.projectDeadlinePassed) {
            setCodeZipMessage(DEADLINE_DUE_STUDENT_MESSAGE);
            return;
        }
        setCodeZipBusy(true);
        setCodeZipMessage('');
        try {
            const res = await studentService.submitProjectCode(
                assignmentId,
                selectedZipFile,
                projectStackHint,
                selectedScreenshotFile
            );
            if (res.success) {
                const v = res.data?.version;
                const updated = res.data?.isUpdate;
                setCodeZipMessage(
                    updated
                        ? `Updated (v${v}): ${res.data?.originalFilename || selectedZipFile.name}. Same submission id — teacher sees the new file.`
                        : `Uploaded: ${res.data?.originalFilename || selectedZipFile.name}. You can replace it until the project deadline.`
                );
                setSelectedZipFile(null);
                setSelectedScreenshotFile(null);
                const assignRes = await studentService.getAssignment(assignmentId);
                if (assignRes.success) setRow(assignRes.data);
            } else {
                setCodeZipMessage(res.message || 'Upload failed.');
            }
        } catch (e) {
            setCodeZipMessage(e.response?.data?.message || e.message || 'Upload failed.');
        } finally {
            setCodeZipBusy(false);
            if (zipInputRef.current) zipInputRef.current.value = '';
            if (screenshotInputRef.current) screenshotInputRef.current.value = '';
        }
    };

    const handleScreenshotUpload = async () => {
        if (!selectedScreenshotFile || !assignmentId) return;
        if (row?.projectDeadlinePassed) {
            setCodeZipMessage(DEADLINE_DUE_STUDENT_MESSAGE);
            return;
        }
        setScreenshotBusy(true);
        setCodeZipMessage('');
        try {
            const res = await studentService.submitProjectScreenshot(assignmentId, selectedScreenshotFile);
            if (res.success) {
                setCodeZipMessage('Screenshot saved. Your project can appear in Verified Projects.');
                setSelectedScreenshotFile(null);
                const assignRes = await studentService.getAssignment(assignmentId);
                if (assignRes.success) setRow(assignRes.data);
            } else {
                setCodeZipMessage(res.message || 'Screenshot upload failed.');
            }
        } catch (e) {
            setCodeZipMessage(e.response?.data?.message || e.message || 'Screenshot upload failed.');
        } finally {
            setScreenshotBusy(false);
            if (screenshotInputRef.current) screenshotInputRef.current.value = '';
        }
    };

    const onDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = () => {
        setIsDragging(false);
    };

    const onDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className={Z_SHELL}>
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="h-8 w-8 text-[#1D68E3] animate-spin" />
                    <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Loading project details…</p>
                </div>
            ) : accessDenied ? (
                <div className={`${Z_CARD} p-6 text-center`}>
                        <ShieldCheck className="h-9 w-9 text-amber-500 mx-auto mb-3" />
                        <h2 className="text-sm font-bold text-[#0F172A] mb-2">Project submission locked</h2>
                        <p className="text-[12px] text-slate-600 font-medium mb-4">{accessDenied}</p>
                        <div className="flex flex-col sm:flex-row gap-2 justify-center">
                            <Link
                                to="/student"
                                className="inline-flex justify-center items-center px-4 py-2 rounded-xl bg-slate-100 text-slate-800 font-bold text-[11px] uppercase tracking-widest"
                            >
                                Back to dashboard
                            </Link>
                            {assignmentId ? (
                                <Link
                                    to={`/student/assignments/${assignmentId}/proposal`}
                                    className={`${Z_BTN_PRIMARY}`}
                                >
                                    Proposal workspace
                                </Link>
                            ) : null}
                        </div>
                </div>
            ) : !project ? (
                <div className="py-12 text-center text-[12px] text-slate-500 font-bold">
                    No assignment data loaded.
                </div>
            ) : (
                <div className={Z_SHELL_INNER}>
                
                {/* Project meta */}
                <div className="mb-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="text-[10px] font-bold text-[#1D68E3] uppercase tracking-[0.2em] mb-1">
                                {project.classCode} / {project.type?.toUpperCase()}
                            </div>
                            <h2 className="text-base font-bold text-[#0F172A] leading-snug tracking-tight max-w-[800px]">
                                {project.title}
                            </h2>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <div
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${getWorkflowBadgeClasses(workflow.tone)}`}
                            >
                                {workflow.label}
                            </div>
                            <div className="bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                                ID: {String(project._id || '').slice(0, 10).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Project Evolution Stepper */}
                <div className="bg-[#F1F5F9] rounded-xl p-4 mb-4 relative">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-4">
                        Project evolution
                    </div>
                    
                    <div className="flex justify-between items-center relative max-w-[1000px] mx-auto">
                        <div className="absolute left-0 right-0 top-5 h-0.5 bg-slate-300 -z-10"></div>
                        
                        <div className="flex flex-col items-center">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-[0_0_0_3px_#F1F5F9] mb-2 ${projectSubmitted ? 'bg-[#1D68E3]' : 'bg-white border-2 border-slate-300 text-slate-400'}`}>
                                <Check className={`h-4 w-4 ${projectSubmitted ? 'text-white' : ''}`} />
                            </div>
                            <div className="text-[9px] font-bold text-[#0F172A] uppercase tracking-widest">Project submitted</div>
                            <div className="text-[9px] font-medium text-slate-400">
                                {formatWorkflowDate(row?.latestProjectSubmission?.createdAt)}
                            </div>
                        </div>

                        <div className="flex flex-col items-center">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-[0_0_0_3px_#F1F5F9] mb-2 ${teacherPreviewed ? 'bg-[#1D68E3]' : 'bg-white border-2 border-slate-300 text-slate-400'}`}>
                                <Cpu className={`h-4 w-4 ${teacherPreviewed ? 'text-white' : ''}`} />
                            </div>
                            <div className="text-[9px] font-bold text-[#0F172A] uppercase tracking-widest">Teacher preview</div>
                            <div className="text-[9px] font-medium text-slate-400">
                                {teacherPreviewed
                                    ? formatWorkflowDate(row?.latestProjectSubmission?.teacherPreviewedAt)
                                    : projectSubmitted
                                      ? 'Waiting'
                                      : '—'}
                            </div>
                        </div>

                        <div className="flex flex-col items-center">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-[0_0_0_3px_#F1F5F9] mb-2 ${feedbackReceived ? 'bg-[#1D68E3]' : 'bg-white border-2 border-slate-300 text-slate-400'}`}>
                                <MessageSquare className={`h-4 w-4 ${feedbackReceived ? 'text-white fill-current' : ''}`} />
                            </div>
                            <div className={`text-[9px] font-bold uppercase tracking-widest ${feedbackReceived ? 'text-[#1D68E3]' : 'text-[#0F172A]'}`}>
                                Teacher feedback
                            </div>
                            <div className={`text-[9px] font-medium ${feedbackReceived ? 'text-[#1D68E3]' : 'text-slate-400'}`}>
                                {feedbackReceived
                                    ? formatWorkflowDate(teacherFeedbackEntries[0]?.reviewedAt)
                                    : teacherPreviewed
                                      ? 'Pending'
                                      : '—'}
                            </div>
                        </div>
                    </div>
                </div>

                {teacherFeedbackEntries.length ? (
                    <StudentProjectFeedbackPanel entries={teacherFeedbackEntries} className="mb-4" />
                ) : null}

                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 space-y-4">
                        
                        {/* Abstract */}
                        <div className={`${Z_CARD} p-4 relative group`}>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">Research abstract</h3>
                                <button 
                                    onClick={() => setIsEditingAbstract(!isEditingAbstract)}
                                    className="p-2 text-slate-400 hover:text-[#1D68E3] hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit Abstract"
                                >
                                    <Edit2 className="h-5 w-5" />
                                </button>
                            </div>

                            {isEditingAbstract ? (
                                <div className="mb-4">
                                    <textarea 
                                        value={abstractText}
                                        onChange={(e) => setAbstractText(e.target.value)}
                                        className="w-full min-h-[140px] p-3 bg-[#F8FAFB] border border-slate-200 rounded-xl text-[13px] font-medium text-slate-600 focus:outline-none focus:border-[#1D68E3] focus:ring-2 focus:ring-blue-100 transition-all resize-y"
                                        placeholder="Write your research abstract here..."
                                    />
                                    <div className="flex justify-end mt-2">
                                        <button 
                                            onClick={() => setIsEditingAbstract(false)}
                                            className={`${Z_BTN_PRIMARY}`}
                                        >
                                            Save abstract
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-4 space-y-2">
                                    {abstractText.split('\n\n').map((paragraph, idx) => (
                                        <p key={idx} className="text-[13px] font-medium text-slate-500 leading-relaxed">
                                            {paragraph}
                                        </p>
                                    ))}
                                </div>
                            )}
                            
                            <hr className="border-slate-100 mb-3" />
                            
                            <div className="flex gap-2 flex-wrap">
                                {(project.featureTags.length ? project.featureTags : ['Proposal features']).map((tag, ti) => (
                                    <span key={`${tag}-${ti}`} className="bg-slate-100 text-[#0F172A] px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Project code ZIP */}
                        <div className={`${Z_CARD} border-emerald-100 p-4`}>
                            <div className="flex items-start gap-2 mb-3">
                                <FileArchive className="h-6 w-6 text-emerald-600 shrink-0" />
                                <div>
                                    <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">Project code (.zip)</h3>
                                    <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
                                        Select your ZIP, then click Upload. You can replace the file until the project deadline (same
                                        submission id, version increments).
                                    </p>
                                    <p className="mt-2 text-xs font-bold text-slate-600">
                                        Submitting as: <span className="text-emerald-800">{user?.name || 'You'}</span>
                                    </p>
                                    {row?.assignment?.projectDeadline && (
                                        <p className="text-xs font-bold text-slate-500 mt-1">
                                            Deadline: {new Date(row.assignment.projectDeadline).toLocaleString()}
                                            {row.projectDeadlinePassed ? (
                                                <span className="text-rose-600"> — closed</span>
                                            ) : null}
                                        </p>
                                    )}
                                    {row?.latestProjectSubmission && (
                                        <p className="text-xs font-bold text-slate-400 mt-2">
                                            Current: {row.latestProjectSubmission.originalFilename} (
                                            {Math.round((row.latestProjectSubmission.sizeBytes || 0) / 1024)} KB)
                                            {row.latestProjectSubmission.version
                                                ? ` · v${row.latestProjectSubmission.version}`
                                                : ''}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {row?.projectDeadlinePassed && projectSubmitted ? (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                    <p className="text-sm font-bold text-emerald-900">Project submitted</p>
                                    <p className="mt-1 text-xs text-emerald-800">
                                        {row.latestProjectSubmission.originalFilename} · v
                                        {row.latestProjectSubmission.version || 1} ·{' '}
                                        {new Date(row.latestProjectSubmission.createdAt).toLocaleString()}
                                    </p>
                                    <p className="mt-2 text-xs font-medium text-emerald-700">
                                        The deadline has passed — your submission is locked. Your teacher can still preview and leave feedback.
                                    </p>
                                </div>
                            ) : row?.projectDeadlinePassed ? (
                                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                                    {DEADLINE_DUE_STUDENT_MESSAGE}
                                </p>
                            ) : (
                                <>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 mt-4">
                                        Project type
                                    </p>
                                    <select
                                        value={projectStackHint}
                                        onChange={(e) => setProjectStackHint(e.target.value)}
                                        disabled={codeZipBusy}
                                        className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800"
                                    >
                                        <option value="">General project (auto-detect on preview)</option>
                                        <option value="static-html">HTML + CSS only</option>
                                        <option value="static-html-js">HTML + CSS + JavaScript</option>
                                    </select>
                                    {projectStackHint === 'static-html' && (
                                        <p className="mb-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900">
                                            ZIP must include <strong>index.html</strong> and <strong>.css</strong> files (no{' '}
                                            <strong>.js</strong>). Example: index.html, styles.css, about.html
                                        </p>
                                    )}
                                    {projectStackHint === 'static-html-js' && (
                                        <p className="mb-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900">
                                            ZIP must include <strong>index.html</strong>, <strong>.css</strong>, and{' '}
                                            <strong>.js</strong> files. Example: index.html, style.css, script.js
                                        </p>
                                    )}
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                                        Step 1 — Choose ZIP
                                    </p>
                                    <input
                                        type="file"
                                        ref={zipInputRef}
                                        accept=".zip,application/zip"
                                        disabled={codeZipBusy}
                                        onChange={(e) => onZipFilePicked(e.target.files?.[0] || null)}
                                        className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                                    />
                                    {selectedZipFile ? (
                                        <p className="mb-3 text-sm font-semibold text-slate-700">
                                            Selected: {selectedZipFile.name} ({Math.round(selectedZipFile.size / 1024)} KB)
                                        </p>
                                    ) : null}
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                                        Step 2 — Upload
                                    </p>
                                    <button
                                        type="button"
                                        disabled={codeZipBusy || !selectedZipFile}
                                        onClick={handleProjectZipUpload}
                                        className={`${Z_BTN_PRIMARY} bg-emerald-600 hover:bg-emerald-700`}
                                    >
                                        {codeZipBusy ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Uploading…
                                            </>
                                        ) : (
                                            <>
                                                <UploadCloud className="h-4 w-4" />
                                                {row?.latestProjectSubmission ? 'Update project ZIP' : 'Upload project ZIP'}
                                            </>
                                        )}
                                    </button>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 mt-6">
                                        Step 3 — Project screenshot (for Verified Projects gallery)
                                    </p>
                                    <p className="mb-3 text-xs font-medium text-slate-500">
                                        Upload a PNG or JPG showing how your app looks (homepage or main screen).
                                    </p>
                                    <input
                                        type="file"
                                        ref={screenshotInputRef}
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        disabled={codeZipBusy || screenshotBusy}
                                        onChange={(e) => setSelectedScreenshotFile(e.target.files?.[0] || null)}
                                        className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                                    />
                                    {selectedScreenshotFile ? (
                                        <p className="mb-3 text-sm font-semibold text-slate-700">
                                            Selected: {selectedScreenshotFile.name}
                                        </p>
                                    ) : null}
                                    <button
                                        type="button"
                                        disabled={screenshotBusy || !selectedScreenshotFile || !row?.latestProjectSubmission}
                                        onClick={handleScreenshotUpload}
                                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#2a3fa4] text-[#2a3fa4] text-sm font-black uppercase tracking-widest hover:bg-blue-50 disabled:opacity-50"
                                    >
                                        {screenshotBusy ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Saving…
                                            </>
                                        ) : (
                                            'Save screenshot only'
                                        )}
                                    </button>
                                    {!row?.latestProjectSubmission ? (
                                        <p className="mt-2 text-xs text-slate-400">Upload your ZIP first, or attach a screenshot with the ZIP upload above.</p>
                                    ) : null}
                                </>
                            )}
                            {codeZipMessage && (
                                <p className="mt-3 text-sm font-medium text-slate-600">{codeZipMessage}</p>
                            )}
                        </div>

                        {/* Asset Repository */}
                        <div className={`${Z_CARD} p-4`}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">Asset repository</h3>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-[13px] font-black text-[#1D68E3] flex items-center gap-2 hover:underline"
                                >
                                    <Upload className="h-4 w-4" /> Upload New
                                </button>
                            </div>

                            {/* Dropzone */}
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                                className={`border-2 border-dashed rounded-xl p-4 mb-4 relative overflow-hidden group transition-all cursor-pointer text-center flex flex-col items-center justify-center 
                                    ${isDragging ? 'border-[#1D68E3] bg-blue-50/50' : 'border-slate-200 bg-white hover:border-[#1D68E3] hover:bg-blue-50/50'}`}
                            >
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    onChange={(e) => {
                                        if (e.target.files?.length) handleFileUpload(e.target.files[0]);
                                    }}
                                    accept=".pdf,.zip,.rar,.docx,.doc,.md"
                                />
                                
                                {isUploading ? (
                                    <div className="flex flex-col items-center justify-center py-4">
                                        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-[#1D68E3] animate-spin mb-4"></div>
                                        <div className="text-[13px] font-black text-[#1D68E3]">Uploading to Repository...</div>
                                    </div>
                                ) : (
                                    <div className="py-6">
                                        <div className="w-12 h-12 bg-slate-400 text-white rounded-full flex items-center justify-center mb-4 mx-auto group-hover:bg-[#1D68E3] transition-colors">
                                            <UploadCloud className="h-6 w-6" />
                                        </div>
                                        <div className="text-[14px] font-bold text-[#0F172A] mb-2">
                                            Drag and drop source code or documentation
                                        </div>
                                        <div className="text-[13px] font-medium text-slate-400">
                                            Accepted formats: .ZIP, .PDF, .MD (Max 50MB)
                                        </div>
                                        <div className="text-[11px] font-bold text-slate-500 mt-3 max-w-md mx-auto">
                                            Optional local-only placeholder. Use “Project code (.zip)” above for the real submission used in teacher preview.
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-4">
                                SUBMISSION HISTORY
                            </div>

                            {/* Dynamic Uploaded Files */}
                            <div className="space-y-3">
                                {uploadedFiles.map((file, idx) => (
                                    <div key={idx} className="bg-[#F8FAFB] p-5 rounded-xl border border-slate-100 flex items-center gap-5">
                                        <div className={`w-12 h-12 rounded flex flex-col items-center justify-center gap-1 ${file.type === 'ZIP' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {file.type === 'ZIP' ? <FileArchive className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-[13px] font-bold text-[#0F172A] leading-none mb-1">{file.name}</div>
                                            <div className="text-[11px] font-medium text-slate-400">Uploaded {file.date} &bull; {file.size}</div>
                                        </div>
                                        {/* Optional Download linked if it's not a local dummy link */}
                                        {file.url !== '#' && (
                                            <a href={`${getApiOrigin()}${file.url}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-[#1D68E3] px-3">Download</a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column / Sidebar */}
                    <div className="w-full lg:w-[280px] space-y-3">
                        
                        <div className="bg-[#F1F5F9] rounded-xl p-4">
                            <h3 className="text-sm font-bold text-[#0F172A] mb-3">Group members</h3>
                            
                            <div className="space-y-3">
                                {project.members?.map((member, mIdx) => (
                                    <div key={String(member._id || mIdx)} className="flex items-center gap-3">
                                        <img 
                                            src={member.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=cbd5e1&color=0f172a`} 
                                            alt={member.name} 
                                            className="w-9 h-9 rounded-lg object-cover shadow-sm bg-white" 
                                        />
                                        <div>
                                            <div className="text-[12px] font-bold text-[#0F172A]">{member.name}</div>
                                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                                {mIdx === 0 ? 'Project lead' : 'Collaborator'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-[#1D68E3] rounded-xl p-4 text-white relative overflow-hidden">
                            <h3 className="text-sm font-bold mb-3 relative z-10">ML insights</h3>
                            
                            <div className="space-y-3 mb-3 relative z-10">
                                <div className="flex justify-between items-baseline">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#93C5FD]">Uniqueness</div>
                                    <div className="text-lg font-bold">{100 - (project.similarity || 0)}%</div>
                                </div>
                                <div className="flex justify-between items-baseline pt-1.5 border-t border-blue-500/50">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#93C5FD]">Similarity</div>
                                    <div className="text-base font-bold">{project.similarityLevel || 'Low'}</div>
                                </div>
                            </div>

                            <p className="text-[12px] font-medium leading-relaxed text-blue-100 relative z-10">
                                {project.similarity > 50 
                                    ? "Critical: Significant similarity detected. Please review citations." 
                                    : "The analysis confirms good implementation and technical originality."}
                            </p>
                        </div>

                        <div className="bg-[#F1F5F9] rounded-xl p-4">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-3">Project details</h3>
                            
                            <div className="space-y-2 text-[12px]">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">Class Code</span>
                                    <span className="font-black text-[#0F172A]">{project.classCode}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">Assignment #</span>
                                    <span className="font-black text-[#0F172A]">{project.assignmentNumber}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">Type</span>
                                    <span className="font-black text-[#0F172A] uppercase">{project.type}</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                </div>
            )}

        </div>
    );
};

export default StudentMyProjectDetail;
