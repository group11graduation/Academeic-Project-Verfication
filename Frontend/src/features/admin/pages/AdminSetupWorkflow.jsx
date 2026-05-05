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
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto">
            <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">Setup Workflow Center</h1>
                <p className="text-slate-600 font-medium">
                    Keep setup in its own pages, and follow this order to avoid confusion.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="text-sm font-bold text-[#1D68E3]">
                        Progress: {completedSteps}/{steps.length} setup steps completed
                    </p>
                    <button
                        type="button"
                        onClick={() => loadStats(false)}
                        disabled={refreshing}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-black hover:bg-slate-200 disabled:opacity-60"
                    >
                        {refreshing ? 'Refreshing...' : 'Refresh data'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Semesters</p>
                    <p className="text-2xl font-black text-slate-900">{semestersCount}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Subjects</p>
                    <p className="text-2xl font-black text-slate-900">{subjectsCount}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Classes</p>
                    <p className="text-2xl font-black text-slate-900">{classesCount}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Teachers</p>
                    <p className="text-2xl font-black text-slate-900">{teachersCount}</p>
                </div>
            </div>

            <div className="space-y-4">
                {steps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                        <div key={step.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1">
                                        {step.done ? (
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                        ) : (
                                            <Circle className="h-5 w-5 text-slate-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
                                            Step {index + 1}
                                        </p>
                                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                            <Icon className="h-4 w-4 text-[#1D68E3]" />
                                            {step.title}
                                        </h3>
                                        <p className="text-sm font-medium text-slate-600 mt-1">{step.description}</p>
                                    </div>
                                </div>
                                <Link
                                    to={step.to}
                                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[#1D68E3] text-white text-sm font-bold hover:bg-blue-700"
                                >
                                    {step.cta}
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-black text-slate-900 mb-4">Role Workflow (Clear Sequence)</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                        <p className="font-black text-[#1D68E3] mb-2">Admin</p>
                        <p className="font-medium text-slate-700">
                            1) Create semester/year in Semesters page. 2) Create subjects in Subjects page. 3) Create classes and link subjects in Classes page. 4) Assign teacher+subject from Class Detail. 5) Add/import students.
                        </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                        <p className="font-black text-[#1D68E3] mb-2">Teacher</p>
                        <p className="font-medium text-slate-700">
                            1) See assigned classes. 2) Create assignment. 3) Set requirement text + required tech keywords. 4) Review proposals. 5) Approve/reject/revision.
                        </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                        <p className="font-black text-[#1D68E3] mb-2">Student</p>
                        <p className="font-medium text-slate-700">
                            1) Open assignment. 2) Submit proposal matching required technologies. 3) Revise if rejected. 4) Upload project ZIP after approval.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSetupWorkflow;
