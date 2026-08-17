import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    BookOpen,
    BookMarked,
    Shield,
    LogOut,
    CalendarRange,
    FileSpreadsheet,
    Workflow,
    Building2,
    Menu,
    Search,
    Power,
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import { ShellSearchProvider, useShellSearch } from '../../../context/shellSearchContext';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';
import ThemeToggle from '../../../shared/components/ThemeToggle';
import ShellMobileDrawer from '../../../shared/components/ShellMobileDrawer';
import NotificationBell from '../../../shared/components/NotificationBell';

const ADMIN_BLUE = '#1e56e3';
const SIDEBAR_W = 236;
const CONTENT_BG = '#eef2f7';

const AdminLayout = () => (
    <ShellSearchProvider>
        <AdminLayoutInner />
    </ShellSearchProvider>
);

const AdminLayoutInner = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { query, setQuery, placeholder } = useShellSearch();

    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
    const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

    const navItems = [
        { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true },
        { name: 'Admins', path: '/admin/admins', icon: Shield },
        { name: 'Teachers', path: '/admin/teachers', icon: GraduationCap },
        { name: 'Students', path: '/admin/students', icon: Users },
        { name: 'Setup Workflow', path: '/admin/setup-workflow', icon: Workflow },
        { name: 'Classes', path: '/admin/classes', icon: BookOpen },
        { name: 'Subjects', path: '/admin/subjects', icon: BookMarked },
        { name: 'Academic Structure', path: '/admin/academic-structure', icon: Building2 },
        { name: 'Semesters', path: '/admin/semesters', icon: CalendarRange },
        { name: 'Import / Export', path: '/admin/import-export', icon: FileSpreadsheet },
        ...((user?.roles || []).includes('teacher')
            ? [{ name: 'Teacher Panel', path: '/teacher', icon: Shield }]
            : []),
    ];

    /** Mobile drawer still expects section groups */
    const navSections = [
        {
            key: 'main',
            name: 'Menu',
            icon: LayoutDashboard,
            links: navItems,
        },
    ];

    const requestLogout = () => setShowLogoutConfirm(true);
    const confirmLogout = () => {
        logout();
        navigate('/');
    };

    const firstName = (user?.name || 'Admin').trim().split(/\s+/)[0];
    const initial = (user?.name || 'A').trim().slice(0, 1).toUpperCase();

    /** White pill + concave corners that blend into the main content */
    const navLinkClass = ({ isActive }) =>
        [
            'group relative z-[1] flex items-center gap-3 py-3 pl-4 pr-3 text-[13px] font-semibold transition-colors',
            isActive
                ? 'rounded-l-[1.35rem] bg-white text-[#1d2f82] shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)]'
                : 'mx-2 rounded-xl text-white/80 hover:bg-white/10 hover:text-white',
        ].join(' ');

    return (
        <div
            className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden font-sans antialiased dark:bg-[#020617] dark:text-slate-100"
            style={{ backgroundColor: CONTENT_BG }}
        >
            {/* Mobile top bar */}
            <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm safe-area-px lg:hidden dark:border-white/10 dark:bg-[#0b1220]">
                <button type="button" onClick={() => navigate('/admin')} className="flex min-w-0 items-center gap-2 text-left">
                    <ProjectVerifyLogo showMark={false} size="md" tagline="Admin console" />
                </button>
                <div className="flex items-center gap-2">
                    <ThemeToggle compact />
                    <button
                        type="button"
                        onClick={() => setMobileNavOpen(true)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-[#111827] dark:text-slate-100"
                        aria-label="Open navigation menu"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                </div>
            </header>

            <ShellMobileDrawer
                open={mobileNavOpen}
                onClose={() => setMobileNavOpen(false)}
                navSections={navSections}
                onLogout={requestLogout}
                panelTitle="Admin menu"
            />

            <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
                {/* Single dark sidebar — mockup style */}
                <aside
                    className="relative z-20 hidden h-full max-h-[100dvh] shrink-0 flex-col lg:flex"
                    style={{
                        width: SIDEBAR_W,
                        minWidth: SIDEBAR_W,
                        background: 'linear-gradient(180deg, #2a3fa4 0%, #1d2f82 55%, #172663 100%)',
                    }}
                >
                    {/* Profile */}
                    <div className="flex flex-col items-center px-4 pb-5 pt-8 text-center">
                        <div className="relative mb-3">
                            <div
                                className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-2xl font-extrabold text-white"
                                style={{
                                    background: 'linear-gradient(145deg, #5b7cff 0%, #1D68E3 100%)',
                                    boxShadow: '0 0 0 4px rgba(255,255,255,0.22), 0 0 24px rgba(93,140,255,0.45)',
                                }}
                            >
                                {initial}
                            </div>
                        </div>
                        <p className="max-w-full truncate text-[15px] font-extrabold tracking-tight text-white">
                            {user?.name || 'Admin'}
                        </p>
                        <p className="mt-0.5 max-w-full truncate text-[11px] font-medium text-white/55">
                            {user?.email || 'admin@projectverify'}
                        </p>
                    </div>

                    {/* Flat nav with cutout active state */}
                    <nav className="relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden pb-4 pl-3 pr-0" aria-label="Admin navigation">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <NavLink key={item.path} to={item.path} end={Boolean(item.end)} className={navLinkClass}>
                                    {({ isActive }) => (
                                        <>
                                            {isActive ? (
                                                <>
                                                    {/* Top concave corner */}
                                                    <span
                                                        aria-hidden
                                                        className="pointer-events-none absolute -right-px -top-3 h-3 w-3 bg-transparent"
                                                        style={{
                                                            borderBottomRightRadius: '0.75rem',
                                                            boxShadow: `4px 4px 0 0 ${CONTENT_BG}`,
                                                        }}
                                                    />
                                                    {/* Bottom concave corner */}
                                                    <span
                                                        aria-hidden
                                                        className="pointer-events-none absolute -bottom-3 -right-px h-3 w-3 bg-transparent"
                                                        style={{
                                                            borderTopRightRadius: '0.75rem',
                                                            boxShadow: `4px -4px 0 0 ${CONTENT_BG}`,
                                                        }}
                                                    />
                                                    {/* Bridge into content */}
                                                    <span
                                                        aria-hidden
                                                        className="pointer-events-none absolute inset-y-0 -right-3 w-3"
                                                        style={{ backgroundColor: CONTENT_BG }}
                                                    />
                                                </>
                                            ) : null}
                                            <Icon
                                                className={`relative z-[1] h-[18px] w-[18px] shrink-0 ${isActive ? 'text-[#2a3fa4]' : 'text-white/70'}`}
                                                strokeWidth={2.15}
                                            />
                                            <span className="relative z-[1] truncate">{item.name}</span>
                                        </>
                                    )}
                                </NavLink>
                            );
                        })}
                    </nav>

                    {/* Logout */}
                    <div className="mt-auto border-t border-white/10 px-4 py-4">
                        <button
                            type="button"
                            onClick={requestLogout}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-[13px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/18"
                        >
                            <Power className="h-4 w-4" strokeWidth={2.2} />
                            Logout
                        </button>
                    </div>
                </aside>

                {/* Main column */}
                <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={{ backgroundColor: CONTENT_BG }}>
                    <header className="hidden shrink-0 items-center justify-between gap-4 px-6 pb-2 pt-6 lg:flex dark:bg-transparent">
                        <h1 className="min-w-0 truncate text-[1.65rem] font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                            Welcome {firstName} !
                        </h1>

                        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                            <label className="relative hidden min-w-0 max-w-md flex-1 xl:block">
                                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={placeholder || 'Search…'}
                                    className="h-11 w-full rounded-full border-0 bg-white pl-10 pr-4 text-sm font-medium text-slate-800 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)] outline-none ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:ring-2 focus:ring-[#2a3fa4]/25 dark:bg-[#111827] dark:text-slate-100 dark:ring-white/10"
                                />
                            </label>

                            <ThemeToggle
                                compact
                                className="h-11 rounded-full border-0 bg-white px-3 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80 dark:bg-[#111827] dark:ring-white/10"
                            />
                            <NotificationBell variant="admin" />
                        </div>
                    </header>

                    {/* Compact search on medium desktop */}
                    <div className="hidden px-6 pb-2 lg:block xl:hidden">
                        <label className="relative block">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={placeholder || 'Search…'}
                                className="h-11 w-full rounded-full border-0 bg-white pl-10 pr-4 text-sm font-medium text-slate-800 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)] outline-none ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:ring-2 focus:ring-[#2a3fa4]/25 dark:bg-[#111827] dark:text-slate-100 dark:ring-white/10"
                            />
                        </label>
                    </div>

                    <main className="app-shell-main min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-2 sm:px-4 lg:px-6">
                        <div className="app-shell-page app-page">
                            <Outlet />
                        </div>
                    </main>
                </div>
            </div>

            {showLogoutConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-[#0f1a3d]/50 backdrop-blur-[2px]"
                        onClick={() => setShowLogoutConfirm(false)}
                        aria-label="Close logout confirmation"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="logout-dialog-title"
                        className="relative w-full max-w-md overflow-hidden rounded-xl border border-[#cfdbfb] bg-white shadow-[0_16px_48px_-12px_rgba(29,47,130,0.22)]"
                    >
                        <div className="border-b border-[#e8eefc] bg-gradient-to-r from-[#f4f7ff] via-white to-[#f4f7ff] px-4 py-4 sm:px-5">
                            <div className="flex items-start gap-3">
                                <div
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-md"
                                    style={{ backgroundColor: ADMIN_BLUE }}
                                >
                                    <LogOut className="h-5 w-5" strokeWidth={2.25} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#51628f]">Session</p>
                                    <h3 id="logout-dialog-title" className="mt-0.5 text-base font-black tracking-tight text-[#1d2f82]">
                                        Sign out of your account?
                                    </h3>
                                    <p className="mt-1.5 text-[12px] font-medium leading-snug text-[#51628f]">
                                        You will need to sign in again to access the admin panel and management tools.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col-reverse gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
                            <button
                                type="button"
                                onClick={() => setShowLogoutConfirm(false)}
                                className="w-full rounded-lg border border-[#cfdbfb] bg-white px-4 py-2 text-[12px] font-bold text-[#1d2f82] transition-colors hover:bg-[#f5f8ff] sm:w-auto"
                            >
                                Stay signed in
                            </button>
                            <button
                                type="button"
                                onClick={confirmLogout}
                                className="w-full rounded-lg px-4 py-2 text-[12px] font-bold text-white shadow-sm transition-[filter] hover:brightness-110 sm:w-auto"
                                style={{ backgroundColor: ADMIN_BLUE }}
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLayout;
