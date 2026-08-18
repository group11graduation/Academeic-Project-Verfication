import React from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowUpRight,
    BookOpen,
    BrainCircuit,
    CheckCircle2,
    Container,
    FileArchive,
    GraduationCap,
    Layers,
    Search,
    ShieldCheck,
    UploadCloud,
    Users,
} from 'lucide-react';
import StudentPublicShell from '../layouts/StudentPublicShell';
import PublicSiteFooter from '../../../shared/components/PublicSiteFooter';
import { BRAND, BRAND_GRADIENT, PROJECT_NAME } from '../../../shared/ui/brandTheme';

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
        highlight: true,
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
            <div className="relative min-h-screen overflow-x-clip bg-[#f0f1f3] text-[var(--sv-text)] antialiased [font-family:var(--sv-font-sans)]">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
                    style={{
                        background:
                            'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(42,63,164,0.16), transparent 60%), radial-gradient(ellipse 40% 35% at 85% 20%, rgba(29,104,227,0.12), transparent 50%)',
                    }}
                />
                <main className="relative">
                    {/* Hero */}
                    <section className="mx-auto max-w-[1200px] px-4 pb-8 pt-6 sm:px-6 sm:pt-8 lg:px-8">
                        <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-[var(--bg-card)] px-5 py-10 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:rounded-[40px] sm:px-10 sm:py-14 lg:px-14">
                            <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#c7d2fe]/50 blur-3xl" />
                            <div aria-hidden className="pointer-events-none absolute -right-16 top-8 h-56 w-56 rounded-full bg-[#bfdbfe]/45 blur-3xl" />
                            <div className="relative mx-auto max-w-3xl text-center">
                                <p className="mb-4 text-sm font-bold tracking-tight text-[var(--brand-primary)]">Platform guide</p>
                                <h1 className="mb-5 text-[1.85rem] font-extrabold leading-[1.15] tracking-tight text-[var(--text-primary)] sm:text-4xl md:text-5xl">
                                    How {PROJECT_NAME} works
                                </h1>
                                <p className="mx-auto mb-8 max-w-xl text-sm font-medium leading-relaxed text-[var(--text-secondary)] sm:text-base">
                                    {PROJECT_NAME} helps universities verify student project originality — from proposal
                                    review to ZIP upload and live Docker preview — for students, teachers, and admins.
                                </p>
                                <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                                    <Link
                                        to="/login"
                                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-7 py-3 text-sm font-bold text-white shadow-lg shadow-[#2a3fa4]/25"
                                        style={{ background: BRAND_GRADIENT }}
                                    >
                                        <GraduationCap className="h-4 w-4" />
                                        Access platform
                                    </Link>
                                    <Link
                                        to="/about"
                                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-900 bg-[var(--bg-card)] px-7 py-3 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                                    >
                                        Meet the team
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Roles */}
                    <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
                        <div className="mb-8 grid gap-4 lg:grid-cols-2 lg:items-end lg:gap-10">
                            <h2 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl lg:text-4xl">
                                Who uses the platform
                            </h2>
                            <p className="text-sm font-medium leading-relaxed text-[var(--text-secondary)] sm:text-base">
                                Three roles share one workflow: publish work, verify originality, and review real code.
                            </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            {roles.map((role) => (
                                <div
                                    key={role.title}
                                    className={`rounded-3xl p-6 sm:p-7 ${
 role.highlight ? 'text-white' : 'border border-[var(--border)] bg-[var(--bg-card)]'
 }`}
                                    style={role.highlight ? { background: BRAND_GRADIENT } : undefined}
                                >
                                    <div
                                        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${
 role.highlight ? 'bg-white/15 text-white' : 'bg-[var(--bg-elevated)] text-[var(--brand-primary)]'
 }`}
                                    >
                                        <role.icon className="h-5 w-5" />
                                    </div>
                                    <h3
                                        className={`mb-3 text-lg font-extrabold ${
 role.highlight ? 'text-white' : 'text-[var(--text-primary)]'
 }`}
                                    >
                                        {role.title}
                                    </h3>
                                    <ul className="space-y-2.5">
                                        {role.points.map((point) => (
                                            <li
                                                key={point}
                                                className={`flex gap-2 text-sm font-medium leading-relaxed ${
 role.highlight ? 'text-blue-100' : 'text-[var(--text-secondary)]'
 }`}
                                            >
                                                <CheckCircle2
                                                    className={`mt-0.5 h-4 w-4 shrink-0 ${
 role.highlight ? 'text-white' : 'text-[var(--accent)]'
 }`}
                                                />
                                                <span>{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Workflow */}
                    <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
                        <div className="rounded-[28px] bg-[#f0f1f3] p-5 sm:rounded-[36px] sm:p-8 lg:p-10">
                            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="max-w-xl">
                                    <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                                        End-to-end workflow
                                    </h2>
                                    <p className="text-sm font-medium leading-relaxed text-[var(--text-secondary)]">
                                        From assignment creation to live preview of the student project.
                                    </p>
                                </div>
                                <span className="inline-flex min-h-10 items-center gap-2 self-start rounded-2xl bg-[var(--bg-card)] px-4 py-2 text-[11px] font-extrabold uppercase tracking-widest text-[var(--brand-primary)] ring-1 ring-[var(--border)]">
                                    <UploadCloud className="h-3.5 w-3.5" />
                                    Proposal → ZIP → Preview
                                </span>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                                {workflow.map((item) => (
                                    <div key={item.step} className="rounded-3xl border border-[var(--border)]/80 bg-[var(--bg-card)] p-5">
                                        <span
                                            className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-extrabold text-white"
                                            style={{ backgroundColor: BRAND.primary }}
                                        >
                                            {item.step}
                                        </span>
                                        <h3 className="mb-2 text-sm font-extrabold text-[var(--text-primary)]">{item.title}</h3>
                                        <p className="text-sm font-medium leading-relaxed text-[var(--text-secondary)]">{item.detail}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Integrity */}
                    <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
                        <div className="mb-8 text-center">
                            <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                                Integrity & verification
                            </h2>
                            <p className="mx-auto max-w-2xl text-sm font-medium leading-relaxed text-[var(--text-secondary)] sm:text-base">
                                Built-in checks keep submissions honest before and after teacher review.
                            </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {integrity.map((item) => (
                                <div
                                    key={item.title}
                                    className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-6 transition hover:border-[var(--border)] hover:shadow-md"
                                >
                                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef2ff] text-[var(--brand-primary)]">
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="mb-2 text-base font-extrabold text-[var(--text-primary)]">{item.title}</h3>
                                    <p className="text-sm font-medium leading-relaxed text-[var(--text-secondary)]">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Collab + Docker */}
                    <section className="mx-auto max-w-[1200px] px-4 pb-10 sm:px-6 lg:px-8">
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-6 sm:rounded-[36px] sm:p-8">
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef2ff] text-[var(--brand-primary)]">
                                    <Layers className="h-5 w-5" />
                                </div>
                                <h2 className="mb-3 text-xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-2xl">
                                    Collaborative assignments
                                </h2>
                                <p className="text-sm font-medium leading-relaxed text-[var(--text-secondary)]">
                                    Final projects can pair a frontend teacher and a backend teacher on the same class.
                                    Each side uploads requirements; both must approve the proposal before students can
                                    submit project code.
                                </p>
                            </div>
                            <div
                                className="rounded-[28px] p-6 text-white sm:rounded-[36px] sm:p-8"
                                style={{ background: BRAND_GRADIENT }}
                            >
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                                    <Container className="h-5 w-5" />
                                </div>
                                <h2 className="mb-3 text-xl font-extrabold tracking-tight sm:text-2xl">
                                    Docker sandbox preview
                                </h2>
                                <p className="text-sm font-medium leading-relaxed text-blue-100">
                                    Teachers start a temporary container for the uploaded ZIP (Node/React, Spring Boot,
                                    PHP/Apache, and related stacks). Preview credentials are shown so teachers can sign
                                    in to the student app without local setup.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* CTA */}
                    <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6 lg:px-8">
                        <div
                            className="rounded-[28px] px-6 py-12 text-center sm:rounded-[36px] sm:px-10 sm:py-14"
                            style={{ background: BRAND_GRADIENT }}
                        >
                            <h2 className="mb-3 text-2xl font-extrabold text-white sm:text-3xl">
                                Ready to explore further?
                            </h2>
                            <p className="mx-auto mb-8 max-w-xl text-sm font-medium text-blue-100">
                                Browse verified student work or meet the graduation team behind {PROJECT_NAME}.
                            </p>
                            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                                <Link
                                    to="/gallery"
                                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--bg-card)] px-6 py-3 text-sm font-extrabold text-[var(--brand-primary)]"
                                >
                                    Verified projects <ArrowUpRight className="h-4 w-4" />
                                </Link>
                                <Link
                                    to="/about"
                                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/40 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
                                >
                                    About the team
                                </Link>
                            </div>
                        </div>
                    </section>
                </main>

                <PublicSiteFooter />
            </div>
        </StudentPublicShell>
    );
};

export default StudentAbout;
