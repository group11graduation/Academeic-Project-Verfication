import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    BookOpen,
    BookMarked,
    Shield,
    LogOut,
    ChevronDown,
    CalendarRange,
    FileSpreadsheet,
    Workflow,
    Building2,
    Menu,
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import { ShellSearchProvider } from '../../../context/shellSearchContext';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';
import ThemeToggle from '../../../shared/components/ThemeToggle';
import ShellMobileDrawer from '../../../shared/components/ShellMobileDrawer';
import NotificationBell from '../../../shared/components/NotificationBell';

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
        { name: 'Academic Structure', path: '/admin/academic-structure', icon: Building2 },
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
    /** Which parent groups have their sub-links expanded */
    const [openGroups, setOpenGroups] = React.useState(() => {
        const key = inferSectionKeyByPath(location.pathname);
        return { [key]: true };
    });

    React.useEffect(() => {
        const key = inferSectionKeyByPath(location.pathname);
        setActiveSectionKey(key);
        setOpenGroups((prev) => ({ ...prev, [key]: true }));
    }, [location.pathname, inferSectionKeyByPath]);

    const toggleGroup = (key) => {
        setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
        setActiveSectionKey(key);
    };

    const openGroupAndGo = (section) => {
        setActiveSectionKey(section.key);
        setOpenGroups((prev) => ({ ...prev, [section.key]: true }));
        setIsSidebarCollapsed(false);
        const first = section.links?.[0];
        if (first?.path) navigate(first.path);
    };

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
    const linkIdle = `${linkRow} mx-1 rounded-2xl px-3 py-2 font-semibold text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white`;
    const linkActive = `${linkRow} mx-1 rounded-2xl px-3 py-2 font-bold text-[#2a3fa4] bg-white shadow-[0_8px_20px_rgba(42,63,164,0.12)] ring-1 ring-[#2a3fa4]/10 dark:bg-[#1e56e3]/20 dark:text-blue-200`;
    const iconBox =
        'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10';
    const iconBoxActive =
        'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#2a3fa4] ring-1 ring-[#2a3fa4]/15';

    return (
        <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#f8fafc] font-sans antialiased dark:bg-[#020617] dark:text-slate-100">
            <header
                className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm safe-area-px dark:border-white/10 dark:bg-[#0b1220] lg:hidden"
            >
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
                                className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-white/50 shadow-sm"
                                title="Admin home"
                                aria-label="Project Verify - Admin home"
                            >
                                <img
                                    src="/logo.png"
                                    alt=""
                                    className="h-10 w-10 object-contain"
                                />
                            </button>

                            <nav
                                className="mt-3 flex min-h-0 w-full flex-1 flex-col items-stretch justify-evenly gap-2 overflow-y-auto px-0.5 py-2"
                                aria-label="Main sections"
                            >
                                {navSections.map((section) => {
                                    const Icon = section.icon;
                                    const isActive = activeSection?.key === section.key;
                                    return (
                                        <button
                                            key={section.key}
                                            type="button"
                                            title={section.name}
                                            onClick={() => openGroupAndGo(section)}
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
                            <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-r-[16px] bg-gradient-to-b from-[#eef2ff] via-[#f8faff] to-white dark:from-[#0b1220] dark:via-[#0b1220] dark:to-[#111827]">
                            <div className="mx-3 mb-2 mt-4 flex flex-col items-center rounded-2xl bg-white/80 px-3 py-4 text-center shadow-sm ring-1 ring-slate-200/70 dark:bg-[#111827]/80 dark:ring-white/10">
                                <div
                                    className="mb-2 flex h-14 w-14 items-center justify-center rounded-full text-lg font-extrabold text-white ring-4 ring-[#e8eefc]"
                                    style={{ background: 'linear-gradient(135deg, #2a3fa4 0%, #1D68E3 100%)' }}
                                >
                                    {(user?.name || 'A').trim().slice(0, 1).toUpperCase()}
                                </div>
                                <p className="max-w-full truncate text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                    {user?.name || 'Admin'}
                                </p>
                                <p className="mt-0.5 max-w-full truncate text-[11px] font-medium text-slate-500">
                                    {user?.email || 'admin@projectverify'}
                                </p>
                            </div>

                            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-1.5 pb-3" aria-label="Admin navigation">
                                {navSections.map((section) => {
                                    const SectionIcon = section.icon;
                                    const isOpen = Boolean(openGroups[section.key]);
                                    const hasChildren = (section.links || []).length > 0;
                                    const sectionActive = activeSectionKey === section.key;

                                    return (
                                        <div key={section.key} className="mb-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (section.links?.length === 1 && section.links[0].path) {
                                                        setOpenGroups((prev) => ({ ...prev, [section.key]: true }));
                                                        setActiveSectionKey(section.key);
                                                        navigate(section.links[0].path);
                                                        return;
                                                    }
                                                    toggleGroup(section.key);
                                                }}
                                                className={`flex w-full items-center gap-2 rounded-2xl px-2.5 py-2 text-left transition ${
                                                    sectionActive
                                                        ? 'bg-white text-[#2a3fa4] shadow-sm ring-1 ring-[#2a3fa4]/10'
                                                        : 'text-slate-700 hover:bg-white/80 dark:text-slate-200 dark:hover:bg-white/10'
                                                }`}
                                                aria-expanded={isOpen}
                                            >
                                                <span
                                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                                                        sectionActive
                                                            ? 'bg-[#eef2ff] text-[#2a3fa4]'
                                                            : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
                                                    }`}
                                                >
                                                    <SectionIcon className="h-4 w-4" strokeWidth={2.2} />
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold">
                                                    {section.name}
                                                </span>
                                                {hasChildren && section.links.length > 1 ? (
                                                    <ChevronDown
                                                        className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                                                            isOpen ? 'rotate-180' : ''
                                                        }`}
                                                    />
                                                ) : null}
                                            </button>

                                            {hasChildren && isOpen ? (
                                                <div className="mt-1 space-y-0.5 border-l-2 border-[#c5d0f0] ml-5 pl-2 dark:border-white/15">
                                                    {section.links.map((item) => {
                                                        const Icon = item.icon || SectionIcon;
                                                        return (
                                                            <NavLink
                                                                key={item.path}
                                                                to={item.path}
                                                                end={Boolean(item.end)}
                                                                onClick={() => setActiveSectionKey(section.key)}
                                                                className={({ isActive }) =>
                                                                    isActive ? linkActive : linkIdle
                                                                }
                                                            >
                                                                {({ isActive }) => (
                                                                    <>
                                                                        <span className={isActive ? iconBoxActive : iconBox}>
                                                                            <Icon className="h-3.5 w-3.5 stroke-[2]" />
                                                                        </span>
                                                                        <span className="truncate">{item.name}</span>
                                                                    </>
                                                                )}
                                                            </NavLink>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </nav>

                            <div className="mt-auto border-t border-slate-200/80 px-2 pb-3 pt-2 dark:border-white/10">
                                <button
                                    type="button"
                                    onClick={requestLogout}
                                    className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-2xl px-3 py-2 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:text-slate-300 dark:hover:bg-rose-950/30 dark:hover:text-rose-200"
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10">
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
                    <header className="flex min-h-[64px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-sm sm:px-5 lg:px-6 dark:border-white/10 dark:bg-[#0b1220]/90">
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-lg font-extrabold leading-tight tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">
                                Welcome {(user?.name || 'Admin').trim().split(/\s+/)[0]}!
                            </div>
                            <div className="text-xs font-semibold text-[#51628f] dark:text-slate-400">Admin Dashboard</div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                            <ThemeToggle compact className="hidden sm:inline-flex" />
                            <NotificationBell variant="admin" />
                            <div className="flex items-center gap-2 rounded-2xl border border-[#cfdbfb] bg-[#f8faff] py-1 pl-1 pr-3 shadow-sm dark:border-white/10 dark:bg-[#111827]">
                                <div
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-extrabold text-white ring-2 ring-white"
                                    style={{ background: 'linear-gradient(135deg, #2a3fa4 0%, #1D68E3 100%)' }}
                                >
                                    {(user?.name || 'Admin').trim().slice(0, 1).toUpperCase()}
                                </div>
                                <div className="hidden leading-tight sm:block">
                                    <div className="max-w-[120px] truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                                        {user?.name || 'My account'}
                                    </div>
                                    <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {(user?.role || 'admin').toUpperCase()}
                                    </div>
                                </div>
                                <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 dark:text-slate-500 sm:block" />
                            </div>
                        </div>
                    </header>

                    <main className="app-shell-main bg-[#f3f6fb] px-3 py-4 sm:px-4 lg:px-6 lg:py-5 dark:bg-[#020617]">
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
