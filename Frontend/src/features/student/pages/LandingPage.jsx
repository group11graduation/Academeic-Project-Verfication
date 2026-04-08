import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Rocket, 
    Sparkles, 
    ShieldCheck, 
    Zap, 
    ChevronRight,
    ArrowRight,
    User as UserIcon,
    LogOut
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import StudentHeader from '../components/StudentHeader';

const LandingPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
            {/* Standardized Header */}
            <StudentHeader />

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6 max-w-[1536px] mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 bg-blue-50 text-[#1D68E3] px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest">
                            <Sparkles className="h-3.5 w-3.5" />
                            Powered by Somali AI
                        </div>
                        
                        <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-[1.1] tracking-tight">
                            Hubi Mashruucaaga si <span className="text-[#1D68E3]">Caalami ah</span>
                        </h1>
                        
                        <p className="text-lg text-slate-600 font-medium leading-relaxed max-w-lg">
                            ProjectVerify uses advanced machine learning to ensure academic integrity for Somali students. Submit your work with confidence and join a community committed to excellence.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <button className="bg-[#1D68E3] text-white px-8 py-3.5 rounded-xl font-bold hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center gap-2">
                                <Rocket className="h-5 w-5" /> Submit Project
                            </button>
                            <button className="bg-white text-slate-700 border border-slate-200 px-8 py-3.5 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                                <span className="w-5 h-5 rounded-full border-2 border-slate-700 flex items-center justify-center text-xs">i</span> Learn More
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        {/* Background Grid Pattern */}
                        <div className="absolute inset-0 -m-10 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] z-0"></div>
                        
                        <div className="relative z-10 rounded-[32px] overflow-hidden shadow-2xl">
                            <img src="https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&q=80&w=1000" alt="Students collaborating" className="w-full h-[500px] object-cover" />
                        </div>

                        {/* Floating Badge */}
                        <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-2xl shadow-xl border border-slate-100 z-20 max-w-xs">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <span className="font-black text-slate-900">98% Accuracy</span>
                            </div>
                            <p className="text-xs font-semibold text-slate-500">Trusted by over 10 universities across Somalia.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Latest News */}
            <section className="py-20 px-6 bg-white">
                <div className="max-w-[1536px] mx-auto">
                    <div className="flex justify-between items-end mb-12">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 mb-2">Latest News</h2>
                            <p className="text-slate-500 font-medium">Updates from the Somali academic community</p>
                        </div>
                        <a href="#" className="text-[#1D68E3] font-bold text-sm tracking-wide hidden sm:block">View All &rarr;</a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                img: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=600',
                                badge: 'WORKSHOP',
                                title: 'AI Workshop 2024',
                                desc: 'Join us for a deep dive into Machine Learning applications in education.'
                            },
                            {
                                img: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=600',
                                badge: 'EXPANSION',
                                title: 'University Partnership',
                                desc: 'Expanding our reach across various regions to support more students.'
                            },
                            {
                                img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=600',
                                badge: 'SUCCESS',
                                title: 'Monthly Highlights',
                                desc: 'Celebrating student innovation and integrity in academic work.'
                            }
                        ].map((news, i) => (
                            <div key={i} className="group cursor-pointer">
                                <div className="relative rounded-2xl overflow-hidden aspect-[16/10] mb-4">
                                    <img src={news.img} alt={news.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    <div className="absolute top-4 left-4 bg-[#1D68E3] text-white text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full">
                                        {news.badge}
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">{news.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{news.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24 px-6 bg-[#F8FAFB]">
                <div className="max-w-[1536px] mx-auto">
                    <div className="mb-16">
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">Maxaad u dooranaysaa ProjectVerify?</h2>
                        <p className="text-lg text-slate-500 font-medium max-w-2xl">
                            Empowering students with tools that foster honesty and technical excellence in the Somali educational landscape.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Rocket,
                                title: 'Machine Learning',
                                desc: 'Advanced algorithms designed to analyze project structures and provide deep insights into technical originality.'
                            },
                            {
                                icon: ShieldCheck,
                                title: 'Academic Integrity',
                                desc: 'Building a culture of trust and merit within the Somali education system to ensure every student\'s hard work counts.'
                            },
                            {
                                icon: Zap,
                                title: 'Instant Feedback',
                                desc: 'Submit your work and receive comprehensive reports in seconds, allowing for quick adjustments before final submission.'
                            }
                        ].map((feat, i) => (
                            <div key={i} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 bg-blue-50 text-[#1D68E3] rounded-xl flex items-center justify-center mb-6">
                                    <feat.icon className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{feat.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{feat.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-6">
                <div className="max-w-[1536px] mx-auto bg-[#1E293B] rounded-[40px] p-12 lg:p-16 flex flex-col lg:flex-row items-center justify-between gap-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-[length:20px_20px]"></div>
                    
                    <div className="relative z-10 max-w-xl">
                        <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
                            Ma u diyaarsan tahay inaad hubiso mashruucaaga?
                        </h2>
                        <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                            Ku biir kumanaan arday Soomaaliyeed ah oo isticmaalaya ProjectVerify si ay u hubiyaan tayada iyo asalka shaqadooda.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button className="bg-[#1D68E3] text-white px-8 py-3.5 rounded-xl font-bold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
                                <Rocket className="h-5 w-5" /> Submit Now
                            </button>
                            <button className="bg-white/10 text-white hover:bg-white/20 px-8 py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                                <ArrowRight className="h-5 w-5" /> View Gallery
                            </button>
                        </div>
                    </div>

                    <div className="relative z-10 grid grid-cols-2 gap-4 lg:w-1/2">
                        {[
                            { val: '5K+', label: 'PROJECTS VERIFIED', bg: 'bg-[#2A3648]' },
                            { val: '10+', label: 'UNIVERSITIES', bg: 'bg-[#1D68E3]' },
                            { val: '24/7', label: 'AI SUPPORT', bg: 'bg-[#2A3648]' },
                            { val: '100%', label: 'SECURE DATA', bg: 'bg-[#2A3648]' }
                        ].map((stat, i) => (
                            <div key={i} className={`${stat.bg} p-6 lg:py-10 rounded-3xl flex flex-col items-center justify-center text-center`}>
                                <h3 className="text-3xl font-black text-white mb-2">{stat.val}</h3>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-300">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-slate-100 bg-white">
                <div className="max-w-[1536px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#1D68E3] rounded-lg flex items-center justify-center">
                            <ShieldCheck className="text-white h-5 w-5" />
                        </div>
                        <span className="font-black text-slate-900">ProjectVerify</span>
                    </div>

                    <nav className="flex flex-wrap justify-center gap-6">
                        <a href="#" className="text-xs font-bold text-slate-500 hover:text-[#1D68E3]">Home</a>
                        <Link to="/about" className="text-xs font-bold text-slate-500 hover:text-[#1D68E3]">About Us</Link>
                        <a href="#" className="text-xs font-bold text-slate-500 hover:text-[#1D68E3]">Terms of Service</a>
                        <a href="#" className="text-xs font-bold text-slate-500 hover:text-[#1D68E3]">Privacy Policy</a>
                        <a href="#" className="text-xs font-bold text-slate-500 hover:text-[#1D68E3]">Contact</a>
                    </nav>

                    <p className="text-xs font-semibold text-slate-400">
                        &copy; 2024 ProjectVerify. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
