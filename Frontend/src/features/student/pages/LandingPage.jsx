import React from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BookOpen,
    BrainCircuit,
    Container,
    GraduationCap,
    Layers,
    ShieldCheck,
    UserCog,
    Users,
    Workflow,
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import StudentPublicShell from '../layouts/StudentPublicShell';
import PublicSiteFooter from '../../../shared/components/PublicSiteFooter';
import { BRAND, BRAND_GRADIENT, PROJECT_NAME } from '../../../shared/ui/brandTheme';

const workflowSteps = [
    { step: '1', title: 'Teacher publishes assignment', detail: 'Final or normal tasks with requirements, deadlines, and optional group mode.' },
    { step: '2', title: 'Student submits proposal', detail: 'Title, features, and description run through requirement and AI similarity checks.' },
    { step: '3', title: 'Teacher reviews & approves', detail: 'Feedback, scores, and approval unlock the project submission phase.' },
    { step: '4', title: 'Project ZIP & live preview', detail: 'Students upload code; teachers preview in Docker with auto stack detection.' },
];

const systemModules = [
    {
        title: 'Student workspace',
        icon: GraduationCap,
        points: ['View assignments by subject', 'Submit proposals and project ZIPs', 'Track teacher feedback and deadlines'],
        link: '/student',
        linkLabel: 'Open student workspace',
        roles: ['student'],
    },
    {
        title: 'Teacher workspace',
        icon: Users,
        points: ['Manage classes, groups, and assignments', 'Review proposals with AI assistance', 'Run sandbox previews on submissions'],
        link: '/teacher',
        linkLabel: 'Open teacher dashboard',
        roles: ['teacher'],
    },
    {
        title: 'Administration',
        icon: UserCog,
        points: ['Classes, subjects, semesters', 'Teacher & student accounts', 'Academic structure setup'],
        link: '/admin',
        linkLabel: 'Open admin panel',
        roles: ['admin'],
    },
    {
        title: 'Integrity engine',
        icon: BrainCircuit,
        points: ['Same-semester similarity detection', 'Legacy project cross-check', 'Keyword & technology requirement gates'],
        link: '/about',
        linkLabel: 'Read platform guide',
        roles: ['guest', 'student', 'teacher', 'admin'],
    },
    {
        title: 'Preview sandbox',
        icon: Container,
        points: ['React, Spring Boot, MERN, PHP stacks', 'Isolated Docker containers', 'Teacher-only live preview sessions'],
        link: '/about',
        linkLabel: 'How previews work',
        roles: ['guest', 'student', 'teacher', 'admin'],
    },
    {
        title: 'Collaborative teaching',
        icon: Layers,
        points: ['Dual-teacher assignments', 'Split frontend/backend requirements', 'Shared assignment on both dashboards'],
        link: '/about',
        linkLabel: 'Collaboration workflow',
        roles: ['guest', 'teacher', 'admin'],
    },
];

