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
import { BRAND, BRAND_GRADIENT } from '../../../shared/ui/brandTheme';

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
                iconBg: 'bg-white text-[#2a3fa4]',
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
                <Loader2 className="h-9 w-9 animate-spin text-[#1D68E3]" />
            </div>
        );
    }

    return (
        <div className="space-y-6 [font-family:var(--sv-font-sans)]">
            <section>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {statCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div
                                key={card.title}
                                className={`relative overflow-hidden rounded-[1.35rem] p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] ring-1 ${card.soft} ${card.ring}`}
                            >
                                <div className="mb-6 flex items-start justify-between gap-3">
                                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${card.iconBg}`}>
                                        <Icon className="h-7 w-7" strokeWidth={2.15} />
                                    </div>
                                    <span className="text-[15px] font-bold text-slate-500">{card.title}</span>
                                </div>
                                <p className="text-[2.5rem] font-extrabold leading-none tracking-tight text-[#0f172a]">
                                    {Number(card.value).toLocaleString()}
                                </p>
                                {card.hint ? (
                                    <p className="mt-3.5 text-[13px] font-medium leading-snug text-slate-500">{card.hint}</p>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <div className="flex flex-col gap-5 xl:col-span-3">
                    <div className="rounded-[1.35rem] bg-white p-7 shadow-[0_12px_32px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80">
                        <div
                            className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-md"
                            style={{ background: BRAND_GRADIENT }}
                        >
                            <Users className="h-8 w-8" />
                        </div>
                        <p className="text-[2.5rem] font-extrabold leading-none tracking-tight text-[#0f172a]">
                            {(stats.totalStudents + stats.totalTeachers).toLocaleString()}
                        </p>
                        <p className="mt-2.5 text-[16px] font-semibold text-slate-500">Total people</p>
                        <p className="mt-3.5 text-[14px] font-medium text-slate-400">
                            {stats.totalStudents} students · {stats.totalTeachers} teachers
                        </p>
                    </div>

                    <div className="rounded-[1.35rem] bg-white p-7 shadow-[0_12px_32px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80">
                        <h3 className="mb-6 text-[16px] font-extrabold text-[#0f172a]">Institution mix</h3>
                        <div className="mx-auto mb-6 flex h-36 w-36 items-center justify-center">
                            <div
                                className="relative h-36 w-36 rounded-full"
                                style={{
                                    background: `conic-gradient(${BRAND.primary} 0% ${Math.min(
                                        100,
                                        stats.totalClasses + stats.activeProjects === 0
                                            ? 50
                                            : Math.round(
                                                  (stats.totalClasses /
                                                      Math.max(stats.totalClasses + stats.activeProjects, 1)) *
                                                      100
                                              )
                                    )}%, #93c5fd ${Math.min(
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
                                <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white">
                                    <span className="text-2xl font-extrabold text-[#0f172a]">
                                        {stats.totalClasses + stats.activeProjects}
                                    </span>
                                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total</span>
                                </div>
                            </div>
                        </div>
                        <ul className="space-y-3 text-[14px] font-semibold text-slate-600">
                            <li className="flex items-center gap-2.5">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: BRAND.primary }} />
                                Classes · {stats.totalClasses}
                            </li>
                            <li className="flex items-center gap-2.5">
                                <span className="h-3 w-3 rounded-full bg-sky-300" />
                                Active projects · {stats.activeProjects}
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="rounded-[1.35rem] bg-white p-7 shadow-[0_12px_32px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80 xl:col-span-5">
                    <div className="mb-6 flex items-center justify-between gap-2">
                        <h2 className="text-[16px] font-extrabold text-[#0f172a]">Priority Setup Actions</h2>
                        <Link to="/admin/setup-workflow" className="text-[14px] font-bold text-[#2a3fa4] hover:underline">
                            View all
                        </Link>
                    </div>
                    <div className="space-y-4">
                        {setupLinks.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className="group block rounded-2xl border border-slate-100 bg-[#f8faff] p-4 transition hover:border-[#c5d0f0] hover:bg-white"
                                >
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-3.5">
                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#2a3fa4] shadow-sm ring-1 ring-slate-200/80">
                                                <Icon className="h-5 w-5" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate text-[16px] font-extrabold text-[#0f172a]">{item.title}</p>
                                                <p className="truncate text-[13px] font-medium text-slate-500">{item.desc}</p>
                                            </div>
                                        </div>
                                        <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-[#2a3fa4]" />
                                    </div>
                                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${item.bar}%`, background: BRAND_GRADIENT }}
                                        />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className="rounded-[1.35rem] bg-white p-7 shadow-[0_12px_32px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80 xl:col-span-4">
                    <h2 className="mb-6 text-[16px] font-extrabold text-[#0f172a]">Role Workflow</h2>
                    <div className="space-y-4">
                        {roles.map((role, i) => (
                            <div key={role.title} className="rounded-2xl border border-slate-100 bg-[#f8faff] p-5">
                                <div className="mb-2.5 flex items-center gap-3">
                                    <span
                                        className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
                                        style={{ background: BRAND_GRADIENT }}
                                    >
                                        {i + 1}
                                    </span>
                                    <p className="text-[14px] font-extrabold uppercase tracking-wide text-[#2a3fa4]">
                                        {role.title}
                                    </p>
                                </div>
                                <p className="text-[14px] font-medium leading-relaxed text-slate-600">{role.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="rounded-[1.35rem] bg-white p-7 shadow-[0_12px_32px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80">
                <h2 className="mb-6 text-[16px] font-extrabold text-[#0f172a]">Quick access</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {setupLinks.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={`quick-${item.to}`}
                                to={item.to}
                                className="flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-[#f8faff] px-4 py-4 transition hover:border-[#c5d0f0] hover:bg-white"
                            >
                                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#2a3fa4] shadow-sm ring-1 ring-slate-200/70">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-[15px] font-extrabold text-[#0f172a]">{item.title}</span>
                                    <span className="block truncate text-[13px] font-medium text-slate-500">{item.desc}</span>
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
