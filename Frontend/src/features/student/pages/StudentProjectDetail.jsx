import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { 
    ShieldCheck, 
    Download, 
    FileText, 
    CheckCircle, 
    Layers, 
    Server, 
    Code, 
    Globe,
    Cpu,
    Database,
    Clock,
    Zap,
    Users,
    ArrowLeft,
    CheckCircle2,
    UploadCloud,
    Send,
    Loader2
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import { PROJECT_NAME, PROJECT_LEGAL_NAME } from '../../../shared/ui/brandTheme';
import StudentHeader from '../components/StudentHeader';
import axios from 'axios';

const StudentProjectDetail = () => {
    const { id } = useParams();
    const { token } = useAuth();
    const navigate = useNavigate();

    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);

    // Upload state tracking
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        window.scrollTo(0, 0);
        if (!token) return;
        
        const fetchProject = async () => {
            try {
                const response = await axios.get(`http://localhost:5000/api/student/projects/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.data.success) {
                    setProject(response.data.data);
                }
            } catch (err) {
                console.error('Failed to fetch project:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchProject();
    }, [id, token]);

    const handleFileUpload = (file) => {
        if (!file) return;
        setUploadedFile({
            file: file,
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmitProposal = async () => {
        if (!uploadedFile || !uploadedFile.file) return alert('Please upload a file first');
        
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('proposalFile', uploadedFile.file);

        try {
            const response = await axios.post(`http://localhost:5000/api/student/projects/${id}/submit`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            if (response.data.success) {
                alert('Project proposal submitted successfully!');
                setProject(prev => ({
                    ...prev,
                    status: 'SUBMITTED',
                    documentUrl: response.data.data.documentUrl,
                    originalFileName: response.data.data.originalFileName
                }));
                setUploadedFile(null);
            }
        } catch (error) {
            console.error('Submit failed:', error);
            alert(error.response?.data?.message || 'Failed to submit proposal.');
        } finally {
            setIsSubmitting(false);
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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans text-slate-900">
                <StudentHeader />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans text-slate-900">
                <StudentHeader />
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <h2 className="text-xl font-bold text-slate-400">Project Not Found</h2>
                    <button onClick={() => navigate('/student')} className="text-[#1D68E3] font-bold">Back to Projects</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#FAFAFA] font-sans text-slate-900 overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">
            <StudentHeader />

            <main className="flex-1 pt-16 pb-24 px-6 max-w-[1536px] mx-auto w-full">
                
                {/* Back Button */}
                <Link to="/student" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#1D68E3] transition-colors mb-10 group">
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to My Projects
                </Link>

                {/* Hero Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-16">
                    <div className="space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="inline-flex items-center gap-2 bg-[#E1EDF7] text-[#4F6C8A] px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-[#CFDFEF]">
                                <ShieldCheck className="h-4 w-4" /> VERIFIED PROJECT
                            </div>
                            <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">CLASS {project.classCode}</span>
                        </div>
                        
                        <h1 className="text-4xl lg:text-[64px] font-black text-slate-900 leading-[1.05] tracking-tight mb-2">
                            {project.title}
                        </h1>
                        
                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            {!project.documentUrl ? (
                                <div className="bg-amber-100 text-amber-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2 text-sm border border-amber-200">
                                    <Clock className="w-5 h-5" /> Proposal Outstanding
                                </div>
                            ) : (
                                <a 
                                    href={`http://localhost:5000${project.documentUrl}`} 
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-emerald-100 text-emerald-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2 text-sm border border-emerald-200 hover:bg-emerald-200 transition-colors"
                                >
                                    <FileText className="w-5 h-5" /> View Proposal / Source
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Proposal Submit Block */}
                    <div className="relative">
                        <div className="w-full bg-white rounded-[32px] shadow-xl border border-slate-100 p-10 flex flex-col z-10 relative">
                            <h2 className="text-[28px] font-black text-[#0F172A] tracking-tight mb-6">
                                {project.documentUrl ? 'Your Document' : 'Submit Project Document'}
                            </h2>

                            {project.documentUrl ? (
                                <div className="border-2 border-emerald-200 bg-emerald-50 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                                        <CheckCircle2 className="h-8 w-8" />
                                    </div>
                                    <div className="text-[18px] font-bold text-[#0F172A] mb-1">
                                        {project.originalFileName || 'project_document.pdf'}
                                    </div>
                                    <div className="text-[14px] font-medium text-slate-500 mb-6">
                                        Status: {project.status}
                                    </div>
                                    <a 
                                        href={`http://localhost:5000${project.documentUrl}`}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-emerald-600 text-white px-6 py-3 rounded-lg text-sm font-bold hover:bg-emerald-700 transition"
                                    >
                                        Download My Document
                                    </a>
                                </div>
                            ) : (
                                <>
                                    <div 
                                        onClick={() => !uploadedFile && fileInputRef.current?.click()}
                                        onDragOver={onDragOver}
                                        onDragLeave={onDragLeave}
                                        onDrop={onDrop}
                                        className={`border-2 border-dashed rounded-xl p-8 mb-6 relative overflow-hidden transition-all flex flex-col items-center justify-center min-h-[200px] 
                                            ${uploadedFile ? 'border-blue-400 bg-blue-50/50 cursor-default' : 
                                            isDragging ? 'border-[#1D68E3] bg-blue-50/50 cursor-pointer' : 
                                            'border-slate-200 bg-slate-50 hover:border-[#1D68E3] hover:bg-blue-50/50 cursor-pointer group'}`}
                                    >
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            onChange={(e) => {
                                                if (e.target.files?.length) handleFileUpload(e.target.files[0]);
                                            }}
                                            accept=".pdf,.zip,.rar,.docx"
                                        />
                                        
                                        {uploadedFile ? (
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                                                    <CheckCircle2 className="h-7 w-7" />
                                                </div>
                                                <div className="text-[16px] font-bold text-[#0F172A] mb-1">
                                                    {uploadedFile.name}
                                                </div>
                                                <div className="text-[13px] font-medium text-slate-500 mb-4">
                                                    {uploadedFile.size}
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}
                                                    className="text-[12px] font-bold text-red-500 hover:text-red-700 underline"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <div className="w-12 h-12 bg-blue-100 text-[#1D68E3] rounded-xl flex items-center justify-center mb-5 mx-auto group-hover:bg-[#1D68E3] group-hover:text-white transition-colors">
                                                    <UploadCloud className="h-6 w-6" />
                                                </div>
                                                <div className="text-[16px] font-bold text-[#0F172A] mb-2">
                                                    Drag and drop your document
                                                </div>
                                                <div className="text-[12px] font-medium text-slate-400">
                                                    Support: PDF, ZIP, RAR
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        onClick={handleSubmitProposal}
                                        disabled={isSubmitting || !uploadedFile}
                                        className="w-full bg-[#1D68E3] text-white px-8 py-4 rounded-xl text-[14px] font-black tracking-wide hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:active:scale-100 disabled:hover:shadow-none"
                                    >
                                        {isSubmitting ? 'Uploading...' : 'Submit Document'} <Send className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                        <div className="absolute -z-10 -top-10 -right-10 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-20"></div>
                        <div className="absolute -z-10 -bottom-10 -left-10 w-64 h-64 bg-indigo-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-20"></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12 mb-20">
                    {/* Similarity Score */}
                    <div className="bg-[#E4ECF5] rounded-[40px] p-10 relative overflow-hidden">
                        <div className="relative z-10 space-y-4">
                            <div className="inline-flex items-center gap-2 bg-[#8C5221] text-white px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest">
                                <Cpu className="h-3 w-3" /> ML DIAGNOSTICS
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Similarity Score</h2>
                            <div className="flex items-baseline gap-4">
                                <span className={`text-6xl font-black leading-none tracking-tight ${project.similarityLevel === 'High' ? 'text-rose-600' : 'text-[#1D68E3]'}`}>
                                    {project.similarity || 0}%
                                </span>
                                <span className="text-sm font-black text-slate-500 uppercase tracking-widest">{project.similarityLevel} SIMILARITY</span>
                            </div>
                        </div>
                    </div>

                    {/* Team Members */}
                    <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm">
                        <h2 className="text-2xl font-black text-slate-900 mb-6 font-mono uppercase tracking-tight">Project Team Members</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {project.members && project.members.map((member, idx) => (
                                <div key={idx} className="bg-slate-50 rounded-[20px] p-4 flex items-center gap-4 border border-slate-100">
                                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm overflow-hidden flex items-center justify-center font-black text-slate-400 text-lg">
                                        {member.photo && member.photo !== 'default-student.jpg' ? (
                                            <img src={member.photo.startsWith('http') ? member.photo : `http://localhost:5000/uploads/${member.photo}`} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            member.name[0]
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900">{member.name}</h3>
                                        <p className="text-[10px] font-black text-[#1D68E3] uppercase tracking-widest">{member.studentId}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </main>

            {/* Footer */}
            <footer className="w-full mt-auto py-10 bg-[#141C2B] text-white flex flex-col md:flex-row items-center justify-between px-12 pb-16">
                <div className="flex flex-col items-center md:items-start mb-6 md:mb-0">
                    <div className="font-black text-white text-[18px] tracking-tighter mb-1">
                        {PROJECT_NAME}
                    </div>
                </div>
                
                <div className="flex flex-wrap justify-center gap-10">
                    <a href="#" className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors">Privacy Policy</a>
                    <a href="#" className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors">Terms of Service</a>
                    <a href="#" className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors">Institutional Access</a>
                    <a href="#" className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors">Support</a>
                    <span className="text-[11px] font-medium text-slate-400 ml-4">
                        &copy; {new Date().getFullYear()} {PROJECT_LEGAL_NAME}. All research rights reserved.
                    </span>
                </div>
            </footer>
        </div>
    );
};

export default StudentProjectDetail;
