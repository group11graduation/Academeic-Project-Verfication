import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import StudentHeader from '../components/StudentHeader';
import axios from 'axios';
import { 
    FileText, Calendar, CheckCircle2, Clock, 
    AlertCircle, Download, User, Loader2, BookOpen, ChevronLeft
} from 'lucide-react';

const StudentAssignments = () => {
    const { token } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [studentInfo, setStudentInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);

    useEffect(() => {
        const fetchAssignments = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/student/assignments', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.data.success) {
                    setAssignments(response.data.data.assignments);
                    setSubjects(response.data.data.subjects || []);
                    setStudentInfo(response.data.data.student);
                }
            } catch (err) {
                console.error('Error fetching assignments:', err);
                setError('Failed to load assignments');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchAssignments();
        } else {
            setLoading(false);
            setError('Not authenticated');
        }
    }, [token]);

    const getDeadlineStatus = (deadline) => {
        if (!deadline) return { label: 'NO DEADLINE', color: 'text-slate-400', bg: 'bg-slate-50' };
        const now = new Date();
        const dl = new Date(deadline);
        const diff = dl - now;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        if (days < 0) return { label: 'OVERDUE', color: 'text-red-600', bg: 'bg-red-50' };
        if (days <= 3) return { label: `${days} DAY${days !== 1 ? 'S' : ''} LEFT`, color: 'text-orange-600', bg: 'bg-orange-50' };
        return { label: `${days} DAYS LEFT`, color: 'text-green-600', bg: 'bg-green-50' };
    };

    const getSubjectStats = (subjectId) => {
        const subAssignments = assignments.filter(a => a.subjectId === subjectId);
        const submitted = subAssignments.filter(a => a.submitted).length;
        const total = subAssignments.length;
        return { total, submitted, pending: total - submitted };
    };

    // Filter assignments by selected subject
    const displayedAssignments = selectedSubjectId 
        ? assignments.filter(a => a.subjectId === selectedSubjectId)
        : assignments;

    const submittedCount = displayedAssignments.filter(a => a.submitted).length;
    const pendingCount = displayedAssignments.filter(a => !a.submitted).length;

    const selectedSubject = subjects.find(s => s._id === selectedSubjectId);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#F8FAFB] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
            <StudentHeader />

            <main className="flex-1 w-full max-w-[1400px] mx-auto px-8 py-10">
                {/* Header Title Section */}
                <div className="mb-10">
                    <div className="flex gap-2 mb-4">
                        <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                            ACADEMIC YEAR {new Date().getFullYear()}
                        </span>
                        {studentInfo && (
                            <span className="bg-blue-100 text-[#1D68E3] px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                                CLASS {studentInfo.classId}
                            </span>
                        )}
                    </div>

                    {selectedSubjectId ? (
                        <div className="flex items-center gap-4 mb-4">
                            <button 
                                onClick={() => setSelectedSubjectId(null)}
                                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-600"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-[40px] md:text-[56px] font-black text-[#0F172A] tracking-tight leading-none">
                                    {selectedSubject?.name}
                                </h1>
                                <p className="text-[16px] font-bold text-slate-500 mt-2 uppercase tracking-widest">
                                    {selectedSubject?.code} — Taught by {selectedSubject?.teacher}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h1 className="text-[40px] md:text-[56px] font-black text-[#0F172A] tracking-tight mb-4 leading-none">
                                Selected Modules
                            </h1>
                            <p className="text-[18px] font-medium text-slate-600 max-w-2xl">
                                Welcome back, <span className="text-[#1D68E3] font-bold">{studentInfo?.name?.split(' ')[0] || 'Student'}</span>. 
                                Select a subject module below to view your associated assignments.
                            </p>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                        <span className="text-[14px] font-bold text-red-600">{error}</span>
                    </div>
                )}

                {!selectedSubjectId ? (
                    /* SUBJECTS GRID VIEW */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {subjects.length === 0 ? (
                            <div className="col-span-full bg-white rounded-2xl p-16 border border-slate-100 shadow-sm text-center">
                                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-xl font-black text-slate-400 mb-2">No Modules Found</h3>
                                <p className="text-[14px] font-medium text-slate-400">
                                    You are not currently enrolled in any subject modules. Contact your administrator.
                                </p>
                            </div>
                        ) : (
                            subjects.map(subject => {
                                const stats = getSubjectStats(subject._id);
                                return (
                                    <div 
                                        key={subject._id}
                                        onClick={() => setSelectedSubjectId(subject._id)}
                                        className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm hover:border-[#1D68E3]/30 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer group flex flex-col h-full"
                                    >
                                        <div className="bg-blue-50 w-14 h-14 rounded-[16px] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                                            <BookOpen className="w-6 h-6 text-[#1D68E3]" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-800 tracking-tight mb-1">{subject.name}</h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[#1D68E3] mb-4 bg-blue-50 inline-block px-2 py-1 rounded flex-shrink-0 self-start">
                                            {subject.code}
                                        </p>
                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-500 mb-6">
                                            <User className="w-4 h-4 text-slate-400" />
                                            {subject.teacher}
                                        </div>
                                        
                                        <div className="mt-auto pt-5 border-t border-slate-50 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="text-center">
                                                    <div className="text-lg font-black text-slate-800">{stats.total}</div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tasks</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-lg font-black text-orange-500">{stats.pending}</div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pending</div>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-[#1D68E3] group-hover:text-white transition-colors">
                                                <ChevronLeft className="w-4 h-4 rotate-180" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    /* ASSIGNMENTS LIST VIEW */
                    <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Left Column (Assignments List) */}
                        <div className="flex-1 space-y-4">
                            {displayedAssignments.length === 0 ? (
                                <div className="bg-white rounded-2xl p-16 border border-slate-100 shadow-sm text-center">
                                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-black text-slate-400 mb-2">No Assignments</h3>
                                    <p className="text-[14px] font-medium text-slate-400">
                                        There are no assignments posted for this module yet.
                                    </p>
                                </div>
                            ) : (
                                displayedAssignments.map((assignment) => {
                                    const deadlineStatus = getDeadlineStatus(assignment.deadline);
                                    return (
                                        <div 
                                            key={assignment._id} 
                                            className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:border-[#1D68E3]/30 transition-all hover:shadow-md"
                                        >
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                {/* Left: Assignment Info */}
                                                <div className="flex items-start gap-4 flex-1">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${assignment.submitted ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-[#1D68E3]'}`}>
                                                        {assignment.submitted ? <CheckCircle2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-[16px] font-black text-[#0F172A] tracking-tight mb-1 truncate">
                                                            {assignment.title}
                                                        </h3>
                                                        <div className="flex flex-wrap items-center gap-3 mb-2">
                                                            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                                                                <Calendar className="w-3 h-3" /> Posted {new Date(assignment.createdAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {/* Status Badge */}
                                                            {assignment.submitted ? (
                                                                <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-100 flex items-center gap-1">
                                                                    <CheckCircle2 className="w-3 h-3" /> SUBMITTED
                                                                </span>
                                                            ) : (
                                                                <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-100 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" /> PENDING
                                                                </span>
                                                            )}
                                                            {/* Deadline Badge */}
                                                            {assignment.deadline && (
                                                                <span className={`${deadlineStatus.bg} ${deadlineStatus.color} px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100`}>
                                                                    {deadlineStatus.label}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Actions */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <a 
                                                        href={`http://localhost:5000${assignment.assignmentFile}`}
                                                        download
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-black text-slate-600 transition-all"
                                                    >
                                                        <Download className="w-3.5 h-3.5" /> DOWNLOAD
                                                    </a>
                                                    <Link 
                                                        to={`/assignments/${assignment._id}`}
                                                        className="flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] hover:bg-[#1D68E3] text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors"
                                                    >
                                                        VIEW
                                                    </Link>
                                                </div>
                                            </div>

                                            {/* Submission info if submitted */}
                                            {assignment.mySubmission && (
                                                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-[11px] font-bold text-green-600">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Submitted: {assignment.mySubmission.originalFileName} — {new Date(assignment.mySubmission.submittedAt).toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Right Column (Summary Sidebar) */}
                        <div className="w-full xl:w-[340px] flex flex-col gap-6">
                            
                            {/* Stats Overview */}
                            <div className="bg-white rounded-[24px] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                                <h3 className="text-[13px] font-black text-slate-400 uppercase tracking-widest mb-6 relative z-10">Module Overview</h3>
                                <div className="space-y-5 relative z-10">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[13px] font-bold text-slate-600">Total Assignments</span>
                                        <span className="text-[20px] font-black text-[#0F172A]">{displayedAssignments.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[13px] font-bold text-slate-600 flex items-center gap-2">
                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div> Submitted
                                        </span>
                                        <span className="text-[20px] font-black text-green-600">{submittedCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[13px] font-bold text-slate-600 flex items-center gap-2">
                                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div> Pending
                                        </span>
                                        <span className="text-[20px] font-black text-orange-500">{pendingCount}</span>
                                    </div>
                                </div>
                                {displayedAssignments.length > 0 && (
                                    <div className="mt-6 pt-6 border-t border-slate-100 relative z-10">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Completion</span>
                                            <span className="text-[13px] font-black text-[#1D68E3]">
                                                {displayedAssignments.length > 0 ? Math.round((submittedCount / displayedAssignments.length) * 100) : 0}%
                                            </span>
                                        </div>
                                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-[#1D68E3] rounded-full transition-all duration-700"
                                                style={{ width: `${displayedAssignments.length > 0 ? (submittedCount / displayedAssignments.length) * 100 : 0}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Class Info */}
                            {studentInfo && (
                                <div className="bg-[#1B2533] rounded-[24px] p-8 text-white relative overflow-hidden shadow-lg border border-[#2D3A4A]">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-[#93C5FD] mb-2 relative z-10">
                                        YOUR CLASS
                                    </div>
                                    <h3 className="text-[24px] font-black tracking-tight mb-2 relative z-10 text-white">
                                        {studentInfo.className}
                                    </h3>
                                    <p className="text-[13px] font-medium text-slate-400 relative z-10">
                                        Class Code: {studentInfo.classId}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </main>

            {/* Footer */}
            <footer className="w-full mt-auto py-12 bg-[#1B2533] text-white flex flex-col md:flex-row items-center justify-between px-10 border-t border-[#2D3A4A]">
                <div className="flex flex-col items-center md:items-start mb-6 md:mb-0">
                    <div className="font-black text-white text-xl tracking-tighter mb-2">
                        ScholarVerify
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        &copy; {new Date().getFullYear()} ScholarVerify Academic Curator. All Rights Reserved.
                    </div>
                </div>
                
                <div className="flex flex-wrap justify-center gap-8">
                    <a href="#" className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Institutional Privacy</a>
                    <a href="#" className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Research Ethics</a>
                    <a href="#" className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">System Status</a>
                    <a href="#" className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Support</a>
                </div>
            </footer>
        </div>
    );
};

export default StudentAssignments;
