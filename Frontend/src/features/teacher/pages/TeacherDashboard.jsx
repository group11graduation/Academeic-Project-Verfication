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
            <header className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#1D68E3] mb-1">Teaching Workspace</p>
                        <h1 className="text-base font-black text-[#0F172A] tracking-tight mb-0.5">Teacher Dashboard</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Review projects, monitor alerts, and manage your assigned classes.</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                        <span className="text-slate-700 text-[11px] font-bold">Current Term</span>
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
                <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-black text-[#0F172A]">Assigned Classes</h2>
                        <Link to="/teacher/classes" className="inline-flex items-center gap-1 text-[#1D68E3] font-bold text-[11px]">
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
                                    status={cls.pending > 0 ? 'alert' : 'ok'}
                                    alerts={cls.pending}
                                    showReviewButton={cls.pending > 0}
                                />
                            ))
                        ) : (
                            <div className="sm:col-span-2 text-center py-8 rounded-lg border border-dashed border-slate-200">
                                <p className="text-[12px] text-slate-500 font-bold">No active classes assigned yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h2 className="text-sm font-black text-[#0F172A] mb-3">Quick Actions</h2>
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
    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
        <div className="flex justify-between items-center mb-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tone}`}>
                <Icon className="h-3.5 w-3.5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{title}</span>
        </div>
        <p className="text-lg font-black text-[#0F172A] leading-none">{value}</p>
    </div>
);

const ActionLink = ({ to, icon: Icon, title, desc }) => (
    <Link to={to} className="block rounded-lg border border-slate-200 bg-slate-50 p-3 hover:bg-blue-50/50 hover:border-blue-300 transition-all">
        <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-[#1D68E3]" />
            </div>
            <p className="text-[12px] font-black text-[#0F172A]">{title}</p>
        </div>
        <p className="text-[10px] font-semibold text-slate-500 leading-snug">{desc}</p>
    </Link>
);

export default TeacherDashboard;
