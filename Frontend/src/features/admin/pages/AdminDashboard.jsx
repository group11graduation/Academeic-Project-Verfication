import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Users, GraduationCap, Building2, Rocket, ArrowRight, Workflow, BookMarked, CalendarRange } from 'lucide-react';
import adminDashboardService from '../../../services/adminDashboardService';

const AdminDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalTeachers: 0,
        totalClasses: 0,
        activeProjects: 0,
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await adminDashboardService.getStats();
                if (response.success) {
                    setStats({
                        totalStudents: response.data.totalStudents || 0,
                        totalTeachers: response.data.totalTeachers || 0,
                        totalClasses: response.data.totalClasses || 0,
                        activeProjects: response.data.activeProjects || 0,
                    });
                }
            } catch (error) {
                console.error('Failed to fetch dashboard stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const statCards = useMemo(
        () => [
            { title: 'Students', value: stats.totalStudents, icon: Users, tone: 'text-blue-600 bg-blue-50' },
            { title: 'Teachers', value: stats.totalTeachers, icon: GraduationCap, tone: 'text-indigo-600 bg-indigo-50' },
            { title: 'Classes', value: stats.totalClasses, icon: Building2, tone: 'text-purple-600 bg-purple-50' },
            { title: 'Active Projects', value: stats.activeProjects, icon: Rocket, tone: 'text-emerald-600 bg-emerald-50', hint: 'Proposals in review or approved project phase' },
        ],
        [stats]
    );

    if (loading) {
        return (
            <div className="min-h-[40vh] flex items-center justify-center">
                <Loader2 className="h-7 w-7 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#1D68E3] mb-1">Admin Control Center</p>
                <h1 className="mb-1 text-base font-black tracking-tight text-[#0F172A] dark:text-slate-100">Institution Dashboard</h1>
                <p className="max-w-3xl text-[11px] font-medium text-slate-500 dark:text-slate-300">
                    Monitor academic setup, people, and project activity from one place.
                </p>
            </section>

            <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {statCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.title} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#111827]">
                            <div className="mb-2 flex items-center justify-between">
                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${card.tone}`}>
                                    <Icon className="h-3.5 w-3.5" />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{card.title}</span>
                            </div>
                            <p className="text-lg font-black leading-none text-[#0F172A] dark:text-slate-100">{card.value}</p>
                            {card.hint ? (
                                <p className="mt-1.5 text-[9px] font-semibold leading-snug text-slate-400 dark:text-slate-500">{card.hint}</p>
                            ) : null}
                        </div>
                    );
                })}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#111827] xl:col-span-2">
                    <h2 className="mb-3 text-sm font-black text-[#0F172A] dark:text-slate-100">Priority Setup Actions</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <QuickLink to="/admin/setup-workflow" title="Setup Workflow" desc="Follow the exact setup order." icon={Workflow} />
                        <QuickLink to="/admin/semesters" title="Semesters" desc="Create academic terms first." icon={CalendarRange} />
                        <QuickLink to="/admin/subjects" title="Subjects" desc="Manage all course subjects." icon={BookMarked} />
                        <QuickLink to="/admin/classes" title="Classes" desc="Create classes and assign teachers." icon={Building2} />
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
                    <h2 className="mb-3 text-sm font-black text-[#0F172A] dark:text-slate-100">Role Workflow</h2>
                    <div className="space-y-2 text-[11px]">
                        <WorkflowItem title="Admin" text="Setup terms, subjects, classes, teacher assignments, then student enrollment." />
                        <WorkflowItem title="Teacher" text="Create assignments, define requirements, review and decide proposals." />
                        <WorkflowItem title="Student" text="Submit matching proposal, revise if needed, then submit final project." />
                    </div>
                </div>
            </section>
        </div>
    );
};

const QuickLink = ({ to, title, desc, icon: Icon }) => (
    <Link to={to} className="rounded-lg border border-slate-200 bg-slate-50 p-3 transition-all hover:border-blue-300 hover:bg-blue-50/50 dark:border-white/10 dark:bg-[#0f172a] dark:hover:border-blue-400/30 dark:hover:bg-[#162033]">
        <div className="mb-1.5 flex items-center justify-between">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white dark:border-white/10 dark:bg-[#111827]">
                <Icon className="h-3.5 w-3.5 text-[#1D68E3]" />
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
        </div>
        <p className="text-[12px] font-black text-[#0F172A] dark:text-slate-100">{title}</p>
        <p className="mt-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">{desc}</p>
    </Link>
);

const WorkflowItem = ({ title, text }) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-[#0f172a]">
        <p className="text-[9px] font-black uppercase tracking-wider text-[#1D68E3] mb-0.5">{title}</p>
        <p className="font-semibold leading-snug text-slate-600 dark:text-slate-300">{text}</p>
    </div>
);

export default AdminDashboard;
