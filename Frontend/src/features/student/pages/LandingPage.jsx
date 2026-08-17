import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    ArrowUpRight,
    BookOpen,
    BrainCircuit,
    Check,
    Container,
    GraduationCap,
    Layers,
    Minus,
    Plus,
    ShieldCheck,
    UserCog,
    Users,
    Workflow,
    X,
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

const featureCards = [
    {
        title: 'Integrity first',
        detail: 'Same-semester similarity detection and legacy project cross-checks before work reaches grading.',
        icon: ShieldCheck,
    },
    {
        title: 'Clear workflow',
        detail: 'Proposal to approval to ZIP submission — every stage tracked with teacher feedback.',
        icon: Workflow,
    },
    {
        title: 'Live sandbox previews',
        detail: 'Teachers open student submissions in isolated Docker environments without local setup.',
        icon: Container,
    },
];

const whyChoose = [
    {
        title: 'Requirement gates',
        detail: 'Keyword and technology checks keep submissions aligned with assignment criteria.',
    },
    {
        title: 'Role-based workspaces',
        detail: 'Students, teachers, and admins each get a focused panel for their responsibilities.',
    },
    {
        title: 'Dual-teacher projects',
        detail: 'Split frontend and backend requirements across collaborative teaching assignments.',
        highlight: true,
    },
    {
        title: 'Verified project gallery',
        detail: 'Browse approved student work from previous terms as a living academic archive.',
    },
    {
        title: 'Institution-ready structure',
        detail: 'Classes, subjects, semesters, and accounts managed from a single admin console.',
    },
];

const comparisonRows = [
    { label: 'Proposal & similarity checks', other: 'Manual / email', ours: true },
    { label: 'Structured teacher feedback', other: 'Sometimes', ours: true },
    { label: 'Live Docker preview', other: false, ours: true },
    { label: 'Dual-teacher collaboration', other: false, ours: true },
    { label: 'Verified project archive', other: 'Scattered files', ours: true },
];

const programCards = [
    {
        title: 'Student workspace',
        detail: 'Assignments, proposals, ZIP uploads, and feedback timelines in one place.',
        icon: GraduationCap,
        link: '/student',
        roles: ['student'],
        featured: true,
    },
    {
        title: 'Teacher workspace',
        detail: 'Review proposals with AI assistance and run sandbox previews on submissions.',
        icon: Users,
        link: '/teacher',
        roles: ['teacher'],
    },
    {
        title: 'Administration',
        detail: 'Classes, subjects, semesters, and account setup for your institution.',
        icon: UserCog,
        link: '/admin',
        roles: ['admin'],
    },
    {
        title: 'Integrity engine',
        detail: 'Similarity screening, legacy cross-checks, and requirement gates.',
        icon: BrainCircuit,
        link: '/guide',
        roles: ['guest', 'student', 'teacher', 'admin'],
    },
];

const faqs = [
    {
        q: 'Who can sign in to the platform?',
        a: 'Students, teachers, and administrators with institution accounts. Guests can browse this overview, the platform guide, and verified projects without signing in.',
    },
    {
        q: 'How does project verification work?',
        a: 'Teachers publish assignments, students submit proposals for requirement and AI similarity checks, then upload project ZIPs after approval. Teachers review and can preview live in Docker.',
    },
    {
        q: 'Which stacks support live preview?',
        a: 'The sandbox supports common academic stacks including React, Spring Boot, MERN, and PHP — isolated in Docker for teacher-only preview sessions.',
    },
    {
        q: 'Where can I learn the full workflow?',
        a: 'Open the Platform guide for step-by-step roles, proposal rules, and preview details. Verified Projects shows approved work from previous terms.',
    },
];

