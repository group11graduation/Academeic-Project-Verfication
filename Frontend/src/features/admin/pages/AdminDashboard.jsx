import React, { useState, useEffect } from 'react';
import {
    Calendar, Users, UsersRound, Building2, Rocket,
    ChevronDown, FileText, Code2, ShieldAlert, FileBarChart,
    ArrowRight, UserPlus, UploadCloud, AlertTriangle
} from 'lucide-react';
import adminDashboardService from '../../../services/adminDashboardService';

const AdminDashboard = () => {

    const [dashboardData, setDashboardData] = useState({
        totalStudents: "...",
        totalTeachers: "...",
        totalClasses: "...",
        activeProjects: "..."
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await adminDashboardService.getStats();
                if (response.success) {
                    setDashboardData({
                        totalStudents: response.data.totalStudents || 0,
                        totalTeachers: response.data.totalTeachers || 0,
                        totalClasses: response.data.totalClasses || 0,
                        activeProjects: response.data.activeProjects || 0
                    });
                }
            } catch (error) {
                console.error("Failed to fetch dashboard stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const statCards = [
        { title: "Total Students", value: dashboardData.totalStudents, trend: "↑ 2.5%", trendUp: true, icon: Users, color: "text-blue-500", bg: "bg-blue-100" },
        { title: "Total Teachers", value: dashboardData.totalTeachers, trend: "↓ 1.2%", trendUp: false, icon: UsersRound, color: "text-orange-500", bg: "bg-orange-100" },
        { title: "Total Classes", value: dashboardData.totalClasses, trend: "— 0%", trendUp: null, icon: Building2, color: "text-purple-500", bg: "bg-purple-100" },
        { title: "Active Projects", value: dashboardData.activeProjects, trend: "↑ 5.8%", trendUp: true, icon: Rocket, color: "text-emerald-500", bg: "bg-emerald-100" }
    ];

    const recentSubmissions = [
        { title: "Neural Network Implementation", author: "Johnathan Davis", class: "CS402 AI Fundamentals", term: "Semester A-2023", date: "Oct 24, 09:15 AM", status: "IN REVIEW", icon: FileText, color: "text-blue-500", bg: "bg-blue-100", statusColor: "text-blue-600 bg-blue-50" },
        { title: "Distributed Database Architecture", author: "Emily Chen", class: "CS501 Advanced Databases", term: "Semester A-2023", date: "Oct 23, 04:45 PM", status: "VERIFIED", icon: Code2, color: "text-indigo-500", bg: "bg-indigo-100", statusColor: "text-emerald-600 bg-emerald-50" },
        { title: "Crypto-Currency Token Audit", author: "Marcus Thorne", class: "CS450 Cybersecurity", term: "Semester A-2023", date: "Oct 23, 01:20 PM", status: "PENDING", icon: ShieldAlert, color: "text-blue-500", bg: "bg-blue-100", statusColor: "text-amber-600 bg-amber-50" },
        { title: "Smart Home IoT Dashboard", author: "Sarah Jenkins", class: "CS320 Web Systems", term: "Semester A-2023", date: "Oct 22, 11:10 AM", status: "VERIFIED", icon: FileBarChart, color: "text-blue-500", bg: "bg-blue-100", statusColor: "text-emerald-600 bg-emerald-50" },
    ];

    const recentActivity = [
        { title: "New Teacher Registered", desc: "Dr. Sarah Jenkins joined Computer Science department.", time: "2 HOURS AGO", icon: UserPlus, color: "text-blue-500", bg: "bg-blue-100" },
        { title: "Bulk Project Export", desc: "Audit report generated for Semester A-2023.", time: "5 HOURS AGO", icon: UploadCloud, color: "text-emerald-500", bg: "bg-emerald-100" },
        { title: "System Maintenance", desc: "Database backup scheduled for midnight.", time: "10 HOURS AGO", icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-100" }
    ];

    const auditLogs = [
        { initial: "AJ", name: "Alan Johnson (Admin)", action: "Modified system permissions", time: "Oct 24, 14:23", status: "SUCCESS", statusColor: "text-emerald-600 bg-emerald-100" }
    ];

    return (
        <div className="p-4 md:p-10 max-w-[1600px] mx-auto space-y-6 md:space-y-8 font-sans">

            {/* Header */}
            <header className="flex items-center justify-between pb-2 md:pb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-[#0F172A] dark:text-white mb-1">Admin Dashboard</h1>
                    <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 font-medium leading-tight md:leading-normal">Welcome back, system control is stable.</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] px-4 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Oct 2023 - Jan 2024</span>
                    <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400 ml-2" />
                </div>
            </header>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <div key={i} className="bg-white dark:bg-slate-800 rounded-[24px] border border-slate-100 dark:border-slate-700 p-6 shadow-sm flex flex-col justify-between h-[160px] hover:border-slate-200 dark:hover:border-slate-600 transition-all">
                            <div className="flex justify-between items-start">
                                <div className={`w-12 h-12 rounded-[12px] flex items-center justify-center ${stat.bg} dark:bg-opacity-10 ${stat.color}`}>
                                    <Icon className="h-6 w-6" />
                                </div>
                                <span className={`text-[13px] font-bold ${stat.trendUp === true ? 'text-emerald-500' :
                                    stat.trendUp === false ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'
                                    }`}>
                                    {stat.trend}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-[11px] md:text-[13px] font-bold text-slate-400 dark:text-slate-500 tracking-wide uppercase mb-1">{stat.title}</h3>
                                <p className="text-2xl md:text-3xl font-extrabold text-[#0F172A] dark:text-white leading-none">{stat.value}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Split Layout: Submissions vs Activity/Health */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Left: Recent Submissions */}
                <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-[32px] border border-slate-100 dark:border-slate-700 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-[20px] font-bold text-[#0F172A] dark:text-white">Recent Project Submissions</h2>
                        <button className="text-[#1D68E3] dark:text-blue-400 text-[14px] font-bold hover:underline">View Submissions</button>
                    </div>

                    <div className="space-y-4">
                        {recentSubmissions.map((sub, i) => {
                            const Icon = sub.icon;
                            return (
                                <div key={i} className="flex items-center justify-between p-5 rounded-[20px] bg-[#F8FAFB] dark:bg-slate-900/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group">
                                    <div className="flex items-center gap-5">
                                        <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 ${sub.bg} dark:bg-opacity-10 ${sub.color}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="text-[15px] font-bold text-[#0F172A] dark:text-slate-200 mb-1">{sub.title}</h4>
                                            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{sub.author} &bull; {sub.class}</p>
                                        </div>
                                    </div>

                                    <div className="text-right flex flex-col items-end gap-2">
                                        <div className="flex items-center gap-4">
                                            <div className="text-right mr-4">
                                                <p className="text-[13px] font-bold text-[#0F172A] dark:text-slate-300">{sub.term}</p>
                                                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{sub.date}</p>
                                            </div>
                                            <span className={`px-3 py-1.5 rounded-[8px] text-[10px] font-extrabold tracking-widest uppercase ${sub.statusColor} dark:bg-opacity-10`}>
                                                {sub.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Activity & Health */}
                <div className="space-y-8">
                    {/* Activity */}
                    <div className="bg-white dark:bg-slate-800 rounded-[32px] border border-slate-100 dark:border-slate-700 p-8 shadow-sm h-full">
                        <h2 className="text-[20px] font-bold text-[#0F172A] dark:text-white mb-8">Recent Activity</h2>

                        <div className="space-y-8 relative before:absolute before:inset-0 before:ml-[1.125rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-100 dark:before:bg-slate-700">
                            {recentActivity.map((act, i) => {
                                const Icon = act.icon;
                                return (
                                    <div key={i} className="relative flex items-start gap-6">
                                        <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-4 border-white dark:border-slate-800 shadow-sm ${act.bg} dark:bg-opacity-10 ${act.color}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-[14px] font-bold text-[#0F172A] dark:text-slate-200 mb-1">{act.title}</h4>
                                            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">{act.desc}</p>
                                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">{act.time}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Health & Logs combined row below or part of right column depending on layout */}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mt-8">
                {/* Critical Logs */}
                <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-[32px] border border-slate-100 dark:border-slate-700 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-[20px] font-bold text-[#0F172A] dark:text-white">Critical Audit Logs</h2>
                        <button className="text-[#1D68E3] dark:text-blue-400 text-[14px] font-bold hover:underline">View All Logs</button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-700 text-[11px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500">
                                    <th className="pb-4 font-bold">User</th>
                                    <th className="pb-4 font-bold">Action</th>
                                    <th className="pb-4 font-bold">Timestamp</th>
                                    <th className="pb-4 text-right font-bold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-[14px]">
                                {auditLogs.map((log, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-[8px] bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                                    {log.initial}
                                                </div>
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">{log.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 font-medium text-slate-600 dark:text-slate-400">{log.action}</td>
                                        <td className="py-4 text-slate-500 dark:text-slate-500">{log.time}</td>
                                        <td className="py-4 text-right">
                                            <span className={`px-3 py-1.5 rounded-[8px] text-[10px] font-extrabold tracking-widest uppercase inline-block ${log.statusColor} dark:bg-opacity-10`}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* System Health */}
                <div className="bg-white dark:bg-slate-800 rounded-[32px] border border-slate-100 dark:border-slate-700 p-8 shadow-sm flex flex-col justify-center">
                    <h2 className="text-[20px] font-bold text-[#0F172A] dark:text-white mb-8">System Health</h2>

                    <div className="space-y-8">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[13px] font-bold text-slate-600 dark:text-slate-400">Server Load</span>
                                <span className="text-[13px] font-bold text-emerald-500">Low (12%)</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '12%' }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[13px] font-bold text-slate-600 dark:text-slate-400">Storage Utilization</span>
                                <span className="text-[13px] font-bold text-[#0F172A] dark:text-white">64%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                <div className="bg-[#1D68E3] h-2 rounded-full" style={{ width: '64%' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default AdminDashboard;
