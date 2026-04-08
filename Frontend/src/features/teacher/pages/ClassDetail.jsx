import React, { useState, useEffect } from 'react';
import {
    Search,
    HelpCircle,
    Bell,
    Users,
    FileCheck,
    AlertOctagon,
    ArrowRight,
    UserCheck,
    Settings,
    AlertTriangle,
    ArrowLeft,
    History,
    Loader2
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import teacherService from '../../../services/teacherService';

const ClassDetail = () => {
    const { id } = useParams();
    const [classData, setClassData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchClassDetails = async () => {
            try {
                const response = await teacherService.getClassDetails(id);
                if (response.success) {
                    setClassData(response.data);
                }
            } catch (error) {
                console.error("Failed to fetch class details:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchClassDetails();
    }, [id]);

    if (loading) {
        return (
            <div className="h-[400px] flex items-center justify-center bg-white dark:bg-[#0B1120]">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    if (!classData) {
        return (
            <div className="p-10 text-center bg-white dark:bg-[#0B1120]">
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-4">Class Not Found</h2>
                <Link to="/teacher/classes" className="text-[#1D68E3] dark:text-blue-400 hover:underline font-bold">Return to My Classes</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-[#0B1120]">
            {/* Utility Top Bar */}
            <div className="px-4 md:px-10 h-[70px] md:h-[80px] flex items-center justify-between border-b border-slate-100 dark:border-white/5 bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-md sticky top-0 z-10">
                <div className="relative w-full max-w-[400px] hidden md:block">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-600" />
                    <input
                        type="text"
                        placeholder="Search student records..."
                        className="w-full bg-slate-50 dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 rounded-2xl py-2.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500/10 transition-all font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700"
                    />
                </div>
                <div className="flex items-center gap-4 md:gap-6 ml-auto">
                    <button className="text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-slate-300 transition-colors">
                        <HelpCircle className="h-5 w-5 md:h-6 md:w-6" />
                    </button>
                    <button className="text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-slate-300 transition-colors relative">
                        <Bell className="h-5 w-5 md:h-6 md:w-6" />
                        <span className="absolute top-0 right-0 h-2 w-2 bg-rose-500 border-2 border-white dark:border-[#0F172A] rounded-full"></span>
                    </button>
                    <div className="h-8 w-[1px] bg-slate-100 dark:bg-white/5 mx-1"></div>
                    <div className="text-right hidden sm:block">
                        <p className="text-slate-800 dark:text-slate-100 font-black text-sm">{classData.code} Dashboard</p>
                        <p className="text-slate-500 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">{classData.timing || 'SPRING 2024'}</p>
                    </div>
                </div>
            </div>

            <main className="p-4 md:p-10 max-w-[1600px] mx-auto">
                {/* Header */}
                <header className="mb-8 md:mb-12">
                    <Link
                        to="/teacher/classes"
                        className="flex items-center gap-2 text-slate-400 dark:text-slate-500 hover:text-[#1D68E3] dark:hover:text-blue-400 transition-colors mb-6 group w-fit"
                    >
                        <div className="bg-white dark:bg-[#0F172A] p-2 rounded-xl border border-slate-100 dark:border-white/5 shadow-xl group-hover:border-blue-200 dark:group-hover:border-blue-900 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 transition-all">
                            <ArrowLeft className="h-4 w-4" />
                        </div>
                        <span className="text-[12px] font-black uppercase tracking-widest">Back to My Classes</span>
                    </Link>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-slate-100 mb-1 md:mb-2 tracking-tight">Class Overview: {classData.title}</h1>
                    <p className="text-slate-500 dark:text-slate-500 text-sm md:text-base font-medium">Real-time engagement metrics and administrative controls.</p>
                </header>

                {/* Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-12">
                    <MetricCard
                        icon={<Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                        label="Total Students"
                        value={classData.studentCount}
                        trend="+0%"
                        trendBg="bg-emerald-500/10"
                        trendText="text-emerald-500"
                        iconBg="bg-blue-500/10"
                    />
                    <MetricCard
                        icon={<FileCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
                        label="Projects Submitted"
                        value={classData.projectsSubmitted}
                        subValue={`/${classData.studentCount}`}
                        trend="~0%"
                        trendBg="bg-emerald-500/10"
                        trendText="text-emerald-500"
                        iconBg="bg-indigo-500/10"
                    />
                    <MetricCard
                        icon={<AlertOctagon className="h-5 w-5 text-rose-600 dark:text-rose-500" />}
                        label="Similarity Alerts"
                        value={classData.similarityAlerts}
                        trend={classData.similarityAlerts > 0 ? "! High" : "Clear"}
                        trendBg={classData.similarityAlerts > 0 ? "bg-rose-500/10" : "bg-emerald-500/10"}
                        trendText={classData.similarityAlerts > 0 ? "text-rose-600 dark:text-rose-500" : "text-emerald-500"}
                        iconBg={classData.similarityAlerts > 0 ? "bg-rose-500/10" : "bg-emerald-500/10"}
                    />
                </div>

                {/* Priority Actions */}
                <section className="mb-8 md:mb-12">
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 mb-6 md:mb-8 tracking-tight">Priority Actions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        {/* View Student List Card */}
                        <Link
                            to={`/teacher/classes/${classData.code}/students`}
                            className="bg-[#1D68E3] rounded-[32px] p-8 md:p-10 text-white relative overflow-hidden group hover:scale-[1.01] transition-all cursor-pointer shadow-2xl shadow-blue-500/20"
                        >
                            <div className="bg-white/20 p-4 rounded-2xl w-fit mb-8 transition-colors group-hover:bg-white/30">
                                <UserCheck className="h-8 w-8" />
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black mb-4 tracking-tight">View Student List</h3>
                            <p className="text-white/80 text-sm md:text-base font-medium leading-relaxed mb-10 max-w-[400px]">
                                Manage enrollment, view individual progress, and handle grading workflows.
                            </p>
                            <div className="flex items-center gap-3 font-black text-sm md:text-base group-hover:gap-5 transition-all uppercase tracking-widest">
                                Access Directory <ArrowRight className="h-5 w-5" />
                            </div>
                        </Link>

                        {/* Manage Group Settings Card */}
                        <Link
                            to={`/teacher/classes/${classData.code}/groups`}
                            className="bg-white dark:bg-[#0F172A] rounded-[32px] p-8 md:p-10 text-white relative overflow-hidden group hover:scale-[1.01] transition-all cursor-pointer block border border-slate-100 dark:border-white/5 shadow-2xl"
                        >
                            <div className="bg-slate-50 dark:bg-white/10 p-4 rounded-2xl w-fit mb-8 transition-colors group-hover:bg-blue-50 dark:group-hover:bg-white/20">
                                <Settings className="h-8 w-8 text-slate-400 dark:text-white" />
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black mb-4 tracking-tight text-slate-800 dark:text-slate-100">Manage Group Settings</h3>
                            <p className="text-slate-500 dark:text-slate-500 text-sm md:text-base font-medium leading-relaxed mb-10 max-w-[400px]">
                                Configure team sizes, randomize assignments, and monitor group dynamics.
                            </p>
                            <div className="flex items-center gap-3 font-black text-[#1D68E3] dark:text-blue-400 text-sm md:text-base group-hover:gap-5 transition-all uppercase tracking-widest">
                                Configure Teams <ArrowRight className="h-5 w-5" />
                            </div>
                        </Link>
                    </div>
                </section>

                {/* Critical Alerts */}
                <section className="bg-white dark:bg-[#0F172A] rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden">
                    <div className="p-6 md:p-10 flex justify-between items-center border-b border-slate-100 dark:border-white/5">
                        <h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100">Critical Alerts</h2>
                        <button className="text-[#1D68E3] dark:text-blue-400 font-black text-[12px] uppercase tracking-widest hover:text-blue-600 transition-colors">See all alerts</button>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        <AlertItem
                            icon={<AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-500" />}
                            iconBg="bg-rose-500/10"
                            title="Similarity Match Detected (84%)"
                            description={<>Project: <span className="text-slate-500 dark:text-slate-400 font-bold italic">"Final Neural Network Implementation"</span> • Student: <span className="text-slate-500 dark:text-slate-400 font-bold">Sarah Jenkins</span></>}
                            time="2H AGO"
                        />
                        <AlertItem
                            icon={<History className="h-5 w-5 text-amber-600 dark:text-amber-500" />}
                            iconBg="bg-amber-500/10"
                            title="Submission Extension Requested"
                            description={<>Request by: <span className="text-slate-500 dark:text-slate-400 font-bold">Mark Thompson</span> • Reasoning: <span className="text-slate-500 dark:text-slate-400 font-bold">Medical Emergency</span></>}
                            time="5H AGO"
                        />
                    </div>
                </section>
            </main>
        </div>
    );
};const MetricCard = ({ icon, label, value, subValue, trend, trendBg, trendText, iconBg }) => (
    <div className="bg-white dark:bg-[#0F172A] p-6 md:p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl relative overflow-hidden transition-all hover:border-blue-500/30 group">
        <div className="flex justify-between items-start mb-6">
            <div className={`${iconBg} p-3 rounded-2xl transition-transform group-hover:scale-110`}>
                {icon}
            </div>
            <div className={`${trendBg} px-3 py-1 rounded-full flex items-center gap-1`}>
                {trend.startsWith('+') && <span className={`${trendText} text-[10px] rotate-[-45deg] font-black`}>↗</span>}
                {trend.startsWith('~') && <span className={`${trendText} text-[10px] rotate-[-45deg] font-black`}>↗</span>}
                <span className={`${trendText} text-[12px] md:text-[13px] font-black uppercase`}>{trend}</span>
            </div>
        </div>
        <p className="text-slate-400 dark:text-slate-500 text-[11px] md:text-[13px] font-black uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
            <h3 className="text-3xl md:text-[40px] font-black text-slate-800 dark:text-slate-100 leading-none">{value}</h3>
            {subValue && <span className="text-slate-400 dark:text-slate-500 text-xl font-black">{subValue}</span>}
        </div>
    </div>
);

const AlertItem = ({ icon, iconBg, title, description, time }) => (
    <div className="p-6 md:p-10 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-[#0B1120] transition-all">
        <div className="flex items-center gap-4 md:gap-6">
            <div className={`${iconBg} p-3 md:p-4 rounded-2xl transition-transform group-hover:scale-110`}>
                {icon}
            </div>
            <div>
                <h4 className="text-[15px] md:text-[17px] font-black text-slate-800 dark:text-slate-100 mb-1 leading-tight">{title}</h4>
                <div className="text-slate-500 dark:text-slate-500 text-xs md:text-sm font-medium">{description}</div>
            </div>
        </div>
        <span className="text-slate-400 dark:text-slate-600 text-[10px] md:text-[12px] font-black tracking-widest hidden sm:block">{time}</span>
    </div>
);

export default ClassDetail;
