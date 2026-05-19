import React, { useEffect } from 'react';
import { BookOpen, CalendarClock, CheckCircle2, Clock3, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import studentService from '../../../services/studentService';

const StudentMyProject = () => {
    const [dashboardData, setDashboardData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    useEffect(() => {
        window.scrollTo(0, 0);
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        const res = await studentService.getDashboard();
        if (res.success) {
            setDashboardData(res.data);
        }
        setLoading(false);
    };

    const assignments = dashboardData?.assignments || [];
    const submittedCount = assignments.filter((r) => r?.proposal && r.proposal.status !== 'draft').length;
    const approvedCount = assignments.filter((r) => r?.proposal?.status === 'teacher_approved').length;
    const pendingCount = assignments.filter((r) => r?.proposal?.status === 'pending_teacher_approval').length;

    return (
        <div className="min-h-screen flex flex-col bg-[#F8FAFB] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
            <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 md:px-8 py-10">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                        <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
                        <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Loading Projects...</p>
                    </div>
                ) : (
                    <>
                        <section className="rounded-[28px] border border-slate-200 bg-white p-6 md:p-8 mb-8">
                            <div className="text-[#1D68E3] text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                Student Workspace • {dashboardData?.class?.code || 'NO CLASS'}
                            </div>
                            <h1 className="text-3xl md:text-5xl font-black text-[#0F172A] tracking-tight leading-none mb-3">
                                My Dashboard
                            </h1>
                            <p className="text-base font-medium text-slate-500 max-w-3xl">
                                Track all assignment proposals and project submissions in one place.
                            </p>
                        </section>

                        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                            <StatCard label="Total Assignments" value={assignments.length} icon={BookOpen} />
                            <StatCard label="Submitted Proposals" value={submittedCount} icon={Clock3} />
                            <StatCard label="Approved Proposals" value={approvedCount} icon={CheckCircle2} />
                        </section>

                        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
                            <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-black text-[#0F172A]">Assignment Workspace</h2>
                                    <Link to="/student/assignments" className="inline-flex items-center gap-1 text-[#1D68E3] font-bold text-sm">
                                        Open all <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </div>

                                {assignments.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {assignments.slice(0, 6).map((row) => {
                                            const a = row.assignment;
                                            const p = row.proposal;
                                            const status = p?.status || 'not_submitted';
                                            const classLabel =
                                                (Array.isArray(a.classNames) && a.classNames.length > 0 && a.classNames.join(', ')) ||
                                                (Array.isArray(a.assignedClasses) && a.assignedClasses.length > 0 && a.assignedClasses.join(', ')) ||
                                                a.class?.code || a.class?.name || 'CLASS';
                                            return (
                                                <div key={a._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#1D68E3] mb-1">
                                                        {a.subject?.code || 'SUBJECT'} • {classLabel}
                                                    </p>
                                                    <h3 className="text-base font-black text-[#0F172A] mb-2 line-clamp-2">{a.title}</h3>
                                                    <div className="flex items-center justify-between text-xs font-bold mb-3">
                                                        <span className="text-slate-500">Status</span>
                                                        <span className="text-slate-700 uppercase">{status.replaceAll('_', ' ')}</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Link
                                                            to={`/student/assignments/${a._id}/proposal`}
                                                            className="flex-1 text-center py-2 rounded-xl bg-[#1D68E3] text-white text-[11px] font-black uppercase tracking-widest"
                                                        >
                                                            Proposal
                                                        </Link>
                                                        {row.projectSubmissionAllowed ? (
                                                            <Link
                                                                to={`/student/project/${a._id}`}
                                                                className="flex-1 text-center py-2 rounded-xl border border-emerald-300 text-emerald-700 text-[11px] font-black uppercase tracking-widest"
                                                            >
                                                                Project
                                                            </Link>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="py-16 text-center rounded-2xl border border-dashed border-slate-200">
                                        <p className="text-slate-500 font-bold">No assignments available yet.</p>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
                                <h2 className="text-xl font-black text-[#0F172A] mb-5">My Progress</h2>
                                <div className="space-y-4">
                                    <ProgressItem label="Pending Teacher Review" value={pendingCount} />
                                    <ProgressItem label="Approved" value={approvedCount} />
                                    <ProgressItem label="Submitted" value={submittedCount} />
                                    <ProgressItem label="Not Submitted" value={Math.max(assignments.length - submittedCount, 0)} />
                                </div>
                                <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-3">
                                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">Quick Tip</p>
                                    <p className="text-sm font-semibold text-slate-600">
                                        If proposal is approved, go to project submission directly.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
};

const StatCard = ({ label, value, icon: Icon }) => (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#1D68E3] flex items-center justify-center">
                <Icon className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
        </div>
        <p className="text-4xl font-black text-[#0F172A] leading-none">{value}</p>
    </div>
);

const ProgressItem = ({ label, value }) => (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="inline-flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#1D68E3]" />
            <span className="text-sm font-semibold text-slate-600">{label}</span>
        </div>
        <span className="text-sm font-black text-[#0F172A]">{value}</span>
    </div>
);

export default StudentMyProject;
