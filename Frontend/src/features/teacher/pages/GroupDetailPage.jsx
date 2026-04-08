import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

const GroupDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('documentation');
    const [selectedFile, setSelectedFile] = useState('app.js');
    const [comparingWith, setComparingWith] = useState(null);

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

    const isPdf = group.originalFileName?.toLowerCase().endsWith('.pdf');
    const docUrl = group.documentUrl ? `http://localhost:5000${group.documentUrl}` : null;

    const DocumentationView = () => (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Content Left: Document Viewer */}
            <div className="lg:col-span-8 space-y-8">
                <div className="bg-white dark:bg-[#0F172A] rounded-[40px] shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden min-h-[800px] flex flex-col">
                    <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-rose-500/10 rounded-lg">
                                <FileText className="h-5 w-5 text-rose-500" />
                            </div>
                            <span className="font-black text-slate-700 dark:text-slate-300 text-sm">
                                {group.originalFileName || `Project_Group${group.assignmentNumber}`}
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
                        {docUrl ? (
                            isPdf ? (
                                <iframe 
                                    src={docUrl} 
                                    title="Project Document" 
                                    className="w-full h-full min-h-[750px] rounded-lg border-0"
                                />
                            ) : (
                                /* Non-PDF file — show a download card */
                                <div className="flex flex-col items-center justify-center text-center space-y-8 py-20">
                                    <div className="w-28 h-28 bg-white dark:bg-[#0F172A] rounded-3xl flex items-center justify-center shadow-xl border border-slate-100 dark:border-white/5">
                                        <FileText className="h-14 w-14 text-[#1D68E3]" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                                            {group.originalFileName}
                                        </h3>
                                        <p className="text-slate-500 font-bold text-sm">
                                            Document submitted by student • Status: <span className="text-emerald-500">{group.status}</span>
                                        </p>
                                    </div>
                                    <a 
                                        href={docUrl} 
                                        download 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="bg-[#1D68E3] text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-blue-500/20 flex items-center gap-3"
                                    >
                                        <Download className="h-5 w-5" /> Download Document
                                    </a>
                                </div>
                            )
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
                                        The students have not yet uploaded their project documentation. Once submitted, the document will appear here for review.
                                    </p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl px-6 py-3 text-amber-600 text-xs font-black uppercase tracking-widest">
                                    Awaiting Submission
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Right: Sidebar */}
            <div className="lg:col-span-4 space-y-8">
                <div className="bg-white dark:bg-[#0F172A] rounded-[40px] border border-slate-100 dark:border-white/5 shadow-2xl p-8 space-y-6">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Review Checklist</h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Abstract & Introduction', desc: 'Verified and relevant', checked: true },
                            { label: 'Methodology Section', desc: 'Correct implementation', checked: true },
                            { label: 'Result Analysis', desc: 'Needs more data charts', checked: false },
                            { label: 'Conclusion & Future Work', desc: 'Pending review', checked: false },
                        ].map((item, i) => (
                            <div key={i} className="flex gap-4 group cursor-pointer">
                                <div className={`mt-1 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                    item.checked ? 'bg-[#1D68E3] border-[#1D68E3]' : 'border-slate-700'
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

                <div className="bg-white dark:bg-[#0F172A] rounded-[40px] border border-slate-100 dark:border-white/5 shadow-2xl p-8 space-y-6">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Reviewer Feedback</h3>
                    <textarea 
                        placeholder="Write your feedback for the students..."
                        className="w-full min-h-[150px] bg-slate-50 dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 rounded-[28px] p-6 text-sm font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 resize-none"
                    ></textarea>
                    <button className="w-full flex items-center justify-center gap-3 bg-[#1E293B] text-slate-300 hover:bg-slate-700 px-8 py-4 rounded-2xl font-black text-[14px] transition-all">
                        Request Revision
                    </button>
                </div>

                <div className="bg-white dark:bg-[#0F172A] rounded-[40px] border border-slate-100 dark:border-white/5 shadow-2xl p-8 space-y-6">
                    <div className="flex items-center gap-3 text-[#1D68E3]">
                        <BarChart3 className="h-5 w-5" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700 dark:text-[#1D68E3]">Submission Info</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400 dark:text-slate-500 font-bold">Status:</span>
                            <span className={`font-black ${group.status === 'SUBMITTED' ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-300'}`}>{group.status}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400 dark:text-slate-500 font-bold">File:</span>
                            <span className="font-black text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{group.originalFileName || 'None'}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400 dark:text-slate-500 font-bold">Submitted:</span>
                            <span className={`font-black ${group.documentUrl ? 'text-emerald-500' : 'text-amber-500'}`}>{group.documentUrl ? 'Yes' : 'Not yet'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const SourceCodeView = () => (
        <div className="bg-white dark:bg-[#0B1120] rounded-[40px] shadow-2xl overflow-hidden min-h-[800px] flex flex-col md:flex-row border border-slate-100 dark:border-white/5">
            {/* File Explorer Sidebar */}
            <div className={`${comparingWith ? 'hidden lg:flex' : 'flex'} w-64 bg-slate-50 dark:bg-[#0F172A] border-r border-slate-100 dark:border-white/5 flex-col`}>
                <div className="p-6 border-b border-slate-100 dark:border-white/5">
                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">File Explorer</h4>
                </div>
                <div className="flex-1 p-4 space-y-2 overflow-auto">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-300 p-2 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-white/5 transition-colors">
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                            <Folder className="h-4 w-4 text-[#1D68E3]" />
                            <span className="text-sm font-bold">src</span>
                        </div>
                        <div className="pl-6 space-y-1">
                            <div className="flex items-center gap-2 text-slate-400 p-2 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-white/5 transition-colors">
                                <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                                <Folder className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                                <span className="text-sm font-bold">components</span>
                            </div>
                            <div className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${selectedFile === 'app.js' ? 'bg-[#1D68E3]/10 text-[#1D68E3]' : 'text-slate-400 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'}`}>
                                <File className="h-4 w-4 opacity-70" />
                                <span className="text-sm font-bold">app.js</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Code Editor Area */}
            <div className="flex-1 flex flex-col bg-slate-50 dark:bg-[#010409]">
                {/* Editor Header / Tabs */}
                <div className="flex items-center justify-between bg-white dark:bg-[#0D1117] border-b border-slate-100 dark:border-white/5 px-2">
                    <div className="flex">
                        <div className="flex items-center gap-2 px-6 py-3.5 bg-slate-50 dark:bg-[#010409] border-r border-slate-100 dark:border-white/5 text-blue-600 dark:text-blue-400 text-xs font-black">
                            <File className="h-3.5 w-3.5" />
                            {comparingWith ? `Comparison: Group ${group.assignmentNumber} vs Group ${comparingWith}` : 'app.js'}
                        </div>
                    </div>
                    {comparingWith && (
                        <button 
                            onClick={() => setComparingWith(null)}
                            className="mr-4 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-400 transition-colors"
                        >
                            Exit Comparison
                        </button>
                    )}
                </div>

                <div className={`flex-1 flex ${comparingWith ? 'divide-x divide-slate-100 dark:divide-white/5' : ''} overflow-hidden`}>
                    {/* Left Panel (Current Group) */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {comparingWith && (
                            <div className="bg-white dark:bg-[#0D1117]/50 px-8 py-2 border-b border-slate-100 dark:border-white/5">
                                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Group {group.assignmentNumber} (Original)</span>
                            </div>
                        )}
                        <div className="flex-1 p-8 font-mono text-[13px] leading-relaxed overflow-auto scrollbar-hide">
                            {[
                                { line: 1, content: <><span className="text-purple-600 dark:text-purple-400">import</span> React, {'{'} <span className="text-amber-600 dark:text-amber-400">useState</span> {'}'} <span className="text-purple-600 dark:text-purple-400">from</span> <span className="text-emerald-600 dark:text-emerald-400">'react'</span>;</> },
                                { line: 2, content: <><span className="text-purple-600 dark:text-purple-400">import</span> {'{'} <span className="text-blue-600 dark:text-blue-400">VerifyAPI</span> {'}'} <span className="text-purple-600 dark:text-purple-400">from</span> <span className="text-emerald-600 dark:text-emerald-400">'./utils/api'</span>;</> },
                                { line: 3, content: '', highlight: true },
                                { line: 4, content: <><span className="text-purple-600 dark:text-purple-400">const</span> <span className="text-amber-600 dark:text-amber-400">DocumentVerifier</span> = () ={'>'} {'{'}</>, highlight: true },
                                { line: 5, content: <>  <span className="text-purple-600 dark:text-purple-400">const</span> [<span className="text-slate-700 dark:text-slate-300">status</span>, <span className="text-blue-600 dark:text-blue-400">setStatus</span>] = <span className="text-amber-600 dark:text-amber-400">useState</span>(<span className="text-emerald-600 dark:text-emerald-400">'idle'</span>);</>, highlight: true },
                                { line: 6, content: '', highlight: true },
                                { line: 7, content: <><span className="text-purple-600 dark:text-purple-400">  const</span> <span className="text-blue-600 dark:text-blue-400">handleVerification</span> = <span className="text-purple-600 dark:text-purple-400">async</span> (<span className="text-slate-700 dark:text-slate-300">docId</span>) ={'>'} {'{'}</>, highlight: true },
                                { line: 8, content: <><span className="text-slate-400 dark:text-slate-500">    // Initialize verification engine</span></> },
                                { line: 9, content: <><span className="text-blue-600 dark:text-blue-400">    setStatus</span>(<span className="text-emerald-600 dark:text-emerald-400">'processing'</span>);</>, highlight: true },
                                { line: 10, content: <><span className="text-purple-600 dark:text-purple-400">    try</span> {'{'}</> },
                                { line: 11, content: <><span className="text-purple-600 dark:text-purple-400">      const</span> <span className="text-slate-700 dark:text-slate-300">result</span> = <span className="text-purple-600 dark:text-purple-400">await</span> <span className="text-blue-600 dark:text-blue-400">VerifyAPI</span>.<span className="text-amber-600 dark:text-amber-400">analyze</span>(<span className="text-slate-700 dark:text-slate-300">docId</span>);</> }
                             ].map((row, i) => (
                                <div key={i} className={`flex group ${row.highlight && comparingWith ? 'bg-amber-400/10' : 'hover:bg-slate-200 dark:hover:bg-white/5'} transition-colors`}>
                                    <span className={`w-10 text-right pr-4 select-none text-[10px] ${row.highlight && comparingWith ? 'text-amber-500 font-bold' : 'text-slate-300 dark:text-slate-700 opacity-50'}`}>{row.line}</span>
                                    <span className="text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.content}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Panel (Matched Group) - Only in comparison mode */}
                    {comparingWith && (
                        <div className="flex-1 flex flex-col min-w-0 bg-slate-100 dark:bg-[#010409]">
                            <div className="bg-white dark:bg-[#0D1117]/50 px-8 py-2 border-b border-slate-100 dark:border-white/5 flex justify-between">
                                <span className="text-[9px] font-black text-[#1D68E3] uppercase tracking-[0.2em]">Group {comparingWith} (Matched)</span>
                                <span className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em]">84% Match</span>
                            </div>
                            <div className="flex-1 p-8 font-mono text-[13px] leading-relaxed overflow-auto scrollbar-hide">
                                {[
                                    { line: 42, content: <><span className="text-purple-400">import</span> React, {'{'} <span className="text-amber-400">useRef</span> {'}'} <span className="text-purple-400">from</span> <span className="text-emerald-400">'react'</span>;</> },
                                    { line: 43, content: <><span className="text-purple-400">import</span> {'{'} <span className="text-blue-400">VerifyAPI</span> {'}'} <span className="text-purple-400">from</span> <span className="text-emerald-400">'./shared/verify'</span>;</> },
                                    { line: 44, content: '', highlight: true },
                                    { line: 45, content: <><span className="text-purple-400">const</span> <span className="text-amber-400">ValidatorComp</span> = () ={'>'} {'{'}</>, highlight: true },
                                    { line: 46, content: <>  <span className="text-purple-400">const</span> [<span className="text-slate-300">state</span>, <span className="text-blue-400">setVal</span>] = <span className="text-amber-400">useState</span>(<span className="text-emerald-400">'idle'</span>);</>, highlight: true },
                                    { line: 47, content: '', highlight: true },
                                    { line: 48, content: <><span className="text-purple-400">  const</span> <span className="text-blue-400">onCheck</span> = <span className="text-purple-400">async</span> (<span className="text-slate-300">id</span>) ={'>'} {'{'}</>, highlight: true },
                                    { line: 49, content: <><span className="text-slate-500">    // Start verify process</span></> },
                                    { line: 50, content: <><span className="text-blue-400">    setVal</span>(<span className="text-emerald-400">'processing'</span>);</>, highlight: true },
                                    { line: 51, content: <><span className="text-purple-400">    try</span> {'{'}</> },
                                    { line: 52, content: <><span className="text-purple-400">      const</span> <span className="text-slate-300">res</span> = <span className="text-purple-400">await</span> <span className="text-blue-400">VerifyAPI</span>.<span className="text-amber-400">analyze</span>(<span className="text-slate-300">id</span>);</> }
                                ].map((row, i) => (
                                    <div key={i} className={`flex group ${row.highlight ? 'bg-amber-400/10' : 'hover:bg-slate-200 dark:hover:bg-white/5'} transition-colors`}>
                                        <span className={`w-10 text-right pr-4 select-none text-[10px] ${row.highlight ? 'text-amber-500 font-bold' : 'text-slate-400 dark:text-slate-700 opacity-50'}`}>{row.line}</span>
                                        <span className="text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.content}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Similarity Sidebar */}
            <div className={`${comparingWith ? 'w-64' : 'w-80'} bg-white dark:bg-[#0F172A] border-l border-slate-100 dark:border-white/5 p-8 space-y-8 overflow-auto transition-all`}>
                <header className="space-y-1">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight">Source Code Similarity</h3>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed">Found 3 matches</p>
                </header>

                <div className="space-y-4">
                    {[
                        { group: '4', match: '14%', detail: 'Matched snippet in utils/api.js' },
                        { group: '12', match: '8%', detail: 'Matched snippet in App.js' },
                    ].map((match, i) => (
                        <div 
                            key={i} 
                            onClick={() => setComparingWith(match.group)}
                            className={`bg-[#0B1120] rounded-[24px] border p-5 space-y-3 transition-all cursor-pointer group ${comparingWith === match.group ? 'border-[#1D68E3] shadow-lg shadow-blue-500/10' : 'border-white/5 hover:border-blue-500/30'}`}
                        >
                            <div className="flex justify-between items-center">
                                <h4 className={`text-[11px] font-black uppercase tracking-widest ${comparingWith === match.group ? 'text-[#1D68E3]' : 'text-slate-300'}`}>Group {match.group}</h4>
                                <span className="text-rose-500 font-black text-[10px]">{match.match} match</span>
                            </div>
                            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">{match.detail}</p>
                            <button className={`w-full py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border ${comparingWith === match.group ? 'bg-[#1D68E3] text-white border-[#1D68E3]' : 'bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700'}`}>
                                {comparingWith === match.group ? 'Comparing Now' : 'Compare Snippets'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const SimilarityReportView = () => {
        const isClean = group.similarity === 0 || group.similarity === '0';

        if (isClean) {
            return (
                <div className="space-y-10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Similarity Analysis</h2>
                            <p className="text-slate-500 dark:text-slate-500 font-bold">Group Project - Similarity Report Overview</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        {/* Document View Panel */}
                        <div className="lg:col-span-7 bg-white dark:bg-[#0F172A] rounded-[40px] border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col min-h-[700px]">
                            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                                <div className="flex items-center gap-4">
                                    <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Document View</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Search className="h-4 w-4 text-slate-600" />
                                    <Download className="h-4 w-4 text-slate-600" />
                                </div>
                            </div>
                            <div className="flex-1 bg-[#010409] p-12 flex justify-center overflow-auto">
                                <div className="w-full max-w-[500px] bg-[#0D1117] shadow-2xl rounded-sm aspect-[1/1.41] p-12 text-center space-y-8 border border-white/5">
                                    <h3 className="text-xl font-black text-slate-300 leading-tight">
                                        Group Project: {group.title}
                                    </h3>
                                    <div className="space-y-3 pointer-events-none opacity-20">
                                        {[1, 2, 3, 4, 5, 6, 7].map(i => (
                                            <div key={i} className={`h-2.5 bg-slate-800 rounded-full ${i % 3 === 0 ? 'w-full' : i % 2 === 0 ? 'w-[85%]' : 'w-[92%]'}`} />
                                        ))}
                                    </div>
                                    <div className="pt-10 space-y-3 pointer-events-none opacity-10">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className={`h-2.5 bg-slate-800 rounded-full ${i % 2 === 0 ? 'w-[80%]' : 'w-full'}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Analysis Details Panel */}
                        <div className="lg:col-span-5 bg-white dark:bg-[#0F172A] rounded-[40px] border border-slate-100 dark:border-white/5 shadow-2xl p-10 flex flex-col items-center justify-center text-center space-y-10">
                            <div className="relative">
                                <div className="w-40 h-40 bg-emerald-500/10 rounded-full flex items-center justify-center">
                                    <div className="w-32 h-32 bg-emerald-500/5 rounded-full flex items-center justify-center">
                                        <div className="bg-emerald-500 rounded-full p-4 text-white shadow-lg shadow-emerald-500/20">
                                            <Check className="h-12 w-12 stroke-[4]" />
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-24 -right-2 bg-emerald-500 text-white text-[13px] font-black px-4 py-1.5 rounded-full border-4 border-white dark:border-[#0F172A] shadow-sm">
                                    0%
                                </div>
                            </div>

                            <div className="space-y-4 max-w-[320px]">
                                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">No Similarity Detected</h3>
                                <p className="text-slate-500 font-bold leading-relaxed">
                                    No matching sources found. This document appears to be completely original and does not match any existing publications in our database.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 w-full">
                                <div className="bg-slate-50 dark:bg-[#0B1120] p-6 rounded-[28px] space-y-2 border border-slate-100 dark:border-white/5">
                                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Words Checked</p>
                                    <p className="text-xl font-black text-slate-700 dark:text-slate-200 tracking-tight">4,281</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-[#0B1120] p-6 rounded-[28px] space-y-2 border border-slate-100 dark:border-white/5">
                                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Database Coverage</p>
                                    <p className="text-xl font-black text-slate-700 dark:text-slate-200 tracking-tight">100%</p>
                                </div>
                            </div>

                            <div className="w-full bg-blue-500/10 rounded-3xl p-6 flex gap-4 text-left border border-blue-500/20">
                                <div className="p-2 bg-[#1D68E3] h-fit rounded-lg text-white">
                                    <Globe className="h-4 w-4" />
                                </div>
                                <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                                    Our system scanned over 90 billion web pages, 82 million scholarly articles, and student papers. No matches were found.
                                </p>
                            </div>

                            <div className="w-full pt-4 flex gap-4">
                                <button className="flex-1 py-4 text-slate-500 font-black text-[13px] hover:text-[#1D68E3] transition-all">Download PDF</button>
                                <button className="flex-1 bg-[#1D68E3] text-white py-4 rounded-2xl font-black text-[13px] shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-all">Share Report</button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-10">
                {/* Report Header Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Detailed Similarity Report: Group {group.assignmentNumber}</h2>
                        <p className="text-slate-500 font-bold">Comparison against all student submissions for Semester 1, 2024.</p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 px-6 py-4 rounded-2xl font-black text-[14px] hover:bg-rose-500/20 transition-all">
                            <AlertCircle className="h-5 w-5" />
                            Flag for Plagiarism
                        </button>
                        <button className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-[#1E293B] border border-white/5 text-slate-300 px-6 py-4 rounded-2xl font-black text-[14px] hover:bg-slate-700 transition-all">
                            <History className="h-5 w-5" />
                            Request Revision
                        </button>
                        <button className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-[#1D68E3] text-white px-8 py-4 rounded-2xl font-black text-[14px] hover:scale-[1.02] shadow-lg shadow-blue-500/10">
                            <CheckCircle2 className="h-5 w-5" />
                            Approve
                        </button>
                    </div>
                </div>

                {/* Document Similarity Comparison */}
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight">Document Similarity</h3>
                        <div className="bg-amber-500/10 text-amber-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
                            MATCH: GROUP 4
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Current Group Panel */}
                        <div className="bg-white dark:bg-[#0F172A] rounded-[40px] border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                                <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Group {group.assignmentNumber} (Current)</span>
                                <FileText className="h-4 w-4 text-slate-400 dark:text-slate-600" />
                            </div>
                            <div className="p-10 text-[15px] leading-relaxed text-slate-400 font-medium space-y-6 max-h-[600px] overflow-auto scrollbar-hide">
                                <p>
                                    The system architecture utilizes a <span className="bg-amber-500/20 text-amber-200 px-1 rounded-sm">highly scalable microservices approach to manage high-volume transaction data</span> while ensuring minimal latency during peak usage hours in a distributed cloud environment. This design pattern was chosen to facilitate independent scaling of individual components, such as the payment gateway and the inventory management system, which experience varying loads throughout the day.
                                </p>
                                <p>
                                    Communication between these services is orchestrated through a message-driven architecture using Apache Kafka. Security is managed via <span className="bg-rose-500/20 text-rose-200 px-1 rounded-sm">OAuth2.0 implementation integrated with JWT for stateless authentication</span> across all gateway endpoints. This ensures that every request is authenticated without the need for server-side session storage, enhancing the overall system throughput.
                                </p>
                                <p>
                                    Data persistence is handled by a polyglot storage strategy. Relational data is stored in PostgreSQL, while <span className="bg-amber-500/20 text-amber-200 px-1 rounded-sm">NoSQL databases like MongoDB are leveraged for unstructured user-generated content</span>. This allows for flexible schema evolution as new features are introduced to the platform. Furthermore, Redis is employed as a caching layer to reduce database load for frequently accessed read-heavy operations.
                                </p>
                            </div>
                        </div>

                        {/* Matched Group Panel */}
                        <div className="bg-white dark:bg-[#0F172A] rounded-[40px] border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                                <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Group 4 (Matched)</span>
                                <span className="text-[#1D68E3] text-[11px] font-black uppercase">Similarity: 84%</span>
                            </div>
                            <div className="p-10 text-[15px] leading-relaxed text-slate-400 font-medium space-y-6 max-h-[600px] overflow-auto scrollbar-hide">
                                <p>
                                    Our design leverages a <span className="bg-amber-500/20 text-amber-200 px-1 rounded-sm">highly scalable microservices approach to manage high-volume transaction data</span> which helps in keeping latency minimal during high-load periods. We found that by decoupling services like ordering and inventory, we could achieve better fault tolerance and simplified maintenance cycles for our engineering team.
                                </p>
                                <p>
                                    Application security utilizes <span className="bg-rose-500/20 text-rose-200 px-1 rounded-sm">OAuth2.0 implementation integrated with JWT for stateless authentication</span> protocols for secure access. By avoiding stateful sessions, we can scale our API gateway horizontally across multiple regions without complex synchronization mechanisms. This provides a robust foundation for our mobile and web clients.
                                </p>
                                <p>
                                    For data storage, we adopted a diverse approach where <span className="bg-amber-500/20 text-amber-200 px-1 rounded-sm">NoSQL databases like MongoDB are leveraged for unstructured user-generated content</span>. This choice was driven by the need for high write speeds and the ability to store complex JSON documents directly. We also use Memcached to speed up lookups for popular products during seasonal sales events.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Source Code Similarity Preview */}
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight">Source Code Similarity</h3>
                        <div className="bg-blue-500/10 text-[#1D68E3] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
                            MATCH: GROUP 12
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#0F172A] rounded-[40px] p-10 flex items-center justify-center border border-slate-100 dark:border-white/5 shadow-2xl group cursor-pointer hover:border-blue-500/30 transition-all">
                        <div className="text-center space-y-4">
                            <div className="p-4 bg-blue-500/10 rounded-full w-fit mx-auto">
                                <Code className="h-8 w-8 text-[#1D68E3]" />
                            </div>
                            <p className="text-slate-500 font-bold">Comprehensive code comparison available in</p>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setActiveTab('source'); }}
                                className="bg-[#1D68E3] text-white px-8 py-4 rounded-2xl font-black text-[13px] hover:scale-105 transition-all shadow-xl shadow-blue-500/20 uppercase tracking-widest"
                            >
                                Source Code Analysis View
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

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
            <div className="max-w-[1600px] mx-auto px-6 md:px-10 py-8">
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
                                            <img src={member.photo.startsWith('http') ? member.photo : `http://localhost:5000/uploads/${member.photo}`} className="w-full h-full object-cover" alt="" />
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
                        {group.documentUrl ? (
                            <a 
                                href={`http://localhost:5000${group.documentUrl}`} 
                                download 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-300 px-6 py-4 rounded-2xl font-black text-[14px] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xl"
                            >
                                <Download className="h-5 w-5" />
                                Download Files
                            </a>
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
            <div className="max-w-[1600px] mx-auto px-6 md:px-10">
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
