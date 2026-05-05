import React, { useEffect, useState, useRef, useMemo } from 'react';
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
import { useAuth } from '../../../context/authContext';
import StudentHeader from '../components/StudentHeader';
import studentService from '../../../services/studentService';
import { getApiOrigin } from '../../../lib/api';

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
    const [codeZipBusy, setCodeZipBusy] = useState(false);
    const [codeZipMessage, setCodeZipMessage] = useState('');

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
            alert('Optional asset uploads are not connected to the API. Use “Project code (.zip)” below for teacher sandbox preview.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleProjectZipSelected = async (file) => {
        if (!file || !assignmentId) return;
        const name = (file.name || '').toLowerCase();
        if (!name.endsWith('.zip')) {
            setCodeZipMessage('Please choose a .zip file.');
            return;
        }
        setCodeZipBusy(true);
        setCodeZipMessage('');
        try {
            const res = await studentService.submitProjectCode(assignmentId, file);
            if (res.success) {
                setCodeZipMessage(`Uploaded: ${res.data?.originalFilename || file.name}. Your teacher can start a sandbox preview after refresh.`);
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
        <div className="min-h-screen bg-[#F8FAFB] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
            {/* Standardized Header */}
            <StudentHeader />

            {loading ? (
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
                    <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Loading Project details...</p>
                </div>
            ) : accessDenied ? (
                <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                    <div className="bg-white rounded-2xl border border-slate-200 p-10 shadow-sm">
                        <ShieldCheck className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                        <h1 className="text-xl font-black text-[#0F172A] mb-3">Project submission locked</h1>
                        <p className="text-slate-600 font-medium mb-8">{accessDenied}</p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Link
                                to="/student"
                                className="inline-flex justify-center items-center px-6 py-3 rounded-xl bg-slate-100 text-slate-800 font-black text-xs uppercase tracking-widest"
                            >
                                Back to dashboard
                            </Link>
                            {assignmentId ? (
                                <Link
                                    to={`/student/assignments/${assignmentId}/proposal`}
                                    className="inline-flex justify-center items-center px-6 py-3 rounded-xl bg-[#1D68E3] text-white font-black text-xs uppercase tracking-widest"
                                >
                                    Proposal workspace
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </main>
            ) : !project ? (
                <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-slate-500 font-bold">
                    No assignment data loaded.
                </main>
            ) : (
                <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
                
                {/* Page Header */}
                <div className="mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] font-black text-[#1D68E3] uppercase tracking-[0.2em] mb-3">
                                {project.classCode} / {project.type?.toUpperCase()}
                            </div>
                            <h1 className="text-[48px] font-black text-[#0F172A] leading-[1.05] tracking-tight max-w-[800px]">
                                {project.title}
                            </h1>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <div className="bg-slate-200 text-slate-600 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest">
                                {project.status}
                            </div>
                            <div className="bg-slate-200 text-slate-600 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest">
                                ID: {String(project._id || '').slice(0, 10).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Project Evolution Stepper */}
                <div className="bg-[#F1F5F9] rounded-2xl p-8 mb-8 relative">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-10">
                        PROJECT EVOLUTION
                    </div>
                    
                    <div className="flex justify-between items-center relative max-w-[1000px] mx-auto">
                        <div className="absolute left-0 right-0 top-6 h-0.5 bg-slate-300 -z-10"></div>
                        
                        {/* Node 1 */}
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-[#1D68E3] rounded-full flex items-center justify-center shadow-[0_0_0_4px_#F1F5F9] mb-3">
                                <Check className="h-5 w-5 text-white" />
                            </div>
                            <div className="text-[10px] font-black text-[#0F172A] uppercase tracking-widest">SUBMITTED</div>
                            <div className="text-[10px] font-medium text-slate-400">Oct 12, 2024</div>
                        </div>

                        {/* Node 2 */}
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-[#1D68E3] rounded-full flex items-center justify-center shadow-[0_0_0_4px_#F1F5F9] mb-3 relative group">
                                <Cpu className="h-5 w-5 text-white" />
                            </div>
                            <div className="text-[10px] font-black text-[#0F172A] uppercase tracking-widest">ML ANALYSIS</div>
                            <div className="text-[10px] font-medium text-slate-400">Oct 14, 2024</div>
                        </div>

                        {/* Node 3 (Active) */}
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-[#1D68E3] rounded-xl flex items-center justify-center shadow-[0_0_0_4px_#F1F5F9] mb-3 relative">
                                <MessageSquare className="h-5 w-5 text-white fill-current" />
                            </div>
                            <div className="text-[10px] font-black text-[#1D68E3] uppercase tracking-widest">REVIEW</div>
                            <div className="text-[11px] font-medium text-[#1D68E3] italic">Ongoing</div>
                        </div>

                        {/* Node 4 (Pending) */}
                        <div className="flex flex-col items-center grayscale opacity-50">
                            <div className="w-12 h-12 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center shadow-[0_0_0_4px_#F1F5F9] mb-3 text-slate-400">
                                <Check className="h-5 w-5" />
                            </div>
                            <div className="text-[10px] font-black text-[#0F172A] uppercase tracking-widest">DECISION</div>
                            <div className="text-[10px] font-medium text-slate-400">Pending</div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Left Column */}
                    <div className="flex-1 space-y-8">
                        
                        {/* Abstract */}
                        <div className="bg-white rounded-2xl p-10 border border-slate-100 shadow-sm relative group">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-[28px] font-black text-[#0F172A] tracking-tight">Research Abstract</h2>
                                <button 
                                    onClick={() => setIsEditingAbstract(!isEditingAbstract)}
                                    className="p-2 text-slate-400 hover:text-[#1D68E3] hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit Abstract"
                                >
                                    <Edit2 className="h-5 w-5" />
                                </button>
                            </div>

                            {isEditingAbstract ? (
                                <div className="mb-10">
                                    <textarea 
                                        value={abstractText}
                                        onChange={(e) => setAbstractText(e.target.value)}
                                        className="w-full min-h-[200px] p-4 bg-[#F8FAFB] border border-slate-200 rounded-xl text-[15px] font-medium text-slate-600 focus:outline-none focus:border-[#1D68E3] focus:ring-2 focus:ring-blue-100 transition-all resize-y"
                                        placeholder="Write your research abstract here..."
                                    />
                                    <div className="flex justify-end mt-4">
                                        <button 
                                            onClick={() => setIsEditingAbstract(false)}
                                            className="bg-[#1D68E3] text-white px-6 py-2 rounded-lg text-[13px] font-black tracking-wide hover:shadow-lg transition-all"
                                        >
                                            Save Abstract
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-10 space-y-4">
                                    {abstractText.split('\n\n').map((paragraph, idx) => (
                                        <p key={idx} className="text-[15px] font-medium text-slate-500 leading-relaxed">
                                            {paragraph}
                                        </p>
                                    ))}
                                </div>
                            )}
                            
                            <hr className="border-slate-100 mb-8" />
                            
                            <div className="flex gap-2 flex-wrap">
                                {(project.featureTags.length ? project.featureTags : ['Proposal features']).map((tag, ti) => (
                                    <span key={`${tag}-${ti}`} className="bg-slate-100 text-[#0F172A] px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Project code ZIP — used for teacher Docker preview */}
                        <div className="bg-white rounded-2xl p-10 border border-emerald-100 shadow-sm">
                            <div className="flex items-start gap-3 mb-4">
                                <FileArchive className="h-8 w-8 text-emerald-600 shrink-0" />
                                <div>
                                    <h2 className="text-[22px] font-black text-[#0F172A] tracking-tight">Project code (.zip)</h2>
                                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                        Upload a ZIP of your project (static HTML/CSS/JS works best for the default preview server).
                                        Your proposal must be teacher-approved. The archive is scanned for unsafe paths before any preview runs.
                                    </p>
                                    {row?.latestProjectSubmission && (
                                        <p className="text-xs font-bold text-slate-400 mt-2">
                                            Last upload: {row.latestProjectSubmission.originalFilename} (
                                            {Math.round((row.latestProjectSubmission.sizeBytes || 0) / 1024)} KB)
                                        </p>
                                    )}
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={zipInputRef}
                                className="hidden"
                                accept=".zip,application/zip"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleProjectZipSelected(f);
                                }}
                            />
                            <button
                                type="button"
                                disabled={codeZipBusy}
                                onClick={() => zipInputRef.current?.click()}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {codeZipBusy ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Uploading…
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud className="h-4 w-4" />
                                        Choose ZIP & upload
                                    </>
                                )}
                            </button>
                            {codeZipMessage && (
                                <p className="mt-3 text-sm font-medium text-slate-600">{codeZipMessage}</p>
                            )}
                        </div>

                        {/* Asset Repository & Uploader */}
                        <div className="bg-white rounded-2xl p-10 border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-[28px] font-black text-[#0F172A] tracking-tight">Asset Repository</h2>
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
                                className={`border-2 border-dashed rounded-xl p-8 mb-10 relative overflow-hidden group transition-all cursor-pointer text-center flex flex-col items-center justify-center 
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
                    <div className="w-full lg:w-[350px] space-y-6">
                        
                        {/* Group Members */}
                        <div className="bg-[#F1F5F9] rounded-2xl p-8">
                            <h3 className="text-[20px] font-black text-[#0F172A] mb-6">Group Members</h3>
                            
                            <div className="space-y-6">
                                {project.members?.map((member, mIdx) => (
                                    <div key={String(member._id || mIdx)} className="flex items-center gap-4">
                                        <img 
                                            src={member.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=cbd5e1&color=0f172a`} 
                                            alt={member.name} 
                                            className="w-12 h-12 rounded-xl object-cover shadow-sm bg-white" 
                                        />
                                        <div>
                                            <div className="text-[13px] font-black text-[#0F172A]">{member.name}</div>
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                                                {mIdx === 0 ? 'PROJECT LEAD' : 'COLABORATOR'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ML Insights */}
                        <div className="bg-[#1D68E3] rounded-2xl p-8 text-white relative overflow-hidden">
                            <h3 className="text-[18px] font-black mb-6 relative z-10">ML Insights</h3>
                            
                            <div className="space-y-4 mb-6 relative z-10">
                                <div className="flex justify-between items-baseline">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-[#93C5FD]">UNIQUENESS</div>
                                    <div className="text-[24px] font-black">{100 - (project.similarity || 0)}%</div>
                                </div>
                                <div className="flex justify-between items-baseline pt-2 border-t border-blue-500/50">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-[#93C5FD]">SIMILARITY</div>
                                    <div className="text-[20px] font-black">{project.similarityLevel || 'Low'}</div>
                                </div>
                            </div>

                            <p className="text-[13px] font-medium leading-relaxed text-blue-100 relative z-10">
                                {project.similarity > 50 
                                    ? "Critical: Significant similarity detected. Please review citations." 
                                    : "The analysis confirms good implementation and technical originality."}
                            </p>
                        </div>

                        {/* Project Details Sheet */}
                        <div className="bg-[#F1F5F9] rounded-2xl p-8">
                            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] mb-6">PROJECT DETAILS</h3>
                            
                            <div className="space-y-4 text-[13px]">
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

                </main>
            )}

            {/* ScholarVerify Footer */}
            <footer className="mt-20 py-12 bg-[#1B2533] text-white text-center flex flex-col md:flex-row items-center justify-between px-10 max-w-[1536px] mx-auto w-full">
                <div className="font-black text-white mb-6 md:mb-0 text-xl tracking-tighter">
                    ScholarVerify
                </div>
                
                <div className="flex gap-8 mb-6 md:mb-0">
                    <a href="#" className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors">Privacy Policy</a>
                    <a href="#" className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors">Terms of Service</a>
                    <a href="#" className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors">Institutional Access</a>
                    <a href="#" className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors">Support</a>
                </div>

                <div className="flex items-center gap-6 text-[11px] font-medium text-slate-400">
                    <div>&copy; 2024 ScholarVerify Academic Systems. All research rights reserved.</div>
                    <a href="#" className="text-[#1D68E3] hover:text-blue-300 transition-colors">English</a>
                </div>
            </footer>
        </div>
    );
};

export default StudentMyProjectDetail;
