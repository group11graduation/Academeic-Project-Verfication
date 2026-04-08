import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import StudentHeader from '../components/StudentHeader';
import axios from 'axios';
import { 
    Folder, 
    Download, 
    FileText, 
    UploadCloud, 
    Send,
    Code2,
    CheckCircle2,
    Loader2,
    ArrowLeft
} from 'lucide-react';

const StudentAssignmentDetail = () => {
    const { id } = useParams();
    const { token } = useAuth();
    const navigate = useNavigate();
    
    const [assignment, setAssignment] = useState(null);
    const [loading, setLoading] = useState(true);

    // Upload state tracking
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        window.scrollTo(0, 0);
        if (!token) return;
        
        const fetchAssignment = async () => {
            try {
                const response = await axios.get(`http://localhost:5000/api/student/assignments/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.data.success) {
                    setAssignment(response.data.data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchAssignment();
    }, [id, token]);

    const handleFileUpload = (file) => {
        if (!file) return;
        setUploadedFile({
            file: file, // keep actual file for submission
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmitAssignment = async () => {
        if (!uploadedFile || !uploadedFile.file) return alert('Please upload a file first');
        
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('submissionFile', uploadedFile.file);

        try {
            const response = await axios.post(`http://localhost:5000/api/teacher/assignments/${id}/submit`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            if (response.data.success) {
                alert('Assignment submitted successfully!');
                // Reload assignment to see the submission
                const mySubData = response.data.data;
                setAssignment(prev => ({
                    ...prev,
                    submitted: true,
                    mySubmission: {
                        submissionFile: mySubData.submissionFile,
                        originalFileName: mySubData.originalFileName,
                        submittedAt: mySubData.submittedAt
                    }
                }));
                setUploadedFile(null);
            }
        } catch (error) {
            console.error('Submit failed:', error);
            alert(error.response?.data?.message || 'Failed to submit assignment.');
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
            <div className="min-h-screen bg-[#F8FAFB] flex flex-col font-sans text-slate-900">
                <StudentHeader />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
                </div>
            </div>
        );
    }

    if (!assignment) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex flex-col font-sans text-slate-900">
                <StudentHeader />
                <div className="flex-1 flex flex-col items-center justify-center">
                    <h2 className="text-xl font-bold text-slate-400 mb-4">Assignment Not Found</h2>
                    <button onClick={() => navigate('/assignments')} className="text-[#1D68E3] font-bold">Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#F8FAFB] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
            {/* Standardized Header */}
            <StudentHeader />

            <main className="flex-1 w-full max-w-[1400px] mx-auto px-8 py-10">
                <button 
                    onClick={() => navigate('/student/assignments')} 
                    className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-[#1D68E3] transition-colors mb-8 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Assignments
                </button>

                {/* Hero Section */}
                <div className="flex flex-col lg:flex-row gap-12 items-center mb-16">
                    <div className="flex-1">
                        <div className="bg-blue-100/50 text-slate-500 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase inline-block mb-6 border border-blue-200">
                            {assignment.subjectName}
                        </div>
                        <h1 className="text-[40px] md:text-[56px] font-black tracking-tight leading-[1.1] mb-6 text-[#0F172A]">
                            {assignment.title}
                        </h1>
                        <p className="text-[18px] font-medium text-slate-500 max-w-xl leading-relaxed">
                            Teacher: <span className="font-bold text-slate-700">{assignment.teacherName}</span> <br/>
                            Deadline: <span className="font-bold text-slate-700">{assignment.deadline ? new Date(assignment.deadline).toLocaleDateString() : 'No deadline'}</span>
                        </p>
                    </div>

                    <div className="w-full lg:w-[400px] h-[250px] bg-[#0F172A] rounded-3xl relative overflow-hidden shadow-2xl flex items-center justify-center border border-slate-800 shrink-0">
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500 via-[#0F172A] to-[#0F172A]"></div>
                        <Code2 className="w-24 h-24 text-blue-400 opacity-80 z-10 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)] animate-pulse" />
                        <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-[#0F172A] to-transparent z-0"></div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 mb-16">
                    {/* Left Sidebar: Course Resources */}
                    <div className="w-full lg:w-[380px]">
                        <div className="bg-[#F1F5F9] rounded-2xl p-8 h-full border border-slate-100">
                            <h3 className="text-[20px] font-black text-[#0F172A] mb-8 flex items-center justify-between">
                                Assignment File
                                <Folder className="w-5 h-5 text-[#1D68E3]" />
                            </h3>

                            <div className="space-y-4">
                                {/* The Assignment File uploaded by Teacher */}
                                <a 
                                    href={`http://localhost:5000${assignment.assignmentFile}`}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-white rounded-xl p-4 flex items-center gap-4 border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                                >
                                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500 shrink-0">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="text-[13px] font-bold text-[#0F172A] truncate" title={assignment.originalFileName}>{assignment.originalFileName}</div>
                                        <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">Click to Download</div>
                                    </div>
                                    <Download className="w-4 h-4 text-slate-300 group-hover:text-[#1D68E3] transition-colors" />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Submit Your Work */}
                    <div className="flex-1">
                        <div className="bg-white rounded-2xl p-10 border border-slate-100 shadow-sm h-full flex flex-col">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-[28px] font-black text-[#0F172A] tracking-tight">
                                    {assignment.submitted ? 'Your Submission' : 'Submit Your Work'}
                                </h2>
                                <span className={`flex items-center gap-2 text-[10px] font-black tracking-widest uppercase ${assignment.submitted ? 'text-green-500' : 'text-[#1D68E3]'}`}>
                                    <div className={`w-2 h-2 rounded-full ${assignment.submitted ? 'bg-green-500' : 'bg-[#1D68E3] animate-pulse'}`}></div>
                                    {assignment.submitted ? 'SUBMITTED' : 'OPEN FOR SUBMISSIONS'}
                                </span>
                            </div>

                            {assignment.submitted && assignment.mySubmission ? (
                                <div className="border-2 border-green-200 bg-green-50 rounded-xl p-8 flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                                        <CheckCircle2 className="h-8 w-8" />
                                    </div>
                                    <div className="text-[18px] font-bold text-[#0F172A] mb-1">
                                        {assignment.mySubmission.originalFileName}
                                    </div>
                                    <div className="text-[14px] font-medium text-slate-500 mb-6 flex items-center gap-2">
                                        Submitted on {new Date(assignment.mySubmission.submittedAt).toLocaleString()}
                                    </div>
                                    <a 
                                        href={`http://localhost:5000${assignment.mySubmission.submissionFile}`}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-green-600 text-white px-6 py-3 rounded-lg text-sm font-bold hover:bg-green-700 transition shadow-lg hover:shadow-green-500/30"
                                    >
                                        Download My Submission
                                    </a>
                                </div>
                            ) : (
                                <>
                                    {/* Dropzone Area */}
                                    <div 
                                        onClick={() => !uploadedFile && fileInputRef.current?.click()}
                                        onDragOver={onDragOver}
                                        onDragLeave={onDragLeave}
                                        onDrop={onDrop}
                                        className={`border-2 border-dashed rounded-xl p-10 mb-8 relative overflow-hidden transition-all flex flex-col items-center justify-center min-h-[200px] 
                                            ${uploadedFile ? 'border-green-400 bg-green-50/50 cursor-default' : 
                                            isDragging ? 'border-[#1D68E3] bg-blue-50/50 cursor-pointer' : 
                                            'border-slate-200 bg-slate-50/50 hover:border-[#1D68E3] hover:bg-blue-50/50 cursor-pointer group'}`}
                                    >
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            onChange={(e) => {
                                                if (e.target.files?.length) handleFileUpload(e.target.files[0]);
                                            }}
                                            accept=".pdf,.zip,.rar,.docx,.txt"
                                        />
                                        
                                        {uploadedFile ? (
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                                                    <CheckCircle2 className="h-7 w-7" />
                                                </div>
                                                <div className="text-[16px] font-bold text-[#0F172A] mb-1">
                                                    {uploadedFile.name}
                                                </div>
                                                <div className="text-[13px] font-medium text-slate-500 mb-4">
                                                    Successfully staged &bull; {uploadedFile.size}
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}
                                                    className="text-[12px] font-bold text-red-500 hover:text-red-700 underline"
                                                >
                                                    Remove and upload different file
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <div className="w-12 h-12 bg-blue-100 text-[#1D68E3] rounded-xl flex items-center justify-center mb-5 mx-auto group-hover:bg-[#1D68E3] group-hover:text-white transition-colors">
                                                    <UploadCloud className="h-6 w-6" />
                                                </div>
                                                <div className="text-[16px] font-bold text-[#0F172A] mb-2">
                                                    Drag and drop your project file
                                                </div>
                                                <div className="text-[12px] font-medium text-slate-400">
                                                    Maximum file size: 50MB
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end mt-auto">
                                        <button 
                                            onClick={handleSubmitAssignment}
                                            disabled={isSubmitting || !uploadedFile}
                                            className="bg-[#1D68E3] text-white px-8 py-3.5 rounded-xl text-[13px] font-black tracking-wide hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:active:scale-100 disabled:hover:shadow-none"
                                        >
                                            {isSubmitting ? 'Submitting...' : 'Submit Assignment'} <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
};

export default StudentAssignmentDetail;
