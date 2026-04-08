import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
    Rocket,
    LayoutDashboard,
    BookOpen,
    FileText,
    Users,
    LogOut,
    Settings,
    Bell
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';

const StudentHeader = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const navItems = [
        { label: 'HOME', path: '/' },
        { label: 'GALLERY', path: '/gallery' },
        { label: 'MY PROJECTS', path: '/student', end: true },
        { label: 'ASSIGNMENTS', path: '/assignments' },
        { label: 'ABOUT', path: '/about' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
            <div className="max-w-[1600px] mx-auto px-8 h-24 flex items-center justify-between">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-3 min-w-[200px]">
                    <div className="w-10 h-10 bg-[#1D68E3] rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
                        <Rocket className="text-white h-6 w-6" />
                    </div>
                    <span className="text-[22px] font-black text-[#0F172A] tracking-tighter hidden sm:block">
                        ProjectVerify
                    </span>
                </Link>

                {/* Centered Navigation */}
                <nav className="hidden lg:flex items-center gap-12 h-full">
                    {navItems.map((item, i) => (
                        <NavLink
                            key={i}
                            to={item.path}
                            end={item.end || item.path === '/'}
                            className={({ isActive }) => `
                                relative h-full flex items-center text-[13px] font-black tracking-[0.1em] transition-all
                                ${isActive
                                    ? 'text-[#1D68E3]'
                                    : 'text-slate-400 hover:text-slate-600'}
                            `}
                        >
                            {({ isActive }) => (
                                <>
                                    <span>{item.label}</span>
                                    {isActive && (
                                        <div className="absolute -bottom-1 left-0 right-0 h-[3px] bg-[#1D68E3] rounded-full scale-x-110"></div>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Profile and Actions */}
                <div className="flex items-center gap-3 min-w-[200px] justify-end">
                    {user ? (
                        <div className="flex items-center gap-3">
                            <Link 
                                to="/student/profile"
                                className="w-11 h-11 rounded-full overflow-hidden border-2 border-white shadow-sm hover:shadow-lg hover:border-blue-200 transition-all active:scale-95 group relative"
                                title="My Profile"
                            >
                                <img 
                                    src={user.photo || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e"} 
                                    alt="Profile" 
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors"></div>
                            </Link>
                            
                            <button 
                                onClick={handleLogout}
                                className="group w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 border border-slate-100 hover:border-rose-100 transition-all active:scale-90 shadow-sm hover:shadow-md"
                                title="Logout"
                            >
                                <div className="relative">
                                    <LogOut className="h-5 w-5 transition-transform group-hover:rotate-12" />
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </div>
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => navigate('/login')}
                            className="bg-[#1D68E3] text-white px-8 py-2.5 rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <Rocket className="h-4 w-4" />
                            <span>LOGIN</span>
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default StudentHeader;
