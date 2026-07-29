import React from 'react';
import StudentPublicShell from '../layouts/StudentPublicShell';
import PublicSiteFooter from '../../../shared/components/PublicSiteFooter';
import { PROJECT_NAME } from '../../../shared/ui/brandTheme';

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
            <div className="min-h-screen overflow-x-hidden bg-[#f8faff] font-sans text-[var(--sv-text)] selection:bg-blue-100 selection:text-blue-900 dark:bg-[#020617] dark:text-slate-100">
                <section className="px-6 pb-10 pt-24">
                    <div className="mx-auto max-w-[1400px]">
                        <p className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-[#2a3fa4]">About</p>
                        <h1 className="mb-4 max-w-3xl text-4xl font-black leading-tight text-[var(--sv-text)] dark:text-slate-100 md:text-5xl">
                            Meet the Team
                        </h1>
                        <p className="max-w-2xl text-lg font-medium text-[var(--sv-muted)] dark:text-slate-300">
                            The students and builders behind {PROJECT_NAME} - an academic project verification platform
                            for proposals, originality checks, and live project previews.
                        </p>
                    </div>
                </section>

                <section id="team" className="bg-[var(--sv-card-muted)] px-6 py-20 dark:bg-[#0b1220]">
                    <div className="mx-auto max-w-[1536px]">
                        <div className="mb-12 max-w-xl">
                            <h2 className="mb-3 text-2xl font-black tracking-tight text-[var(--sv-text)] dark:text-slate-100 md:text-3xl">
                                Graduation project team
                            </h2>
                            <p className="text-base font-medium text-[var(--sv-muted)] dark:text-slate-300">
                                Educators, engineers, and visionaries working to secure academic futures.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                            {team.map((member) => (
                                <div key={member.name} className="group">
                                    <div className="relative mb-6 aspect-[4/5] overflow-hidden rounded-[32px] bg-slate-200 dark:bg-slate-800">
                                        <img
                                            src={member.image}
                                            alt={member.name}
                                            className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
                                        />
                                    </div>
                                    <h3 className="mb-1 text-2xl font-black text-[var(--sv-text)] dark:text-slate-100">
                                        {member.name}
                                    </h3>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="careers" className="px-6 py-16">
                    <div className="mx-auto max-w-[1100px] rounded-[32px] border border-[var(--sv-border)] bg-[var(--sv-card)] px-8 py-10 shadow-sm dark:border-white/10 dark:bg-[#111827]">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2a3fa4]">Contact</p>
                        <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--sv-text)] dark:text-slate-100 md:text-4xl">
                            Talk to the {PROJECT_NAME} team
                        </h2>
                        <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-[var(--sv-muted)] dark:text-slate-300">
                            Questions about the platform, demos, or collaboration? Reach out to the graduation project
                            group.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <a
                                href="https://mail.google.com/mail/?view=cm&fs=1&to=group11graduation@gmail.com&su=About%20Project%20Verify"
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl bg-[#2a3fa4] px-5 py-3 text-sm font-bold text-white hover:bg-[#223688]"
                            >
                                Contact the team
                            </a>
                            <a
                                href="#team"
                                className="inline-flex items-center gap-2 rounded-xl border border-[var(--sv-border)] bg-[var(--sv-card)] px-5 py-3 text-sm font-bold text-[var(--sv-text)] hover:bg-[var(--sv-card-muted)] dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100 dark:hover:bg-[#1f2937]"
                            >
                                Back to team
                            </a>
                        </div>
                    </div>
                </section>

                <PublicSiteFooter />
            </div>
        </StudentPublicShell>
    );
};

export default StudentTeamAbout;
