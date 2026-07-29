import React from 'react';
import { Link } from 'react-router-dom';
import {
    BookOpen,
    BrainCircuit,
    CheckCircle2,
    Container,
    FileArchive,
    Layers,
    Search,
    ShieldCheck,
    UploadCloud,
    Users,
} from 'lucide-react';
import StudentPublicShell from '../layouts/StudentPublicShell';
import PublicSiteFooter from '../../../shared/components/PublicSiteFooter';
import { PROJECT_NAME } from '../../../shared/ui/brandTheme';

const roles = [
    {
        title: 'Students',
        icon: BookOpen,
        points: [
            'Browse assignments by subject (regular and collaborative pairs)',
            'Submit proposals with title, description, and features',
            'Upload project ZIP + screenshot after teacher approval',
            'Track deadlines, feedback, and submission history',
        ],
    },
    {
        title: 'Teachers',
        icon: Users,
        points: [
            'Publish final or normal assignments with requirements and deadlines',
            'Review proposals with AI similarity and requirement checks',
            'Approve or request changes; score and leave feedback',
            'Start Docker sandbox previews of student project ZIPs',
        ],
    },
    {
        title: 'Admins',
        icon: ShieldCheck,
        points: [
            'Manage academic years, semesters, classes, and subjects',
            'Create teacher and student accounts',
            'Assign teachers to classes and enroll students',
            'Oversee platform structure for each semester',
        ],
    },
];

const workflow = [
    {
        step: '1',
        title: 'Assignment published',
        detail: 'Teacher creates a final or normal assignment with requirements, allowed technologies, and deadlines.',
    },
    {
        step: '2',
        title: 'Proposal submitted',
        detail: 'Student (or group leader) submits title, overview, and features. The system checks requirements and AI similarity.',
    },
    {
        step: '3',
        title: 'Teacher decision',
        detail: 'Teacher reviews checks, leaves feedback, and approves or requests revision. Collaborative assignments need both frontend and backend teachers.',
    },
    {
        step: '4',
        title: 'Project ZIP upload',
        detail: 'After approval, students upload source code. The ZIP must match the proposal — not a legacy clone or unrelated project.',
    },
    {
        step: '5',
        title: 'Live preview',
        detail: 'Teachers can start an isolated Docker preview (React/Node, Spring Boot, PHP, and related stacks) to verify the running app.',
    },
];

const integrity = [
    {
        icon: Search,
        title: 'Requirement match',
        desc: 'Proposals are checked against the assignment file and allowed technologies before they reach the teacher.',
    },
    {
        icon: BrainCircuit,
        title: 'AI similarity',
        desc: 'Same-semester overlap can block a proposal. Previous-semester / legacy overlap warns students to differentiate.',
    },
    {
        icon: FileArchive,
        title: 'Project ZIP gates',
        desc: 'Uploads are checked for exact duplicates, legacy/system clones, and keyword overlap with the approved proposal.',
    },
    {
        icon: Container,
        title: 'Sandbox preview',
        desc: 'Teachers preview student apps in Docker without installing projects on their own machines.',
    },
];

