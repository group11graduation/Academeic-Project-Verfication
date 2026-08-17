import React, { useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    GalleryHorizontal,
    GraduationCap,
    LogOut,
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
import { BRAND_GRADIENT } from '../../../shared/ui/brandTheme';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';
import ThemeToggle from '../../../shared/components/ThemeToggle';
import NotificationBell from '../../../shared/components/NotificationBell';

function buildNavItems(user) {
    if (!user) {
        return [
            { label: 'Home', path: '/', end: true },
            { label: 'Guide', path: '/guide' },
            { label: 'About', path: '/about' },
            { label: 'Verified Projects', path: '/gallery' },
        ];
    }

    if (user.role === 'student') {
        return [
            { label: 'Home', path: '/', end: true },
            { label: 'My Workspace', path: '/student' },
            { label: 'Verified Projects', path: '/gallery' },
        ];
    }

    if (user.role === 'teacher') {
        return [
            { label: 'Home', path: '/', end: true },
            { label: 'Guide', path: '/guide' },
            { label: 'About', path: '/about' },
            { label: 'Verified Projects', path: '/gallery' },
            { label: 'Teacher Dashboard', path: '/teacher' },
        ];
    }

    return [
        { label: 'Home', path: '/', end: true },
        { label: 'Guide', path: '/guide' },
        { label: 'About', path: '/about' },
        { label: 'Admin Panel', path: '/admin' },
    ];
}

const StudentHeader = ({ forcePublic = false }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    const showPublicShell = forcePublic || location.pathname === '/';
    const isPublicMarketing =
        showPublicShell ||
        ['/', '/guide', '/about', '/gallery'].includes(location.pathname) ||
        location.pathname.startsWith('/gallery/');

    const navItems = useMemo(() => buildNavItems(showPublicShell ? null : user), [showPublicShell, user]);

    const workspacePath =
        user?.role === 'student' ? '/student' : user?.role === 'teacher' ? '/teacher' : user?.role === 'admin' ? '/admin' : '/login';

    const handleLogout = () => {
        setProfileOpen(false);
        logout();
        navigate('/');
    };

    const desktopNavClass = ({ isActive }) =>
        `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            isActive
                ? 'bg-[#f0f1f3] text-slate-950'
                : 'text-slate-600 hover:bg-[#f5f5f7] hover:text-slate-950'
        }`;

    const mobileIcon = (path) => {
        if (path === '/') return LayoutDashboard;
        if (path === '/about') return Users;
        if (path === '/guide') return Info;
        if (path === '/gallery') return GalleryHorizontal;
        if (path === '/teacher') return Users;
        if (path === '/admin') return Shield;
        if (path === '/student') return LayoutDashboard;
        return null;
    };

    if (isPublicMarketing) {
        return (
            <header className="sticky top-0 z-50 [font-family:var(--sv-font-sans)]">
                <div className="border-b border-white/40 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1220]/85">
                    <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
                        <div className="flex h-[72px] items-center justify-between gap-3">
                            <Link to="/" className="group shrink-0" onClick={() => setMobileOpen(false)}>
                                <ProjectVerifyLogo
                                    size="md"
                                    hideTextOnMobile
                                    className="transition-opacity hover:opacity-95"
                                    tagline=""
                                />
                            </Link>

                            <nav className="hidden items-center gap-1 lg:flex">
                                {navItems.map((item) => (
                                    <NavLink
                                        key={`${item.path}-${item.label}`}
                                        to={item.path}
                                        end={item.end}
                                        className={desktopNavClass}
                                    >
                                        {item.label}
                                    </NavLink>
                                ))}
                            </nav>

                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                {user ? (
                                    <Link
                                        to={workspacePath}
                                        className="hidden text-sm font-semibold text-slate-700 hover:text-slate-950 sm:inline-flex"
                                    >
                                        Student portal
                                    </Link>
                                ) : (
                                    <Link
                                        to="/login"
                                        className="hidden text-sm font-semibold text-slate-700 hover:text-slate-950 sm:inline-flex"
                                    >
                                        Student portal
                                    </Link>
                                )}

                                <ThemeToggle compact className="hidden sm:inline-flex" />

                                <button
                                    type="button"
                                    onClick={() => navigate(user ? workspacePath : '/login')}
                                    className="inline-flex min-h-10 items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold text-white transition hover:opacity-95 sm:px-4 sm:text-sm"
                                    style={{ background: BRAND_GRADIENT }}
                                >
                                    <GraduationCap className="h-4 w-4 shrink-0" />
                                    <span className="sm:hidden">{user ? 'Portal' : 'Apply'}</span>
                                    <span className="hidden sm:inline">{user ? 'Open portal' : 'Apply'}</span>
                                </button>

                                <button
                                    type="button"
                                    className="lg:hidden flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-[#111827] dark:text-slate-100"
                                    onClick={() => setMobileOpen((v) => !v)}
                                    aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                                >
                                    {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {mobileOpen && (
                        <div className="border-t border-slate-200/80 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1220] lg:hidden safe-area-px">
                            <nav className="mx-auto max-w-[1200px] space-y-1 px-4 py-4">
                                <ThemeToggle className="mb-2 w-full justify-center" />
                                {navItems.map((item) => {
                                    const Icon = mobileIcon(item.path) || LayoutDashboard;
                                    return (
                                        <NavLink
                                            key={`${item.path}-${item.label}`}
                                            to={item.path}
                                            end={item.end}
                                            onClick={() => setMobileOpen(false)}
                                            className={({ isActive }) =>
                                                `flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${
                                                    isActive
                                                        ? 'bg-[#f0f1f3] text-slate-950'
                                                        : 'text-slate-700 hover:bg-[#f5f5f7]'
                                                }`
                                            }
                                        >
                                            <Icon className="h-4 w-4 opacity-60" />
                                            {item.label}
                                        </NavLink>
                                    );
                                })}
                                <Link
                                    to={user ? workspacePath : '/login'}
                                    onClick={() => setMobileOpen(false)}
                                    className="mt-2 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white"
                                    style={{ background: BRAND_GRADIENT }}
                                >
                                    <GraduationCap className="h-4 w-4" />
                                    {user ? 'Open portal' : 'Apply'}
                                </Link>
                                {user && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMobileOpen(false);
                                            handleLogout();
                                        }}
                                        className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50"
                                    >
                                        <LogOut className="h-4 w-4" /> Sign out
                                    </button>
                                )}
                            </nav>
                        </div>
                    )}
                </div>
            </header>
        );
    }

    return (
        <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-[var(--sv-card)] shadow-[0_1px_0_rgba(42,63,164,0.04)] dark:border-white/10 dark:bg-[#0b1220]">
            <div className="h-[3px] w-full" style={{ background: BRAND_GRADIENT }} />

            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between gap-4">
                    <Link to="/" className="group shrink-0">
                        <ProjectVerifyLogo size="lg" hideTextOnMobile className="transition-transform hover:opacity-95" tagline="" />
                    </Link>

                    <nav className="hidden max-w-3xl flex-1 items-center justify-center gap-2 lg:flex">
                        {navItems.map((item) => (
                            <NavLink key={`${item.path}-${item.label}`} to={item.path} end={item.end} className={desktopNavClass}>
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <ThemeToggle compact className="hidden sm:inline-flex" />
                        <NotificationBell variant="student" />

                        <div className="relative hidden sm:block">
                            <button
                                type="button"
                                onClick={() => setProfileOpen((v) => !v)}
                                className="flex items-center gap-2 rounded-full border border-[var(--sv-border)] bg-slate-50/60 py-1 pl-1 pr-3 hover:bg-[var(--sv-card-muted)] dark:border-white/10 dark:bg-[#111827] dark:hover:bg-[#1f2937]"
                            >
                                <div
                                    className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-xs font-black text-white ring-2 ring-white"
                                    style={{ background: BRAND_GRADIENT }}
                                >
                                    {user?.photo ? (
                                        <img src={user.photo} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        (user?.name || 'U').charAt(0).toUpperCase()
                                    )}
                                </div>
                                <span className="hidden max-w-[120px] truncate text-xs font-bold text-[var(--sv-text)] lg:block dark:text-slate-100">
                                    {user?.name || user?.role}
                                </span>
                                <ChevronDown
                                    className={`h-3.5 w-3.5 text-[var(--sv-muted)] transition-transform ${profileOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {profileOpen && (
                                <>
                                    <button
                                        type="button"
                                        className="fixed inset-0 z-40 cursor-default"
                                        aria-label="Close menu"
                                        onClick={() => setProfileOpen(false)}
                                    />
                                    <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 rounded-xl border border-[var(--sv-border)] bg-[var(--sv-card)] py-1.5 shadow-xl dark:border-white/10 dark:bg-[#111827]">
                                        <div className="border-b border-[var(--sv-border)] px-4 py-2.5 dark:border-white/10">
                                            <p className="truncate text-xs font-black text-[var(--sv-text)] dark:text-slate-100">
                                                {user?.name}
                                            </p>
                                            <p className="truncate text-[11px] capitalize text-[var(--sv-muted)]">
                                                {user?.role} account
                                            </p>
                                        </div>
                                        {user?.role === 'student' && (
                                            <Link
                                                to="/student/profile"
                                                onClick={() => setProfileOpen(false)}
                                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[var(--sv-text)] hover:bg-[var(--sv-card-muted)] dark:text-slate-200 dark:hover:bg-white/10"
                                            >
                                                <UserRound className="h-4 w-4 text-[var(--sv-muted)]" />
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
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--sv-border)] lg:hidden dark:border-white/10 dark:text-slate-100"
                            onClick={() => setMobileOpen((v) => !v)}
                        >
                            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {mobileOpen && (
                <div className="border-t border-[var(--sv-border)] bg-[var(--sv-card)] dark:border-white/10 dark:bg-[#0b1220] lg:hidden safe-area-px">
                    <nav className="mx-auto max-w-[1400px] space-y-1 px-4 py-4">
                        <ThemeToggle className="mb-2 w-full justify-center" />
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
                                            isActive
                                                ? 'bg-[#2a3fa4]/10 text-[#2a3fa4] dark:text-blue-300'
                                                : 'text-[var(--sv-text)] hover:bg-[var(--sv-card-muted)] dark:text-slate-200 dark:hover:bg-white/10'
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
                                <div className="my-2 border-t border-[var(--sv-border)] dark:border-white/10" />
                                <Link
                                    to="/student/profile"
                                    onClick={() => setMobileOpen(false)}
                                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-[var(--sv-text)] hover:bg-[var(--sv-card-muted)] dark:text-slate-200 dark:hover:bg-white/10"
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
