import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
    ArrowLeft, 
    Download, 
    CheckCircle2, 
    History, 
    BarChart3, 
    FileText, 
    Code, 
    AlertCircle,
    Loader2,
    Check,
    Folder,
    File,
    ChevronRight,
    ChevronDown,
    Globe,
    Terminal,
    Search
} from 'lucide-react';
import teacherService from '../../../services/teacherService';
import ExtractedSubmissionView from '../components/ExtractedSubmissionView';
import { getApiOrigin } from '../../../lib/api';

const formatSubmissionStatus = (status) =>
    String(status || 'Unknown')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

const SubmissionInfoRow = ({ label, value, valueClassName = '' }) => (
    <div className="grid grid-cols-[minmax(0,6.75rem)_minmax(0,1fr)] gap-x-3 gap-y-1 items-start text-sm min-w-0">
        <span className="text-slate-400 dark:text-slate-500 font-bold pt-0.5 leading-snug">{label}</span>
        <span className={`font-black text-right break-words min-w-0 leading-snug ${valueClassName}`}>{value}</span>
    </div>
);

const GroupDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('documentation');

    const apiOrigin = getApiOrigin();
    const sim = group?.similarityDetails || {};
    const doc = group?.documentation || {};
    const proposalText = doc.proposalPlainText || group?.proposal?.plainText || '';
    const projectDownload = doc.projectDownloadPath || group?.project?.downloadPath || group?.documentUrl || '';
    const projectFileName = doc.projectFileName || group?.project?.originalFilename || group?.originalFileName || '';
    const screenshotUrl = doc.screenshotUrl ? `${apiOrigin}${doc.screenshotUrl}` : null;
    const fullReviewUrl =
        group?.assignmentId && group?.proposalId
            ? `/teacher/assignments/${group.assignmentId}/proposals/${group.proposalId}`
            : null;

    const resolveUploadUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `${apiOrigin}${path.startsWith('/') ? path : `/${path}`}`;
    };

    const docUrl = resolveUploadUrl(projectDownload);
    const isPdf = projectFileName?.toLowerCase().endsWith('.pdf');
    const checklist = group?.reviewChecklist?.length
        ? group.reviewChecklist
        : [
            { label: 'No proposal yet', desc: 'Students have not started a proposal', checked: false },
        ];

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await teacherService.getGroupDetails(id);
                if (response.success) {
                    setGroup(response.data);
                }
            } catch (error) {
                console.error("Failed to fetch group details:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B1120]">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    if (!group) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B1120] text-slate-500 dark:text-slate-400 font-bold">Group not found</div>;
    }

    const DocumentationView = () => (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6 xl:gap-10">
            {/* Content Left: Document Viewer */}
            <div className="lg:col-span-8 space-y-8">
                <div className="bg-white dark:bg-[#0F172A] rounded-2xl sm:rounded-3xl lg:rounded-[2rem] shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden min-h-[50vh] lg:min-h-[640px] flex flex-col">
                    <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-rose-500/10 rounded-lg">
                                <FileText className="h-5 w-5 text-rose-500" />
                            </div>
                            <span className="font-black text-slate-700 dark:text-slate-300 text-sm">
                                {proposalText
                                    ? doc.proposalTitle || group.title
                                    : projectFileName || `Project_Group${group.assignmentNumber}`}
                            </span>
                        </div>
                        {docUrl && (
                            <a 
                                href={docUrl} 
                                download 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-[#1D68E3] text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
                            >
                                <Download className="h-4 w-4" /> Download
                            </a>
                        )}
                    </div>

                    <div className="flex-1 bg-slate-100 dark:bg-[#010409] p-4 flex justify-center overflow-auto">
                        {proposalText ? (
                            <div className="w-full max-w-4xl bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#1D68E3]">Proposal documentation</p>
                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">
                                        Status: {String(group.proposalStatus || group.status || 'draft').replace(/_/g, ' ')}
                                    </p>
                                </div>
                                <div className="p-6 max-h-[750px] overflow-auto">
                                    <ExtractedSubmissionView
                                        text={proposalText}
                                        filename={`${(group.title || 'proposal').replace(/\s+/g, '_')}.txt`}
                                        highlightNorms={null}
                                    />
                                </div>
                            </div>
                        ) : docUrl && isPdf ? (
                                <iframe 
                                    src={docUrl} 
                                    title="Project Document" 
                                className="w-full h-full min-h-[50vh] sm:min-h-[480px] lg:min-h-[620px] rounded-lg border-0"
                                />
                        ) : docUrl ? (
                                <div className="flex flex-col items-center justify-center text-center space-y-8 py-20">
                                    <div className="w-28 h-28 bg-white dark:bg-[#0F172A] rounded-3xl flex items-center justify-center shadow-xl border border-slate-100 dark:border-white/5">
                                        <FileText className="h-14 w-14 text-[#1D68E3]" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                                        {projectFileName}
                                        </h3>
                                        <p className="text-slate-500 font-bold text-sm">
                                        Project archive • Status: <span className="text-emerald-500">{group.status}</span>
                                        </p>
                                    </div>
                                    <a 
                                        href={docUrl} 
                                        download 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                    className="bg-[#1D68E3] text-white px-6 py-3 sm:px-8 sm:py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-blue-500/20 flex items-center gap-3"
                                    >
                                    <Download className="h-5 w-5" /> Download project ZIP
                                    </a>
                                </div>
                        ) : screenshotUrl ? (
                            <img src={screenshotUrl} alt="Project screenshot" className="max-w-full rounded-lg shadow-lg" />
                        ) : (
                            /* No document submitted yet */
                            <div className="flex flex-col items-center justify-center text-center space-y-8 py-20">
                                <div className="w-28 h-28 bg-white dark:bg-[#0F172A] rounded-3xl flex items-center justify-center shadow-xl border-2 border-dashed border-slate-200 dark:border-white/10">
                                    <FileText className="h-14 w-14 text-slate-300 dark:text-slate-700" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                                        No Document Submitted
                                    </h3>
                                    <p className="text-slate-500 font-bold text-sm max-w-md">
                                        {group.isClassTeamTemplate
                                            ? 'This is a class team template. Students must submit a proposal on the linked assignment before documentation appears here.'
                                            : 'No proposal text or project file yet. Once students submit their proposal or project ZIP, it will appear here.'}
                                    </p>
                                </div>
                                {fullReviewUrl && (
                                    <Link
                                        to={fullReviewUrl}
                                        className="text-[#1D68E3] font-black text-sm uppercase tracking-widest hover:underline"
                                    >
                                        Open full proposal review
                                    </Link>
                                )}
                                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl px-6 py-3 text-amber-600 text-xs font-black uppercase tracking-widest">
                                    Awaiting Submission
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Right: Sidebar */}
            <div className="lg:col-span-4 space-y-8 min-w-0">
                <div className="bg-white dark:bg-[#0F172A] rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-2xl p-4 sm:p-6 lg:p-8 space-y-6 min-w-0 overflow-hidden">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Review Checklist</h3>
                    <div className="space-y-4">
                        {checklist.map((item, i) => (
                            <div key={i} className="flex gap-4 group">
                                <div className={`mt-1 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                    item.checked ? 'bg-[#1D68E3] border-[#1D68E3]' : 'border-slate-300 dark:border-slate-700'
                                }`}>
                                    {item.checked && <Check className="h-3 w-3 text-white stroke-[4]" />}
                                </div>
                                <div>
                                    <p className={`text-sm font-black transition-colors ${item.checked ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>{item.label}</p>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0F172A] rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-2xl p-4 sm:p-6 lg:p-8 space-y-6">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Reviewer Feedback</h3>
                    <textarea 
                        readOnly
                        value={group.reviewerFeedback || ''}
                        placeholder="No teacher feedback yet."
                        className="w-full min-h-[150px] bg-slate-50 dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 rounded-[28px] p-6 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none resize-none"
                    />
                    {fullReviewUrl && (
                        <Link
                            to={fullReviewUrl}
                            className="w-full flex items-center justify-center gap-3 bg-[#1E293B] text-slate-300 hover:bg-slate-700 px-8 py-4 rounded-2xl font-black text-[14px] transition-all"
                        >
                            Open full review &amp; feedback
                        </Link>
                    )}
                </div>

                <div className="bg-white dark:bg-[#0F172A] rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-2xl p-4 sm:p-6 lg:p-8 space-y-6 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-3 text-[#1D68E3]">
                        <BarChart3 className="h-5 w-5 shrink-0" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700 dark:text-[#1D68E3]">Submission Info</h3>
                    </div>
                    <div className="space-y-4 min-w-0">
                        <SubmissionInfoRow
                            label="Status:"
                            value={formatSubmissionStatus(group.proposalStatus || group.status)}
                            valueClassName={
                                group.status === 'SUBMITTED' || group.proposalStatus === 'teacher_approved'
                                    ? 'text-emerald-500'
                                    : 'text-slate-700 dark:text-slate-300'
                            }
                        />
                        <SubmissionInfoRow
                            label="File:"
                            value={projectFileName || proposalText ? 'Proposal / project' : 'None'}
                            valueClassName="text-slate-700 dark:text-slate-300"
                        />
                        <SubmissionInfoRow
                            label="Proposal:"
                            value={group.proposal ? 'Yes' : 'Not yet'}
                            valueClassName={group.proposal ? 'text-emerald-500' : 'text-amber-500'}
                        />
                        <SubmissionInfoRow
                            label="Project ZIP:"
                            value={docUrl ? 'Yes' : 'Not yet'}
                            valueClassName={docUrl ? 'text-emerald-500' : 'text-amber-500'}
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    const SimilarityReportView = () => {
        const hasProposal = Boolean(group.proposal);
        const hasSignal =
            (sim.sameSemesterPercent ?? 0) > 0 ||
            (sim.previousSemesterPercent ?? 0) > 0 ||
            sim.verdict === 'warn_previous_semester' ||
            sim.verdict === 'reject_same_semester';
        const legacy = sim.matchedLegacy;
        const peer = sim.matchedSameSemester;
        const verdictLabel =
            sim.verdict === 'reject_same_semester'
                ? 'High same-semester overlap'
                : sim.verdict === 'warn_previous_semester'
                  ? 'Legacy similarity warning'
                  : 'Low similarity';

        if (!hasProposal) {
            return (
                <div className="bg-white dark:bg-[#0F172A] rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-2xl p-4 sm:p-6 lg:p-10 text-center">
                    <p className="text-slate-500 font-bold">No proposal submitted yet — similarity checks run after students submit.</p>
                </div>
            );
        }

        return (
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                            Similarity Report — {group.title}
                        </h2>
                        <p className="text-slate-500 font-bold mt-1">
                            Advisory only — you make the final approve / revision / reject decision.
                        </p>
                    </div>
                    <span
                        className={`inline-flex px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest border ${
                            sim.verdict === 'reject_same_semester'
                                ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                : sim.verdict === 'warn_previous_semester'
                                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        }`}
                    >
                        {verdictLabel}
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-100 dark:border-white/5 p-6 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Same semester</p>
                        <p className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-2">{sim.sameSemesterPercent ?? 0}%</p>
                    </div>
                    <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-100 dark:border-white/5 p-6 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Legacy / past term</p>
                        <p className="text-3xl font-black text-amber-600 mt-2">{sim.previousSemesterPercent ?? 0}%</p>
                    </div>
                    <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-100 dark:border-white/5 p-6 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Overall signal</p>
                        <p className="text-3xl font-black text-[#1D68E3] mt-2">{group.similarity ?? 0}%</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0F172A] rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-2xl p-4 sm:p-6 lg:p-8 space-y-3">
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">What the AI found</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {sim.humanExplanation || 'No similarity explanation available for this proposal.'}
                    </p>
                    {sim.aiSummary && (
                        <p className="text-[11px] font-mono text-slate-400 border-t border-slate-100 dark:border-white/5 pt-3">
                            Technical: {sim.aiSummary}
                        </p>
                    )}
                    </div>

                {(legacy?.title || peer?.title) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {legacy?.title && (
                            <div className="bg-white dark:bg-[#0F172A] rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-amber-200 dark:border-amber-900/30 shadow-2xl p-4 sm:p-6 lg:p-8 space-y-4">
                                <h3 className="text-lg font-black text-amber-700 dark:text-amber-400">
                                    Matched legacy project ({sim.previousSemesterPercent ?? 0}%)
                                </h3>
                                <p className="text-xl font-black text-slate-800 dark:text-slate-100">{legacy.title}</p>
                                {legacy.ownerLabel && (
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{legacy.ownerLabel}</p>
                                )}
                                {legacy.description && (
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                                        {legacy.description}
                                    </p>
                                )}
                                {Array.isArray(legacy.features) && legacy.features.length > 0 && (
                                    <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                        {legacy.features.map((f) => (
                                            <li key={f}>{f}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                        {peer?.title && (
                            <div className="bg-white dark:bg-[#0F172A] rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-rose-200 dark:border-rose-900/30 shadow-2xl p-4 sm:p-6 lg:p-8 space-y-4">
                                <h3 className="text-lg font-black text-rose-600">
                                    Matched same-semester project ({sim.sameSemesterPercent ?? 0}%)
                                </h3>
                                <p className="text-xl font-black text-slate-800 dark:text-slate-100">{peer.title}</p>
                                {peer.studentName && (
                                    <p className="text-xs font-bold text-slate-500">Submitted by {peer.studentName}</p>
                                )}
                                {peer.description && (
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                                        {peer.description}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {(sim.recommendationText || (sim.suggestedFeatures?.length ?? 0) > 0) && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-blue-200 dark:border-blue-900/30 p-8 space-y-4">
                        <h3 className="text-lg font-black text-[#1D68E3]">Suggested differentiation</h3>
                        {sim.recommendationText && (
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{sim.recommendationText}</p>
                        )}
                        {Array.isArray(sim.suggestedFeatures) && sim.suggestedFeatures.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {sim.suggestedFeatures.map((f) => (
                                    <span
                                        key={f}
                                        className="px-3 py-1.5 rounded-full bg-white dark:bg-[#0F172A] border border-blue-200 dark:border-blue-800 text-xs font-bold text-slate-700 dark:text-slate-200"
                                    >
                                        + {f}
                                    </span>
                                ))}
                            </div>
                        )}
                        </div>
                )}

                {proposalText && (
                    <div className="bg-white dark:bg-[#0F172A] rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-2xl p-4 sm:p-6 lg:p-8">
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4">
                            This group&apos;s proposal (compared above)
                        </h3>
                        <ExtractedSubmissionView
                            text={proposalText}
                            filename="group_proposal.txt"
                            highlightNorms={null}
                        />
                    </div>
                )}

                {!hasSignal && (
                    <p className="text-center text-sm font-bold text-emerald-600">
                        No significant overlap detected — scores are advisory and low.
                    </p>
                )}
            </div>
        );
    };

    const SourceCodeView = () => (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-2xl p-6 sm:p-8 lg:p-12 text-center space-y-6">
            <Code className="h-12 w-12 text-[#1D68E3] mx-auto" />
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Source code &amp; live preview</h3>
            <p className="text-slate-500 font-bold max-w-lg mx-auto">
                {group.project?.downloadPath
                    ? `Project ZIP: ${group.project.originalFilename || 'uploaded'}. Open the full review page to run Docker preview and inspect extracted code.`
                    : 'Students have not uploaded a project ZIP yet. Source analysis is available after project submission.'}
            </p>
            {fullReviewUrl ? (
                <Link
                    to={fullReviewUrl}
                    className="inline-flex items-center gap-2 bg-[#1D68E3] text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] transition-all"
                >
                    Open full project review
                </Link>
            ) : null}
            {docUrl && (
                <a
                    href={docUrl}
                    download
                    className="inline-flex items-center gap-2 text-[#1D68E3] font-bold text-sm"
                >
                    <Download className="h-4 w-4" /> Download project ZIP
                </a>
            )}
        </div>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case 'documentation': return <DocumentationView />;
            case 'source': return <SourceCodeView />;
            case 'similarity': return <SimilarityReportView />;
            default: return <DocumentationView />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] pb-20 text-slate-600 dark:text-slate-300">
            {/* Top Navigation / Header */}
            <div className="max-w-[1600px] mx-auto px-3 py-6 sm:px-4 md:px-6 lg:px-10 safe-area-px">
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-500 hover:text-[#1D68E3] font-bold text-sm mb-6 transition-colors group"
                >
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Overview
                </button>

                <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                                {group.type === 'individual' ? 'Project' : `Group ${group.assignmentNumber}`}: {group.title}
                            </h1>
                            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-full border border-emerald-500/20">
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                    {group.type === 'individual' ? 'Individual' : 'Group'} • {group.similarityLevel} Similarity: {group.similarity}%
                                </span>
                            </div>
                        </div>
                        <p className="text-slate-500 font-bold flex items-center gap-2">
                            Class {group.classCode} • Academic Year 2023/24
                        </p>
                        
                        <div className="flex items-center gap-6 pt-2">
                            <div className="flex -space-x-3">
                                {group.members?.map((member, i) => (
                                    <div key={i} className="w-10 h-10 rounded-xl border-4 border-white dark:border-[#0B1120] bg-slate-50 dark:bg-[#0F172A] flex items-center justify-center overflow-hidden shadow-sm">
                                         {member.photo && member.photo !== 'default-student.jpg' ? (
                                            <img src={member.photo.startsWith('http') ? member.photo : `${apiOrigin}/uploads/${member.photo}`} className="w-full h-full object-cover" alt="" />
                                        ) : <span className="text-xs font-black text-slate-400 dark:text-slate-600">{member?.name?.[0] || '?'}</span>}
                                    </div>
                                ))}
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-0.5">Team Members</h4>
                                 <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{group.members?.map(m => m.name?.split(' ')?.[0] || 'Unknown').join(', ')}</p>
                            </div>
                            <button className="flex items-center gap-2 text-[#1D68E3] hover:text-blue-400 font-bold text-[13px] ml-4">
                                <History className="h-4 w-4" />
                                View Revision History
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        {(docUrl || fullReviewUrl) ? (
                            docUrl ? (
                            <a 
                                href={docUrl} 
                                download 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-300 px-6 py-4 rounded-2xl font-black text-[14px] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xl"
                            >
                                <Download className="h-5 w-5" />
                                Download Files
                            </a>
                            ) : (
                            <Link
                                to={fullReviewUrl}
                                className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-300 px-6 py-4 rounded-2xl font-black text-[14px] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xl"
                            >
                                <FileText className="h-5 w-5" />
                                Open proposal
                            </Link>
                            )
                        ) : (
                            <button disabled className="opacity-50 flex-1 lg:flex-none flex items-center justify-center gap-3 bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-300 px-6 py-4 rounded-2xl font-black text-[14px] shadow-xl cursor-not-allowed">
                                <Download className="h-5 w-5" />
                                No Files Yet
                            </button>
                        )}
                        <button className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-[#1D68E3] text-white px-8 py-4 rounded-2xl font-black text-[14px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20">
                            <CheckCircle2 className="h-5 w-5" />
                            Approve Project
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 lg:px-10 safe-area-px">
                {/* Tabs */}
                <div className="flex items-center gap-8 border-b border-slate-100 dark:border-white/5 mb-8">
                    {[
                        { id: 'documentation', label: 'Project Documentation', icon: FileText },
                        { id: 'source', label: 'Source Code Analysis', icon: Code },
                        { id: 'similarity', label: 'Similarity Report', icon: AlertCircle },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 pb-4 text-[15px] font-black transition-all relative ${
                                activeTab === tab.id ? 'text-[#1D68E3]' : 'text-slate-600 hover:text-slate-400'
                            }`}
                        >
                            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-[#1D68E3] rounded-full" />}
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {renderTabContent()}
            </div>
        </div>
    );
};

export default GroupDetailPage;
