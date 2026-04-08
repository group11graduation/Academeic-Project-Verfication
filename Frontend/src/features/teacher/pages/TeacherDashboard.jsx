import React, { useState, useEffect } from 'react';
import {
    CheckCircle2,
    Hourglass,
    AlertTriangle,
    ChevronRight,
    Calendar as CalendarIcon,
    ListRestart,
    FileText,
    Loader2
} from 'lucide-react';
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
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B1120]">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }
    return (
        <div className="p-4 md:p-10 max-w-[1600px] mx-auto min-h-screen">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-12 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 mb-1 md:mb-2 tracking-tight">Teacher Dashboard</h1>
                    <p className="text-slate-500 text-sm md:text-base font-medium">Manage your courses and review student academic integrity.</p>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-[#0F172A] px-4 py-2 rounded-full border border-slate-100 dark:border-white/5 shadow-xl">
                    <span className="text-slate-500 dark:text-slate-300 text-sm font-bold">Spring 2024</span>
                    <div className="bg-blue-500/10 p-1.5 rounded-full">
                        <CalendarIcon className="h-4 w-4 text-blue-400" />
                    </div>
                </div>
            </header>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-12">
                {/* Total Projects Reviewed */}
                <div className="bg-white dark:bg-[#0F172A] p-6 md:p-8 rounded-[24px] border border-slate-100 dark:border-white/5 shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4 md:mb-6">
                        <div>
                            <p className="text-slate-400 dark:text-slate-500 text-[11px] md:text-[13px] font-bold uppercase tracking-widest mb-1 md:mb-2">Total Projects Reviewed</p>
                            <h3 className="text-2xl md:text-[32px] font-black text-slate-800 dark:text-slate-100 leading-tight">{dashboardData.totalProjectsReviewed}</h3>
                        </div>
                        <div className="bg-blue-500/10 p-3 md:p-4 rounded-2xl">
                            <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="flex items-center text-emerald-500 text-xs md:text-sm font-black">
                            <span className="rotate-[-45deg] mr-0.5 md:mr-1">↗</span>
                            +12%
                        </div>
                        <span className="text-slate-400 dark:text-slate-600 text-xs md:text-sm font-bold">from last month</span>
                    </div>
                </div>

                {/* Pending Reviews */}
                <div className="bg-white dark:bg-[#0F172A] p-6 md:p-8 rounded-[24px] border border-slate-100 dark:border-white/5 shadow-2xl group hover:border-amber-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4 md:mb-6">
                        <div>
                            <p className="text-slate-400 dark:text-slate-500 text-[11px] md:text-[13px] font-bold uppercase tracking-widest mb-1 md:mb-2">Pending Reviews</p>
                            <h3 className="text-2xl md:text-[32px] font-black text-slate-800 dark:text-slate-100 leading-tight">{dashboardData.pendingReviews}</h3>
                        </div>
                        <div className="bg-amber-500/10 p-3 md:p-4 rounded-2xl">
                            <Hourglass className="h-5 w-5 md:h-6 md:w-6 text-amber-500" />
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="flex items-center text-amber-500 text-xs md:text-sm font-black">
                            <span className="rotate-[-45deg] mr-0.5 md:mr-1">↗</span>
                            5 tasks
                        </div>
                        <span className="text-slate-400 dark:text-slate-600 text-xs md:text-sm font-bold">added today</span>
                    </div>
                </div>

                {/* Similarity Alerts */}
                <div className="bg-white dark:bg-[#0F172A] p-6 md:p-8 rounded-[24px] border border-slate-100 dark:border-white/5 shadow-2xl group hover:border-rose-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4 md:mb-6">
                        <div>
                            <p className="text-slate-400 dark:text-slate-500 text-[11px] md:text-[13px] font-bold uppercase tracking-widest mb-1 md:mb-2">Similarity Alerts</p>
                            <h3 className="text-2xl md:text-[32px] font-black text-slate-800 dark:text-slate-100 leading-tight">{dashboardData.similarityAlerts}</h3>
                        </div>
                        <div className="bg-rose-500/10 p-3 md:p-4 rounded-2xl">
                            <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-rose-500" />
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-rose-500">
                        <AlertTriangle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        <span className="text-xs md:text-sm font-black uppercase tracking-widest">Urgent attention</span>
                    </div>
                </div>
            </div>

            {/* Active Classes Section */}
            <section className="mb-8 md:mb-12">
                <div className="flex justify-between items-center mb-6 md:mb-8">
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Active Classes</h2>
                    <button className="text-[#1D68E3] font-black text-xs md:text-sm tracking-widest uppercase hover:text-blue-400 transition-colors">View All Courses</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {dashboardData.activeClasses.length > 0 ? (
                        dashboardData.activeClasses.map((cls, index) => (
                            <ClassCard
                                key={index}
                                code={cls.code}
                                title={cls.title}
                                section={cls.section}
                                students={cls.students}
                                pending={cls.pending}
                                status={cls.pending > 2 ? "alert" : "ok"}
                                alerts={cls.pending > 2 ? cls.pending - 2 : 0}
                                showReviewButton={cls.pending > 0}
                            />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-12 bg-white dark:bg-[#0F172A] border border-dashed border-slate-100 dark:border-white/5 rounded-[32px]">
                            <p className="text-slate-400 dark:text-slate-500 font-bold">You have no active classes assigned this semester.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-7 bg-white dark:bg-[#0F172A] p-6 md:p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl">
                    <div className="flex justify-between items-center mb-6 md:mb-8">
                        <h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100">Recent Activity</h2>
                        <button className="text-slate-400 font-black text-[10px] md:text-[11px] tracking-widest uppercase flex items-center gap-2 hover:text-slate-600 dark:hover:text-slate-400 transition-colors">
                            REFRESH <ListRestart className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <ActivityItem
                            icon={<div className="bg-blue-500/10 p-2 md:p-2.5 rounded-xl text-blue-400 transition-colors"><FileText className="h-4 w-4" /></div>}
                            title="New Submission: John Doe (CA221)"
                            desc='Project: "B-Tree Implementation"'
                            time="2 hours ago"
                        />
                        <ActivityItem
                            icon={<div className="bg-rose-500/10 p-2 md:p-2.5 rounded-xl text-rose-400 transition-colors"><AlertTriangle className="h-4 w-4" /></div>}
                            title="Similarity Alert: Sarah Miller (CA222)"
                            desc="82% Match detected with external source."
                            time="5 hours ago"
                        />
                    </div>
                </div>

                {/* Upcoming Deadlines */}
                <div className="lg:col-span-5 bg-white dark:bg-[#0F172A] p-6 md:p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl">
                    <div className="flex justify-between items-center mb-6 md:mb-8">
                        <h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100">Upcoming Deadlines</h2>
                        <div className="p-2 bg-slate-50 dark:bg-[#0B1120] rounded-xl border border-slate-100 dark:border-white/5">
                            <CalendarIcon className="h-4 w-4 md:h-5 md:w-5 text-slate-400 dark:text-slate-500" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <DeadlineItem date="OCT 25" title="Mid-Semester Grades" sub="All courses" due="In 3 days" />
                        <DeadlineItem date="OCT 28" title="Final Project Proposal" sub="CA223 - Database Mgmt" due="In 6 days" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const ActivityItem = ({ icon, title, desc, time }) => (
    <div className="flex gap-4 group">
        <div className="mt-1 transition-transform group-hover:scale-110 duration-200">{icon}</div>
        <div className="flex-1">
            <h5 className="text-[14px] md:text-[15px] font-black text-slate-700 dark:text-slate-100 leading-tight mb-1">{title}</h5>
            <p className="text-slate-500 text-xs md:text-sm font-medium mb-1">{desc}</p>
            <span className="text-slate-400 dark:text-slate-600 text-[10px] md:text-xs font-bold uppercase tracking-widest">{time}</span>
        </div>
    </div>
);

const DeadlineItem = ({ date, title, sub, due }) => (
    <div className="flex items-center gap-4 bg-slate-50 dark:bg-[#0B1120] p-4 rounded-3xl border border-slate-100 dark:border-white/5 hover:border-blue-500/30 transition-all duration-300 group">
        <div className="w-12 h-12 md:w-14 md:h-14 bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 rounded-2xl flex flex-col items-center justify-center text-slate-700 dark:text-slate-100 shadow-xl">
            <span className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 dark:text-slate-600">{date.split(' ')[0]}</span>
            <span className="text-base md:text-lg font-black leading-none">{date.split(' ')[1]}</span>
        </div>
        <div className="flex-1">
            <h5 className="text-[14px] md:text-[15px] font-black text-slate-700 dark:text-slate-100 leading-tight mb-0.5 md:mb-1">{title}</h5>
            <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-widest">{sub}</p>
        </div>
        <div className="text-[12px] md:text-[13px] font-black text-[#1D68E3] group-hover:translate-x-1 transition-transform">{due}</div>
    </div>
);

export default TeacherDashboard;
