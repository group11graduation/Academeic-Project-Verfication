import React, { useEffect } from 'react';
import { 
    Code, 
    Terminal, 
    Database, 
    Rocket, 
    Settings, 
    ShieldAlert, 
    ArrowRight,
    Code2,
    ShieldCheck
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import studentService from '../../../services/studentService';
import { Loader2 } from 'lucide-react';
import StudentHeader from '../components/StudentHeader';

const StudentMyProject = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
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

    // Helper to format project count as "06"
    const formatCount = (num) => {
        return num < 10 ? `0${num}` : num;
    };

    // Simple helper to pick an icon based on title length (pseudo-random deterministic)
    const getIconForProject = (title) => {
        const len = title?.length || 0;
        if (len % 5 === 0) return <Terminal className="h-5 w-5" />;
        if (len % 4 === 0) return <Database className="h-5 w-5" />;
        if (len % 3 === 0) return <Rocket className="h-5 w-5" />;
        if (len % 2 === 0) return <Settings className="h-5 w-5" />;
        return <Code2 className="h-5 w-5" />;
    };

    // Helper to map track names
    const getTrackName = (classCode) => {
        return classCode || 'RESEARCH TRACK';
    };

    // Helper for dummy descriptions since data doesn't provide them fully in mockup format
    const getDescription = (group) => {
        if (group.title?.toLowerCase().includes('react')) return "Component-based architecture and state management for scalable frontend applications.";
        if (group.title?.toLowerCase().includes('node')) return "Asynchronous event-driven JavaScript runtime for high-performance server-side logic.";
        if (group.title?.toLowerCase().includes('mongo')) return "NoSQL document databases and large-scale data modeling for modern web stacks.";
        if (group.title?.toLowerCase().includes('fastapi')) return "High performance, easy to learn, fast to code, ready for production API design.";
        if (group.title?.toLowerCase().includes('python')) return "Scientific computing, automation, and core algorithmic problem solving.";
        if (group.title?.toLowerCase().includes('security')) return "Cybersecurity protocols, penetration testing, and infrastructure hardening techniques.";
        
        return `Group project with ${group.members?.length || 0} members. Currently in ${group.status || 'Active'} status with ${group.similarity || 0}% architectural similarity.`;
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#F8FAFB] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
            <StudentHeader />

            <main className="flex-1 w-full max-w-[1400px] mx-auto px-8 py-16">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                        <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
                        <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Loading Projects...</p>
                    </div>
                ) : (
                    <>
                        {/* Hero Header */}
                        <div className="mb-14">
                            <div className="text-[#1D68E3] text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                ACADEMIC PORTFOLIO &bull; {dashboardData?.class?.code || 'CA221'} SOFTWARE ENGINEERING
                            </div>
                            <h1 className="text-[48px] md:text-[64px] font-black text-[#0F172A] tracking-[-0.03em] leading-none mb-6">
                                Course Projects
                            </h1>
                            <p className="text-[17px] font-medium text-slate-500 max-w-xl leading-relaxed">
                                A unified overview of your specialized research modules and development tracks for the {dashboardData?.class?.code || 'CA221'} curriculum.
                            </p>
                        </div>

                        {/* Top Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                            {/* Stat 1 */}
                            <div className="bg-[#F1F5F9] rounded-[24px] p-8 relative overflow-hidden group">
                                <div className="absolute left-0 top-6 bottom-6 w-1.5 bg-[#1D68E3] rounded-r-lg"></div>
                                <div className="text-[40px] font-black text-[#0F172A] leading-none mb-2 tracking-tight">
                                    {formatCount(dashboardData?.groups?.length || 0)}
                                </div>
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">
                                    Active Modules
                                </div>
                            </div>
                            
                            {/* Stat 2 */}
                            <div className="bg-[#F1F5F9] rounded-[24px] p-8 group">
                                <div className="text-[40px] font-black text-[#0F172A] leading-none mb-2 tracking-tight">
                                    84%
                                </div>
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">
                                    Course Completion
                                </div>
                            </div>

                            {/* Stat 3 */}
                            <div className="bg-[#F1F5F9] rounded-[24px] p-8 group">
                                <div className="text-[40px] font-black text-[#0F172A] leading-none mb-2 tracking-tight">
                                    12
                                </div>
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">
                                    Days to Final Demo
                                </div>
                            </div>
                        </div>

                        {/* Filter Bar */}
                        <div className="flex flex-col md:flex-row md:items-center gap-6 mb-10">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">
                                Filter Modules:
                            </span>
                            <div className="flex flex-wrap gap-3">
                                <button className="bg-[#1D68E3] text-white px-6 py-3 rounded-full text-[11px] font-black tracking-[0.1em] uppercase shadow-md hover:shadow-blue-500/20 transition-all">
                                    All Subjects
                                </button>
                                <button className="bg-[#E2E8F0] text-slate-500 px-6 py-3 rounded-full text-[11px] font-black tracking-[0.1em] uppercase hover:bg-slate-200 hover:text-slate-700 transition-all">
                                    In Progress
                                </button>
                                <button className="bg-[#E2E8F0] text-slate-500 px-6 py-3 rounded-full text-[11px] font-black tracking-[0.1em] uppercase hover:bg-slate-200 hover:text-slate-700 transition-all">
                                    Completed
                                </button>
                            </div>
                        </div>

                        {/* Subject / assignment blocks (API) or legacy groups mock */}
                        {dashboardData?.assignments?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
                                {dashboardData.assignments.map((row) => {
                                    const a = row.assignment;
                                    const p = row.proposal;
                                    const iconComp = getIconForProject(a?.title);
                                    const status = p?.status || '—';
                                    return (
                                        <div
                                            key={a._id}
                                            className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full"
                                        >
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="bg-blue-50 text-[#1D68E3] px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em]">
                                                    {a.subject?.code} · {a.class?.code}
                                                </div>
                                                {React.cloneElement(iconComp, { className: 'h-5 w-5 text-slate-300' })}
                                            </div>
                                            <h3 className="text-xl font-black text-[#0F172A] mb-2">{a.title}</h3>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                                Teacher: {a.teacher?.name || '—'}
                                            </p>
                                            <p className="text-sm text-slate-500 mb-4">
                                                Proposal: <span className="font-bold text-slate-700">{status}</span>
                                            </p>
                                            <div className="mt-auto flex flex-col gap-2">
                                                <Link
                                                    to={`/student/assignments/${a._id}/proposal`}
                                                    className="text-center py-3 rounded-2xl bg-[#1D68E3] text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-700"
                                                >
                                                    Proposal workspace
                                                </Link>
                                                {row.projectSubmissionAllowed ? (
                                                    <Link
                                                        to={`/student/project/${a._id}`}
                                                        className="text-center py-3 rounded-2xl border-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500/10"
                                                    >
                                                        Project submission
                                                    </Link>
                                                ) : null}
                                                <Link
                                                    to={`/student/assignments/${a._id}/proposal`}
                                                    className="text-center text-[11px] font-black text-slate-400 uppercase"
                                                >
                                                    View / submit proposal
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : dashboardData?.groups?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
                                {dashboardData.groups.map((group) => {
                                    const iconComp = getIconForProject(group.title);
                                    return (
                                        <div
                                            key={group._id}
                                            className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300 group/card flex flex-col h-full"
                                        >
                                            <div className="flex justify-between items-start mb-8">
                                                <div className="bg-blue-50 text-[#1D68E3] px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em]">
                                                    {getTrackName(group.classCode)}
                                                </div>
                                                <div className="text-slate-300 group-hover/card:text-slate-400 transition-colors">
                                                    {React.cloneElement(iconComp, { className: 'h-5 w-5' })}
                                                </div>
                                            </div>
                                            <div className="flex-1 mb-10">
                                                <h3 className="text-[24px] font-black text-[#0F172A] mb-4 tracking-tight group-hover/card:text-[#1D68E3] transition-colors line-clamp-2 leading-tight">
                                                    {group.title}
                                                </h3>
                                                <p className="text-slate-500 text-[14px] font-medium leading-relaxed">
                                                    {getDescription(group)}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between mt-auto">
                                                <Link
                                                    to={`/student/project/${group._id}`}
                                                    className="text-[11px] font-black text-[#1D68E3] tracking-[0.15em] uppercase flex items-center gap-2 group/link"
                                                >
                                                    Project Details
                                                    <ArrowRight className="h-3.5 w-3.5 group-hover/link:translate-x-1 transition-transform" />
                                                </Link>
                                                <div className="w-12 h-12 bg-[#0F172A] rounded-2xl flex items-center justify-center relative overflow-hidden group-hover/card:scale-105 transition-transform shadow-lg">
                                                    <div className="absolute inset-0 opacity-20 blur-md bg-blue-400"></div>
                                                    {React.cloneElement(iconComp, { className: 'h-5 w-5 relative z-10 text-cyan-300' })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-24 bg-white rounded-[40px] border border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 shadow-sm">
                                <Rocket className="h-12 w-12 text-slate-300" />
                                <p className="font-bold text-slate-400 uppercase tracking-[0.15em] text-[11px]">No course projects found.</p>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* ScholarVerify Footer */}
            <footer className="w-full mt-auto py-10 bg-[#141C2B] text-white flex flex-col md:flex-row items-center justify-between px-12 pb-16">
                <div className="flex flex-col items-center md:items-start mb-6 md:mb-0">
                    <div className="font-black text-white text-[18px] tracking-tighter mb-1">
                        ScholarVerify
                    </div>
                </div>
                
                <div className="flex flex-wrap justify-center gap-10">
                    <a href="#" className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors">Privacy Policy</a>
                    <a href="#" className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors">Terms of Service</a>
                    <a href="#" className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors">Institutional Access</a>
                    <a href="#" className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors">Support</a>
                    <span className="text-[11px] font-medium text-slate-400 ml-4">
                        &copy; {new Date().getFullYear()} ScholarVerify Academic Systems. All research rights reserved.
                    </span>
                </div>
            </footer>
        </div>
    );
};

export default StudentMyProject;
