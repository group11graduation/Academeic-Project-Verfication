import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BookMarked,
    Building2,
    CalendarRange,
    GraduationCap,
    Loader2,
    Rocket,
    Users,
    Workflow,
} from 'lucide-react';
import adminDashboardService from '../../../services/adminDashboardService';
import { ADMIN, ADMIN_GRADIENT } from '../ui/adminTheme';

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
            {
                title: 'Students',
                value: stats.totalStudents,
                icon: Users,
                soft: 'bg-[#e8f5ef]',
                iconBg: 'bg-white text-emerald-600',
                ring: 'ring-emerald-100',
            },
            {
                title: 'Teachers',
                value: stats.totalTeachers,
                icon: GraduationCap,
                soft: 'bg-[#e8eefc]',
                iconBg: 'bg-white text-[#1e2b72]',
                ring: 'ring-blue-100',
            },
            {
                title: 'Classes',
                value: stats.totalClasses,
                icon: Building2,
                soft: 'bg-[#eef0f4]',
                iconBg: 'bg-white text-slate-600',
                ring: 'ring-slate-200',
            },
            {
                title: 'Active Projects',
                value: stats.activeProjects,
                icon: Rocket,
                soft: 'bg-[#fff1e8]',
                iconBg: 'bg-white text-orange-600',
                ring: 'ring-orange-100',
                hint: 'Proposals in review or approved project phase',
            },
        ],
        [stats]
    );

    const setupLinks = [
        { to: '/admin/setup-workflow', title: 'Setup Workflow', desc: 'Follow the exact setup order.', icon: Workflow, bar: 92 },
        { to: '/admin/academic-structure', title: 'Academic Structure', desc: 'Manage faculties and departments.', icon: Building2, bar: 78 },
        { to: '/admin/semesters', title: 'Semesters', desc: 'Create academic years and terms.', icon: CalendarRange, bar: 64 },
        { to: '/admin/subjects', title: 'Subjects', desc: 'Manage all course subjects.', icon: BookMarked, bar: 55 },
        { to: '/admin/classes', title: 'Classes', desc: 'Create classes and assign teachers.', icon: Building2, bar: 48 },
    ];

    const roles = [
        { title: 'Admin', text: 'Setup terms, subjects, classes, teacher assignments, then student enrollment.' },
        { title: 'Teacher', text: 'Create assignments, define requirements, review and decide proposals.' },
        { title: 'Student', text: 'Submit matching proposal, revise if needed, then submit final project.' },
    ];

    if (loading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#1e2b72]" />
            </div>
        );
    }

    return (
        <div className="space-y-3 [font-family:var(--sv-font-sans)]">
            <section>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                    {statCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div
                                key={card.title}
                                className={`relative overflow-hidden rounded-xl p-3 shadow-sm ring-1 ${card.soft} ${card.ring}`}
                            >
                                <div className="mb-2.5 flex items-start justify-between gap-2">
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-sm ${card.iconBg}`}>
                                        <Icon className="h-4 w-4" strokeWidth={2.2} />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500">{card.title}</span>
                                </div>
                                <p className="text-xl font-extrabold leading-none tracking-tight text-[#0f172a]">
                                    {Number(card.value).toLocaleString()}
                                </p>
                                {card.hint ? (
                                    <p className="mt-1.5 text-[10px] font-medium leading-snug text-slate-500">{card.hint}</p>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="grid grid-cols-1 gap-2.5 xl:grid-cols-12">
                <div className="flex flex-col gap-2.5 xl:col-span-3">
                    <div className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/80">
                        <div
                            className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
                            style={{ background: ADMIN_GRADIENT }}
                        >
                            <Users className="h-4 w-4" />
                        </div>
                        <p className="text-xl font-extrabold leading-none tracking-tight text-[#0f172a]">
                            {(stats.totalStudents + stats.totalTeachers).toLocaleString()}
                        </p>
                        <p className="mt-1 text-[12px] font-semibold text-slate-500">Total people</p>
                        <p className="mt-1.5 text-[10px] font-medium text-slate-400">
                            {stats.totalStudents} students · {stats.totalTeachers} teachers
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/80">
                        <h3 className="mb-2.5 text-[12px] font-extrabold text-[#0f172a]">Institution mix</h3>
                        <div className="mx-auto mb-2.5 flex h-20 w-20 items-center justify-center">
                            <div
                                className="relative h-20 w-20 rounded-full"
                                style={{
                                    background: `conic-gradient(${ADMIN.primary} 0% ${Math.min(
                                        100,
                                        stats.totalClasses + stats.activeProjects === 0
                                            ? 50
                                            : Math.round(
                                                  (stats.totalClasses /
                                                      Math.max(stats.totalClasses + stats.activeProjects, 1)) *
                                                      100
                                              )
                                    )}%, #9aa8d6 ${Math.min(
                                        100,
                                        stats.totalClasses + stats.activeProjects === 0
                                            ? 50
                                            : Math.round(
                                                  (stats.totalClasses /
                                                      Math.max(stats.totalClasses + stats.activeProjects, 1)) *
                                                      100
                                              )
                                    )}% 100%)`,
                                }}
                            >
                                <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-white">
                                    <span className="text-sm font-extrabold text-[#0f172a]">
                                        {stats.totalClasses + stats.activeProjects}
                                    </span>
                                    <span className="text-[8px] font-bold uppercase tracking-wide text-slate-400">Total</span>
                                </div>
                            </div>
                        </div>
                        <ul className="space-y-1.5 text-[11px] font-semibold text-slate-600">
                            <li className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ADMIN.primary }} />
                                Classes · {stats.totalClasses}
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-violet-300" />
                                Active projects · {stats.activeProjects}
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/80 xl:col-span-5">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                        <h2 className="text-[12px] font-extrabold text-[#0f172a]">Priority Setup Actions</h2>
                        <Link to="/admin/setup-workflow" className="text-[10px] font-bold text-[#1e2b72] hover:underline">
                            View all
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {setupLinks.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className="group block rounded-lg border border-slate-100 bg-[#f8faff] p-2.5 transition hover:border-[#c5d0f0] hover:bg-white"
                                >
                                    <div className="mb-1.5 flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#1e2b72] shadow-sm ring-1 ring-slate-200/80">
                                                <Icon className="h-3.5 w-3.5" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate text-[12px] font-extrabold text-[#0f172a]">{item.title}</p>
                                                <p className="truncate text-[10px] font-medium text-slate-500">{item.desc}</p>
                                            </div>
                                        </div>
                                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-[#1e2b72]" />
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${item.bar}%`, background: ADMIN_GRADIENT }}
                                        />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/80 xl:col-span-4">
                    <h2 className="mb-2.5 text-[12px] font-extrabold text-[#0f172a]">Role Workflow</h2>
                    <div className="space-y-2">
                        {roles.map((role, i) => (
                            <div key={role.title} className="rounded-lg border border-slate-100 bg-[#f8faff] p-2.5">
                                <div className="mb-1 flex items-center gap-2">
                                    <span
                                        className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold text-white"
                                        style={{ background: ADMIN_GRADIENT }}
                                    >
                                        {i + 1}
                                    </span>
                                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#1e2b72]">
                                        {role.title}
                                    </p>
                                </div>
                                <p className="text-[11px] font-medium leading-snug text-slate-600">{role.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/80">
                <h2 className="mb-2.5 text-[12px] font-extrabold text-[#0f172a]">Quick access</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {setupLinks.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={`quick-${item.to}`}
                                to={item.to}
                                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-[#f8faff] px-2.5 py-2 transition hover:border-[#c5d0f0] hover:bg-white"
                            >
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#1e2b72] shadow-sm ring-1 ring-slate-200/70">
                                    <Icon className="h-3.5 w-3.5" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-[11px] font-extrabold text-[#0f172a]">{item.title}</span>
                                    <span className="block truncate text-[10px] font-medium text-slate-500">{item.desc}</span>
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};

export default AdminDashboard;
