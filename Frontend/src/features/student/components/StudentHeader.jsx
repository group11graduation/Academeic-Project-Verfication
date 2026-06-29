import React, { useMemo, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
    Rocket,
    BookOpen,
    GalleryHorizontal,
    LogOut,
    Bell,
    Search,
    UserRound,
    Menu,
    X,
    ChevronDown,
    LayoutDashboard,
    Info,
    Shield,
    Users,
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import { BRAND, BRAND_GRADIENT } from '../../../shared/ui/brandTheme';

function buildNavItems(user) {
    if (!user) {
        return [
            { label: 'Overview', path: '/', end: true },
            { label: 'Platform Guide', path: '/about' },
            { label: 'Verified Projects', path: '/gallery' },
        ];
    }

    if (user.role === 'student') {
        return [
            { label: 'Overview', path: '/', end: true },
            { label: 'My Workspace', path: '/student' },
            { label: 'Assignments', path: '/student/assignments' },
            { label: 'My Projects', path: '/student/project' },
            { label: 'Verified Projects', path: '/gallery' },
        ];
    }

    if (user.role === 'teacher') {
        return [
            { label: 'Overview', path: '/', end: true },
            { label: 'Platform Guide', path: '/about' },
            { label: 'Verified Projects', path: '/gallery' },
            { label: 'Teacher Dashboard', path: '/teacher' },
        ];
    }

    return [
        { label: 'Overview', path: '/', end: true },
        { label: 'Platform Guide', path: '/about' },
        { label: 'Admin Panel', path: '/admin' },
    ];
}

const StudentHeader = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    const navItems = useMemo(() => buildNavItems(user), [user]);

    const handleLogout = () => {
        setProfileOpen(false);
        logout();
        navigate('/');
    };

    const desktopNavClass = ({ isActive }) =>
        `relative px-1 py-4 text-sm font-semibold transition-colors ${
            isActive ? 'text-[#2a3fa4]' : 'text-slate-600 hover:text-slate-900'
        } after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-full after:transition-opacity ${
            isActive ? 'after:opacity-100 after:bg-[#2a3fa4]' : 'after:opacity-0 hover:after:opacity-40 after:bg-slate-300'
        }`;

    const mobileIcon = (path) => {
        if (path === '/') return LayoutDashboard;
        if (path === '/about') return Info;
        if (path === '/gallery') return GalleryHorizontal;
        if (path.includes('assignments')) return BookOpen;
        if (path.includes('project')) return Rocket;
        if (path === '/teacher') return Users;
        if (path === '/admin') return Shield;
        if (path === '/student') return LayoutDashboard;
        return null;
    };

    return (
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200/80 shadow-[0_1px_0_rgba(42,63,164,0.04)]">
            <div className="h-[3px] w-full" style={{ background: BRAND_GRADIENT }} />

            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between gap-4">
                    <Link to="/" className="flex items-center gap-3 shrink-0 group">
                        <div
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-white ring-2 ring-[#2a3fa4]/15 transition-transform group-hover:scale-105"
                            style={{ backgroundColor: BRAND.primary }}
                        >
                            <Rocket className="h-[18px] w-[18px]" />
                        </div>
                        <div className="hidden sm:block leading-tight">
                            <span className="block text-[15px] font-extrabold tracking-tight text-slate-900">
                                ScholarVerify
                            </span>
                            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                Project verification
                            </span>
                        </div>
                    </Link>

                    <nav className="hidden lg:flex items-center gap-6 xl:gap-8 flex-1 justify-center max-w-3xl">
                        {navItems.map((item) => (
                            <NavLink key={`${item.path}-${item.label}`} to={item.path} end={item.end} className={desktopNavClass}>
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    {user ? (
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <div className="hidden md:flex items-center rounded-full border border-slate-200 bg-slate-50/80 pl-3 pr-2 py-1.5 w-[160px] lg:w-[180px]">
                                <Search className="h-4 w-4 text-slate-400 shrink-0" />
                                <input
                                    type="search"
                                    placeholder="Search..."
                                    className="ml-2 w-full bg-transparent text-xs font-medium text-slate-700 placeholder:text-slate-400 outline-none border-0 !text-slate-700"
                                />
                            </div>

                            <button
                                type="button"
                                className="relative hidden sm:flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                                title="Notifications"
                            >
                                <Bell className="h-[18px] w-[18px]" />
                                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                            </button>

                            <div className="relative hidden sm:block">
                                <button
                                    type="button"
                                    onClick={() => setProfileOpen((v) => !v)}
                                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/60 pl-1 pr-3 py-1 hover:bg-slate-100"
                                >
                                    <div
                                        className="h-8 w-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-black ring-2 ring-white"
                                        style={{ background: BRAND_GRADIENT }}
                                    >
                                        {user.photo ? (
                                            <img src={user.photo} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            (user.name || 'U').charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <span className="hidden lg:block max-w-[120px] truncate text-xs font-bold text-slate-800">
                                        {user.name || user.role}
                                    </span>
                                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {profileOpen && (
                                    <>
                                        <button
                                            type="button"
                                            className="fixed inset-0 z-40 cursor-default"
                                            aria-label="Close menu"
                                            onClick={() => setProfileOpen(false)}
                                        />
                                        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl">
                                            <div className="px-4 py-2.5 border-b border-slate-100">
                                                <p className="text-xs font-black text-slate-900 truncate">{user.name}</p>
                                                <p className="text-[11px] text-slate-500 truncate capitalize">{user.role} account</p>
                                            </div>
                                            {user.role === 'student' && (
                                                <Link
                                                    to="/student/profile"
                                                    onClick={() => setProfileOpen(false)}
                                                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                                >
                                                    <UserRound className="h-4 w-4 text-slate-400" />
                                                    My profile
                                                </Link>
                                            )}
                                            <button
                                                type="button"
                                                onClick={handleLogout}
                                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                                            >
                                                <LogOut className="h-4 w-4" />
                                                Sign out
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <button
                                type="button"
                                className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200"
                                onClick={() => setMobileOpen((v) => !v)}
                            >
                                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 shrink-0">
                            <Link to="/login" className="hidden sm:inline-flex px-4 py-2 text-sm font-bold text-slate-700 hover:text-[#2a3fa4]">
                                Sign in
                            </Link>
                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="inline-flex px-4 py-2 rounded-lg text-sm font-bold text-white"
                                style={{ backgroundColor: BRAND.primary }}
                            >
                                Access platform
                            </button>
                            <button
                                type="button"
                                className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200"
                                onClick={() => setMobileOpen((v) => !v)}
                            >
                                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {mobileOpen && (
                <div className="lg:hidden border-t border-slate-200 bg-white">
                    <nav className="max-w-[1400px] mx-auto px-4 py-4 space-y-1">
                        {navItems.map((item) => {
                            const Icon = mobileIcon(item.path) || LayoutDashboard;
                            return (
                                <NavLink
                                    key={`${item.path}-${item.label}`}
                                    to={item.path}
                                    end={item.end}
                                    onClick={() => setMobileOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center justify-between rounded-lg px-4 py-3 text-sm font-bold ${
                                            isActive ? 'bg-[#2a3fa4]/10 text-[#2a3fa4]' : 'text-slate-700 hover:bg-slate-50'
                                        }`
                                    }
                                >
                                    <span className="flex items-center gap-2">
                                        <Icon className="h-4 w-4 opacity-60" />
                                        {item.label}
                                    </span>
                                </NavLink>
                            );
                        })}
                        {user?.role === 'student' && (
                            <>
                                <div className="my-2 border-t border-slate-100" />
                                <Link
                                    to="/student/profile"
                                    onClick={() => setMobileOpen(false)}
                                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                >
                                    <UserRound className="h-4 w-4" /> My profile
                                </Link>
                            </>
                        )}
                        {user && (
                            <button
                                type="button"
                                onClick={() => {
                                    setMobileOpen(false);
                                    handleLogout();
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50"
                            >
                                <LogOut className="h-4 w-4" /> Sign out
                            </button>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
};

export default StudentHeader;