const LandingPage = () => {
    const { user, logout } = useAuth();
    const [openFaq, setOpenFaq] = useState(0);

    const workspacePath =
        user?.role === 'student' ? '/student' : user?.role === 'teacher' ? '/teacher' : user?.role === 'admin' ? '/admin' : '/login';

    const primaryCta = user
        ? { to: workspacePath, label: 'Open my workspace' }
        : { to: '/login', label: 'Sign in to the platform' };

    const visiblePrograms = programCards.filter((m) => {
        if (!user) return true;
        return m.roles.includes(user.role) || m.roles.includes('guest');
    });

    return (
        <StudentPublicShell forcePublic>
            <div className="relative min-h-screen overflow-x-clip bg-[#f0f1f3] text-[var(--sv-text)] antialiased [font-family:var(--sv-font-sans)]">
                {/* Soft page gradient wash */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-[720px] opacity-90"
                    style={{
                        background:
                            'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(42,63,164,0.18), transparent 60%), radial-gradient(ellipse 45% 40% at 15% 20%, rgba(29,104,227,0.14), transparent 55%), radial-gradient(ellipse 40% 35% at 85% 15%, rgba(99,102,241,0.12), transparent 50%)',
                    }}
                />

                <main className="relative">
                    {/* Signed-in banner */}
                    {user && (
                        <div className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-6 lg:px-8">
                            <div className="flex flex-col gap-4 rounded-3xl border border-[#dbe3f5] bg-white/90 px-5 py-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#2a3fa4]">
                                        Already signed in
                                    </p>
                                    <p className="text-sm font-semibold text-slate-800">
                                        Continue as {user.name || user.email} from your workspace, or browse below.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <Link
                                        to={workspacePath}
                                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white"
                                        style={{ backgroundColor: BRAND.primary }}
                                    >
                                        Go to my workspace <ArrowRight className="h-4 w-4" />
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => logout()}
                                        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                    >
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hero */}
                    <section className="mx-auto max-w-[1200px] px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16">
                        <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/80 px-5 py-10 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:rounded-[40px] sm:px-10 sm:py-14 lg:px-14">
                            {/* Soft gradient blobs inside hero */}
                            <div
                                aria-hidden
                                className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[#c7d2fe]/55 blur-3xl"
                            />
                            <div
                                aria-hidden
                                className="pointer-events-none absolute -right-16 top-10 h-64 w-64 rounded-full bg-[#bfdbfe]/50 blur-3xl"
                            />
                            <div
                                aria-hidden
                                className="pointer-events-none absolute bottom-24 left-1/3 h-56 w-56 rounded-full bg-[#a5b4fc]/35 blur-3xl"
                            />

                            <div className="relative mx-auto max-w-3xl text-center">
                                <p className="mb-4 text-sm font-bold tracking-tight text-[#2a3fa4] sm:text-base">
                                    {PROJECT_NAME}
                                </p>
                                <h1 className="mb-5 text-[1.85rem] font-extrabold leading-[1.15] tracking-tight text-slate-950 sm:text-4xl md:text-5xl lg:text-[3.25rem]">
                                    Academic integrity through verified project workflows
                                </h1>
                                <p className="mx-auto mb-8 max-w-xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
                                    Flexible proposal checks, teacher review, and Docker previews — designed to elevate
                                    coursework from submission to verified delivery.
                                </p>
                                <div className="mb-12 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                                    <Link
                                        to={primaryCta.to}
                                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-7 py-3 text-sm font-bold text-white shadow-lg shadow-[#2a3fa4]/25 transition hover:opacity-95"
                                        style={{ background: BRAND_GRADIENT }}
                                    >
                                        <GraduationCap className="h-4 w-4" />
                                        {primaryCta.label}
                                    </Link>
                                    <Link
                                        to="/guide"
                                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-900 bg-white px-7 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-50"
                                    >
                                        Platform guide
                                    </Link>
                                </div>
                            </div>

                            {/* Dashboard preview mock */}
                            <div className="relative z-[1] mx-auto max-w-4xl">
                                <div className="pointer-events-none absolute -left-2 top-8 hidden h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#2a3fa4] shadow-sm sm:flex lg:-left-6">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div className="pointer-events-none absolute -right-2 top-16 hidden h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#2a3fa4] shadow-sm sm:flex lg:-right-6">
                                    <Container className="h-5 w-5" />
                                </div>
                                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#f8faff] shadow-xl sm:rounded-3xl">
                                    <div className="flex min-h-[220px] sm:min-h-[280px]">
                                        <aside className="hidden w-40 shrink-0 border-r border-slate-200 bg-white p-4 sm:block md:w-48">
                                            <p className="mb-4 text-xs font-extrabold text-slate-900">{PROJECT_NAME}</p>
                                            {[
                                                'Home',
                                                'Assignments',
                                                'Proposals',
                                                'Submissions',
                                                'Previews',
                                                'Feedback',
                                            ].map((item, i) => (
                                                <div
                                                    key={item}
                                                    className={`mb-1 rounded-xl px-3 py-2 text-[11px] font-semibold ${
                                                        i === 0 ? 'bg-[#eef2ff] text-[#2a3fa4]' : 'text-slate-500'
                                                    }`}
                                                >
                                                    {item}
                                                </div>
                                            ))}
                                        </aside>
                                        <div className="flex-1 space-y-3 p-4 sm:p-5">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-extrabold text-slate-900">Upcoming reviews</p>
                                                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                                                    Live panel
                                                </span>
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                                    <p className="mb-2 text-[11px] font-bold text-slate-500">Proposal status</p>
                                                    <p className="mb-3 text-sm font-extrabold text-slate-900">Similarity check</p>
                                                    <div className="mb-1 h-2 overflow-hidden rounded-full bg-slate-100">
                                                        <div className="h-full w-[35%] rounded-full" style={{ background: BRAND_GRADIENT }} />
                                                    </div>
                                                    <p className="text-[10px] font-semibold text-slate-400">35% screened</p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                                    <p className="mb-2 text-[11px] font-bold text-slate-500">Sandbox</p>
                                                    <p className="mb-3 text-sm font-extrabold text-slate-900">Docker preview</p>
                                                    <p className="inline-flex rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                                                        Ready for teacher
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-extrabold text-white"
                                                        style={{ background: BRAND_GRADIENT }}
                                                    >
                                                        PV
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-bold text-slate-900">Capstone submission queue</p>
                                                        <p className="text-[11px] font-medium text-slate-500">AI integrity · teacher review · preview</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Features intro */}
                    <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
                        <div className="mb-8 grid gap-4 lg:grid-cols-2 lg:items-end lg:gap-10">
                            <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                                Unlocking clearer paths for academic project delivery
                            </h2>
                            <p className="text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
                                {PROJECT_NAME} brings proposal checks, teacher review, collaborative assignments, and
                                sandbox previews into one institutional workflow — without changing how your roles work.
                            </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            {featureCards.map(({ title, detail, icon: Icon }) => (
                                <div
                                    key={title}
                                    className="rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-[#c5d0f0] hover:shadow-md"
                                >
                                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#2a3fa4]">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="mb-2 text-base font-extrabold text-slate-950">{title}</h3>
                                    <p className="text-sm font-medium leading-relaxed text-slate-500">{detail}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Promo banner */}
                    <section className="mx-auto max-w-[1200px] px-4 pb-10 sm:px-6 lg:px-8">
                        <div className="grid overflow-hidden rounded-[28px] border border-slate-200 bg-white sm:rounded-[36px] lg:grid-cols-2">
                            <div
                                className="relative min-h-[200px] bg-cover bg-center sm:min-h-[280px]"
                                style={{
                                    backgroundImage:
                                        'linear-gradient(135deg, rgba(42,63,164,0.92), rgba(29,104,227,0.85)), radial-gradient(circle at 30% 40%, #93c5fd 0%, transparent 55%)',
                                }}
                            >
                                <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
                                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-100">Workflow</p>
                                    <p className="text-xl font-extrabold text-white sm:text-2xl">From proposal to preview</p>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center p-6 sm:p-10">
                                <h2 className="mb-3 text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">
                                    Start early — keep every submission on track
                                </h2>
                                <p className="mb-6 text-sm font-medium leading-relaxed text-slate-500">
                                    Publish assignments, collect proposals, run integrity checks, and open live previews
                                    before grading day. One platform for faculty and students.
                                </p>
                                <Link
                                    to={primaryCta.to}
                                    className="inline-flex w-fit min-h-11 items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-bold text-white"
                                    style={{ backgroundColor: BRAND.primary }}
                                >
                                    <GraduationCap className="h-4 w-4" />
                                    {user ? 'Open workspace' : 'Access platform'}
                                </Link>
                            </div>
                        </div>
                    </section>

                    {/* Why choose */}
                    <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
                        <div className="mb-10 text-center">
                            <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                                Choose {PROJECT_NAME} for academic projects
                            </h2>
                            <p className="mx-auto max-w-2xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
                                Built for institutions that need integrity screening, structured review, and reliable
                                sandbox previews — without replacing your academic policies.
                            </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-fr">
                            {whyChoose.map((card) => (
                                <div
                                    key={card.title}
                                    className={`rounded-3xl p-6 sm:p-7 ${
                                        card.highlight
                                            ? 'flex min-h-[260px] flex-col justify-between bg-slate-950 text-white lg:row-span-2'
                                            : 'border border-slate-200 bg-white'
                                    }`}
                                >
                                    <div>
                                        <h3 className={`mb-2 text-lg font-extrabold ${card.highlight ? 'text-white' : 'text-slate-950'}`}>
                                            {card.title}
                                        </h3>
                                        <p className={`text-sm font-medium leading-relaxed ${card.highlight ? 'text-slate-300' : 'text-slate-500'}`}>
                                            {card.detail}
                                        </p>
                                    </div>
                                    {card.highlight && (
                                        <div className="mt-8 flex items-end justify-between gap-4">
                                            <Layers className="h-16 w-16 text-white/20" />
                                            <Link
                                                to="/guide"
                                                className="inline-flex items-center gap-1 text-sm font-bold text-white underline-offset-4 hover:underline"
                                            >
                                                Learn more <ArrowUpRight className="h-4 w-4" />
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Comparison */}
                    <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
                        <div className="mb-8 grid gap-4 lg:grid-cols-2 lg:items-end">
                            <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                                Affordable process, recognized integrity
                            </h2>
                            <p className="text-sm font-medium leading-relaxed text-slate-500">
                                Replace scattered emails and ZIP chaos with a single verified pipeline your faculty can
                                trust.
                            </p>
                        </div>
                        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                            <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr] border-b border-slate-100 px-3 py-4 text-center text-[11px] font-extrabold uppercase tracking-wide text-slate-900 sm:grid-cols-3 sm:px-6 sm:text-xs">
                                <div className="text-left">Capability</div>
                                <div>Other tools</div>
                                <div>{PROJECT_NAME}</div>
                            </div>
                            {comparisonRows.map((row, i) => (
                                <div
                                    key={row.label}
                                    className={`grid grid-cols-[1.2fr_0.9fr_0.9fr] items-center px-3 py-3.5 text-xs sm:grid-cols-3 sm:px-6 sm:text-sm ${
                                        i % 2 === 0 ? 'bg-[#eef2ff]/70' : 'bg-white'
                                    }`}
                                >
                                    <p className="pr-2 text-left font-semibold text-slate-700">{row.label}</p>
                                    <div className="flex justify-center text-center font-medium text-slate-400">
                                        {row.other === false ? (
                                            <X className="h-4 w-4 text-slate-300" />
                                        ) : (
                                            <span>{row.other}</span>
                                        )}
                                    </div>
                                    <div className="flex justify-center">
                                        {row.ours === true ? (
                                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#2a3fa4] text-white">
                                                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                            </span>
                                        ) : (
                                            <span className="font-semibold text-slate-700">{row.ours}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Programs / modules */}
                    <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
                        <div className="rounded-[28px] bg-[#f0f1f3] p-5 sm:rounded-[36px] sm:p-8 lg:p-10">
                            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="max-w-xl">
                                    <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                                        Our modules
                                    </h2>
                                    <p className="text-sm font-medium leading-relaxed text-slate-500">
                                        Explore the workspaces and engines that power verification — same links and roles
                                        you already use.
                                    </p>
                                </div>
                                <Link
                                    to="/guide"
                                    className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-bold text-white"
                                    style={{ backgroundColor: BRAND.primary }}
                                >
                                    <ArrowUpRight className="h-4 w-4" />
                                    View all
                                </Link>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {visiblePrograms.map((mod) => {
                                    const Icon = mod.icon;
                                    const to = user ? mod.link : mod.link === '/guide' ? '/guide' : '/login';
                                    return (
                                        <Link
                                            key={mod.title}
                                            to={to}
                                            className={`group flex min-h-[180px] flex-col justify-between rounded-3xl p-5 transition hover:-translate-y-0.5 ${
                                                mod.featured
                                                    ? 'text-white shadow-lg'
                                                    : 'border border-slate-200/80 bg-white'
                                            }`}
                                            style={mod.featured ? { background: BRAND_GRADIENT } : undefined}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div
                                                    className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                                                        mod.featured ? 'bg-white/15 text-white' : 'bg-[#eef2ff] text-[#2a3fa4]'
                                                    }`}
                                                >
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <span
                                                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                                        mod.featured ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                                    }`}
                                                >
                                                    <ArrowUpRight className="h-4 w-4" />
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className={`mb-1 text-base font-extrabold ${mod.featured ? 'text-white' : 'text-slate-950'}`}>
                                                    {mod.title}
                                                </h3>
                                                <p className={`text-sm font-medium leading-relaxed ${mod.featured ? 'text-blue-100' : 'text-slate-500'}`}>
                                                    {mod.detail}
                                                </p>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* Workflow steps */}
                    <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
                        <div className="mb-8 text-center">
                            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#2a3fa4]">End-to-end</p>
                            <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                                How a project moves through the system
                            </h2>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {workflowSteps.map((s) => (
                                <div key={s.step} className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                                    <span
                                        className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-extrabold text-white"
                                        style={{ backgroundColor: BRAND.primary }}
                                    >
                                        {s.step}
                                    </span>
                                    <h3 className="mb-2 text-sm font-extrabold text-slate-950">{s.title}</h3>
                                    <p className="text-sm font-medium leading-relaxed text-slate-500">{s.detail}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Stats + experience */}
                    <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
                        <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {[
                                { n: '4', l: 'Workflow stages' },
                                { n: '3', l: 'User roles' },
                                { n: 'AI', l: 'Similarity checks' },
                                { n: 'Docker', l: 'Live previews' },
                            ].map((s) => (
                                <div key={s.l} className="rounded-3xl bg-[#eceef2] px-4 py-6 text-center sm:py-8">
                                    <p className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{s.n}</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500 sm:text-sm">{s.l}</p>
                                </div>
                            ))}
                        </div>
                        <div className="grid items-center gap-8 rounded-[28px] border border-slate-200 bg-white p-6 sm:rounded-[36px] sm:p-10 lg:grid-cols-2">
                            <div>
                                <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                                    Exceptional review experience
                                </h2>
                                <p className="mb-6 text-sm font-medium leading-relaxed text-slate-500">
                                    Teachers open submissions in a focused panel with proposal history, integrity signals,
                                    and one-click sandbox sessions — students stay informed at every step.
                                </p>
                                <Link
                                    to="/guide"
                                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-bold text-white"
                                    style={{ backgroundColor: BRAND.primary }}
                                >
                                    Learn more
                                </Link>
                                <p className="mt-4 text-sm font-semibold text-[#2a3fa4]">
                                    <Link to="/gallery" className="underline-offset-4 hover:underline">
                                        Browse verified projects in the gallery
                                    </Link>
                                </p>
                            </div>
                            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-[#f8faff] p-4">
                                <div className="mb-3 flex gap-2">
                                    <BookOpen className="h-4 w-4 text-[#2a3fa4]" />
                                    <p className="text-xs font-bold text-slate-700">Teacher panel preview</p>
                                </div>
                                <div className="space-y-2">
                                    {['Upcoming classes & deadlines', 'Recent proposals', 'Sandbox session ready'].map((t) => (
                                        <div key={t} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                                            {t}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Dark CTA */}
                    <section className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
                        <div className="relative overflow-hidden rounded-[28px] bg-slate-950 px-6 py-14 text-center sm:rounded-[36px] sm:px-10 sm:py-20">
                            <div className="pointer-events-none absolute inset-0 opacity-30">
                                <div className="absolute left-1/2 top-8 h-16 w-16 -translate-x-1/2 rounded-2xl border border-white/20 bg-white/5" />
                                <ShieldCheck className="absolute left-[18%] top-[35%] h-8 w-8 text-white/40" />
                                <Container className="absolute right-[18%] top-[30%] h-8 w-8 text-white/40" />
                                <BrainCircuit className="absolute bottom-[28%] left-[28%] h-7 w-7 text-white/30" />
                                <Layers className="absolute bottom-[26%] right-[26%] h-7 w-7 text-white/30" />
                            </div>
                            <div className="relative">
                                <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                                    Start your verification journey
                                </h2>
                                <p className="mx-auto mb-8 max-w-xl text-sm font-medium leading-relaxed text-slate-300 sm:text-base">
                                    Join students and faculty already using {PROJECT_NAME} to keep academic projects
                                    clear, checkable, and preview-ready.
                                </p>
                                <Link
                                    to={primaryCta.to}
                                    className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-slate-100"
                                >
                                    {user ? 'Open my workspace' : 'Start application'}
                                </Link>
                            </div>
                        </div>
                    </section>

                    {/* FAQ */}
                    <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
                        <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-10 sm:rounded-[36px] sm:px-10 sm:py-14">
                            <div className="mx-auto mb-8 max-w-2xl text-center">
                                <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                                    Frequently asked questions
                                </h2>
                                <p className="mb-5 text-sm font-medium leading-relaxed text-slate-500">
                                    Answers about programs, admissions to the platform, and how verification works —
                                    all in one place.
                                </p>
                                <Link
                                    to="/guide"
                                    className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"
                                >
                                    More questions
                                </Link>
                            </div>
                            <div className="mx-auto max-w-3xl divide-y divide-slate-200">
                                {faqs.map((item, i) => {
                                    const open = openFaq === i;
                                    return (
                                        <div key={item.q} className="py-2">
                                            <button
                                                type="button"
                                                onClick={() => setOpenFaq(open ? -1 : i)}
                                                className={`flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-4 text-left transition ${
                                                    open ? 'bg-[#f4f5f7]' : 'hover:bg-slate-50'
                                                }`}
                                            >
                                                <span className="text-sm font-extrabold text-slate-950 sm:text-base">{item.q}</span>
                                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600">
                                                    {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                                </span>
                                            </button>
                                            {open && (
                                                <p className="px-4 pb-4 text-sm font-medium leading-relaxed text-slate-500">
                                                    {item.a}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* Help + news */}
                    <section className="mx-auto max-w-[1200px] px-4 pb-6 sm:px-6 lg:px-8">
                        <div className="mb-10 text-center">
                            <span className="mb-4 inline-flex rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-500">
                                Dedicated support for your institution
                            </span>
                            <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Need help?</h2>
                            <p className="mx-auto max-w-xl text-sm font-medium leading-relaxed text-slate-500">
                                Start with the{' '}
                                <Link to="/guide" className="font-bold text-[#2a3fa4] underline-offset-2 hover:underline">
                                    FAQ & guide
                                </Link>
                                , the{' '}
                                <Link to="/about" className="font-bold text-[#2a3fa4] underline-offset-2 hover:underline">
                                    About page
                                </Link>
                                , or browse{' '}
                                <Link to="/gallery" className="font-bold text-[#2a3fa4] underline-offset-2 hover:underline">
                                    Verified projects
                                </Link>
                                .
                            </p>
                        </div>
                        <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">News and updates</h2>
                                <p className="mt-1 text-sm font-medium text-slate-500">
                                    Stay informed about platform capabilities and verified work.
                                </p>
                            </div>
                            <Link
                                to="/gallery"
                                className="inline-flex min-h-11 items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-bold text-white"
                                style={{ backgroundColor: BRAND.primary }}
                            >
                                <ArrowUpRight className="h-4 w-4" />
                                View all
                            </Link>
                        </div>
                        <div className="grid gap-5 sm:grid-cols-3">
                            {[
                                { title: 'Platform guide — roles & workflow', to: '/guide', tag: 'Guide' },
                                { title: 'About Project Verify', to: '/about', tag: 'About' },
                                { title: 'Browse verified student projects', to: '/gallery', tag: 'Gallery' },
                            ].map((card) => (
                                <Link key={card.to} to={card.to} className="group block">
                                    <div
                                        className="relative mb-3 aspect-[16/10] overflow-hidden rounded-3xl"
                                        style={{ background: BRAND_GRADIENT }}
                                    >
                                        <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-slate-800">
                                            {card.tag}
                                        </span>
                                        <div className="absolute inset-0 flex items-center justify-center opacity-40">
                                            <BookOpen className="h-12 w-12 text-white" />
                                        </div>
                                    </div>
                                    <h3 className="text-base font-extrabold text-slate-950 group-hover:text-[#2a3fa4]">
                                        {card.title}
                                    </h3>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Explore CTA strip */}
                    <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6 lg:px-8">
                        <div
                            className="rounded-[28px] px-6 py-10 text-center sm:rounded-[36px] sm:px-10 sm:py-12"
                            style={{ background: BRAND_GRADIENT }}
                        >
                            <h2 className="mb-3 text-2xl font-extrabold text-white sm:text-3xl">Explore the platform</h2>
                            <p className="mx-auto mb-8 max-w-xl text-sm font-medium text-blue-100">
                                Read the full platform guide or browse verified student projects from previous terms.
                            </p>
                            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                                <Link
                                    to="/guide"
                                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-[#2a3fa4]"
                                >
                                    Platform guide
                                </Link>
                                <Link
                                    to="/gallery"
                                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border-2 border-white/40 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
                                >
                                    Verified projects
                                </Link>
                                {!user && (
                                    <Link
                                        to="/login"
                                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#223688] px-6 py-3 text-sm font-bold text-white"
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
