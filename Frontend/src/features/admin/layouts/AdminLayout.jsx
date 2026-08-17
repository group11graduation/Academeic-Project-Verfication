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
    ChevronLeft,
    ChevronRight,
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
const SIDEBAR_W = 260;
const SIDEBAR_COLLAPSED_W = 76;

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
        { key: 'people', name: 'People', icon: Users, links: peopleChildren },
        { key: 'academic', name: 'Academic', icon: BookMarked, links: academicItems },
        { key: 'data', name: 'Data', icon: FileSpreadsheet, links: dataItems },
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

    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
    const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
    const [openGroups, setOpenGroups] = React.useState(() => {
        const key = inferSectionKeyByPath(location.pathname);
        return { [key]: true };
    });

    React.useEffect(() => {
        const key = inferSectionKeyByPath(location.pathname);
        setOpenGroups((prev) => ({ ...prev, [key]: true }));
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

    const toggleGroup = (key) => {
        setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const requestLogout = () => setShowLogoutConfirm(true);
    const confirmLogout = () => {
        logout();
        navigate('/');
    };

    const sidebarWidth = isSidebarCollapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W;
    const firstName = (user?.name || 'Admin').trim().split(/\s+/)[0];
    const initial = (user?.name || 'A').trim().slice(0, 1).toUpperCase();

    return (
        <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#f3f6fb] font-sans antialiased dark:bg-[#020617] dark:text-slate-100">
            <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm safe-area-px dark:border-white/10 dark:bg-[#0b1220] lg:hidden">
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
                {/* Single unified sidebar — no icon rail + secondary panel */}
                <aside
                    className="relative hidden h-full max-h-[100dvh] shrink-0 flex-col overflow-hidden bg-gradient-to-b from-[#2a3fa4] to-[#1d2f82] text-white shadow-[8px_0_28px_-16px_rgba(29,47,130,0.55)] lg:flex"
                    style={{ width: sidebarWidth, minWidth: sidebarWidth }}
                >
                    <div className={`flex items-center gap-3 border-b border-white/10 ${isSidebarCollapsed ? 'justify-center px-2 py-4' : 'px-4 py-4'}`}>
                        <button
                            type="button"
                            onClick={() => navigate('/admin')}
                            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-white/40"
                            title="Admin home"
                            aria-label="Project Verify — Admin home"
                        >
                            <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
                        </button>
                        {!isSidebarCollapsed ? (
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-extrabold tracking-tight">Project Verify</p>
                                <p className="truncate text-[11px] font-medium text-white/65">Admin console</p>
                            </div>
                        ) : null}
                    </div>

                    {!isSidebarCollapsed ? (
                        <div className="mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15">
                            <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ring-2 ring-white/25"
                                style={{ background: 'linear-gradient(135deg, #4f6fff 0%, #1D68E3 100%)' }}
                            >
                                {initial}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-bold">{user?.name || 'Admin'}</p>
                                <p className="truncate text-[10px] text-white/60">{user?.email || ''}</p>
                            </div>
                        </div>
                    ) : null}

                    <nav
                        className={`flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-3 ${isSidebarCollapsed ? 'px-1.5' : 'px-2.5'}`}
                        aria-label="Admin navigation"
                    >
                        {navSections.map((section) => {
                            const SectionIcon = section.icon;
                            const links = section.links || [];
                            const isSingle = links.length === 1;
                            const isOpen = Boolean(openGroups[section.key]);
                            const sectionHasActive = links.some((link) =>
                                link.end
                                    ? location.pathname === link.path
                                    : location.pathname === link.path || location.pathname.startsWith(`${link.path}/`)
                            );

                            if (isSidebarCollapsed) {
                                const target = links[0];
                                return (
                                    <button
                                        key={section.key}
                                        type="button"
                                        title={section.name}
                                        onClick={() => {
                                            if (target?.path) navigate(target.path);
                                            setIsSidebarCollapsed(false);
                                            setOpenGroups((prev) => ({ ...prev, [section.key]: true }));
                                        }}
                                        className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2.5 transition ${
                                            sectionHasActive
                                                ? 'bg-white text-[#1d2f82] shadow-md'
                                                : 'text-white/85 hover:bg-white/12'
                                        }`}
                                    >
                                        <SectionIcon className="h-[18px] w-[18px]" strokeWidth={2.3} />
                                        <span className="text-center text-[9px] font-semibold leading-tight">{section.name}</span>
                                    </button>
                                );
                            }

                            if (isSingle) {
                                const item = links[0];
                                return (
                                    <NavLink
                                        key={section.key}
                                        to={item.path}
                                        end={Boolean(item.end)}
                                        className={({ isActive }) =>
                                            `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold transition ${
                                                isActive
                                                    ? 'bg-white text-[#1d2f82] shadow-md'
                                                    : 'text-white/90 hover:bg-white/12'
                                            }`
                                        }
                                    >
                                        <SectionIcon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                                        <span className="truncate">{section.name}</span>
                                    </NavLink>
                                );
                            }

                            return (
                                <div key={section.key} className="mb-0.5">
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(section.key)}
                                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold transition ${
                                            sectionHasActive
                                                ? 'bg-white/15 text-white'
                                                : 'text-white/90 hover:bg-white/10'
                                        }`}
                                        aria-expanded={isOpen}
                                    >
                                        <SectionIcon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                                        <span className="min-w-0 flex-1 truncate">{section.name}</span>
                                        <ChevronDown
                                            className={`h-4 w-4 shrink-0 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>

                                    {isOpen ? (
                                        <div className="mt-1 space-y-0.5 border-l border-white/20 ml-5 pl-2">
                                            {links.map((item) => {
                                                const Icon = item.icon || SectionIcon;
                                                return (
                                                    <NavLink
                                                        key={item.path}
                                                        to={item.path}
                                                        end={Boolean(item.end)}
                                                        className={({ isActive }) =>
                                                            `flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-semibold transition ${
                                                                isActive
                                                                    ? 'bg-white text-[#1d2f82] shadow-sm'
                                                                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                                                            }`
                                                        }
                                                    >
                                                        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                                                        <span className="truncate">{item.name}</span>
                                                    </NavLink>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </nav>

                    <div className={`mt-auto border-t border-white/10 ${isSidebarCollapsed ? 'px-1.5 py-3' : 'px-3 py-3'}`}>
                        {!isSidebarCollapsed ? (
                            <div className="mb-2 flex items-center gap-2">
                                <ThemeToggle
                                    compact
                                    className="flex-1 justify-center border-white/20 bg-white/10 text-white hover:bg-white/15 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                                />
                                <button
                                    type="button"
                                    onClick={requestLogout}
                                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 text-[12px] font-bold text-white ring-1 ring-white/15 transition hover:bg-rose-500/80"
                                >
                                    <LogOut className="h-3.5 w-3.5" />
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <div className="mb-2 flex flex-col items-center gap-2">
                                <ThemeToggle
                                    compact
                                    iconOnly
                                    className="h-9 w-9 rounded-xl border-white/20 bg-white/10 px-0 py-0 text-white hover:bg-white/15 dark:border-white/20 dark:bg-white/10 dark:text-white"
                                />
                                <button
                                    type="button"
                                    onClick={requestLogout}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-rose-500/80"
                                    title="Logout"
                                >
                                    <LogOut className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setIsSidebarCollapsed((v) => !v)}
                            className={`flex items-center justify-center gap-1 rounded-xl bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/15 ${
                                isSidebarCollapsed ? 'mx-auto h-8 w-8' : 'h-8 w-full text-[11px] font-bold'
                            }`}
                            title={isSidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
                        >
                            {isSidebarCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                            ) : (
                                <>
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                    Collapse
                                </>
                            )}
                        </button>
                    </div>
                </aside>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f3f6fb] dark:bg-[#020617]">
                    <header className="hidden min-h-[64px] shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-5 lg:flex lg:px-6 dark:border-white/10 dark:bg-[#0b1220]/95">
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-lg font-extrabold leading-tight tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">
                                Welcome {firstName}!
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
                                    {initial}
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
