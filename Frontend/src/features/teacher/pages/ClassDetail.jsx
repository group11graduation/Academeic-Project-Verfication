import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    Users,
    FileCheck,
    AlertOctagon,
    ArrowRight,
    UserCheck,
    Settings,
    ArrowLeft,
    Loader2,
    BookOpen,
    Building2,
    GraduationCap,
    Layers,
    Mail,
    ClipboardList,
    CheckCircle2,
} from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import teacherService from '../../../services/teacherService';
import { getApiOrigin } from '../../../lib/api';

const ClassDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [classData, setClassData] = useState(null);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [studentSearch, setStudentSearch] = useState('');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const [detailRes, studentsRes] = await Promise.all([
                    teacherService.getClassDetails(id),
                    teacherService.getClassStudents(id),
                ]);
                if (cancelled) return;
                if (detailRes.success) setClassData(detailRes.data);
                else setClassData(null);
                if (studentsRes.success && Array.isArray(studentsRes.data)) {
                    setStudents(studentsRes.data);
                } else {
                    setStudents([]);
                }
            } catch (error) {
                console.error('Failed to load class page:', error);
                if (!cancelled) {
                    setClassData(null);
                    setStudents([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        if (id) load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const filteredStudents = useMemo(() => {
        const q = studentSearch.trim().toLowerCase();
        if (!q) return students;
        return students.filter(
            (s) =>
                (s.name || '').toLowerCase().includes(q) ||
                String(s.id || '').toLowerCase().includes(q) ||
                (s.email || '').toLowerCase().includes(q)
        );
    }, [students, studentSearch]);

    const uploadBase = getApiOrigin();

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
                <Link to="/teacher/classes" className="text-[#1D68E3] dark:text-blue-400 hover:underline font-bold">
                    Return to My Classes
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-[#0B1120]">
            <main className="p-4 md:p-10 max-w-[1600px] mx-auto">
                <header className="mb-8 md:mb-10">
                    <Link
                        to="/teacher/classes"
                        className="flex items-center gap-2 text-slate-400 dark:text-slate-500 hover:text-[#1D68E3] dark:hover:text-blue-400 transition-colors mb-6 group w-fit"
                    >
                        <div className="bg-white dark:bg-[#0F172A] p-2 rounded-xl border border-slate-100 dark:border-white/5 shadow-xl group-hover:border-blue-200 dark:group-hover:border-blue-900 transition-all">
                            <ArrowLeft className="h-4 w-4" />
                        </div>
                        <span className="text-[12px] font-black uppercase tracking-widest">Back to My Classes</span>
                    </Link>

                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#1D68E3] dark:text-blue-400 mb-2">
                                {classData.code}
                            </p>
                            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
                                {classData.title}
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base font-medium max-w-2xl">
                                Class profile, live counts, and full student roster for this section.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Link
                                to={`/teacher/classes/${classData.code}/students`}
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#1D68E3] text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
                            >
                                <UserCheck className="h-4 w-4" />
                                Full roster page
                            </Link>
                            <Link
                                to={`/teacher/classes/${classData.code}/groups`}
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <Settings className="h-4 w-4" />
                                Groups
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Class metadata */}
                <section className="mb-8 md:mb-10 rounded-[28px] border border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-[#0F172A] p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-2xl bg-white dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 shadow-sm">
                            <BookOpen className="h-6 w-6 text-[#1D68E3] dark:text-blue-400" />
                        </div>
                        <h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100">Class information</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        <InfoItem icon={<Layers className="h-4 w-4" />} label="Category" value={classData.category || '—'} />
                        <InfoItem
                            icon={<GraduationCap className="h-4 w-4" />}
                            label="Academic period"
                            value={classData.timing || '—'}
                        />
                        <InfoItem icon={<Building2 className="h-4 w-4" />} label="Department" value={classData.department || '—'} />
                        <InfoItem icon={<Users className="h-4 w-4" />} label="Faculty / unit" value={classData.faculty || '—'} />
                        <InfoItem
                            icon={<ClipboardList className="h-4 w-4" />}
                            label="Section"
                            value={classData.section ? `Section ${classData.section}` : '—'}
                        />
                        <InfoItem
                            icon={<Hash className="h-4 w-4" />}
                            label="Internal ID"
                            value={classData._id ? String(classData._id) : '—'}
                        />
                    </div>
                    {classData.description ? (
                        <p className="mt-6 text-sm md:text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-200 dark:border-white/10 pt-6">
                            {classData.description}
                        </p>
                    ) : (
                        <p className="mt-6 text-sm text-slate-500 dark:text-slate-500 border-t border-slate-200 dark:border-white/10 pt-6 italic">
                            No class description on file.
                        </p>
                    )}
                </section>

                {/* Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 md:mb-10">
                    <MetricCard
                        icon={<Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                        label="Students enrolled"
                        value={classData.studentCount ?? 0}
                        trend="Roster"
                        trendBg="bg-blue-500/10"
                        trendText="text-blue-600 dark:text-blue-400"
                        iconBg="bg-blue-500/10"
                    />
                    <MetricCard
                        icon={<FileCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
                        label="Project submissions"
                        value={classData.projectsSubmitted ?? 0}
                        subValue={` / ${classData.studentCount ?? 0}`}
                        trend="Class"
                        trendBg="bg-indigo-500/10"
                        trendText="text-indigo-600 dark:text-indigo-400"
                        iconBg="bg-indigo-500/10"
                    />
                    <MetricCard
                        icon={<ClipboardList className="h-5 w-5 text-amber-600 dark:text-amber-500" />}
                        label="Pending review"
                        value={classData.pendingReviews ?? 0}
                        trend={classData.pendingReviews > 0 ? 'Queue' : 'Clear'}
                        trendBg={classData.pendingReviews > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}
                        trendText={
                            classData.pendingReviews > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-600'
                        }
                        iconBg={classData.pendingReviews > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}
                    />
                    <MetricCard
                        icon={<AlertOctagon className="h-5 w-5 text-rose-600 dark:text-rose-500" />}
                        label="Similarity alerts"
                        value={classData.similarityAlerts ?? 0}
                        trend={classData.similarityAlerts > 0 ? 'Review' : 'None'}
                        trendBg={classData.similarityAlerts > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10'}
                        trendText={classData.similarityAlerts > 0 ? 'text-rose-600 dark:text-rose-500' : 'text-emerald-600'}
                        iconBg={classData.similarityAlerts > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10'}
                    />
                </div>

                {/* Students on this page */}
                <section className="rounded-[28px] border border-slate-100 dark:border-white/10 bg-white dark:bg-[#0F172A] shadow-xl overflow-hidden mb-10">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Students in this class</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {students.length} student{students.length !== 1 ? 's' : ''} on the roster
                            </p>
                        </div>
                        <div className="relative w-full md:max-w-xs">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search name, ID, email..."
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1120] py-3 pl-11 pr-4 text-sm font-bold text-slate-800 dark:text-slate-100"
                            />
                        </div>
                    </div>
                    <div className="app-table-shell border-t-0 rounded-none shadow-none">
                        <div className="app-table-wrap custom-scrollbar max-h-[520px] overflow-y-auto">
                            <table className="app-table">
                                <thead>
                                    <tr className="app-table-headrow sticky top-0 z-[1] bg-white dark:bg-[#0F172A]">
                                        <th className="app-table-th">Student</th>
                                        <th className="app-table-th text-center">Student ID</th>
                                        <th className="app-table-th hidden md:table-cell">Email</th>
                                        <th className="app-table-th text-center">Team</th>
                                        <th className="app-table-th">Attendance</th>
                                    </tr>
                                </thead>
                                <tbody className="app-table-body">
                                    {filteredStudents.length > 0 ? (
                                        filteredStudents.map((student) => (
                                            <tr
                                                key={`${student.userId || student.id}`}
                                                className="app-table-row cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                                onClick={() =>
                                                    navigate(
                                                        `/teacher/classes/${id}/students/${student.userId}`,
                                                    )
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        navigate(
                                                            `/teacher/classes/${id}/students/${student.userId}`,
                                                        );
                                                    }
                                                }}
                                                role="button"
                                                tabIndex={0}
                                            >
                                                <td className="app-table-td">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-[#0B1120] flex items-center justify-center overflow-hidden border border-slate-100 dark:border-white/5 shrink-0">
                                                            {student.photo && student.photo !== 'default-student.jpg' ? (
                                                                <img
                                                                    src={
                                                                        student.photo.startsWith('http')
                                                                            ? student.photo
                                                                            : `${uploadBase}/uploads/${student.photo}`
                                                                    }
                                                                    alt=""
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <span className="text-xs font-black text-slate-500">
                                                                    {(student.name || '?')
                                                                        .split(' ')
                                                                        .map((n) => n[0])
                                                                        .join('')
                                                                        .slice(0, 2)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="font-bold text-slate-800 dark:text-slate-100">
                                                            {student.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="app-table-td text-center font-mono text-sm">{student.id}</td>
                                                <td className="app-table-td hidden md:table-cell">
                                                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                                                        <Mail className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                                        {student.email || '—'}
                                                    </span>
                                                </td>
                                                <td className="app-table-td text-center">
                                                    <span className="bg-blue-500/10 text-[#1D68E3] dark:text-blue-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                                                        {student.group || 'UNASSIGNED'}
                                                    </span>
                                                </td>
                                                <td className="app-table-td">
                                                    <div className="flex items-center gap-3 max-w-[180px]">
                                                        <div className="flex-1 h-2 bg-slate-100 dark:bg-[#0B1120] rounded-full overflow-hidden border border-slate-200 dark:border-white/5">
                                                            <div
                                                                className={`h-full rounded-full ${
                                                                    (student.attendance ?? 0) >= 50
                                                                        ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                                                                        : 'bg-gradient-to-r from-rose-400 to-rose-600'
                                                                }`}
                                                                style={{ width: `${Math.min(100, Number(student.attendance) || 0)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-black text-slate-700 dark:text-slate-200 w-10 text-right">
                                                            {student.attendance ?? 0}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="app-table-empty">
                                                {students.length === 0
                                                    ? 'No students enrolled for this class yet.'
                                                    : 'No students match your search.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Priority shortcuts */}
                <section className="mb-10">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4">Shortcuts</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Link
                            to={`/teacher/classes/${classData.code}/students`}
                            className="rounded-[28px] p-8 border border-slate-100 dark:border-white/10 bg-white dark:bg-[#0F172A] hover:border-[#1D68E3]/40 transition-all group shadow-lg"
                        >
                            <UserCheck className="h-8 w-8 text-[#1D68E3] mb-4" />
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Student directory</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Open the dedicated roster page for sorting and extended layout.
                            </p>
                            <span className="text-[#1D68E3] dark:text-blue-400 text-xs font-black uppercase tracking-widest inline-flex items-center gap-2">
                                Go <ArrowRight className="h-4 w-4" />
                            </span>
                        </Link>
                        <Link
                            to={`/teacher/classes/${classData.code}/groups`}
                            className="rounded-[28px] p-8 border border-slate-100 dark:border-white/10 bg-white dark:bg-[#0F172A] hover:border-[#1D68E3]/40 transition-all group shadow-lg"
                        >
                            <Settings className="h-8 w-8 text-slate-400 dark:text-slate-500 mb-4" />
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Team setup</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Configure groups and project assignment flows for this class.
                            </p>
                            <span className="text-[#1D68E3] dark:text-blue-400 text-xs font-black uppercase tracking-widest inline-flex items-center gap-2">
                                Configure <ArrowRight className="h-4 w-4" />
                            </span>
                        </Link>
                    </div>
                </section>

                <section className="rounded-[28px] border border-slate-100 dark:border-white/10 bg-white dark:bg-[#0F172A] p-6 md:p-8">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-3">Alerts</h2>
                    {(classData.similarityAlerts ?? 0) > 0 ? (
                        <p className="text-sm text-rose-700 dark:text-rose-400 font-medium">
                            {classData.similarityAlerts} proposal(s) flagged for similarity or requirement issues across
                            assignments for this class. Review them from your assignments and proposals workflow.
                        </p>
                    ) : (
                        <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-5 w-5 shrink-0" />
                            <p className="text-sm font-medium">No similarity or requirement alerts for this class&apos;s assignments.</p>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

function InfoItem({ icon, label, value }) {
    return (
        <div className="flex gap-3 rounded-2xl bg-white dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 p-4">
            <div className="text-slate-400 dark:text-slate-500 mt-0.5">{icon}</div>
            <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{label}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 break-words">{value}</p>
            </div>
        </div>
    );
}

const MetricCard = ({ icon, label, value, subValue, trend, trendBg, trendText, iconBg }) => (
    <div className="bg-white dark:bg-[#0F172A] p-6 rounded-[28px] border border-slate-100 dark:border-white/5 shadow-lg relative overflow-hidden transition-all hover:border-blue-500/20 group">
        <div className="flex justify-between items-start mb-4">
            <div className={`${iconBg} p-3 rounded-2xl transition-transform group-hover:scale-105`}>{icon}</div>
            <div className={`${trendBg} px-3 py-1 rounded-full`}>
                <span className={`${trendText} text-[11px] font-black uppercase`}>{trend}</span>
            </div>
        </div>
        <p className="text-slate-400 dark:text-slate-500 text-[11px] font-black uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 leading-none">{value}</h3>
            {subValue != null && (
                <span className="text-slate-400 dark:text-slate-500 text-lg font-black">{subValue}</span>
            )}
        </div>
    </div>
);

export default ClassDetail;
