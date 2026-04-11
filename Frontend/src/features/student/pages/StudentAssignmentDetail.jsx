import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StudentHeader from '../components/StudentHeader';
import studentService from '../../../services/studentService';
import { getApiOrigin } from '../../../lib/api';
import { 
    Folder, 
    Download, 
    FileText, 
    Code2,
    CheckCircle2,
    Loader2,
    ArrowLeft
} from 'lucide-react';

const StudentAssignmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [row, setRow] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        window.scrollTo(0, 0);
        
        const fetchAssignment = async () => {
            try {
                const response = await studentService.getAssignment(id);
                if (response.success) {
                    setRow(response.data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchAssignment();
    }, [id]);

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

    if (!row?.assignment) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex flex-col font-sans text-slate-900">
                <StudentHeader />
                <div className="flex-1 flex flex-col items-center justify-center">
                    <h2 className="text-xl font-bold text-slate-400 mb-4">Assignment Not Found</h2>
                    <button onClick={() => navigate('/student/assignments')} className="text-[#1D68E3] font-bold">Go Back</button>
                </div>
            </div>
        );
    }

    const assignment = row.assignment;
    const teacherName = assignment?.teacher?.name || 'N/A';
    const subjectLabel = assignment?.subject?.name
        ? `${assignment.subject.name}${assignment.subject?.code ? ` (${assignment.subject.code})` : ''}`
        : 'Subject';
    const proposalDeadline = assignment?.proposalDeadline ? new Date(assignment.proposalDeadline).toLocaleString() : null;
    const projectDeadline = assignment?.projectDeadline ? new Date(assignment.projectDeadline).toLocaleString() : null;
    const effectiveDeadline = projectDeadline || proposalDeadline;
    const teacherFileUrl = assignment?.assignmentFile ? `${getApiOrigin()}${assignment.assignmentFile}` : null;
    const teacherFileName = assignment?.originalFileName || assignment?.title || 'Teacher requirements file';
    const proposalApprovedOrProjectUploaded = Boolean(
        row?.latestProjectSubmission || row?.proposal?.status === 'teacher_approved'
    );

    return (
        <div className="min-h-screen flex flex-col bg-[#F8FAFB] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
            {/* Standardized Header */}
            <StudentHeader />

            <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
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
                            {subjectLabel}
                        </div>
                        <h1 className="text-[34px] md:text-[44px] font-black tracking-tight leading-[1.1] mb-5 text-[#0F172A]">
                            {assignment.title}
                        </h1>
                        <p className="text-[15px] font-medium text-slate-500 max-w-xl leading-relaxed">
                            Teacher: <span className="font-bold text-slate-700">{teacherName}</span> <br/>
                            Deadline: <span className="font-bold text-slate-700">{effectiveDeadline || 'No deadline'}</span>
                            {proposalDeadline && (
                                <>
                                    <br />
                                    Proposal Deadline: <span className="font-bold text-slate-700">{proposalDeadline}</span>
                                </>
                            )}
                            {projectDeadline && (
                                <>
                                    <br />
                                    Project Deadline: <span className="font-bold text-slate-700">{projectDeadline}</span>
                                </>
                            )}
                        </p>
                    </div>

                    <div className="w-full lg:w-[400px] h-[250px] bg-[#0F172A] rounded-3xl relative overflow-hidden shadow-2xl flex items-center justify-center border border-slate-800 shrink-0">
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500 via-[#0F172A] to-[#0F172A]"></div>
                        <Code2 className="w-24 h-24 text-blue-400 opacity-80 z-10 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)] animate-pulse" />
                        <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-[#0F172A] to-transparent z-0"></div>
                    </div>
                </div>

                {row?.proposal?.teacherComment ? (
                    <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
                        <p className="text-[11px] font-black uppercase tracking-widest text-blue-700 mb-1.5">
                            Teacher Feedback
                        </p>
                        <p className="text-sm font-semibold text-blue-900 whitespace-pre-wrap">
                            {row.proposal.teacherComment}
                        </p>
                    </div>
                ) : null}

                <div className="flex flex-col lg:flex-row gap-8 mb-16">
                    {/* Left Sidebar: Course Resources */}
                    <div className="w-full lg:w-[380px]">
                        <div className="bg-[#F1F5F9] rounded-2xl p-8 h-full border border-slate-100">
                            <h3 className="text-[18px] font-black text-[#0F172A] mb-6 flex items-center justify-between">
                                Assignment File
                                <Folder className="w-5 h-5 text-[#1D68E3]" />
                            </h3>

                            <div className="space-y-4">
                                {/* The Assignment File uploaded by Teacher */}
                                {teacherFileUrl ? (
                                    <a
                                        href={teacherFileUrl}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-white rounded-xl p-4 flex items-center gap-4 border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500 shrink-0">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="text-[13px] font-bold text-[#0F172A] truncate" title={teacherFileName}>{teacherFileName}</div>
                                            <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">Click to Download</div>
                                        </div>
                                        <Download className="w-4 h-4 text-slate-300 group-hover:text-[#1D68E3] transition-colors" />
                                    </a>
                                ) : (
                                    <div className="bg-white rounded-xl p-4 flex items-center gap-4 border border-slate-100">
                                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="text-[13px] font-bold text-[#0F172A] truncate">No uploaded file yet</div>
                                            <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">
                                                Teacher has not attached a requirement file for this assignment.
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Student Actions */}
                    <div className="flex-1">
                        <div className="bg-white rounded-2xl p-10 border border-slate-100 shadow-sm h-full flex flex-col">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-[24px] font-black text-[#0F172A] tracking-tight">
                                    Student Workspace
                                </h2>
                                <span className={`flex items-center gap-2 text-[10px] font-black tracking-widest uppercase ${row.latestProjectSubmission ? 'text-green-500' : 'text-[#1D68E3]'}`}>
                                    <div className={`w-2 h-2 rounded-full ${row.latestProjectSubmission ? 'bg-green-500' : 'bg-[#1D68E3]'}`}></div>
                                    {row.latestProjectSubmission ? 'PROJECT UPLOADED' : 'READY TO SUBMIT'}
                                </span>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <Link
                                    to={`/student/assignments/${assignment._id}/proposal`}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-6 hover:border-[#1D68E3]/40 hover:bg-blue-50/40 transition-colors"
                                >
                                    <div className="text-[12px] font-black uppercase tracking-widest text-[#1D68E3] mb-2">
                                        Step 1
                                    </div>
                                    <h3 className="text-lg font-black text-[#0F172A] mb-2">Submit Proposal</h3>
                                    <p className="text-sm font-medium text-slate-500">
                                        Write your project idea and features for AI + teacher review.
                                    </p>
                                </Link>
                                {proposalApprovedOrProjectUploaded ? (
                                    <Link
                                        to={`/student/project/${assignment._id}`}
                                        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 hover:border-emerald-400 transition-colors"
                                    >
                                        <div className="text-[12px] font-black uppercase tracking-widest text-emerald-700 mb-2">
                                            Step 2
                                        </div>
                                        <h3 className="text-lg font-black text-[#0F172A] mb-2">Upload Project ZIP</h3>
                                        <p className="text-sm font-medium text-slate-600">
                                            Upload your final `.zip` project from the project submission page.
                                        </p>
                                    </Link>
                                ) : (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 opacity-80">
                                        <div className="text-[12px] font-black uppercase tracking-widest text-slate-500 mb-2">
                                            Step 2 (Locked)
                                        </div>
                                        <h3 className="text-lg font-black text-slate-700 mb-2">Upload Project ZIP</h3>
                                        <p className="text-sm font-medium text-slate-600">
                                            Proposal must be accepted by teacher to unlock this step.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {row.latestProjectSubmission ? (
                                <div className="mt-6 border border-green-200 bg-green-50 rounded-xl p-5 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        <div>
                                            <p className="text-sm font-bold text-green-800">
                                                Uploaded: {row.latestProjectSubmission.originalFilename}
                                            </p>
                                            <p className="text-xs text-green-700">
                                                {new Date(row.latestProjectSubmission.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="mt-6 text-sm font-semibold text-slate-500">
                                    No project upload found yet. Start with proposal, then submit your ZIP project.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
};

export default StudentAssignmentDetail;
