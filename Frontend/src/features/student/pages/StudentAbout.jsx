import React from 'react';
import { Search, Scale, Sparkles, Cpu, Database, Linkedin, Github } from 'lucide-react';
import StudentPublicShell from '../layouts/StudentPublicShell';
import PublicSiteFooter from '../../../shared/components/PublicSiteFooter';
import { PROJECT_NAME } from '../../../shared/ui/brandTheme';

const StudentAbout = () => {
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

    return (
        <StudentPublicShell>
        <div className="min-h-screen overflow-x-hidden bg-[#f8faff] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900 dark:bg-[#020617] dark:text-slate-100">

            {/* Hero Section */}
            <section className="pt-24 pb-16 px-6">
                <div className="max-w-[1400px] mx-auto">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2a3fa4] mb-4">Platform guide</p>
                    <h1 className="mb-4 max-w-3xl text-4xl font-black leading-tight text-slate-900 dark:text-slate-100 md:text-5xl">
                        How {PROJECT_NAME} works for your institution
                    </h1>
                    <p className="mb-10 max-w-2xl text-lg font-medium text-slate-600 dark:text-slate-300">
                        Detailed reference for students, teachers, and admins — integrity checks, workflows, and preview sandboxes.
                    </p>
                </div>
            </section>

            {/* Mission Section */}
            <section className="bg-slate-50 px-6 py-24 dark:bg-[#0b1220]">
                <div className="max-w-[1536px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 bg-blue-100/50 text-[#1D68E3] px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-blue-200/50">
                            <Search className="h-3.5 w-3.5" />
                            Our Mission
                        </div>
                        
                        <h2 className="text-4xl font-black leading-tight text-slate-900 dark:text-slate-100 md:text-5xl">
                            Fostering Honesty in Academic Projects
                        </h2>
                        
                        <div className="space-y-6 text-lg font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                            <p>
                                {PROJECT_NAME} was founded on the core principle that original ideas deserve protection. In an era where digital content is easily replicated, our platform ensures that student work remains unique and authentic.
                            </p>
                            <p>
                                We aim to discourage academic misconduct by providing institutions and students with the tools to verify originality, encouraging genuine learning through the process of creation rather than duplication.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-6 pt-6">
                            <div className="flex gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111827]">
                                <div className="text-[#1D68E3] bg-blue-50 p-3 rounded-2xl h-fit">
                                    <Sparkles className="h-6 w-6" />
                                </div>
                                <div>
                                    <h4 className="mb-1 font-bold text-slate-900 dark:text-slate-100">Originality</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Promoting unique research</p>
                                </div>
                            </div>
                            <div className="flex gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111827]">
                                <div className="text-purple-600 bg-purple-50 p-3 rounded-2xl h-fit">
                                    <Scale className="h-6 w-6" />
                                </div>
                                <div>
                                    <h4 className="mb-1 font-bold text-slate-900 dark:text-slate-100">Equality</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Fair grading for all students</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative lg:h-[600px] flex items-center justify-center">
                        {/* Decorative blob behind the card */}
                        <div className="absolute inset-0 rounded-[60px] bg-blue-100/40 blur-sm transform -rotate-6 scale-105 dark:bg-blue-500/10"></div>
                        <div className="absolute inset-0 rounded-[60px] bg-slate-200/30 blur-sm transform rotate-3 scale-105 dark:bg-slate-700/20"></div>

                        {/* UI Mockup Card */}
                        <div className="group relative w-full max-w-md overflow-hidden rounded-[40px] border border-slate-100 bg-white p-8 pt-10 shadow-2xl shadow-slate-200/50 dark:border-white/10 dark:bg-[#111827] dark:shadow-none">
                           {/* Subtle grid background on the card */}
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-30 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)]"></div>
                            
                            <div className="relative z-10 space-y-8">
                                <div className="flex justify-between items-end">
                                    <h3 className="text-[#1D68E3] font-black text-xl tracking-tight">Originality Score</h3>
                                    <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                                        98% Unique
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Progress Bar Container */}
                                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                        <div className="h-full bg-blue-600 w-[98%] rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
                                    </div>
                                    
                                    {/* Skeleton Text Lines */}
                                    <div className="space-y-2.5 pt-4">
                                        <div className="h-3 w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-800"></div>
                                        <div className="delay-75 h-3 w-[85%] animate-pulse rounded-md bg-slate-100 dark:bg-slate-800"></div>
                                        <div className="delay-150 h-3 w-[92%] animate-pulse rounded-md bg-slate-100 dark:bg-slate-800"></div>
                                        <div className="delay-200 h-3 w-[78%] animate-pulse rounded-md bg-slate-100 dark:bg-slate-800"></div>
                                    </div>
                                </div>

                                <div className="mt-8 flex items-center gap-3 border-t border-slate-100 pt-6 dark:border-white/10">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Verified by NLP Engine</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Technology Section */}
            <section id="technology" className="bg-white px-6 py-32 dark:bg-[#020617]">
                <div className="max-w-[1536px] mx-auto">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h2 className="mb-6 text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">Advanced ML & NLP Technology</h2>
                        <p className="text-xl font-medium text-slate-500 dark:text-slate-300">
                            Our proprietary algorithms analyze semantic patterns beyond simple keyword matching to identify sophisticated project duplication.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Search,
                                title: 'Semantic Analysis',
                                desc: 'We utilize Natural Language Processing to understand the context and meaning of technical documentation, spotting rephrased content.',
                                color: 'text-blue-600',
                                bg: 'bg-blue-50'
                            },
                            {
                                icon: Cpu,
                                title: 'Structure Verification',
                                desc: 'Machine Learning models compare the underlying structural blueprints of technical projects to detect structural mimics.',
                                color: 'text-indigo-600',
                                bg: 'bg-indigo-50'
                            },
                            {
                                icon: Database,
                                title: 'Global Repository',
                                desc: 'Cross-referencing against a massive database of historical student projects to prevent multi-year duplication cycles.',
                                color: 'text-emerald-600',
                                bg: 'bg-emerald-50'
                            }
                        ].map((feature, i) => (
                            <div key={i} className="group rounded-[40px] border border-slate-100 bg-slate-50 p-10 transition-all duration-300 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 dark:border-white/10 dark:bg-[#0f172a] dark:hover:bg-[#111827] dark:hover:shadow-none">
                                <div className={`w-16 h-16 ${feature.bg} ${feature.color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                                    <feature.icon className="h-8 w-8" />
                                </div>
                                <h3 className="mb-4 text-2xl font-black text-slate-900 dark:text-slate-100">{feature.title}</h3>
                                <p className="font-medium leading-relaxed text-slate-500 dark:text-slate-300">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Team Section */}
            <section id="team" className="bg-slate-50 px-6 py-32 dark:bg-[#0b1220]">
                <div className="max-w-[1536px] mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
                        <div className="max-w-xl">
                            <h2 className="mb-4 text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">Meet the Team</h2>
                            <p className="text-lg font-medium text-slate-500 dark:text-slate-300">
                                The educators, engineers, and visionaries working to secure academic futures.
                            </p>
                        </div>
                        <a href="#careers" className="text-[#1D68E3] font-black text-sm flex items-center gap-2 hover:underline group">
                            View Careers <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </a>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {team.map((member, i) => (
                            <div key={i} className="group cursor-pointer">
                                <div className="relative mb-6 aspect-[4/5] overflow-hidden rounded-[32px] bg-slate-200 dark:bg-slate-800">
                                    <img 
                                        src={member.image} 
                                        alt={member.name} 
                                        className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                                    />
                                </div>
                                <h3 className="mb-1 text-2xl font-black text-slate-900 dark:text-slate-100">{member.name}</h3>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="careers" className="px-6 pb-24">
                <div className="mx-auto max-w-[1100px] rounded-[32px] border border-slate-200 bg-white px-8 py-10 shadow-sm dark:border-white/10 dark:bg-[#111827]">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2a3fa4]">Careers</p>
                    <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
                        Join the Project Verify team
                    </h2>
                    <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-slate-500 dark:text-slate-300">
                        We are always happy to connect with students and developers who care about academic integrity,
                        originality, and better education systems.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <a
                            href="https://mail.google.com/mail/?view=cm&fs=1&to=group11graduation@gmail.com&su=Careers%20at%20Project%20Verify"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-[#2a3fa4] px-5 py-3 text-sm font-bold text-white hover:bg-[#223688]"
                        >
                            Contact the team
                        </a>
                        <a
                            href="#team"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100 dark:hover:bg-[#1f2937]"
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

export default StudentAbout;