const LandingPage = () => {
    const { user } = useAuth();
    const role = 'guest';

    const workspacePath =
        user?.role === 'student' ? '/student' : user?.role === 'teacher' ? '/teacher' : user?.role === 'admin' ? '/admin' : '/login';

    const visibleModules = systemModules.filter((m) => m.roles.includes(role));

    return (
        <StudentPublicShell forcePublic>
        <div className="min-h-screen bg-[#f8faff] font-sans text-slate-900 dark:bg-[#020617] dark:text-slate-100">

            <main>
                {/* System hero */}
                <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 md:pt-14">
                    {user && (
                        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-blue-200/80 bg-white px-5 py-4 shadow-sm dark:border-blue-400/20 dark:bg-[#111827] sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-[#2a3fa4] mb-1">
                                    Already signed in
                                </p>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    Continue as {user.name || user.email} from your workspace, or browse the public overview below.
                                </p>
                            </div>
                            <Link
                                to={workspacePath}
                                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white shrink-0"
                                style={{ backgroundColor: BRAND.primary }}
                            >
                                Go to my workspace <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
                        <div className="lg:col-span-3">
                            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                {PROJECT_NAME} · System overview
                            </p>
                            <h1 className="mb-5 text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl lg:text-[2.75rem]">
                                Academic project verification — from proposal to graded submission
                            </h1>
                            <p className="mb-8 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300 md:text-lg">
                                {PROJECT_NAME} is your institution&apos;s workflow for capstone and coursework projects: assignments,
                                AI-assisted integrity checks, teacher review, collaborative dual-teacher tasks, and Docker previews
                                — all in one place.
                            </p>
                            {!user && (
                                <div className="flex flex-wrap gap-3">
                                    <Link
                                        to="/login"
                                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-black"
                                        style={{ background: BRAND_GRADIENT }}
                                    >
                                        Sign in to the platform <ArrowRight className="h-4 w-4" />
                                    </Link>
                                    <Link
                                        to="/about"
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-[#111827] dark:text-slate-100 dark:hover:bg-[#1f2937]"
                                    >
                                        Platform guide
                                    </Link>
                                </div>
                            )}
                            {user && (
                                <div className="flex flex-wrap gap-3">
                                    <Link
                                        to={workspacePath}
                                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-black"
                                        style={{ background: BRAND_GRADIENT }}
                                    >
                                        Open my workspace <ArrowRight className="h-4 w-4" />
                                    </Link>
                                    <Link
                                        to="/gallery"
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-[#111827] dark:text-slate-100 dark:hover:bg-[#1f2937]"
                                    >
                                        Verified projects
                                    </Link>
                                </div>
                            )}
                        </div>

                        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
                            {[
                                { label: 'Proposal → project pipeline', icon: Workflow },
                                { label: 'AI similarity screening', icon: BrainCircuit },
                                { label: 'Teacher sandbox previews', icon: Container },
                                { label: 'Academic integrity focus', icon: ShieldCheck },
                            ].map(({ label, icon: Icon }) => (
                                <div
                                    key={label}
                                    className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111827]"
                                >
                                    <div className="ui-icon-box w-9 h-9 rounded-lg bg-blue-50 text-[#2a3fa4] mb-3">
                                        <Icon className="h-4 w-4 shrink-0" />
                                    </div>
                                    <p className="text-xs font-bold leading-snug text-slate-700 dark:text-slate-200">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Workflow */}
                <section className="border-y border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0b1220]">
                    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
                        <div className="flex items-center gap-2 mb-2">
                            <Workflow className="h-5 w-5 text-[#2a3fa4]" />
                            <p className="text-xs font-black uppercase tracking-widest text-[#2a3fa4]">
                                End-to-end workflow
                            </p>
                        </div>
                        <h2 className="mb-8 text-2xl font-black text-slate-900 dark:text-slate-100 md:text-3xl">
                            How a project moves through the system
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {workflowSteps.map((s) => (
                                <div
                                    key={s.step}
                                    className="relative rounded-2xl border border-slate-200 bg-[#f8faff] p-5 dark:border-white/10 dark:bg-[#111827]"
                                >
                                    <span
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white mb-4"
                                        style={{ backgroundColor: BRAND.primary }}
                                    >
                                        {s.step}
                                    </span>
                                    <h3 className="mb-2 text-sm font-black text-slate-900 dark:text-slate-100">{s.title}</h3>
                                    <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">{s.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* System modules */}
                <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
                    <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="h-5 w-5 text-[#2a3fa4]" />
                        <p className="text-xs font-black uppercase tracking-widest text-[#2a3fa4]">
                            Platform modules
                        </p>
                    </div>
                    <h2 className="mb-8 text-2xl font-black text-slate-900 dark:text-slate-100 md:text-3xl">
                        What you can do in {PROJECT_NAME}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {visibleModules.map((mod) => {
                            const Icon = mod.icon;
                            return (
                                <div
                                    key={mod.title}
                                    className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111827]"
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2a3fa4] flex items-center justify-center">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-black text-slate-900 dark:text-slate-100">{mod.title}</h3>
                                    </div>
                                    <ul className="space-y-2 mb-5 flex-1">
                                        {mod.points.map((p) => (
                                            <li key={p} className="flex gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                                                <span className="text-[#2a3fa4] shrink-0">•</span>
                                                {p}
                                            </li>
                                        ))}
                                    </ul>
                                    <Link
                                        to={user ? mod.link : '/login'}
                                        className="inline-flex items-center gap-1 text-sm font-black text-[#2a3fa4] hover:underline"
                                    >
                                        {mod.linkLabel} <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Quick links */}
                <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                    <div
                        className="rounded-[1.75rem] overflow-hidden px-6 py-10 md:px-10 md:py-12 text-center"
                        style={{ background: BRAND_GRADIENT }}
                    >
                        <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
                            Explore the platform
                        </h2>
                        <p className="text-blue-100 font-medium mb-8 max-w-xl mx-auto">
                            Read the full platform guide or browse verified student projects from previous terms.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <Link
                                to="/about"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-[#2a3fa4] text-sm font-black hover:bg-blue-50"
                            >
                                Platform guide
                            </Link>
                            <Link
                                to="/gallery"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-white/40 text-white text-sm font-black hover:bg-white/10"
                            >
                                Verified projects
                            </Link>
                            {!user && (
                                <Link
                                    to="/login"
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#223688] text-white text-sm font-black hover:opacity-95"
                                >
                                    Sign in
                                </Link>
                            )}
                        </div>
                    </div>
                </section>
            </main>

            <PublicSiteFooter />
        </div>
        </StudentPublicShell>
    );
};

export default LandingPage;
