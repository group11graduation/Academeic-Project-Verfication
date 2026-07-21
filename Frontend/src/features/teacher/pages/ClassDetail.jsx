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
    Hash,
    ExternalLink,
} from 'lucide-react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import teacherService from '../../../services/teacherService';
import { getApiOrigin } from '../../../lib/api';
import { usePageSearch } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';

const ALERT_STATUS_LABELS = {
    ai_rejected_same_semester: 'AI rejected (same semester)',
    ai_flagged_previous_semester: 'AI warning (legacy similarity)',
    requirements_rejected: 'Requirements rejected',
    pending_teacher_approval: 'Pending your approval',
};

const ClassDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [classData, setClassData] = useState(null);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const { query: studentSearch, setQuery: setStudentSearch } = usePageSearch('Search students…');

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

    useEffect(() => {
        if (loading || searchParams.get('focus') !== 'alerts') return;
        const el = document.getElementById('review-alerts');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [loading, searchParams]);

    const reviewAlerts = classData?.reviewAlerts || [];

    const filteredStudents = useMemo(() => {
        const list = !studentSearch.trim()
            ? students
            : students.filter((s) =>
                  matchesSearchQuery(studentSearch, s.name, s.id, s.email, s.studentId)
              );
        return [...list].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
        );
    }, [students, studentSearch]);

    const uploadBase = getApiOrigin();

    if (loading) {
        return (
            <div className="min-h-[40vh] flex flex-col items-center justify-center">
                <Loader2 className="h-7 w-7 text-[#1D68E3] animate-spin mb-2" />
                <p className="text-[12px] text-slate-500 font-medium">Loading class...</p>
            </div>
        );
    }

    if (!classData) {
        return (
            <div className="min-h-[40vh] flex flex-col items-center justify-center p-4">
                <h2 className="text-base font-black text-slate-800 dark:text-slate-100 mb-3">Class Not Found</h2>
                <Link to="/teacher/classes" className="text-[#1D68E3] dark:text-blue-400 hover:underline font-bold text-[12px]">
                    Return to My Classes
                </Link>
            </div>
        );
    }

    return (
        <div className="font-sans text-[13px]">
            <main>
                <header className="mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <Link
                        to="/teacher/classes"
                        className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 hover:text-[#1D68E3] dark:hover:text-blue-400 transition-colors mb-3 group w-fit"
                    >
                        <div className="bg-white dark:bg-[#0F172A] p-1.5 rounded-lg border border-slate-100 dark:border-white/5 group-hover:border-blue-200 dark:group-hover:border-blue-900 transition-all">
                            <ArrowLeft className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest">Back to My Classes</span>
                    </Link>

                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1D68E3] dark:text-blue-400 mb-1">
                                {classData.code}
                            </p>
                            <h1 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 mb-1 tracking-tight">
                                {classData.title}
                            </h1>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
                                Class profile, live counts, and full student roster for this section.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Link
                                to={`/teacher/classes/${classData.code}/students`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1D68E3] text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors"
                            >
                                <UserCheck className="h-3.5 w-3.5" />
                                Full roster page
                            </Link>
                            <Link
                                to={`/teacher/classes/${classData.code}/groups`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <Settings className="h-3.5 w-3.5" />
                                Groups
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Class metadata */}
                <section className="mb-4 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-[#0F172A] p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-white dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 shadow-sm">
                            <BookOpen className="h-4 w-4 text-[#1D68E3] dark:text-blue-400" />
                        </div>
                        <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Class information</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
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
                        <p className="mt-3 text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-200 dark:border-white/10 pt-3">
                            {classData.description}
                        </p>
                    ) : (
                        <p className="mt-3 text-[12px] text-slate-500 dark:text-slate-500 border-t border-slate-200 dark:border-white/10 pt-3 italic">
                            No class description on file.
                        </p>
                    )}
                </section>

                {/* Metrics */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
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

                <section id="review-alerts" className="rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-[#0F172A] p-4 mb-4">
                    <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 mb-2">Review alerts</h2>
                    {reviewAlerts.length > 0 ? (
                        <div className="space-y-2">
                            {reviewAlerts.map((alert) => (
                                <Link
                                    key={alert.proposalId}
                                    to={`/teacher/assignments/${alert.assignmentId}/proposals/${alert.proposalId}`}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/5 px-3 py-2.5 hover:border-rose-200 dark:hover:border-rose-500/40 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100 truncate">
                                            {alert.studentName}
                                            {alert.proposalTitle ? ` — ${alert.proposalTitle}` : ''}
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                            {alert.assignmentTitle}
                                        </p>
                                        <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                                            {ALERT_STATUS_LABELS[alert.status] || alert.status}
                                        </p>
                                    </div>
                                    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#1D68E3]">
                                        Review
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </span>
                                </Link>
                            ))}
                        </div>
                    ) : (classData.similarityAlerts ?? 0) > 0 || (classData.pendingReviews ?? 0) > 0 ? (
                        <p className="text-[12px] text-rose-700 dark:text-rose-400 font-medium">
                            Alerts are recorded for this class but no open proposal rows were returned. Check your assignments list.
                        </p>
                    ) : (
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <p className="text-[12px] font-medium">No proposals need review for this class right now.</p>
                        </div>
                    )}
                </section>

                {/* Students on this page */}
                <section className="rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-[#0F172A] shadow-sm overflow-hidden mb-4">
                    <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Students in this class</h2>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {students.length} student{students.length !== 1 ? 's' : ''} on the roster
                            </p>
                        </div>
                        <div className="relative w-full md:max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search name, ID, email..."
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1120] py-2 pl-9 pr-3 text-[12px] font-bold text-slate-800 dark:text-slate-100"
                            />
                        </div>
                    </div>
                    <div className="app-table-shell border-t-0 rounded-none shadow-none">
                        <div className="app-table-wrap custom-scrollbar max-h-[420px] overflow-y-auto">
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
                                                        <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-[#0B1120] flex items-center justify-center overflow-hidden border border-slate-100 dark:border-white/5 shrink-0">
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
                <section className="mb-4">
                    <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 mb-2">Shortcuts</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Link
                            to={`/teacher/classes/${classData.code}/students`}
                            className="rounded-xl p-4 border border-slate-100 dark:border-white/10 bg-white dark:bg-[#0F172A] hover:border-[#1D68E3]/40 transition-all group shadow-sm"
                        >
                            <UserCheck className="h-5 w-5 text-[#1D68E3] mb-2" />
                            <h3 className="text-[13px] font-black text-slate-800 dark:text-slate-100 mb-1">Student directory</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                                Open the dedicated roster page for sorting and extended layout.
                            </p>
                            <span className="text-[#1D68E3] dark:text-blue-400 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5">
                                Go <ArrowRight className="h-3.5 w-3.5" />
                            </span>
                        </Link>
                        <Link
                            to={`/teacher/classes/${classData.code}/groups`}
                            className="rounded-xl p-4 border border-slate-100 dark:border-white/10 bg-white dark:bg-[#0F172A] hover:border-[#1D68E3]/40 transition-all group shadow-sm"
                        >
                            <Settings className="h-5 w-5 text-slate-400 dark:text-slate-500 mb-2" />
                            <h3 className="text-[13px] font-black text-slate-800 dark:text-slate-100 mb-1">Team setup</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                                Configure groups and project assignment flows for this class.
                            </p>
                            <span className="text-[#1D68E3] dark:text-blue-400 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5">
                                Configure <ArrowRight className="h-3.5 w-3.5" />
                            </span>
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
};

function InfoItem({ icon, label, value }) {
    return (
        <div className="flex gap-2 rounded-lg bg-white dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 p-3">
            <div className="text-slate-400 dark:text-slate-500 mt-0.5">{icon}</div>
            <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">{label}</p>
                <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100 break-words">{value}</p>
            </div>
        </div>
    );
}

const MetricCard = ({ icon, label, value, subValue, trend, trendBg, trendText, iconBg }) => (
    <div className="bg-white dark:bg-[#0F172A] p-3 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm relative overflow-hidden transition-all hover:border-blue-500/20 group">
        <div className="flex justify-between items-start mb-2">
            <div className={`${iconBg} p-2 rounded-lg transition-transform group-hover:scale-105`}>{icon}</div>
            <div className={`${trendBg} px-2 py-0.5 rounded-full`}>
                <span className={`${trendText} text-[10px] font-black uppercase`}>{trend}</span>
            </div>
        </div>
        <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-0.5">{label}</p>
        <div className="flex items-baseline gap-1">
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 leading-none">{value}</h3>
            {subValue != null && (
                <span className="text-slate-400 dark:text-slate-500 text-sm font-black">{subValue}</span>
            )}
        </div>
    </div>
);

export default ClassDetail;
