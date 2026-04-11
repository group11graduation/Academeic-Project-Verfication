import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StudentHeader from '../components/StudentHeader';
import studentService from '../../../services/studentService';
import { getApiOrigin } from '../../../lib/api';
import {
    FileText, Calendar, CheckCircle2, AlertCircle, Download,
    User, Loader2, BookOpen, ChevronLeft, Rocket
} from 'lucide-react';

const StudentAssignments = () => {
    const [rows, setRows] = useState([]);
    const [studentInfo, setStudentInfo] = useState(null);
    const [enrolledSubjects, setEnrolledSubjects] = useState([]);
    const [studentMeta, setStudentMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null); // final | normal

    useEffect(() => {
        const fetchAssignments = async () => {
            try {
                const response = await studentService.getAssignments();
                if (response.success) {
                    const raw = response.data;
                    const list = Array.isArray(raw) ? raw : raw?.assignments || [];
                    setRows(list);
                    setStudentInfo(raw?.class || list[0]?.assignment?.class || null);
                    setEnrolledSubjects(Array.isArray(raw?.subjects) ? raw.subjects : []);
                    setStudentMeta(raw?.student || null);
                }
            } catch (err) {
                console.error('Error fetching assignments:', err);
                setError('Failed to load assignments');
            } finally {
                setLoading(false);
            }
        };
        fetchAssignments();
    }, []);

    const isFinalProjectAssignment = (row) => {
        const a = row?.assignment || {};
        const text = `${a.title || ''} ${a.description || ''}`.toLowerCase();
        return Boolean(
            a.projectPhaseOpen ||
            text.includes('final project') ||
            text.includes('capstone') ||
            text.includes('graduation project')
        );
    };

    const subjects = useMemo(() => {
        if (enrolledSubjects.length > 0) {
            const teacherBySubject = new Map();
            for (const r of rows) {
                const sid = String(r?.assignment?.subject?._id || '');
                const teacherName = r?.assignment?.teacher?.name;
                if (sid && teacherName && !teacherBySubject.has(sid)) {
                    teacherBySubject.set(sid, teacherName);
                }
            }
            return enrolledSubjects.map((s) => ({
                _id: String(s._id),
                name: s.name || 'Subject',
                code: s.code || 'N/A',
                teacher: teacherBySubject.get(String(s._id)) || 'Teacher',
            }));
        }

        const map = new Map();
        for (const r of rows) {
            const s = r?.assignment?.subject;
            if (s?._id && !map.has(String(s._id))) {
                map.set(String(s._id), {
                    _id: String(s._id),
                    name: s.name || 'Subject',
                    code: s.code || 'N/A',
                    teacher: r?.assignment?.teacher?.name || 'Teacher'
                });
            }
        }
        return Array.from(map.values());
    }, [rows, enrolledSubjects]);

    const rowsForSubject = useMemo(() => {
        if (!selectedSubjectId) return [];
        return rows.filter((r) => String(r?.assignment?.subject?._id) === String(selectedSubjectId));
    }, [rows, selectedSubjectId]);

    const finalRows = useMemo(() => rowsForSubject.filter(isFinalProjectAssignment), [rowsForSubject]);
    const normalRows = useMemo(() => rowsForSubject.filter((r) => !isFinalProjectAssignment(r)), [rowsForSubject]);
    const displayedRows = selectedCategory === 'final' ? finalRows : selectedCategory === 'normal' ? normalRows : [];
    const selectedSubject = subjects.find((s) => String(s._id) === String(selectedSubjectId));

    const getSubjectStats = (subjectId) => {
        const subRows = rows.filter((r) => String(r?.assignment?.subject?._id) === String(subjectId));
        const submitted = subRows.filter((r) => Boolean(r?.latestProjectSubmission)).length;
        const finals = subRows.filter((r) => isFinalProjectAssignment(r)).length;
        const total = subRows.length;
        return { total, submitted, pending: total - submitted, finals };
    };

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

    const getProposalStatusLabel = (row) => {
        const status = row?.proposal?.status || 'not_submitted';
        if (status === 'teacher_approved') return 'Proposal Accepted';
        if (status === 'pending_teacher_approval' || status === 'submitted' || status === 'pending') {
            return 'Proposal Pending Teacher';
        }
        if (status === 'ai_rejected_same_semester') return 'Proposal Rejected by AI';
        if (status === 'requirements_rejected') return 'Proposal Rejected by Requirements';
        if (status === 'ai_flagged_previous_semester') return 'Proposal Needs Update';
        if (status === 'teacher_rejected') return 'Proposal Rejected by Teacher';
        return 'No Proposal';
    };

    const isProposalLockedForReview = (row) => {
        const status = row?.proposal?.status;
        return status === 'pending_teacher_approval' || status === 'teacher_approved';
    };

    const getSubmissionDeadline = (a) => a?.projectDeadline || a?.proposalDeadline || null;
    const canOpenProjectUpload = (row) => {
        const proposalStatus = row?.proposal?.status;
        return Boolean(
            row?.latestProjectSubmission ||
            proposalStatus === 'teacher_approved' ||
            (row?.projectSubmissionAllowed && proposalStatus === 'teacher_approved')
        );
    };
    const isProjectSubmitted = (row) => Boolean(row?.latestProjectSubmission);
    const submittedCount = displayedRows.filter((r) => isProjectSubmitted(r)).length;
    const pendingCount = displayedRows.length - submittedCount;

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#F8FAFB] font-sans text-slate-900">
            <StudentHeader />

            <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="mb-10">
                    <div className="flex flex-wrap gap-2 mb-4">
                        <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                            ACADEMIC YEAR {new Date().getFullYear()}
                        </span>
                        {studentInfo?.code && (
                            <span className="bg-blue-100 text-[#1D68E3] px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                                CLASS {studentInfo.code}
                            </span>
                        )}
                    </div>

                    {!selectedSubjectId ? (
                        <>
                            <h1 className="text-[34px] md:text-[42px] font-black text-[#0F172A] tracking-tight leading-none mb-3">Selected Modules</h1>
                            <p className="text-[15px] font-medium text-slate-600 max-w-3xl">
                                First select your subject, then select assignment category: Final class-based projects or normal assignments.
                            </p>
                            {studentMeta?.name ? (
                                <p className="text-sm font-semibold text-slate-500 mt-3">
                                    Student: <span className="text-[#1D68E3]">{studentMeta.name}</span>
                                </p>
                            ) : null}
                        </>
                    ) : !selectedCategory ? (
                        <div className="flex items-center gap-4">
                            <button onClick={() => setSelectedSubjectId(null)} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-[30px] md:text-[38px] font-black text-[#0F172A] tracking-tight leading-none">{selectedSubject?.name}</h1>
                                <p className="text-[13px] font-bold text-slate-500 mt-2 uppercase tracking-widest">Choose assignment category</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <button onClick={() => setSelectedCategory(null)} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-[28px] md:text-[36px] font-black text-[#0F172A] tracking-tight leading-none">
                                    {selectedCategory === 'final' ? 'Final Class-Based Projects' : 'Normal Assignments'}
                                </h1>
                                <p className="text-[14px] font-semibold text-slate-500 mt-2">
                                    {selectedCategory === 'final'
                                        ? 'Teacher requirements + proposal AI checks + project upload'
                                        : 'Regular assignments for this subject'}
                                </p>
                            </div>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {subjects.length === 0 ? (
                            <div className="col-span-full bg-white rounded-2xl p-16 border border-slate-100 shadow-sm text-center">
                                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-xl font-black text-slate-400 mb-2">No Modules Found</h3>
                                <p className="text-[14px] font-medium text-slate-400">You are not currently enrolled in any subject modules. Contact your administrator.</p>
                            </div>
                        ) : (
                            subjects.map((subject) => {
                                const stats = getSubjectStats(subject._id);
                                return (
                                    <button
                                        type="button"
                                        key={subject._id}
                                        onClick={() => {
                                            setSelectedSubjectId(subject._id);
                                            setSelectedCategory(null);
                                        }}
                                        className="text-left bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm hover:border-[#1D68E3]/30 hover:shadow-xl transition-all group flex flex-col h-full"
                                    >
                                        <div className="bg-blue-50 w-14 h-14 rounded-[16px] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                                            <BookOpen className="w-6 h-6 text-[#1D68E3]" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-800 tracking-tight mb-1">{subject.name}</h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[#1D68E3] mb-4 bg-blue-50 inline-block px-2 py-1 rounded self-start">{subject.code}</p>
                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-500 mb-6">
                                            <User className="w-4 h-4 text-slate-400" />
                                            {subject.teacher}
                                        </div>
                                        <div className="mt-auto pt-5 border-t border-slate-50 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="text-center">
                                                    <div className="text-lg font-black text-slate-800">{stats.total}</div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">All</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-lg font-black text-[#1D68E3]">{stats.finals}</div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Final</div>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-[#1D68E3] group-hover:text-white transition-colors">
                                                <ChevronLeft className="w-4 h-4 rotate-180" />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                ) : !selectedCategory ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button
                            type="button"
                            onClick={() => setSelectedCategory('final')}
                            className="text-left bg-white rounded-2xl border border-slate-200 p-7 shadow-sm hover:border-[#1D68E3]/40 hover:shadow-md transition-all"
                        >
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1D68E3] flex items-center justify-center mb-4">
                                <Rocket className="w-5 h-5" />
                            </div>
                            <h3 className="text-2xl font-black text-[#0F172A] mb-2">Final Class-Based Projects</h3>
                            <p className="text-sm font-semibold text-slate-500 mb-4">Proposal + AI checking + teacher approval + ZIP project submission.</p>
                            <span className="inline-flex px-3 py-1 rounded-full bg-blue-50 text-[#1D68E3] text-[11px] font-black uppercase tracking-widest">
                                {finalRows.length} assignments
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setSelectedCategory('normal')}
                            className="text-left bg-white rounded-2xl border border-slate-200 p-7 shadow-sm hover:border-[#1D68E3]/40 hover:shadow-md transition-all"
                        >
                            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
                                <FileText className="w-5 h-5" />
                            </div>
                            <h3 className="text-2xl font-black text-[#0F172A] mb-2">Normal Assignments</h3>
                            <p className="text-sm font-semibold text-slate-500 mb-4">Regular assignments and tasks for this selected subject.</p>
                            <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-widest">
                                {normalRows.length} assignments
                            </span>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col xl:flex-row gap-8">
                        <div className="flex-1 space-y-4">
                            {displayedRows.length === 0 ? (
                                <div className="bg-white rounded-2xl p-16 border border-slate-100 shadow-sm text-center">
                                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-black text-slate-400 mb-2">No Assignments</h3>
                                    <p className="text-[14px] font-medium text-slate-400">No assignments found in this category for selected subject.</p>
                                </div>
                            ) : (
                                displayedRows.map((row) => {
                                    const a = row.assignment || {};
                                    const proposalStatus = row?.proposal?.status;
                                    const deadlineStatus = getDeadlineStatus(getSubmissionDeadline(a));
                                    return (
                                        <div key={a._id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:border-[#1D68E3]/30 hover:shadow-md transition-all">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-start gap-4 flex-1">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isProjectSubmitted(row) ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-[#1D68E3]'}`}>
                                                        {isProjectSubmitted(row) ? <CheckCircle2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-[17px] font-black text-[#0F172A] tracking-tight mb-1">{a.title || 'Assignment'}</h3>
                                                        <div className="flex flex-wrap items-center gap-3 mb-2">
                                                            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400"><User className="w-3 h-3" /> {a.teacher?.name || 'Teacher'}</span>
                                                            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400"><Calendar className="w-3 h-3" /> {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '-'}</span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className={`${isProjectSubmitted(row) ? 'bg-green-50 text-green-700 border-green-100' : 'bg-orange-50 text-orange-600 border-orange-100'} px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border`}>
                                                                {isProjectSubmitted(row) ? 'PROJECT SUBMITTED' : 'PENDING'}
                                                            </span>
                                                            {getSubmissionDeadline(a) && (
                                                                <span className={`${deadlineStatus.bg} ${deadlineStatus.color} px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100`}>
                                                                    {deadlineStatus.label}
                                                                </span>
                                                            )}
                                                            <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                                                {getProposalStatusLabel(row)}
                                                            </span>
                                                        </div>
                                                        {row?.proposal?.teacherComment ? (
                                                            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 mb-1">
                                                                    Teacher Feedback
                                                                </p>
                                                                <p className="text-xs font-semibold text-blue-900 line-clamp-2">
                                                                    {row.proposal.teacherComment}
                                                                </p>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                    <Link to={`/student/assignments/${a._id}`} className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-black text-slate-700">
                                                        Teacher requirements
                                                    </Link>
                                                    {a.assignmentFile ? (
                                                        <a
                                                            href={`${getApiOrigin()}${a.assignmentFile}`}
                                                            download
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-black text-slate-600"
                                                        >
                                                            <Download className="w-3.5 h-3.5" /> Download
                                                        </a>
                                                    ) : null}
                                                    {canOpenProjectUpload(row) ? (
                                                        <Link to={`/student/project/${a._id}`} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest">
                                                            Project
                                                        </Link>
                                                    ) : (
                                                        <Link to={`/student/assignments/${a._id}/proposal`} className="px-4 py-2.5 bg-[#1D68E3] hover:bg-[#2a3fa4] text-white rounded-xl text-[11px] font-black uppercase tracking-widest">
                                                            Proposal
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="w-full xl:w-[340px] flex flex-col gap-6">
                            <div className="bg-white rounded-[24px] p-8 border border-slate-100 shadow-sm">
                                <h3 className="text-[13px] font-black text-slate-400 uppercase tracking-widest mb-6">Category Overview</h3>
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[13px] font-bold text-slate-600">Total</span>
                                        <span className="text-[20px] font-black text-[#0F172A]">{displayedRows.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[13px] font-bold text-slate-600">Submitted</span>
                                        <span className="text-[20px] font-black text-green-600">{submittedCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[13px] font-bold text-slate-600">Pending</span>
                                        <span className="text-[20px] font-black text-orange-500">{pendingCount}</span>
                                    </div>
                                </div>
                            </div>

                            {selectedCategory === 'final' && (
                                <div className="bg-[#1B2533] rounded-[24px] p-8 text-white border border-[#2D3A4A]">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-[#93C5FD] mb-2">AI VERIFICATION FLOW</div>
                                    <p className="text-[13px] font-medium text-slate-300 leading-relaxed">
                                        Submit proposal first. AI checks same-semester duplication and previous-semester similarity.
                                        If teacher approves, project ZIP upload is unlocked.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            <footer className="w-full mt-auto py-10 bg-[#1B2533] text-white flex flex-col md:flex-row items-center justify-between px-10 border-t border-[#2D3A4A]">
                <div className="font-black text-white text-xl tracking-tighter mb-4 md:mb-0">ScholarVerify</div>
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
