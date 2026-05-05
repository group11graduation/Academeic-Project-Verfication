import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, Clock3, FileText, Loader2, MessageSquare, Rocket } from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import studentService from '../../../services/studentService';
import StudentHeader from '../components/StudentHeader';

const ACCENT = '#2a3fa4';

const LandingPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await studentService.getAssignments();
                if (res.success) {
                    const list = Array.isArray(res.data) ? res.data : res.data?.assignments || [];
                    setRows(list);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const stats = useMemo(() => {
        const total = rows.length;
        const proposalApproved = rows.filter((r) => r?.proposal?.status === 'teacher_approved').length;
        const waitingReview = rows.filter((r) => r?.proposal?.status === 'pending_teacher_approval').length;
        const projectSubmitted = rows.filter((r) => Boolean(r?.latestProjectSubmission)).length;
        return { total, proposalApproved, waitingReview, projectSubmitted };
    }, [rows]);

    const recentRows = useMemo(() => rows.slice(0, 4), [rows]);
    const canOpenProject = (row) =>
        Boolean(row?.latestProjectSubmission || row?.proposal?.status === 'teacher_approved');

    return (
        <div className="min-h-screen bg-[#f8faff] font-sans text-slate-900">
            <StudentHeader />

            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm mb-6">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Student Home</p>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">
                        Welcome {user?.name ? `, ${user.name}` : ''}
                    </h1>
                    <p className="text-sm text-slate-600 font-medium mb-5">
                        Manage your assignments, check teacher feedback, and continue your proposal/project workflow.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/student/assignments')}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold"
                            style={{ backgroundColor: ACCENT }}
                        >
                            <BookOpen className="h-4 w-4" /> Open Assignments
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/student')}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700"
                        >
                            <Rocket className="h-4 w-4" /> My Projects
                        </button>
                    </div>
                </section>

                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'Total Assignments', value: stats.total, icon: BookOpen, tone: 'text-slate-700 bg-slate-100' },
                        { label: 'Proposal Approved', value: stats.proposalApproved, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-100' },
                        { label: 'Waiting Review', value: stats.waitingReview, icon: Clock3, tone: 'text-amber-700 bg-amber-100' },
                        { label: 'Project Submitted', value: stats.projectSubmitted, icon: Rocket, tone: 'text-blue-700 bg-blue-100' },
                    ].map((s) => (
                        <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.tone}`}>
                                <s.icon className="h-5 w-5" />
                            </div>
                            <p className="text-2xl font-black text-slate-900">{s.value}</p>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">{s.label}</p>
                        </div>
                    ))}
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-black text-slate-900">Recent Assignment Activity</h2>
                        <Link to="/student/assignments" className="text-xs font-black uppercase tracking-widest text-[#2a3fa4]">
                            View all
                        </Link>
                    </div>

                    {loading ? (
                        <div className="py-10 flex justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-[#2a3fa4]" />
                        </div>
                    ) : recentRows.length === 0 ? (
                        <p className="text-sm font-semibold text-slate-500">No assignments found for your account yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {recentRows.map((row) => {
                                const assignment = row?.assignment || {};
                                return (
                                    <div key={assignment._id} className="rounded-2xl border border-slate-200 p-4">
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-black text-slate-900">{assignment.title || 'Assignment'}</p>
                                                <p className="text-xs font-semibold text-slate-500 mt-1">
                                                    {row?.proposal?.status === 'teacher_approved' ? 'Proposal Accepted' : 'Continue proposal workflow'}
                                                </p>
                                                {row?.proposal?.teacherComment ? (
                                                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                                                        <MessageSquare className="h-3.5 w-3.5" />
                                                        Teacher feedback available
                                                    </p>
                                                ) : null}
                                            </div>
                                            <div className="flex gap-2">
                                                <Link
                                                    to={`/student/assignments/${assignment._id}`}
                                                    className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700"
                                                >
                                                    Details
                                                </Link>
                                                {canOpenProject(row) ? (
                                                    <Link
                                                        to={`/student/project/${assignment._id}`}
                                                        className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                                                    >
                                                        Project
                                                    </Link>
                                                ) : (
                                                    <Link
                                                        to={`/student/assignments/${assignment._id}/proposal`}
                                                        className="px-3.5 py-2 rounded-lg text-white text-xs font-bold"
                                                        style={{ backgroundColor: ACCENT }}
                                                    >
                                                        Proposal
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default LandingPage;