const StudentAbout = () => {
    return (
        <StudentPublicShell>
            <div className="min-h-screen overflow-x-hidden bg-[#f8faff] font-sans text-[var(--sv-text)] selection:bg-blue-100 selection:text-blue-900 dark:bg-[#020617] dark:text-slate-100">
                <section className="px-6 pb-12 pt-24">
                    <div className="mx-auto max-w-[1400px]">
                        <p className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-[#2a3fa4]">
                            Platform guide
                        </p>
                        <h1 className="mb-4 max-w-3xl text-4xl font-black leading-tight text-[var(--sv-text)] dark:text-slate-100 md:text-5xl">
                            How {PROJECT_NAME} works
                        </h1>
                        <p className="mb-8 max-w-2xl text-lg font-medium text-[var(--sv-muted)] dark:text-slate-300">
                            {PROJECT_NAME} helps universities verify student project originality - from proposal review
                            to ZIP upload and live Docker preview - for students, teachers, and admins.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 rounded-xl bg-[#2a3fa4] px-5 py-3 text-sm font-bold text-white hover:bg-[#223688]"
                            >
                                Access platform
                            </Link>
                            <Link
                                to="/about"
                                className="inline-flex items-center gap-2 rounded-xl border border-[var(--sv-border)] bg-[var(--sv-card)] px-5 py-3 text-sm font-bold text-[var(--sv-text)] hover:bg-[var(--sv-card-muted)] dark:border-white/10 dark:bg-[#111827]"
                            >
                                Meet the team
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="bg-[var(--sv-card-muted)] px-6 py-16 dark:bg-[#0b1220]">
                    <div className="mx-auto max-w-[1400px]">
                        <h2 className="mb-3 text-3xl font-black text-[var(--sv-text)] dark:text-slate-100">
                            Who uses the platform
                        </h2>
                        <p className="mb-10 max-w-2xl text-base font-medium text-[var(--sv-muted)] dark:text-slate-300">
                            Three roles share one workflow: publish work, verify originality, and review real code.
                        </p>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            {roles.map((role) => (
                                <div
                                    key={role.title}
                                    className="rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-card)] p-6 shadow-sm dark:border-white/10 dark:bg-[#111827]"
                                >
                                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#1D68E3] dark:bg-blue-500/15 dark:text-sky-300">
                                        <role.icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="mb-3 text-xl font-black text-[var(--sv-text)] dark:text-slate-100">
                                        {role.title}
                                    </h3>
                                    <ul className="space-y-2.5">
                                        {role.points.map((point) => (
                                            <li
                                                key={point}
                                                className="flex gap-2 text-sm font-medium leading-relaxed text-[var(--sv-muted)] dark:text-slate-300"
                                            >
                                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1D68E3]" />
                                                <span>{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="px-6 py-16">
                    <div className="mx-auto max-w-[1400px]">
                        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h2 className="text-3xl font-black text-[var(--sv-text)] dark:text-slate-100">
                                    End-to-end workflow
                                </h2>
                                <p className="mt-2 max-w-2xl text-base font-medium text-[var(--sv-muted)] dark:text-slate-300">
                                    From assignment creation to live preview of the student project.
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-[#1D68E3] dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-sky-300">
                                <UploadCloud className="h-3.5 w-3.5" />
                                Proposal → ZIP → Preview
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                            {workflow.map((item) => (
                                <div
                                    key={item.step}
                                    className="rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-card)] p-5 dark:border-white/10 dark:bg-[#111827]"
                                >
                                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#2a3fa4] text-sm font-black text-white">
                                        {item.step}
                                    </div>
                                    <h3 className="mb-2 text-sm font-black text-[var(--sv-text)] dark:text-slate-100">
                                        {item.title}
                                    </h3>
                                    <p className="text-[13px] font-medium leading-relaxed text-[var(--sv-muted)] dark:text-slate-300">
                                        {item.detail}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="bg-[var(--sv-card-muted)] px-6 py-16 dark:bg-[#0b1220]">
                    <div className="mx-auto max-w-[1400px]">
                        <h2 className="mb-3 text-3xl font-black text-[var(--sv-text)] dark:text-slate-100">
                            Integrity & verification
                        </h2>
                        <p className="mb-10 max-w-2xl text-base font-medium text-[var(--sv-muted)] dark:text-slate-300">
                            Built-in checks keep submissions honest before and after teacher review.
                        </p>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                            {integrity.map((item) => (
                                <div
                                    key={item.title}
                                    className="rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-card)] p-6 dark:border-white/10 dark:bg-[#111827]"
                                >
                                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="mb-2 text-lg font-black text-[var(--sv-text)] dark:text-slate-100">
                                        {item.title}
                                    </h3>
                                    <p className="text-sm font-medium leading-relaxed text-[var(--sv-muted)] dark:text-slate-300">
                                        {item.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="px-6 py-16">
                    <div className="mx-auto max-w-[1400px] grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-card)] p-8 dark:border-white/10 dark:bg-[#111827]">
                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                                <Layers className="h-5 w-5" />
                            </div>
                            <h2 className="mb-3 text-2xl font-black text-[var(--sv-text)] dark:text-slate-100">
                                Collaborative assignments
                            </h2>
                            <p className="text-sm font-medium leading-relaxed text-[var(--sv-muted)] dark:text-slate-300">
                                Final projects can pair a frontend teacher and a backend teacher on the same class.
                                Each side uploads requirements; both must approve the proposal before students can
                                submit project code.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-[var(--sv-border)] bg-[var(--sv-card)] p-8 dark:border-white/10 dark:bg-[#111827]">
                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#1D68E3] dark:bg-blue-500/15 dark:text-sky-300">
                                <Container className="h-5 w-5" />
                            </div>
                            <h2 className="mb-3 text-2xl font-black text-[var(--sv-text)] dark:text-slate-100">
                                Docker sandbox preview
                            </h2>
                            <p className="text-sm font-medium leading-relaxed text-[var(--sv-muted)] dark:text-slate-300">
                                Teachers start a temporary container for the uploaded ZIP (Node/React, Spring Boot,
                                PHP/Apache, and related stacks). Preview credentials are shown so teachers can sign in
                                to the student app without local setup.
                            </p>
                        </div>
                    </div>
                </section>

                <PublicSiteFooter />
            </div>
        </StudentPublicShell>
    );
};

export default StudentAbout;
