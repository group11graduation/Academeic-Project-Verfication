import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
    Rocket,
    BookOpen,
    GalleryHorizontal,
    Home,
    LogOut,
    Bell,
    Search,
    UserRound
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';

const StudentHeader = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const accent = '#2a3fa4';

    const navItems = [
        { label: 'Home', path: '/', icon: Home },
        { label: 'Gallery', path: '/gallery', icon: GalleryHorizontal },
        { label: 'My Projects', path: '/student', end: true, icon: Rocket },
        { label: 'Assignments', path: '/student/assignments', icon: BookOpen },
    ];

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 border-b border-slate-100">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
                <div className="min-h-[56px] h-14 sm:h-[58px] rounded-2xl border border-slate-200/90 bg-[#fafbff] shadow-[0_4px_20px_rgba(29,47,130,0.05)] px-3 sm:px-4 lg:px-5 flex items-center justify-between gap-2 sm:gap-3">
                    <Link to="/" className="flex items-center gap-2 min-w-fit shrink-0">
                        <div
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                            style={{ backgroundColor: accent }}
                        >
                            <Rocket className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                        </div>
                        <span className="hidden md:block text-[15px] font-extrabold tracking-tight text-slate-900">ProjectVerify</span>
                    </Link>

                    <nav className="hidden lg:flex flex-1 justify-center max-w-2xl mx-2 items-center rounded-[12px] border border-slate-200/80 bg-white px-1.5 py-1 gap-0.5 shadow-sm">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    end={item.end || item.path === '/'}
                                    className={({ isActive }) =>
                                        `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[13px] font-bold transition-all ${
                                            isActive ? 'text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                        }`
                                    }
                                    style={({ isActive }) => (isActive ? { backgroundColor: accent } : undefined)}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    {item.label}
                                </NavLink>
                            );
                        })}
                    </nav>

                    {user ? (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="hidden sm:inline-flex w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 items-center justify-center hover:bg-slate-50 transition-colors"
                                title="Search"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                className="hidden sm:inline-flex w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 items-center justify-center hover:bg-slate-50 transition-colors"
                                title="Notifications"
                            >
                                <Bell className="h-4 w-4" />
                            </button>
                            <Link
                                to="/student/profile"
                                className="h-9 sm:h-10 pl-1 pr-2 rounded-xl border border-slate-200 bg-white flex items-center gap-2 hover:shadow-sm transition-shadow"
                                title="My Profile"
                            >
                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                                    {user.photo ? (
                                        <img src={user.photo} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserRound className="h-4 w-4 text-slate-500" />
                                    )}
                                </div>
                                <span className="hidden xl:block text-[11px] font-black text-slate-700 max-w-[120px] truncate">
                                    {user.name || 'Student'}
                                </span>
                            </Link>

                            <button
                                onClick={handleLogout}
                                className="w-9 h-9 rounded-xl border border-rose-200 bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors"
                                title="Logout"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            className="text-white px-4 sm:px-5 py-2 rounded-xl text-[11px] sm:text-xs font-bold tracking-widest hover:opacity-90 transition-opacity shrink-0"
                            style={{ backgroundColor: accent }}
                        >
                            LOGIN
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default StudentHeader;
