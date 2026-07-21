import React, { useState, useEffect } from 'react';
import { CheckCircle2, Hourglass, AlertTriangle, Calendar as CalendarIcon, Loader2, ClipboardList, ArrowRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import ClassCard from '../components/ClassCard';
import teacherService from '../../../services/teacherService';

const TeacherDashboard = () => {
    const [dashboardData, setDashboardData] = useState({
        totalProjectsReviewed: 0,
        pendingReviews: 0,
        similarityAlerts: 0,
        activeClasses: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await teacherService.getDashboardStats();
                if (response.success) {
                    setDashboardData(response.data);
                }
            } catch (error) {
                console.error("Failed to fetch teacher dashboard stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="min-h-[40vh] flex items-center justify-center">
                <Loader2 className="h-7 w-7 text-[#1D68E3] animate-spin" />
            </div>
        );
    }
    return (
        <div className="space-y-3">
            <header className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#1D68E3] mb-1">Teaching Workspace</p>
                        <h1 className="mb-0.5 text-base font-black tracking-tight text-[#0F172A] dark:text-slate-100">Teacher Dashboard</h1>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-300">Review projects, monitor alerts, and manage your assigned classes.</p>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-white/10 dark:bg-[#0f172a]">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Current Term</span>
                        <div className="bg-blue-500/10 p-1 rounded-full">
                            <CalendarIcon className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                    </div>
                </div>
            </header>

            <section className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <StatCard title="Projects Reviewed" value={dashboardData.totalProjectsReviewed} icon={CheckCircle2} tone="text-blue-600 bg-blue-50" />
                <StatCard title="Pending Reviews" value={dashboardData.pendingReviews} icon={Hourglass} tone="text-amber-600 bg-amber-50" />
                <StatCard title="Similarity Alerts" value={dashboardData.similarityAlerts} icon={AlertTriangle} tone="text-rose-600 bg-rose-50" />
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#111827] xl:col-span-2">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-black text-[#0F172A] dark:text-slate-100">Assigned Classes</h2>
                        <Link to="/teacher/classes" className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1D68E3] dark:text-blue-300">
                            Open classes <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {dashboardData.activeClasses.length > 0 ? (
                            dashboardData.activeClasses.slice(0, 4).map((cls, index) => (
                                <ClassCard
                                    key={index}
                                    code={cls.code}
                                    title={cls.title}
                                    section={cls.section}
                                    students={cls.students}
                                    pending={cls.pending}
                                    status={(cls.reviewAlertCount ?? cls.pending ?? 0) > 0 ? 'alert' : 'ok'}
                                    alerts={cls.reviewAlertCount ?? cls.pending ?? 0}
                                    showReviewButton={(cls.reviewAlertCount ?? cls.pending ?? 0) > 0}
                                />
                            ))
                        ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center dark:border-white/10 sm:col-span-2">
                                <p className="text-[12px] font-bold text-slate-500 dark:text-slate-400">No active classes assigned yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
                    <h2 className="mb-3 text-sm font-black text-[#0F172A] dark:text-slate-100">Quick Actions</h2>
                    <div className="space-y-2">
                        <ActionLink to="/teacher/assignments/collaborative/new" icon={Users} title="Collaborative Assignment" desc="Pair with a co-teacher and split FE/BE requirements." />
                        <ActionLink to="/teacher/assignments" icon={ClipboardList} title="Manage Assignments" desc="Create and track assignment lifecycle." />
                        <ActionLink to="/teacher/classes" icon={CalendarIcon} title="Manage Classes" desc="Open class overview and students." />
                        <ActionLink to="/teacher/group-management" icon={CheckCircle2} title="Group Management" desc="Configure and monitor student groups." />
                    </div>
                </div>
            </section>
        </div>
    );
};

const StatCard = ({ title, value, icon: Icon, tone }) => (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#111827]">
        <div className="mb-2 flex items-center justify-between">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tone}`}>
                <Icon className="h-3.5 w-3.5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</span>
        </div>
        <p className="text-lg font-black leading-none text-[#0F172A] dark:text-slate-100">{value}</p>
    </div>
);

const ActionLink = ({ to, icon: Icon, title, desc }) => (
    <Link to={to} className="block rounded-lg border border-slate-200 bg-slate-50 p-3 transition-all hover:border-blue-300 hover:bg-blue-50/50 dark:border-white/10 dark:bg-[#0f172a] dark:hover:border-blue-400/30 dark:hover:bg-[#162033]">
        <div className="mb-1 flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white dark:border-white/10 dark:bg-[#111827]">
                <Icon className="h-3.5 w-3.5 text-[#1D68E3]" />
            </div>
            <p className="text-[12px] font-black text-[#0F172A] dark:text-slate-100">{title}</p>
        </div>
        <p className="text-[10px] font-semibold leading-snug text-slate-500 dark:text-slate-400">{desc}</p>
    </Link>
);

export default TeacherDashboard;
