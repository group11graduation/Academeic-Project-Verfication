import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Heart, TrendingUp } from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import StudentHeader from '../components/StudentHeader';

// Helper to get likes from localStorage
const getLikes = () => {
    try {
        return JSON.parse(localStorage.getItem('projectLikes') || '{}');
    } catch { return {}; }
};

const StudentGallery = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeCategory, setActiveCategory] = useState('ALL CATEGORIES');
    const [sortByLikes, setSortByLikes] = useState(false);
    const [likesData, setLikesData] = useState(getLikes());

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Listen for storage changes (when user likes from detail page and comes back)
    useEffect(() => {
        const handleStorage = () => setLikesData(getLikes());
        window.addEventListener('storage', handleStorage);
        // Also refresh on focus (same-tab navigation)
        const handleFocus = () => setLikesData(getLikes());
        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    // Refresh likes when component re-renders (e.g. navigating back)
    useEffect(() => {
        setLikesData(getLikes());
    }, [activeCategory, sortByLikes]);

    const handleAuthAction = () => {
        if (user) {
            navigate(`/${user.role}`);
        } else {
            navigate('/login');
        }
    };

    const categories = [
        'ALL CATEGORIES',
        'WEB DEVELOPMENT',
        'ARTIFICIAL INTELLIGENCE',
        'DATA SCIENCE',
        'MOBILE APPS',
        'CYBERSECURITY',
        'BLOCKCHAIN',
        'IOT'
    ];

    const projects = [
        {
            id: 1,
            title: 'Secure E-Vault',
            category: 'CYBERSECURITY',
            image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800',
            desc: 'A military-grade decentralized storage solution utilizing quantum-resistant encryption for secure data transfer.',
            author: null,
            tags: ['RUST', 'WEBCRYPTO', 'IPFS'],
            baseLikes: 24
        },
        {
            id: 2,
            title: 'AI Path Optimizer',
            category: 'ARTIFICIAL INTELLIGENCE',
            image: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&q=80&w=800',
            desc: 'Neural network model designed to optimize urban traffic flows in real-time, reducing carbon emissions.',
            author: null,
            tags: ['PYTHON', 'PYTORCH', 'GIS'],
            baseLikes: 41
        },
        {
            id: 3,
            title: 'Real-time Collab',
            category: 'WEB DEVELOPMENT',
            image: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=800',
            desc: 'High-performance workspace for global research teams featuring CRDT-based synchronized document editing.',
            author: null,
            tags: ['TYPESCRIPT', 'NEXT.JS', 'REDUX'],
            baseLikes: 33
        },
        {
            id: 4,
            title: 'Genome Explorer',
            category: 'DATA SCIENCE',
            image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800',
            desc: 'Advanced visualizer for mapping large-scale genomic datasets to identify potential hereditary outliers.',
            author: null,
            tags: ['R', 'D3.JS', 'C++'],
            baseLikes: 18
        },
        {
            id: 5,
            title: 'Campus Connect',
            category: 'MOBILE APPS',
            image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=800',
            desc: 'Hyper-local social platform for university campuses to facilitate peer tutoring and physical study groups.',
            author: null,
            tags: ['FLUTTER', 'FIREBASE', 'DART'],
            baseLikes: 56
        },
        {
            id: 6,
            title: 'Smart Grid Hub',
            category: 'IOT',
            image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800',
            desc: 'A sensor-driven edge computing node for monitoring decentralized renewable energy grids across remote areas.',
            author: null,
            tags: ['C++', 'ESP32', 'MQTT'],
            baseLikes: 12
        },
        {
            id: 7,
            title: 'Nomadic Flow',
            category: 'DATA SCIENCE',
            image: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&q=80&w=800',
            desc: 'Predictive analytics using satellite data to forecast water availability for pastoral communities.',
            author: 'Ashin Nedi',
            tags: ['PYTHON', 'TENSORFLOW', 'GIS'],
            baseLikes: 29
        },
        {
            id: 8,
            title: 'Ethical Ledger',
            category: 'BLOCKCHAIN',
            image: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&q=80&w=800',
            desc: 'A transparent blockchain framework for tracking non-profit donations undiluted from source to destination.',
            author: 'Mohamed Duale',
            tags: ['SOLIDITY', 'ETHEREUM', 'REACT'],
            baseLikes: 37
        },
        {
            id: 9,
            title: 'EduPortal VR',
            category: 'WEB DEVELOPMENT',
            image: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?auto=format&fit=crop&q=80&w=800',
            desc: 'Immersive virtual reality environments for remote laboratory experiments in high school chemistry.',
            author: 'Sarah Chen',
            tags: ['UNITY', 'C#', 'OCULUS SDK'],
            baseLikes: 45
        },
        {
            id: 10,
            title: 'AgroFly Mesh',
            category: 'IOT',
            image: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&q=80&w=800',
            desc: 'Autonomous drone swarm mesh network for precision agriculture in densely vegetated areas.',
            author: 'Hassan Warsame',
            tags: ['C++', 'ROS', 'LINUX'],
            baseLikes: 22
        },
        {
            id: 11,
            title: 'MediSurg AI',
            category: 'ARTIFICIAL INTELLIGENCE',
            image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=800',
            desc: 'Al-driven computer vision assistant for surgical residents to improve procedural accuracy during training.',
            author: 'Amina Yusuf',
            tags: ['OPENCV', 'RESNET', 'PYTORCH'],
            baseLikes: 63
        },
        {
            id: 12,
            title: 'QuantumKey',
            category: 'CYBERSECURITY',
            image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=800',
            desc: 'A novel key distribution protocol resistant to Shor\'s algorithm for secure academic communications.',
            author: 'Khalid Omar',
            tags: ['QISKIT', 'GO', 'CRYPTOGRAPHY'],
            baseLikes: 31
        }
    ];

    const getProjectLikes = (projId) => {
        const proj = projects.find(p => p.id === projId);
        const base = proj ? proj.baseLikes : 0;
        const userLike = likesData[projId] ? 1 : 0;
        return base + userLike;
    };

    let filteredProjects = activeCategory === 'ALL CATEGORIES' 
        ? [...projects] 
        : projects.filter(p => p.category === activeCategory);

    if (sortByLikes) {
        filteredProjects.sort((a, b) => getProjectLikes(b.id) - getProjectLikes(a.id));
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] font-sans text-slate-900 overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">
            {/* Standardized Header */}
            <StudentHeader />

            {/* Main Content */}
            <main className="pt-32 pb-12 px-6 max-w-[1536px] mx-auto">
                {/* Category Filters */}
                <div className="flex flex-wrap gap-3 mb-6">
                    {categories.map(cat => (
                        <button 
                            key={cat}
                            onClick={() => { setActiveCategory(cat); setSortByLikes(false); }}
                            className={`px-5 py-2.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                                activeCategory === cat && !sortByLikes
                                    ? 'bg-[#1D68E3] text-white shadow-md shadow-blue-200' 
                                    : 'bg-slate-100/80 text-slate-500 hover:bg-slate-200'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Sort by Likes Button */}
                <div className="flex gap-3 mb-12">
                    <button 
                        onClick={() => setSortByLikes(!sortByLikes)}
                        className={`px-5 py-2.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${
                            sortByLikes
                                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-200' 
                                : 'bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-200'
                        }`}
                    >
                        <TrendingUp className="h-3.5 w-3.5" />
                        MOST LIKED
                    </button>
                </div>

                <div className="mb-16">
                    <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-[1.1] mb-6 tracking-tight">
                        Explore <span className="text-[#1D68E3]">Student</span><br />Projects
                    </h1>
                    <p className="text-lg text-slate-500 font-medium max-w-2xl leading-relaxed">
                        A curated exhibit of breakthrough research, digital engineering, and creative problem solving from the next generation of academic pioneers.
                    </p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {filteredProjects.map(proj => {
                        const totalLikes = getProjectLikes(proj.id);
                        const isLiked = !!likesData[proj.id];
                        return (
                            <div key={proj.id} className="bg-white rounded-[24px] border border-slate-100 overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 flex flex-col h-full">
                                <Link to={`/gallery/${proj.id}`} className="relative h-[240px] overflow-hidden bg-slate-100 block">
                                    <img 
                                        src={proj.image} 
                                        alt={proj.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
                                    />
                                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-700 shadow-sm">
                                        {proj.category}
                                    </div>
                                    {/* Like count badge on image */}
                                    <div className={`absolute top-4 right-4 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-black shadow-sm flex items-center gap-1.5 transition-all ${
                                        isLiked 
                                            ? 'bg-rose-500 text-white' 
                                            : 'bg-white/95 text-slate-600'
                                    }`}>
                                        <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-white' : ''}`} />
                                        {totalLikes}
                                    </div>
                                </Link>
                                <div className="p-8 flex flex-col flex-grow">
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">{proj.title}</h3>
                                    {proj.author && (
                                        <p className="text-sm font-semibold text-slate-500 mb-4">By <span className="text-slate-700">{proj.author}</span></p>
                                    )}
                                    <p className="text-[15px] text-slate-600 leading-relaxed mb-8 flex-grow">
                                        {proj.desc}
                                    </p>
                                    
                                    <div className="flex flex-wrap gap-2 mb-8">
                                        {proj.tags.map(tag => (
                                            <span key={tag} className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] border border-slate-200 px-2.5 py-1 rounded-md">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-auto">
                                        <Link to={`/gallery/${proj.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#1D68E3] group-hover:gap-3 transition-all w-fit">
                                            View Details <ArrowRight className="h-4 w-4" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="py-24 text-center">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.25em]">YOU'VE REACHED THE END OF THE CURRENT EXHIBIT</p>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-slate-200 bg-[#FAFAFA]">
                <div className="max-w-[1536px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900">ProjectVerify</span>
                        <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase ml-2 hidden sm:inline">
                            &copy; 2024 ProjectVerify Curator. All rights reserved.
                        </span>
                    </div>

                    <nav className="flex flex-wrap justify-center gap-8">
                        <Link to="/about" className="text-[10px] font-black tracking-widest text-slate-400 uppercase hover:text-[#1D68E3] transition-colors">Privacy Policy</Link>
                        <Link to="/about" className="text-[10px] font-black tracking-widest text-slate-400 uppercase hover:text-[#1D68E3] transition-colors">Terms of Service</Link>
                        <Link to="/about" className="text-[10px] font-black tracking-widest text-slate-400 uppercase hover:text-[#1D68E3] transition-colors">Institutional Access</Link>
                        <Link to="/about" className="text-[10px] font-black tracking-widest text-slate-400 uppercase hover:text-[#1D68E3] transition-colors">Support</Link>
                    </nav>
                </div>
            </footer>
        </div>
    );
};

export default StudentGallery;
