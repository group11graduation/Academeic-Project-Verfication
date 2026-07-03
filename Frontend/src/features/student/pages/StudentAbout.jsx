import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Rocket, Search, Scale, Shield, ShieldCheck, Sparkles, Cpu, Database,
    Zap, BrainCircuit, Globe, BookOpen,
    Users, Medal, FileText, Linkedin, Twitter, Github
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import StudentPublicShell from '../layouts/StudentPublicShell';
import PublicSiteFooter from '../../../shared/components/PublicSiteFooter';

const StudentAbout = () => {
    const { user } = useAuth();

    const team = [
        {
            name: 'Dr. Sarah Chen',
            role: 'Founder & Chief Ethics Officer',
            image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=600'
        },
        {
            name: 'Marcus Thorne',
            role: 'Lead ML Architect',
            image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=600'
        },
        {
            name: 'Elena Rodriguez',
            role: 'Head of Product Design',
            image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=600'
        },
        {
            name: 'David Kim',
            role: 'Senior NLP Engineer',
            image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=600'
        }
    ];

    return (
        <StudentPublicShell>
        <div className="min-h-screen bg-[#f8faff] font-sans text-slate-900 overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">

            {/* Hero Section */}
            <section className="pt-24 pb-16 px-6">
                <div className="max-w-[1400px] mx-auto">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2a3fa4] mb-4">Platform guide</p>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-4 max-w-3xl">
                        How ScholarVerify works for your institution
                    </h1>
                    <p className="text-lg text-slate-600 font-medium max-w-2xl mb-10">
                        Detailed reference for students, teachers, and admins — integrity checks, workflows, and preview sandboxes.
                    </p>
                </div>
            </section>

            {/* Mission Section */}
            <section className="py-24 px-6 bg-slate-50">
                <div className="max-w-[1536px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 bg-blue-100/50 text-[#1D68E3] px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-blue-200/50">
                            <Search className="h-3.5 w-3.5" />
                            Our Mission
                        </div>
                        
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">
                            Fostering Honesty in Academic Projects
                        </h2>
                        
                        <div className="space-y-6 text-lg text-slate-600 font-medium leading-relaxed">
                            <p>
                                ScholarVerify was founded on the core principle that original ideas deserve protection. In an era where digital content is easily replicated, our platform ensures that student work remains unique and authentic.
                            </p>
                            <p>
                                We aim to discourage academic misconduct by providing institutions and students with the tools to verify originality, encouraging genuine learning through the process of creation rather than duplication.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-6 pt-6">
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex gap-4">
                                <div className="text-[#1D68E3] bg-blue-50 p-3 rounded-2xl h-fit">
                                    <Sparkles className="h-6 w-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 mb-1">Originality</h4>
                                    <p className="text-sm text-slate-500">Promoting unique research</p>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex gap-4">
                                <div className="text-purple-600 bg-purple-50 p-3 rounded-2xl h-fit">
                                    <Scale className="h-6 w-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 mb-1">Equality</h4>
                                    <p className="text-sm text-slate-500">Fair grading for all students</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative lg:h-[600px] flex items-center justify-center">
                        {/* Decorative blob behind the card */}
                        <div className="absolute inset-0 bg-blue-100/40 rounded-[60px] transform -rotate-6 scale-105 blur-sm"></div>
                        <div className="absolute inset-0 bg-slate-200/30 rounded-[60px] transform rotate-3 scale-105 blur-sm"></div>

                        {/* UI Mockup Card */}
                        <div className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100 p-8 pt-10 overflow-hidden group">
                           {/* Subtle grid background on the card */}
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-30"></div>
                            
                            <div className="relative z-10 space-y-8">
                                <div className="flex justify-between items-end">
                                    <h3 className="text-[#1D68E3] font-black text-xl tracking-tight">Originality Score</h3>
                                    <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                                        98% Unique
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Progress Bar Container */}
                                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600 w-[98%] rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
                                    </div>
                                    
                                    {/* Skeleton Text Lines */}
                                    <div className="space-y-2.5 pt-4">
                                        <div className="h-3 bg-slate-100 rounded-md w-full animate-pulse"></div>
                                        <div className="h-3 bg-slate-100 rounded-md w-[85%] animate-pulse delay-75"></div>
                                        <div className="h-3 bg-slate-100 rounded-md w-[92%] animate-pulse delay-150"></div>
                                        <div className="h-3 bg-slate-100 rounded-md w-[78%] animate-pulse delay-200"></div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-bold text-slate-600">Verified by NLP Engine</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Technology Section */}
            <section id="technology" className="py-32 px-6 bg-white">
                <div className="max-w-[1536px] mx-auto">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">Advanced ML & NLP Technology</h2>
                        <p className="text-xl text-slate-500 font-medium">
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
                            <div key={i} className="bg-slate-50 p-10 rounded-[40px] border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group">
                                <div className={`w-16 h-16 ${feature.bg} ${feature.color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                                    <feature.icon className="h-8 w-8" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-4">{feature.title}</h3>
                                <p className="text-slate-500 font-medium leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Team Section */}
            <section id="team" className="py-32 px-6 bg-slate-50">
                <div className="max-w-[1536px] mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
                        <div className="max-w-xl">
                            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Meet the Team</h2>
                            <p className="text-lg text-slate-500 font-medium">
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
                                <div className="relative rounded-[32px] overflow-hidden aspect-[4/5] mb-6 bg-slate-200">
                                    <img 
                                        src={member.image} 
                                        alt={member.name} 
                                        className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
                                    />
                                    {/* Hover overlay with social links */}
                                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                        <button className="w-10 h-10 bg-white/20 hover:bg-white rounded-full flex items-center justify-center text-white hover:text-slate-900 backdrop-blur-sm transition-all"><Linkedin className="h-4 w-4" /></button>
                                        <button className="w-10 h-10 bg-white/20 hover:bg-white rounded-full flex items-center justify-center text-white hover:text-slate-900 backdrop-blur-sm transition-all"><Github className="h-4 w-4" /></button>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-1">{member.name}</h3>
                                <p className="text-[#1D68E3] font-bold text-sm tracking-wide">{member.role}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <PublicSiteFooter />
        </div>
        </StudentPublicShell>
    );
};

export default StudentAbout;
