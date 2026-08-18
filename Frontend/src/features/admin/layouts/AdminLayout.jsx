import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
    ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import { ShellSearchProvider, useShellSearch } from '../../../context/shellSearchContext';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';
import ThemeToggle from '../../../shared/components/ThemeToggle';
import ShellMobileDrawer from '../../../shared/components/ShellMobileDrawer';
import NotificationBell from '../../../shared/components/NotificationBell';
import {
    ADMIN,
    ADMIN_AVATAR_GRADIENT,
    ADMIN_SIDEBAR_GRADIENT,
    ADMIN_MOBILE_GRADIENT,
} from '../ui/adminTheme';

const ADMIN_BLUE = ADMIN.primary;
const SIDEBAR_W = 220;
const FRAME_BG = ADMIN.frameBg;
const CONTENT_BG = ADMIN.contentBg;
const BORDER = ADMIN.primaryDeep;

const AdminLayout = () => (
    <ShellSearchProvider>
        <AdminLayoutInner />
    </ShellSearchProvider>
);

const AdminLayoutInner = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { query, setQuery, placeholder } = useShellSearch();

    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    /** undefined = follow current route section; null = all collapsed; string = that group open */
    const [manualOpenKey, setManualOpenKey] = useState(undefined);

    const hasTeacherRole = (user?.roles || []).includes('teacher');

    const navSections = useMemo(() => {
        const sections = [
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
                links: [
                    { name: 'Admins', path: '/admin/admins', icon: Shield },
                    { name: 'Teachers', path: '/admin/teachers', icon: GraduationCap },
                    { name: 'Students', path: '/admin/students', icon: Users },
                ],
            },
            {
                key: 'academic',
                name: 'Academic',
                icon: BookMarked,
                links: [
                    { name: 'Setup Workflow', path: '/admin/setup-workflow', icon: Workflow },
                    { name: 'Classes', path: '/admin/classes', icon: BookOpen },
                    { name: 'Subjects', path: '/admin/subjects', icon: BookMarked },
                    { name: 'Academic Structure', path: '/admin/academic-structure', icon: Building2 },
                    { name: 'Semesters', path: '/admin/semesters', icon: CalendarRange },
                ],
            },
            {
                key: 'data',
                name: 'Data',
                icon: FileSpreadsheet,
                links: [{ name: 'Import / Export', path: '/admin/import-export', icon: FileSpreadsheet }],
            },
        ];
        if (hasTeacherRole) {
            sections.push({
                key: 'teacher',
                name: 'Teacher Panel',
                icon: Shield,
                links: [{ name: 'Teacher Panel', path: '/teacher', icon: Shield }],
            });
        }
        return sections;
    }, [hasTeacherRole]);

    const pathMatches = useCallback(
        (link, pathname) =>
            link.end ? pathname === link.path : pathname === link.path || pathname.startsWith(`${link.path}/`),
        []
    );

    const routeSectionKey = useMemo(() => {
        for (const section of navSections) {
            if (section.links.some((link) => pathMatches(link, location.pathname))) return section.key;
        }
        return 'dashboard';
    }, [navSections, location.pathname, pathMatches]);

    useEffect(() => {
        setManualOpenKey(undefined);
    }, [location.pathname]);

    const openKey = manualOpenKey === undefined ? routeSectionKey : manualOpenKey;

    const toggleGroup = (key) => {
        setManualOpenKey((prev) => {
            const current = prev === undefined ? routeSectionKey : prev;
            return current === key ? null : key;
        });
    };

    const requestLogout = () => setShowLogoutConfirm(true);
    const confirmLogout = () => {
        logout();
        navigate('/');
    };

    const firstName = (user?.name || 'Admin').trim().split(/\s+/)[0];
    const initial = (user?.name || 'A').trim().slice(0, 1).toUpperCase();

    const cutoutActive = (isActive) =>
        isActive ? (
            <>
                <span
                    aria-hidden
                    className="pointer-events-none absolute -right-px -top-3 h-3 w-3 bg-transparent"
                    style={{
                        borderBottomRightRadius: '0.75rem',
                        boxShadow: `4px 4px 0 0 ${CONTENT_BG}`,
                    }}
                />
                <span
                    aria-hidden
                    className="pointer-events-none absolute -bottom-3 -right-px h-3 w-3 bg-transparent"
                    style={{
                        borderTopRightRadius: '0.75rem',
                        boxShadow: `4px -4px 0 0 ${CONTENT_BG}`,
                    }}
                />
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 -right-3 w-3"
                    style={{ backgroundColor: CONTENT_BG }}
                />
            </>
        ) : null;

    const parentActiveClass =
        'relative z-[1] flex w-full items-center gap-2.5 rounded-l-2xl bg-[#f3f5fa] py-2.5 pl-3.5 pr-3 text-[12px] font-bold text-[#182863]';
    const parentIdleClass =
        'relative z-[1] mx-2 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-xl py-2.5 pl-2.5 pr-2 text-[12px] font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white';

    return (
        <div
            className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden antialiased [font-family:var(--sv-font-sans)]"
            style={{
                backgroundColor: FRAME_BG,
                fontSize: '12.5px',
                ['--sv-primary']: ADMIN.primary,
                ['--sv-primary-hover']: ADMIN.primaryHover,
                ['--sv-action']: ADMIN.primary,
                ['--sv-shell']: ADMIN.primary,
            }}
        >
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
                panelGradient={ADMIN_MOBILE_GRADIENT}
            />

            <div className="flex min-h-0 min-w-0 flex-1 flex-col p-0 lg:p-1">
                <div
                    className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-white lg:rounded-xl lg:border lg:shadow-sm"
                    style={{ borderColor: `${BORDER}88` }}
                >
                    <aside
                        className="relative z-20 hidden h-full max-h-full shrink-0 flex-col overflow-hidden lg:flex"
                        style={{
                            width: SIDEBAR_W,
                            minWidth: SIDEBAR_W,
                            background: ADMIN_SIDEBAR_GRADIENT,
                        }}
                    >
                        <div className="flex shrink-0 flex-col items-center px-3 pb-3 pt-5 text-center">
                            <div className="relative mb-2.5">
                                <div
                                    className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-extrabold text-white"
                                    style={{
                                        background: ADMIN_AVATAR_GRADIENT,
                                        boxShadow: '0 0 0 3px rgba(255,255,255,0.22), 0 0 18px rgba(38,60,150,0.45)',
                                    }}
                                >
                                    {initial}
                                </div>
                            </div>
                            <p className="max-w-full truncate text-[13px] font-extrabold tracking-tight text-white">
                                {user?.name || 'Admin'}
                            </p>
                            <p className="mt-0.5 max-w-full truncate text-[10px] font-medium text-white/55">
                                {user?.email || 'admin@projectverify'}
                            </p>
                        </div>

                        <nav
                            className="relative flex min-h-0 flex-1 flex-col justify-start gap-0.5 overflow-y-auto overflow-x-hidden pb-2 pl-2.5 pr-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                            aria-label="Admin navigation"
                        >
                            {navSections.map((section) => {
                                const SectionIcon = section.icon;
                                const links = section.links || [];
                                const isSingle = links.length === 1;
                                const isOpen = openKey === section.key;

                                if (isSingle) {
                                    const item = links[0];
                                    return (
                                        <NavLink
                                            key={section.key}
                                            to={item.path}
                                            end={Boolean(item.end)}
                                            className={({ isActive }) => (isActive ? parentActiveClass : parentIdleClass)}
                                        >
                                            {({ isActive }) => (
                                                <>
                                                    {cutoutActive(isActive)}
                                                    <SectionIcon
                                                        className={`relative z-[1] h-4 w-4 shrink-0 ${
                                                            isActive ? 'text-[#263c96]' : 'text-white/75'
                                                        }`}
                                                        strokeWidth={2.15}
                                                    />
                                                    <span className="relative z-[1] truncate">{section.name}</span>
                                                </>
                                            )}
                                        </NavLink>
                                    );
                                }

                                return (
                                    <div key={section.key} className="min-w-0">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleGroup(section.key);
                                            }}
                                            className={parentIdleClass}
                                            aria-expanded={isOpen}
                                        >
                                            <SectionIcon className="h-4 w-4 shrink-0 text-white/75" strokeWidth={2.15} />
                                            <span className="min-w-0 flex-1 truncate text-left">{section.name}</span>
                                            <ChevronDown
                                                className={`h-3.5 w-3.5 shrink-0 text-white/50 transition-transform duration-200 ${
                                                    isOpen ? 'rotate-180' : ''
                                                }`}
                                            />
                                        </button>

                                        {isOpen ? (
                                            <div className="mt-0.5 space-y-0.5 pb-1 pl-1.5">
                                                {links.map((item) => {
                                                    const Icon = item.icon || SectionIcon;
                                                    return (
                                                        <NavLink
                                                            key={item.path}
                                                            to={item.path}
                                                            end={Boolean(item.end)}
                                                            className={({ isActive }) =>
                                                                [
                                                                    'relative z-[1] flex items-center gap-2 py-2 pl-3 pr-2.5 text-[11px] font-semibold transition-colors',
                                                                    isActive
                                                                        ? 'rounded-l-2xl bg-[#f3f5fa] text-[#182863]'
                                                                        : 'mx-1 rounded-lg text-white/75 hover:bg-white/10 hover:text-white',
                                                                ].join(' ')
                                                            }
                                                        >
                                                            {({ isActive }) => (
                                                                <>
                                                                    {cutoutActive(isActive)}
                                                                    <Icon
                                                                        className={`relative z-[1] h-3.5 w-3.5 shrink-0 ${
                                                                            isActive ? 'text-[#263c96]' : 'opacity-80'
                                                                        }`}
                                                                        strokeWidth={2}
                                                                    />
                                                                    <span className="relative z-[1] truncate">{item.name}</span>
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

                        <div className="mt-auto shrink-0 border-t border-white/10 px-3 py-3">
                            <button
                                type="button"
                                onClick={requestLogout}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-2.5 py-2 text-[12px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/18"
                            >
                                <Power className="h-3.5 w-3.5" strokeWidth={2.2} />
                                Logout
                            </button>
                        </div>
                    </aside>

                    <div
                        className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                        style={{ backgroundColor: CONTENT_BG }}
                    >
                        <header className="hidden shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-4 lg:flex">
                            <div className="min-w-0">
                                <h1 className="truncate text-[1.35rem] font-extrabold leading-tight tracking-tight text-[#182863]">
                                    Welcome {firstName} !
                                </h1>
                                <p className="mt-0.5 text-[12px] font-semibold text-[#51628f]">Over View</p>
                            </div>

                            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                                <label className="relative hidden min-w-0 max-w-md flex-1 xl:block">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder={placeholder || 'Search…'}
                                        className="h-9 w-full rounded-full border-0 bg-white pl-9 pr-3 text-[12px] font-medium text-slate-800 shadow-sm outline-none ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:ring-2 focus:ring-[#263c96]/25"
                                    />
                                </label>

                                <ThemeToggle
                                    compact
                                    className="h-9 rounded-xl border-0 bg-white px-2.5 shadow-sm ring-1 ring-slate-200/80"
                                />
                                <NotificationBell variant="admin" />
                            </div>
                        </header>

                        <div className="hidden px-5 pb-2 lg:block xl:hidden">
                            <label className="relative block">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={placeholder || 'Search…'}
                                    className="h-9 w-full rounded-full border-0 bg-white pl-9 pr-3 text-[12px] font-medium text-slate-800 shadow-sm outline-none ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:ring-2 focus:ring-[#263c96]/25"
                                />
                            </label>
                        </div>

                        <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:px-4 lg:px-5">
                            <div className="app-shell-page app-page">
                                <Outlet />
                            </div>
                        </main>
                    </div>
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
                                    <h3 id="logout-dialog-title" className="mt-0.5 text-base font-black tracking-tight text-[#182863]">
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
                                className="w-full rounded-lg border border-[#cfdbfb] bg-white px-4 py-2 text-[12px] font-bold text-[#182863] transition-colors hover:bg-[#f5f8ff] sm:w-auto"
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
