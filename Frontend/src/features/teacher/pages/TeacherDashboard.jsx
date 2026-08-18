import React, { useState, useEffect, useMemo } from 'react';
import {
    CheckCircle2,
    Hourglass,
    AlertTriangle,
    Calendar as CalendarIcon,
    Loader2,
    ClipboardList,
    ArrowRight,
    Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ClassCard from '../components/ClassCard';
import TeacherPage from '../components/TeacherPage';
import teacherService from '../../../services/teacherService';
import { TEACHER_GRADIENT, TEACHER_PRIMARY } from '../ui/teacherTheme';

const TeacherDashboard = () => {
    const [dashboardData, setDashboardData] = useState({
        totalProjectsReviewed: 0,
        pendingReviews: 0,
        similarityAlerts: 0,
        activeClasses: [],
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
                console.error('Failed to fetch teacher dashboard stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const statCards = useMemo(
        () => [
            {
                title: 'Projects Reviewed',
                value: dashboardData.totalProjectsReviewed,
                icon: CheckCircle2,
                soft: 'bg-[var(--bg-elevated)]',
                iconBg: 'bg-[var(--bg-card)] text-[var(--brand-primary)]',
                ring: 'ring-[var(--border)]',
            },
            {
                title: 'Pending Reviews',
                value: dashboardData.pendingReviews,
                icon: Hourglass,
                soft: 'bg-[var(--bg-elevated)]',
                iconBg: 'bg-[var(--bg-card)] text-[var(--brand-primary)]',
                ring: 'ring-[var(--border)]',
            },
            {
                title: 'Similarity Alerts',
                value: dashboardData.similarityAlerts,
                icon: AlertTriangle,
                soft: 'bg-[var(--bg-elevated)]',
                iconBg: 'bg-[var(--bg-card)] text-[var(--brand-primary)]',
                ring: 'ring-[var(--border)]',
            },
        ],
        [dashboardData]
    );

    if (loading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center [font-family:var(--sv-font-sans)]">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: TEACHER_PRIMARY }} />
            </div>
        );
    }

    return (
        <TeacherPage>
            <section>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {statCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div
                                key={card.title}
                                className={`relative overflow-hidden rounded-xl p-3 shadow-sm ring-1 ${card.soft} ${card.ring}`}
                            >
                                <div className="mb-2.5 flex items-start justify-between gap-2">
                                    <div
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-sm ${card.iconBg}`}
                                    >
                                        <Icon className="h-4 w-4" strokeWidth={2.2} />
                                    </div>
                                    <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{card.title}</span>
                                </div>
                                <p className="text-xl font-bold leading-[1.2] tracking-tight text-[var(--text-primary)]">
                                    {Number(card.value).toLocaleString()}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="grid grid-cols-1 gap-2.5 xl:grid-cols-12">
                <div className="rounded-xl bg-[var(--bg-card)] p-3.5 shadow-sm ring-1 ring-[var(--border)] xl:col-span-8">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Assigned Classes</h2>
                        <Link
                            to="/teacher/classes"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold"
                            style={{ color: TEACHER_PRIMARY }}
                        >
                            Open classes <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
                            <div className="rounded-lg border border-dashed border-[var(--border)] py-8 text-center sm:col-span-2">
                                <p className="text-[12px] font-medium text-[var(--text-secondary)]">No active classes assigned yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-xl bg-[var(--bg-card)] p-3.5 shadow-sm ring-1 ring-[var(--border)] xl:col-span-4">
                    <div className="mb-3 flex items-center gap-2">
                        <div
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm"
                            style={{ background: TEACHER_GRADIENT }}
                        >
                            <ClipboardList className="h-4 w-4" />
                        </div>
                        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Quick Actions</h2>
                    </div>
                    <div className="space-y-2">
                        <ActionLink
                            to="/teacher/assignments/collaborative/new"
                            icon={Users}
                            title="Collaborative Assignment"
                            desc="Pair with a co-teacher and split FE/BE requirements."
                        />
                        <ActionLink
                            to="/teacher/assignments"
                            icon={ClipboardList}
                            title="Manage Assignments"
                            desc="Create and track assignment lifecycle."
                        />
                        <ActionLink
                            to="/teacher/classes"
                            icon={CalendarIcon}
                            title="Manage Classes"
                            desc="Open class overview and students."
                        />
                        <ActionLink
                            to="/teacher/group-management"
                            icon={CheckCircle2}
                            title="Group Management"
                            desc="Configure and monitor student groups."
                        />
                    </div>
                </div>
            </section>
        </TeacherPage>
    );
};

const ActionLink = ({ to, icon: Icon, title, desc }) => (
    <Link
        to={to}
        className="block rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 transition hover:border-[var(--accent)]/40 hover:brightness-110"
    >
        <div className="mb-1 flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-card)] text-[var(--brand-primary)] shadow-sm ring-1 ring-[var(--border)]">
                <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
            </div>
            <p className="text-[12px] font-semibold text-[var(--text-primary)]">{title}</p>
        </div>
        <p className="text-[10px] font-normal leading-snug text-[var(--text-secondary)]">{desc}</p>
    </Link>
);

export default TeacherDashboard;
