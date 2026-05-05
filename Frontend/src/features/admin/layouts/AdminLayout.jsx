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
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';

const ADMIN_BLUE = '#1e56e3';
const CONTENT_BG = '#f8fafc';
const SIDEBAR_W = 330;
const RAIL_W = 100;

const AdminLayout = () => {
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

    const activeSection = navSections.find((s) => s.key === activeSectionKey) || navSections[0];
    const requestLogout = () => setShowLogoutConfirm(true);
    const confirmLogout = () => {
        logout();
        navigate('/');
    };

    const linkRow =
        'flex min-h-[46px] items-center gap-3 text-[14px] transition-[background,color,box-shadow] duration-200 ease-out';
    const linkIdle = `${linkRow} mx-2 rounded-xl px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900`;
    const linkActive = `${linkRow} mx-2 rounded-xl px-3 py-2 font-bold text-[#1e56e3] bg-blue-50 ring-1 ring-[#1e56e3]/12`;
    const iconBox =
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/80';
    const iconBoxActive =
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1e56e3]/12 text-[#1e56e3] ring-1 ring-[#1e56e3]/20';

    return (
        <div className="flex min-h-screen flex-col bg-[#f8fafc] font-sans antialiased">
            <header
                className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:hidden"
            >
                <button type="button" onClick={() => navigate('/admin')} className="flex min-w-0 items-center gap-2 text-left">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1e56e3] text-white shadow-sm">
                        <ShieldCheck className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <span className="truncate text-[15px] font-extrabold tracking-tight text-slate-900">ProjectVerify</span>
                </button>
                <NavLink
                    to="/admin"
                    className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                    Home
                </NavLink>
            </header>

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <aside
                    className="hidden h-screen shrink-0 lg:sticky lg:top-0 lg:block"
                    style={{ width: isSidebarCollapsed ? RAIL_W : SIDEBAR_W, minWidth: isSidebarCollapsed ? RAIL_W : SIDEBAR_W }}
                >
                    <div className="flex h-screen overflow-hidden rounded-r-[16px] bg-white shadow-[6px_0_24px_-18px_rgba(15,23,42,0.2)] ring-1 ring-slate-200">
                        <div className="flex w-[100px] shrink-0 flex-col items-center bg-gradient-to-b from-[#2a3fa4] to-[#223688] px-3 py-5 text-white">
                            <button
                                type="button"
                                onClick={() => navigate('/admin')}
                                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30"
                                title="Admin home"
                            >
                                <Activity className="h-5 w-5" strokeWidth={2.2} />
                            </button>

                            <div className="mt-6 flex w-full flex-1 flex-col items-center gap-2.5 overflow-y-auto">
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
                                            className={`flex w-full items-center justify-center rounded-[20px] px-2 py-3 transition-all ${
                                                isActive
                                                    ? 'bg-white text-[#1d2f82] shadow-[0_10px_22px_-12px_rgba(15,23,42,0.6)]'
                                                    : 'text-white/85 hover:bg-white/12 hover:text-white'
                                            }`}
                                        >
                                            <div className="flex flex-col items-center gap-1">
                                                <Icon className="h-[18px] w-[18px]" strokeWidth={2.3} />
                                                <span className={`text-[11px] font-semibold ${isActive ? 'text-[#1d2f82]' : 'text-white/85'}`}>
                                                    {section.name}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={requestLogout}
                                className="mt-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white/90 transition hover:bg-white/15 hover:text-white"
                                title="Logout"
                            >
                                <LogOut className="h-5 w-5" strokeWidth={2.2} />
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsSidebarCollapsed((v) => !v)}
                                className="mt-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25 transition hover:bg-white/20"
                                title={isSidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
                            >
                                <span className={`inline-block text-sm font-black transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`}>
                                    {'<'}
                                </span>
                            </button>
                        </div>

                        {!isSidebarCollapsed && <>
                            <div className="w-[2px] bg-[#eaf0ff] shadow-[1px_0_0_rgba(15,23,42,0.10)]" />
                            <div className="flex min-w-0 flex-1 flex-col bg-gradient-to-b from-[#f4f7ff] via-white to-[#f4f7ff] rounded-r-[16px] overflow-hidden">
                            <button
                                type="button"
                                onClick={() => navigate('/admin')}
                                className="mx-4 mb-2 mt-5 flex items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-slate-200/80 transition hover:bg-slate-50"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1e56e3]/10 text-[#1e56e3]">
                                    <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[14px] font-extrabold leading-tight tracking-[0.03em] text-slate-900">ProjectVerify</div>
                                    <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Admin console</div>
                                </div>
                            </button>

                            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto pb-4 pl-1 pr-1">
                                <p className="px-4 pb-1 pt-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    {activeSection?.name || 'Navigation'}
                                </p>
                                <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
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
                                                        <Icon className="h-[18px] w-[18px] stroke-[2]" />
                                                    </span>
                                                    {item.name}
                                                </>
                                            )}
                                        </NavLink>
                                    );
                                })}
                            </nav>

                            <div className="mt-auto border-t border-slate-200 px-2 pb-5 pt-3">
                                <button
                                    type="button"
                                    onClick={requestLogout}
                                    className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                                >
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/80">
                                        <LogOut className="h-[18px] w-[18px] stroke-[2]" />
                                    </span>
                                    Logout
                                </button>
                            </div>
                        </div>
                        </>}
                    </div>
                </aside>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f8fafc]" style={{ backgroundColor: CONTENT_BG }}>
                    <header className="flex h-[76px] shrink-0 items-center justify-between gap-4 bg-gradient-to-r from-[#f4f7ff] via-white to-[#f4f7ff] px-4 sm:px-6 lg:px-8">
                        <div className="min-w-0">
                            <div className="text-[15px] font-extrabold leading-tight text-[#1d2f82]">Welcome back</div>
                            <div className="text-[12px] font-semibold text-[#51628f]">Admin Dashboard</div>
                        </div>

                        <div className="mx-2 hidden min-w-0 max-w-2xl flex-1 md:block">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search"
                                    className="w-full rounded-xl border border-[#cfdbfb] bg-white/90 py-2.5 pl-10 pr-4 text-[14px] font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#2a3fa4] focus:bg-white focus:ring-2 focus:ring-[#2a3fa4]/15"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                            <button
                                type="button"
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#cfdbfb] bg-white text-[#53638f] transition-colors hover:bg-[#f5f8ff]"
                                title="Notifications"
                            >
                                <Bell className="h-5 w-5" strokeWidth={2} />
                            </button>
                            <div className="flex items-center gap-3 rounded-xl border border-[#cfdbfb] bg-white py-1.5 pl-2 pr-3 shadow-sm">
                                <div
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
                                    style={{ backgroundColor: ADMIN_BLUE }}
                                >
                                    {(user?.name || 'Admin').trim().slice(0, 1).toUpperCase()}
                                </div>
                                <div className="hidden leading-tight sm:block">
                                    <div className="max-w-[140px] truncate text-[13px] font-bold text-slate-800">{user?.name || 'My account'}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        {(user?.role || 'admin').toUpperCase()}
                                    </div>
                                </div>
                                <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
                            </div>
                        </div>
                    </header>

                    <main className="w-full flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8" style={{ backgroundColor: CONTENT_BG }}>
                        <Outlet />
                    </main>
                </div>
            </div>
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/55"
                        onClick={() => setShowLogoutConfirm(false)}
                        aria-label="Close logout confirmation"
                    />
                    <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <h3 className="text-lg font-black text-slate-900">Confirm Logout</h3>
                        <p className="mt-2 text-sm font-medium text-slate-600">Are you sure you want to logout now?</p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowLogoutConfirm(false)}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmLogout}
                                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLayout;
