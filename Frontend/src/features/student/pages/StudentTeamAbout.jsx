import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, GraduationCap, Mail, Users } from 'lucide-react';
import StudentPublicShell from '../layouts/StudentPublicShell';
import PublicSiteFooter from '../../../shared/components/PublicSiteFooter';
import { BRAND, BRAND_GRADIENT, PROJECT_NAME } from '../../../shared/ui/brandTheme';

const team = [
    {
        name: 'Asma Abdirazak Mohamud',
        image: '/Devlopers/asma.jpg',
    },
    {
        name: 'Mohamed Dahir Osman',
        image: '/Devlopers/mohamed.jpg',
    },
    {
        name: 'Amina Ibrahim Saleh',
        image: '/Devlopers/amina.png',
    },
    {
        name: 'Ahmed Abdulkadir Abdullahi',
        image: '/Devlopers/ahmed.jpg',
    },
];

const StudentTeamAbout = () => {
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
                        <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/80 px-5 py-10 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:rounded-[40px] sm:px-10 sm:py-14 lg:px-14">
                            <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#c7d2fe]/50 blur-3xl" />
                            <div aria-hidden className="pointer-events-none absolute -right-16 top-8 h-56 w-56 rounded-full bg-[#bfdbfe]/45 blur-3xl" />
                            <div className="relative mx-auto max-w-3xl text-center">
                                <p className="mb-4 text-sm font-bold tracking-tight text-[#2a3fa4]">About</p>
                                <h1 className="mb-5 text-[1.85rem] font-extrabold leading-[1.15] tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
                                    Meet the team
                                </h1>
                                <p className="mx-auto mb-8 max-w-xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
                                    The students and builders behind {PROJECT_NAME} — an academic project verification
                                    platform for proposals, originality checks, and live project previews.
                                </p>
                                <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                                    <a
                                        href="#team"
                                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-7 py-3 text-sm font-bold text-white shadow-lg shadow-[#2a3fa4]/25"
                                        style={{ background: BRAND_GRADIENT }}
                                    >
                                        <Users className="h-4 w-4" />
                                        View graduation team
                                    </a>
                                    <Link
                                        to="/guide"
                                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-900 bg-white px-7 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50"
                                    >
                                        Platform guide
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Team grid */}
                    <section id="team" className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
                        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="max-w-xl">
                                <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                                    Graduation project team
                                </h2>
                                <p className="text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
                                    Educators, engineers, and visionaries working to secure academic futures.
                                </p>
                            </div>
                            <span className="inline-flex min-h-10 items-center gap-2 self-start rounded-2xl bg-white px-4 py-2 text-xs font-bold text-[#2a3fa4] ring-1 ring-slate-200">
                                <GraduationCap className="h-4 w-4" />
                                Group 11
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {team.map((member) => (
                                <article
                                    key={member.name}
                                    className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[32px]"
                                >
                                    <div className="relative aspect-[4/5] overflow-hidden bg-slate-100">
                                        <img
                                            src={member.image}
                                            alt={member.name}
                                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                        />
                                    </div>
                                    <div className="p-5">
                                        <h3 className="text-lg font-extrabold leading-snug text-slate-950 sm:text-xl">
                                            {member.name}
                                        </h3>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>

                    {/* Contact */}
                    <section id="careers" className="mx-auto max-w-[1200px] px-4 pb-10 sm:px-6 lg:px-8">
                        <div className="grid overflow-hidden rounded-[28px] border border-slate-200 bg-white sm:rounded-[36px] lg:grid-cols-2">
                            <div
                                className="relative min-h-[180px] sm:min-h-[240px]"
                                style={{
                                    background:
                                        'linear-gradient(135deg, rgba(42,63,164,0.92), rgba(29,104,227,0.85)), radial-gradient(circle at 30% 40%, #93c5fd 0%, transparent 55%)',
                                }}
                            >
                                <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
                                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-100">Contact</p>
                                    <p className="text-xl font-extrabold text-white sm:text-2xl">
                                        Talk to the {PROJECT_NAME} team
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center p-6 sm:p-10">
                                <h2 className="mb-3 text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">
                                    Questions, demos, or collaboration?
                                </h2>
                                <p className="mb-6 text-sm font-medium leading-relaxed text-slate-500">
                                    Reach out to the graduation project group. We are happy to discuss the platform,
                                    demos, or partnership ideas.
                                </p>
                                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                    <a
                                        href="https://mail.google.com/mail/?view=cm&fs=1&to=group11graduation@gmail.com&su=About%20Project%20Verify"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white"
                                        style={{ backgroundColor: BRAND.primary }}
                                    >
                                        <Mail className="h-4 w-4" />
                                        Contact the team
                                    </a>
                                    <a
                                        href="#team"
                                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
                                    >
                                        Back to team
                                    </a>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* CTA */}
                    <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6 lg:px-8">
                        <div
                            className="rounded-[28px] px-6 py-10 text-center sm:rounded-[36px] sm:px-10 sm:py-12"
                            style={{ background: BRAND_GRADIENT }}
                        >
                            <h2 className="mb-3 text-2xl font-extrabold text-white sm:text-3xl">Explore the platform</h2>
                            <p className="mx-auto mb-8 max-w-xl text-sm font-medium text-blue-100">
                                Read how verification works, or browse approved student projects from previous terms.
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
                                    Verified projects <ArrowUpRight className="h-4 w-4" />
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

export default StudentTeamAbout;
