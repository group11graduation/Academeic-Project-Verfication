import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    CheckSquare,
    ClipboardList,
    Shield,
    ShieldCheck,
    LogOut,
    Search,
    ChevronDown,
    Bell,
    Activity,
} from 'lucide-react';
import { useAuth } from '../../context/authContext';

const TEACHER_BLUE = '#1e56e3';
const CONTENT_BG = '#f8fafc';
const SIDEBAR_W = 248;
const RAIL_W = 72;

/** Teacher shell aligned with current admin two-part sidebar layout. */
const DashboardLayout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const classesItems = [{ name: 'My Classes', path: '/teacher/classes', icon: Users }];
    const workflowItems = [
        { name: 'Group Management', path: '/teacher/group-management', icon: CheckSquare },
        { name: 'Assignments', path: '/teacher/assignments', icon: ClipboardList },
    ];
    const adminItems = user?.roles?.includes('admin')
        ? [{ name: 'Admin Panel', path: '/admin', icon: Shield }]
        : [];

    const navSections = [
        {
            key: 'dashboard',
            name: 'Dashboard',
            icon: LayoutDashboard,
            links: [{ name: 'Dashboard', path: '/teacher', icon: LayoutDashboard, end: true }],
        },
        { key: 'classes', name: 'Classes', icon: Users, links: classesItems },
        { key: 'workflow', name: 'Workflow', icon: CheckSquare, links: workflowItems },
        ...(adminItems.length ? [{ key: 'admin', name: 'Admin', icon: Shield, links: adminItems }] : []),
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
        'flex min-h-[40px] items-center gap-2 text-[11px] transition-[background,color,box-shadow] duration-200 ease-out';
    const linkIdle = `${linkRow} mx-0.5 rounded-lg px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900`;
    const linkActive = `${linkRow} mx-0.5 rounded-lg px-2 py-1.5 font-bold text-[#1e56e3] bg-blue-50 ring-1 ring-[#1e56e3]/12`;

    const iconBox =
        'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-slate-200/80';
    const iconBoxActive =
        'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-[#1e56e3]/12 text-[#1e56e3] ring-1 ring-[#1e56e3]/20';

    return (
        <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#f8fafc] font-sans antialiased">
            <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:hidden">
                <button type="button" onClick={() => navigate('/teacher')} className="flex min-w-0 items-center gap-2 text-left">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1e56e3] text-white shadow-sm">
                        <Shield className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <span className="truncate text-[15px] font-extrabold tracking-tight text-slate-900">ScholarVerify</span>
                </button>
                <NavLink
                    to="/teacher"
                    className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                    Home
                </NavLink>
            </header>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
                <aside
                    className="hidden h-full max-h-[100dvh] shrink-0 lg:sticky lg:top-0 lg:block"
                    style={{ width: isSidebarCollapsed ? RAIL_W : SIDEBAR_W, minWidth: isSidebarCollapsed ? RAIL_W : SIDEBAR_W }}
                >
                    <div className="flex h-full max-h-[100dvh] overflow-hidden rounded-r-[16px] bg-white shadow-[6px_0_24px_-18px_rgba(15,23,42,0.2)] ring-1 ring-slate-200">
                        <div className="flex w-[72px] shrink-0 flex-col items-center bg-gradient-to-b from-[#2a3fa4] to-[#223688] px-1.5 py-3 text-white">
                            <button
                                type="button"
                                onClick={() => navigate('/teacher')}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30"
                                title="Teacher home"
                            >
                                <Activity className="h-[16px] w-[16px]" strokeWidth={2.2} />
                            </button>

                            <nav
                                className="mt-4 flex min-h-0 w-full flex-1 flex-col items-stretch justify-evenly gap-2 overflow-y-auto px-0.5 py-3"
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
                                            className={`flex w-full min-h-[56px] shrink-0 flex-col items-center justify-center rounded-xl px-1 py-2 transition-all ${
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
                                className="mt-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/90 transition hover:bg-white/15 hover:text-white"
                                title="Logout"
                            >
                                <LogOut className="h-[16px] w-[16px]" strokeWidth={2.2} />
                            </button>

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
                            <div className="w-[2px] bg-[#eaf0ff] shadow-[1px_0_0_rgba(15,23,42,0.10)]" />
                            <div className="flex min-w-0 flex-1 flex-col bg-gradient-to-b from-[#f4f7ff] via-white to-[#f4f7ff] rounded-r-[16px] overflow-hidden">
                            <button
                                type="button"
                                onClick={() => navigate('/teacher')}
                                className="mx-2 mb-2 mt-3 flex items-center gap-2 rounded-xl bg-white p-2 text-left ring-1 ring-slate-200/80 transition hover:bg-slate-50"
                            >
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1e56e3]/10 text-[#1e56e3]">
                                    <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[11px] font-extrabold leading-tight tracking-[0.03em] text-slate-900">ScholarVerify</div>
                                    <div className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">Faculty console</div>
                                </div>
                            </button>

                            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3 pl-0.5 pr-0.5">
                                <p className="px-2 pb-0.5 pt-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                                    {activeSection?.name || 'Navigation'}
                                </p>
                                <p className="px-2 pb-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
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

                            <div className="mt-auto border-t border-slate-200 px-1.5 pb-3 pt-2">
                                <button
                                    type="button"
                                    onClick={requestLogout}
                                    className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-xl px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                                >
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 ring-1 ring-slate-200/80">
                                        <LogOut className="h-3.5 w-3.5 stroke-[2]" />
                                    </span>
                                    Logout
                                </button>
                            </div>
                        </div>
                        </>}
                    </div>
                </aside>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f8fafc]" style={{ backgroundColor: CONTENT_BG }}>
                    <header className="flex h-[48px] shrink-0 items-center justify-between gap-2 bg-gradient-to-r from-[#f4f7ff] via-white to-[#f4f7ff] px-3 sm:px-4 lg:px-4">
                        <div className="min-w-0">
                            <div className="text-[12px] font-extrabold leading-tight text-[#1d2f82]">Welcome back</div>
                            <div className="text-[10px] font-semibold text-[#51628f]">Teacher Dashboard</div>
                        </div>

                        <div className="mx-2 hidden min-w-0 max-w-xl flex-1 md:block">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search"
                                    className="w-full rounded-lg border border-[#cfdbfb] bg-white/90 py-1.5 pl-8 pr-2.5 text-[11px] font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#2a3fa4] focus:bg-white focus:ring-2 focus:ring-[#2a3fa4]/15"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#cfdbfb] bg-white text-[#53638f] transition-colors hover:bg-[#f5f8ff]"
                                title="Notifications"
                            >
                                <Bell className="h-4 w-4" strokeWidth={2} />
                            </button>
                            <div className="flex items-center gap-1.5 rounded-lg border border-[#cfdbfb] bg-white py-0.5 pl-1 pr-2 shadow-sm">
                                <div
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                                    style={{ backgroundColor: TEACHER_BLUE }}
                                >
                                    {(user?.name || 'T').trim().slice(0, 1).toUpperCase()}
                                </div>
                                <div className="hidden leading-tight sm:block">
                                    <div className="max-w-[100px] truncate text-[11px] font-bold text-slate-800">{user?.name || 'My account'}</div>
                                    <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">
                                        {(user?.department || 'Faculty').toUpperCase()}
                                    </div>
                                </div>
                                <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
                            </div>
                        </div>
                    </header>

                    <main className="app-shell-main px-3 py-2 sm:px-3 lg:px-4 lg:py-3" style={{ backgroundColor: CONTENT_BG }}>
                        <div className="app-shell-page app-page">{children ?? <Outlet />}</div>
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
                                    style={{ backgroundColor: TEACHER_BLUE }}
                                >
                                    <LogOut className="h-5 w-5" strokeWidth={2.25} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#51628f]">Session</p>
                                    <h3 id="logout-dialog-title" className="mt-0.5 text-base font-black tracking-tight text-[#1d2f82]">
                                        Sign out of your account?
                                    </h3>
                                    <p className="mt-1.5 text-[12px] font-medium leading-snug text-[#51628f]">
                                        You will need to sign in again to access the teacher dashboard, assignments, and class tools.
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
                                style={{ backgroundColor: TEACHER_BLUE }}
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

export default DashboardLayout;
