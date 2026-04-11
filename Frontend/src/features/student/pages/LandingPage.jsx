import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Rocket, Sparkles, ShieldCheck, Zap, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import StudentHeader from '../components/StudentHeader';

const ACCENT = '#2a3fa4';
const ACCENT_SOFT = '#eef1fb';

const LandingPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-[#eef1fb] selection:text-[#1d2f82]">
            {/* Standardized Header */}
            <StudentHeader />

            {/* Hero Section */}
            <section className="pt-6 sm:pt-8 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto bg-white">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
                    <div className="space-y-5">
                        <div
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-slate-200/80 bg-white/80 text-[#2a3fa4]"
                            style={{ backgroundColor: `${ACCENT_SOFT}` }}
                        >
                            <Sparkles className="h-3 w-3" />
                            Powered by Somali AI
                        </div>

                        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight">
                            Hubi Mashruucaaga si <span style={{ color: ACCENT }}>Caalami ah</span>
                        </h1>

                        <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed max-w-lg">
                            ProjectVerify uses advanced machine learning to ensure academic integrity for Somali students. Submit your work with confidence and join a community committed to excellence.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 pt-1">
                            <button
                                type="button"
                                onClick={() => navigate(user ? '/student' : '/login')}
                                className="text-white px-5 py-2.5 rounded-[14px] text-sm font-semibold shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2"
                                style={{ backgroundColor: ACCENT, boxShadow: '0 8px 24px rgba(42,63,164,0.22)' }}
                            >
                                <Rocket className="h-4 w-4" /> Submit Project
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/about')}
                                className="bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-[14px] text-sm font-semibold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="w-4 h-4 rounded-full border-2 border-slate-600 flex items-center justify-center text-[9px]">i</span> Learn More
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        {/* Background Grid Pattern */}
                        <div className="absolute inset-0 -m-6 bg-[linear-gradient(to_right,rgba(42,63,164,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(42,63,164,0.07)_1px,transparent_1px)] bg-[size:2.5rem_2.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] z-0" />

                        <div className="relative z-10 rounded-[22px] overflow-hidden shadow-[0_20px_50px_rgba(15,23,42,0.12)] border border-slate-200/80">
                            <img src="https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&q=80&w=1000" alt="Students collaborating" className="w-full h-[280px] sm:h-[320px] lg:h-[340px] object-cover" />
                        </div>

                        {/* Floating Badge */}
                        <div className="absolute -bottom-4 -left-2 sm:-left-4 bg-white p-3.5 sm:p-4 rounded-xl shadow-lg border border-slate-100 z-20 max-w-[220px] sm:max-w-xs">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <span className="font-bold text-sm text-slate-900">98% Accuracy</span>
                            </div>
                            <p className="text-[11px] font-medium text-slate-500 leading-snug">Trusted by over 10 universities across Somalia.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Latest News */}
            <section className="py-12 px-4 sm:px-6 lg:px-8 bg-[#f4f7ff] border-t border-[#e2e8f0]/60">
                <div className="max-w-[1600px] mx-auto">
                    <div className="flex justify-between items-end mb-8 gap-4">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1">Latest News</h2>
                            <p className="text-sm text-slate-500 font-medium">Updates from the Somali academic community</p>
                        </div>
                        <a href="#" className="font-semibold text-xs tracking-wide hidden sm:block hover:underline" style={{ color: ACCENT }}>View All &rarr;</a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
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
                            <div key={i} className="group cursor-pointer rounded-[18px] border border-white/80 bg-white p-3 shadow-[0_4px_20px_rgba(29,47,130,0.06)] hover:shadow-[0_8px_28px_rgba(29,47,130,0.1)] transition-shadow">
                                <div className="relative rounded-xl overflow-hidden aspect-[16/10] mb-3">
                                    <img src={news.img} alt={news.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    <div
                                        className="absolute top-2.5 left-2.5 text-white text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full"
                                        style={{ backgroundColor: ACCENT }}
                                    >
                                        {news.badge}
                                    </div>
                                </div>
                                <h3 className="text-base font-bold text-slate-900 mb-1">{news.title}</h3>
                                <p className="text-xs text-slate-500 leading-relaxed">{news.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white border-t border-[#e2e8f0]/60">
                <div className="max-w-[1600px] mx-auto">
                    <div className="mb-8">
                        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">Maxaad u dooranaysaa ProjectVerify?</h2>
                        <p className="text-sm sm:text-base text-slate-500 font-medium max-w-2xl">
                            Empowering students with tools that foster honesty and technical excellence in the Somali educational landscape.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
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
                            <div key={i} className="bg-white p-5 rounded-[18px] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                                    style={{ backgroundColor: ACCENT_SOFT, color: ACCENT }}
                                >
                                    <feat.icon className="h-5 w-5" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900 mb-2">{feat.title}</h3>
                                <p className="text-xs text-slate-500 leading-relaxed">{feat.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white border-t border-[#e2e8f0]/60">
                <div className="max-w-[1600px] mx-auto bg-[#1d2f82] rounded-[22px] p-8 lg:p-10 flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-[0_20px_50px_rgba(29,47,130,0.25)]">
                    <div className="absolute top-0 right-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.04)_50%,transparent_75%)] bg-[length:16px_16px]" />

                    <div className="relative z-10 max-w-xl">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-3">
                            Ma u diyaarsan tahay inaad hubiso mashruucaaga?
                        </h2>
                        <p className="text-slate-300 text-sm sm:text-base mb-6 leading-relaxed">
                            Ku biir kumanaan arday Soomaaliyeed ah oo isticmaalaya ProjectVerify si ay u hubiyaan tayada iyo asalka shaqadooda.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={() => navigate(user ? '/student' : '/login')}
                                className="text-[#1d2f82] px-5 py-2.5 rounded-[14px] text-sm font-semibold bg-white hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Rocket className="h-4 w-4" /> Submit Now
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/gallery')}
                                className="bg-white/10 text-white hover:bg-white/15 px-5 py-2.5 rounded-[14px] text-sm font-semibold transition-colors flex items-center justify-center gap-2 border border-white/15"
                            >
                                <ArrowRight className="h-4 w-4" /> View Gallery
                            </button>
                        </div>
                    </div>

                    <div className="relative z-10 grid grid-cols-2 gap-3 w-full lg:w-[46%] max-w-md lg:max-w-none">
                        {[
                            { val: '5K+', label: 'PROJECTS VERIFIED', muted: true },
                            { val: '10+', label: 'UNIVERSITIES', muted: false },
                            { val: '24/7', label: 'AI SUPPORT', muted: true },
                            { val: '100%', label: 'SECURE DATA', muted: true }
                        ].map((stat, i) => (
                            <div
                                key={i}
                                className={`p-4 lg:p-5 rounded-[16px] flex flex-col items-center justify-center text-center border border-white/10 ${stat.muted ? 'bg-white/5' : ''}`}
                                style={stat.muted ? undefined : { backgroundColor: ACCENT }}
                            >
                                <h3 className="text-xl lg:text-2xl font-extrabold text-white mb-1">{stat.val}</h3>
                                <p className="text-[9px] uppercase tracking-widest font-bold text-slate-300">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-[#e2e8f0]/60 bg-[#f4f7ff]">
                <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
                            <ShieldCheck className="text-white h-4 w-4" />
                        </div>
                        <span className="font-bold text-sm text-slate-900">ProjectVerify</span>
                    </div>

                    <nav className="flex flex-wrap justify-center gap-4">
                        <a href="#" className="text-[11px] font-semibold text-slate-500 transition-colors hover:text-[#2a3fa4]">Home</a>
                        <Link to="/about" className="text-[11px] font-semibold text-slate-500 transition-colors hover:text-[#2a3fa4]">About Us</Link>
                        <a href="#" className="text-[11px] font-semibold text-slate-500 transition-colors hover:text-[#2a3fa4]">Terms of Service</a>
                        <a href="#" className="text-[11px] font-semibold text-slate-500 transition-colors hover:text-[#2a3fa4]">Privacy Policy</a>
                        <a href="#" className="text-[11px] font-semibold text-slate-500 transition-colors hover:text-[#2a3fa4]">Contact</a>
                    </nav>

                    <p className="text-[11px] font-medium text-slate-400">
                        &copy; 2024 ProjectVerify. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
