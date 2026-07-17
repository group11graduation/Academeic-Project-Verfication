import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    BookOpen,
    BookMarked,
    Shield,
    ShieldCheck,
    LogOut,
    Search,
    ChevronDown,
    Bell,
    CalendarRange,
    FileSpreadsheet,
    Activity,
    Workflow,
    Menu,
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import { ShellSearchProvider, useShellSearch } from '../../../context/shellSearchContext';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';
import ThemeToggle from '../../../shared/components/ThemeToggle';
import ShellMobileDrawer from '../../../shared/components/ShellMobileDrawer';

const ADMIN_BLUE = '#1e56e3';
const CONTENT_BG = '#f8fafc';
const SIDEBAR_W = 248;
const RAIL_W = 72;

const AdminLayout = () => (
    <ShellSearchProvider>
        <AdminLayoutInner />
    </ShellSearchProvider>
);

const AdminLayoutInner = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { query: shellSearchQuery, setQuery: setShellSearchQuery, placeholder: shellSearchPlaceholder } =
        useShellSearch();
    const location = useLocation();

    const peopleChildren = [
        { name: 'Admins', path: '/admin/admins', icon: Shield },
        { name: 'Teachers', path: '/admin/teachers', icon: GraduationCap },
        { name: 'Students', path: '/admin/students', icon: Users },
    ];
    const academicItems = [
        { name: 'Setup Workflow', path: '/admin/setup-workflow', icon: Workflow },
        { name: 'Classes', path: '/admin/classes', icon: BookOpen },
        { name: 'Subjects', path: '/admin/subjects', icon: BookMarked },
        { name: 'Semesters', path: '/admin/semesters', icon: CalendarRange },
    ];
    const dataItems = [{ name: 'Import / Export', path: '/admin/import-export', icon: FileSpreadsheet }];
    const teacherExtra =
        (user?.roles || []).includes('teacher') ? [{ name: 'Teacher Panel', path: '/teacher', icon: Shield }] : [];

    const navSections = [
        {
            key: 'dashboard',
            name: 'Dashboard',
            icon: LayoutDashboard,
            links: [{ name: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true }],
        },
        {
            key: 'people',
            name: 'People',
            icon: Users,
            links: peopleChildren,
        },
        {
            key: 'academic',
            name: 'Academic',
            icon: BookMarked,
            links: academicItems,
        },
        {
            key: 'data',
            name: 'Data',
            icon: FileSpreadsheet,
            links: dataItems,
        },
        ...(teacherExtra.length
            ? [{ key: 'teacher', name: 'Teacher Panel', icon: Shield, links: teacherExtra }]
            : []),
    ];

    const inferSectionKeyByPath = React.useCallback(
        (pathname) => {
            for (const section of navSections) {
                for (const link of section.links) {
                    const isMatch = link.end
                        ? pathname === link.path
                        : pathname === link.path || pathname.startsWith(`${link.path}/`);
                    if (isMatch) return section.key;
                }
            }
            return 'dashboard';
        },
        [navSections]
    );

    const [activeSectionKey, setActiveSectionKey] = React.useState(() => inferSectionKeyByPath(location.pathname));
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
    const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
    React.useEffect(() => {
        setActiveSectionKey(inferSectionKeyByPath(location.pathname));
    }, [location.pathname, inferSectionKeyByPath]);

    React.useEffect(() => {
        const onKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                setIsSidebarCollapsed((v) => !v);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    /** On narrower viewports, start collapsed so the main page is not clipped by the dual sidebar */
    React.useEffect(() => {
        const mq = window.matchMedia('(max-width: 1535px)');
        const apply = (event) => {
            if (event.matches) setIsSidebarCollapsed(true);
        };
        apply(mq);
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    const activeSection = navSections.find((s) => s.key === activeSectionKey) || navSections[0];
    const requestLogout = () => setShowLogoutConfirm(true);
    const confirmLogout = () => {
        logout();
        navigate('/');
    };

    const linkRow =
        'flex min-h-[36px] items-center gap-2 text-[11px] transition-[background,color,box-shadow] duration-200 ease-out';
    const linkIdle = `${linkRow} mx-0.5 rounded-lg px-2.5 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white`;
    const linkActive = `${linkRow} mx-0.5 rounded-lg px-2.5 py-1.5 font-bold text-[#1e56e3] bg-blue-50 ring-1 ring-[#1e56e3]/12 dark:bg-[#1e56e3]/15 dark:text-blue-300`;
    const iconBox =
        'flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10';
    const iconBoxActive =
        'flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-md bg-[#1e56e3]/12 text-[#1e56e3] ring-1 ring-[#1e56e3]/20';

    return (
        <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#f8fafc] font-sans antialiased dark:bg-[#020617] dark:text-slate-100">
            <header
                className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm safe-area-px dark:border-white/10 dark:bg-[#0b1220] lg:hidden"
            >
                <button type="button" onClick={() => navigate('/admin')} className="flex min-w-0 items-center gap-2 text-left">
                    <ProjectVerifyLogo size="md" tagline="Admin console" />
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

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
                <aside
                    className="hidden h-full max-h-[100dvh] shrink-0 lg:sticky lg:top-0 lg:block"
                    style={{ width: isSidebarCollapsed ? RAIL_W : SIDEBAR_W, minWidth: isSidebarCollapsed ? RAIL_W : SIDEBAR_W }}
                >
                    <div className="flex h-full max-h-[100dvh] overflow-hidden rounded-r-[16px] bg-white shadow-[6px_0_24px_-18px_rgba(15,23,42,0.2)] ring-1 ring-slate-200 dark:bg-[#0b1220] dark:ring-white/10">
                        <div className="flex w-[72px] shrink-0 flex-col items-center bg-gradient-to-b from-[#2a3fa4] to-[#223688] px-1.5 py-3 text-white">
                            <button
                                type="button"
                                onClick={() => navigate('/admin')}
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/30"
                                title="Admin home"
                            >
                                <Activity className="h-[16px] w-[16px]" strokeWidth={2.2} />
                            </button>

                            <nav
                                className="mt-3 flex min-h-0 w-full flex-1 flex-col items-stretch justify-evenly gap-2 overflow-y-auto px-0.5 py-2"
                                aria-label="Main sections"
                            >
                                {navSections.map((section) => {
                                    const Icon = section.icon;
                                    const firstLink = section.links[0];
                                    const isActive = activeSection?.key === section.key;
                                    return (
                                        <button
                                            key={section.key}
                                            type="button"
                                            title={section.name}
                                            onClick={() => {
                                                setActiveSectionKey(section.key);
                                                setIsSidebarCollapsed(false);
                                                if (firstLink?.path) navigate(firstLink.path);
                                            }}
                                            className={`flex w-full min-h-[52px] shrink-0 flex-col items-center justify-center rounded-xl px-1 py-2 transition-all ${
                                                isActive
                                                    ? 'bg-white text-[#1d2f82] shadow-[0_10px_22px_-12px_rgba(15,23,42,0.6)]'
                                                    : 'text-white/85 hover:bg-white/12 hover:text-white'
                                            }`}
                                        >
                                            <div className="flex flex-col items-center gap-1">
                                                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.3} />
                                                <span
                                                    className={`text-center text-[9px] font-semibold leading-tight tracking-tight ${isActive ? 'text-[#1d2f82]' : 'text-white/85'}`}
                                                >
                                                    {section.name}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </nav>

                            <button
                                type="button"
                                onClick={requestLogout}
                                className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15 hover:text-white"
                                title="Logout"
                            >
                                <LogOut className="h-[16px] w-[16px]" strokeWidth={2.2} />
                            </button>

                            <ThemeToggle
                                compact
                                iconOnly
                                className="mt-2 h-9 w-9 rounded-lg border-white/20 bg-white/15 px-0 py-0 text-white hover:bg-white/20 dark:border-white/20 dark:bg-white/15 dark:text-white dark:hover:bg-white/20"
                            />

                            <button
                                type="button"
                                onClick={() => setIsSidebarCollapsed((v) => !v)}
                                className="mt-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/25 transition hover:bg-white/20"
                                title={isSidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
                            >
                                <span className={`inline-block text-xs font-black transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`}>
                                    {'<'}
                                </span>
                            </button>
                        </div>

                        {!isSidebarCollapsed && <>
                            <div className="w-[1px] bg-slate-200/80 shadow-[1px_0_0_rgba(15,23,42,0.06)] dark:bg-white/8 dark:shadow-none" />
                            <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-r-[16px] bg-gradient-to-b from-[#f4f7ff] via-white to-[#f4f7ff] dark:from-[#0b1220] dark:via-[#0b1220] dark:to-[#111827]">
                            <button
                                type="button"
                                onClick={() => navigate('/admin')}
                                className="mx-2 mb-1.5 mt-3 flex items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:opacity-90"
                            >
                                <ProjectVerifyLogo size="md" tagline="Admin console" />
                            </button>

                            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3 pl-0.5 pr-0.5">
                                <p className="px-2 pb-0.5 pt-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                    {activeSection?.name || 'Navigation'}
                                </p>
                                <p className="px-2 pb-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                    {activeSection?.name || 'Menu'}
                                </p>

                                {(activeSection?.links || []).map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            end={Boolean(item.end)}
                                            className={({ isActive }) => (isActive ? linkActive : linkIdle)}
                                        >
                                            {({ isActive }) => (
                                                <>
                                                    <span className={isActive ? iconBoxActive : iconBox}>
                                                        <Icon className="h-3.5 w-3.5 stroke-[2]" />
                                                    </span>
                                                    {item.name}
                                                </>
                                            )}
                                        </NavLink>
                                    );
                                })}
                            </nav>

                            <div className="mt-auto border-t border-slate-200 px-2 pb-3 pt-2 dark:border-white/10">
                                <button
                                    type="button"
                                    onClick={requestLogout}
                                    className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:text-slate-300 dark:hover:bg-rose-950/30 dark:hover:text-rose-200"
                                >
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10">
                                        <LogOut className="h-3.5 w-3.5 stroke-[2]" />
                                    </span>
                                    Logout
                                </button>
                            </div>
                        </div>
                        </>}
                    </div>
                </aside>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f8fafc] dark:bg-[#020617]">
                    <header className="flex min-h-[52px] shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 bg-gradient-to-r from-[#f4f7ff] via-white to-[#f4f7ff] px-3 py-2 sm:px-4 lg:px-5 dark:border-white/10 dark:from-[#0b1220] dark:via-[#0f172a] dark:to-[#111827]">
                        <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-extrabold leading-tight text-[#1d2f82] dark:text-blue-300">Welcome back</div>
                            <div className="text-[10px] font-semibold text-[#51628f] dark:text-slate-400">Admin Dashboard</div>
                        </div>

                        <div className="mx-2 hidden min-w-0 max-w-xl flex-1 md:block">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                                <input
                                    type="search"
                                    value={shellSearchQuery}
                                    onChange={(e) => setShellSearchQuery(e.target.value)}
                                    placeholder={shellSearchPlaceholder}
                                    aria-label={shellSearchPlaceholder}
                                    className="w-full rounded-lg border border-[#cfdbfb] bg-white/90 py-1.5 pl-8 pr-2.5 text-[11px] font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#2a3fa4] focus:bg-white focus:ring-2 focus:ring-[#2a3fa4]/15 dark:border-white/10 dark:bg-[#111827] dark:text-slate-100 dark:placeholder:text-slate-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <ThemeToggle compact className="hidden sm:inline-flex" />
                            <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#cfdbfb] bg-white text-[#53638f] transition-colors hover:bg-[#f5f8ff] dark:border-white/10 dark:bg-[#111827] dark:text-slate-300 dark:hover:bg-[#1f2937]"
                                title="Notifications"
                            >
                                <Bell className="h-4 w-4" strokeWidth={2} />
                            </button>
                            <div className="flex items-center gap-1.5 rounded-lg border border-[#cfdbfb] bg-white py-0.5 pl-1 pr-2 shadow-sm dark:border-white/10 dark:bg-[#111827]">
                                <div
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                                    style={{ backgroundColor: ADMIN_BLUE }}
                                >
                                    {(user?.name || 'Admin').trim().slice(0, 1).toUpperCase()}
                                </div>
                                <div className="hidden leading-tight sm:block">
                                    <div className="max-w-[100px] truncate text-[11px] font-bold text-slate-800 dark:text-slate-100">{user?.name || 'My account'}</div>
                                    <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {(user?.role || 'admin').toUpperCase()}
                                    </div>
                                </div>
                                <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 dark:text-slate-500 sm:block" />
                            </div>
                        </div>
                    </header>

                    <main className="app-shell-main bg-transparent px-3 py-2 sm:px-3 lg:px-4 lg:py-3">
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
