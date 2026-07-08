import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle2, Circle, ArrowRight, Building2, BookOpen, GraduationCap, CalendarRange } from 'lucide-react';
import adminClassService from '../../../services/adminClassService';
import adminSubjectService from '../../../services/adminSubjectService';
import adminTeacherService from '../../../services/adminTeacherService';
import adminSemesterService from '../../../services/adminSemesterService';

const AdminSetupWorkflow = () => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [classesCount, setClassesCount] = useState(0);
    const [subjectsCount, setSubjectsCount] = useState(0);
    const [teachersCount, setTeachersCount] = useState(0);
    const [semestersCount, setSemestersCount] = useState(0);

    const loadStats = async (isInitial = false) => {
        if (isInitial) setLoading(true);
        else setRefreshing(true);
        try {
            const [classesRes, subjectsRes, teachersRes, semestersRes] = await Promise.all([
                adminClassService.getClasses(),
                adminSubjectService.getSubjects(),
                adminTeacherService.getTeachers(),
                adminSemesterService.getSemesters(),
            ]);

            if (classesRes.success) setClassesCount((classesRes.data || []).length);
            if (subjectsRes.success) setSubjectsCount((subjectsRes.data || []).length);
            if (teachersRes.success) setTeachersCount((teachersRes.data || []).length);
            if (semestersRes.success) setSemestersCount((semestersRes.data || []).length);
        } catch (error) {
            console.error('Failed to load setup workflow data:', error);
        } finally {
            if (isInitial) setLoading(false);
            else setRefreshing(false);
        }
    };

    useEffect(() => {
        loadStats(true);
    }, []);

    const steps = useMemo(
        () => [
            {
                id: 'semesters',
                title: 'Create semester structure',
                description: 'Set academic year and semester first so class-level assignments have the right term context.',
                done: semestersCount > 0,
                to: '/admin/semesters',
                cta: 'Open Semesters',
                icon: CalendarRange,
            },
            {
                id: 'subjects',
                title: 'Create subjects',
                description: 'Register all subjects/courses that teachers and classes will use.',
                done: subjectsCount > 0,
                to: '/admin/subjects',
                cta: 'Open Subjects',
                icon: BookOpen,
            },
            {
                id: 'classes',
                title: 'Create classes',
                description: 'Create each class section and attach related subjects.',
                done: classesCount > 0,
                to: '/admin/classes',
                cta: 'Open Classes',
                icon: Building2,
            },
            {
                id: 'assign',
                title: 'Assign teachers inside class detail',
                description: 'Use Class Details to assign teacher + subject in one source of truth.',
                done: classesCount > 0 && teachersCount > 0 && subjectsCount > 0,
                to: '/admin/classes',
                cta: 'Assign From Class Detail',
                icon: GraduationCap,
            },
        ],
        [classesCount, semestersCount, subjectsCount, teachersCount]
    );

    const completedSteps = steps.filter((s) => s.done).length;

    if (loading) {
        return (
            <div className="admin-page min-h-[40vh] flex items-center justify-center">
                <Loader2 className="h-7 w-7 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    return (
        <div className="admin-page font-sans text-[13px]">
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
                <h1 className="mb-1 text-base font-black text-slate-900 dark:text-slate-100">Setup Workflow Center</h1>
                <p className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
                    Keep setup in its own pages, and follow this order to avoid confusion.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-bold text-[#1D68E3]">
                        Progress: {completedSteps}/{steps.length} setup steps completed
                    </p>
                    <button
                        type="button"
                        onClick={() => loadStats(false)}
                        disabled={refreshing}
                        className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-700 hover:bg-slate-200 disabled:opacity-60 dark:bg-[#0f172a] dark:text-slate-200 dark:hover:bg-[#162033]"
                    >
                        {refreshing ? 'Refreshing...' : 'Refresh data'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#111827]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Semesters</p>
                    <p className="text-lg font-black leading-tight text-slate-900 dark:text-slate-100">{semestersCount}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#111827]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Subjects</p>
                    <p className="text-lg font-black leading-tight text-slate-900 dark:text-slate-100">{subjectsCount}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#111827]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Classes</p>
                    <p className="text-lg font-black leading-tight text-slate-900 dark:text-slate-100">{classesCount}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#111827]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Teachers</p>
                    <p className="text-lg font-black leading-tight text-slate-900 dark:text-slate-100">{teachersCount}</p>
                </div>
            </div>

            <div className="space-y-2">
                {steps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                        <div key={step.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#111827]">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2 min-w-0">
                                    <div className="mt-0.5 shrink-0">
                                        {step.done ? (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        ) : (
                                            <Circle className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="mb-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                            Step {index + 1}
                                        </p>
                                        <h3 className="flex items-center gap-1.5 text-[13px] font-black text-slate-900 dark:text-slate-100">
                                            <Icon className="h-3.5 w-3.5 text-[#1D68E3] shrink-0" />
                                            <span className="truncate">{step.title}</span>
                                        </h3>
                                        <p className="mt-0.5 text-[11px] font-medium leading-snug text-slate-600 dark:text-slate-300">{step.description}</p>
                                    </div>
                                </div>
                                <Link
                                    to={step.to}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1D68E3] text-white text-[11px] font-bold hover:bg-blue-700 shrink-0 whitespace-nowrap"
                                >
                                    {step.cta}
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
                <h2 className="mb-3 text-sm font-black text-slate-900 dark:text-slate-100">Role Workflow (Clear Sequence)</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0f172a]">
                        <p className="font-black text-[#1D68E3] mb-1.5 text-[12px]">Admin</p>
                        <p className="font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                            1) Create semester/year in Semesters page. 2) Create subjects in Subjects page. 3) Create classes and link subjects in Classes page. 4) Assign teacher+subject from Class Detail. 5) Add/import students.
                        </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0f172a]">
                        <p className="font-black text-[#1D68E3] mb-1.5 text-[12px]">Teacher</p>
                        <p className="font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                            1) See assigned classes. 2) Create assignment. 3) Set requirement text + required tech keywords. 4) Review proposals. 5) Approve/reject/revision.
                        </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0f172a]">
                        <p className="font-black text-[#1D68E3] mb-1.5 text-[12px]">Student</p>
                        <p className="font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                            1) Open assignment. 2) Submit proposal matching required technologies. 3) Revise if rejected. 4) Upload project ZIP after approval.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSetupWorkflow;
