import { useState } from 'react';
import { Outlet, useLocation, Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, BookOpen, FolderKanban, UserRound, ChevronDown, Search } from 'lucide-react';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';
import StudentSidebar from '../components/StudentSidebar';
import { useAuth } from '../../../context/authContext';
import { ShellSearchProvider, useShellSearch } from '../../../context/shellSearchContext';
import ThemeToggle from '../../../shared/components/ThemeToggle';

const pageTitles = [
    { match: /^\/student\/assignments\/[^/]+\/proposal/, title: 'Submit proposal' },
    { match: /^\/student\/assignments\/[^/]+/, title: 'Assignment detail' },
    { match: /^\/student\/assignments/, title: 'Assignments' },
    { match: /^\/student\/project\/[^/]+/, title: 'Project workspace' },
    { match: /^\/student\/project/, title: 'My projects' },
    { match: /^\/student\/profile/, title: 'Profile' },
    { match: /^\/student/, title: 'Dashboard' },
];

function resolveTitle(pathname) {
    const row = pageTitles.find((p) => p.match.test(pathname));
    return row?.title || 'Dashboard';
}

const mobileNav = [
    { label: 'Dashboard', to: '/student', icon: LayoutDashboard, end: true },
    { label: 'Assignments', to: '/student/assignments', icon: BookOpen },
    { label: 'Projects', to: '/student/project', icon: FolderKanban },
    { label: 'Profile', to: '/student/profile', icon: UserRound },
];

const StudentLayout = () => (
    <ShellSearchProvider>
        <StudentLayoutInner />
    </ShellSearchProvider>
);

/** Authenticated student shell — edge-attached sidebar + curved top-right corner. */
const StudentLayoutInner = () => {
    const { pathname } = useLocation();
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);
    const { query: shellSearchQuery, setQuery: setShellSearchQuery, placeholder: shellSearchPlaceholder } =
        useShellSearch();
    const title = resolveTitle(pathname);
    const today = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <div className="flex min-h-screen w-full bg-[#f8fafc] font-sans text-slate-900 dark:bg-[#020617] dark:text-slate-100">
            <StudentSidebar />

            <div className="flex min-h-screen min-w-0 flex-1 flex-col">
                    {/* Mobile top bar */}
                    <div className="lg:hidden flex items-center justify-between gap-3 border-b border-slate-200/80 bg-[#f8fafc] px-4 py-3 dark:border-white/10 dark:bg-[#0b1220]">
                        <Link to="/student">
                            <ProjectVerifyLogo size="sm" hideTextOnMobile />
                        </Link>
                        <div className="flex items-center gap-2">
                            <ThemeToggle compact />
                            <button
                                type="button"
                                onClick={() => setMobileOpen((v) => !v)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-[#111827]"
                            >
                                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    {mobileOpen && (
                        <div
                            className="lg:hidden border-b border-white/10 p-3 space-y-1 safe-area-px"
                            style={{ background: 'linear-gradient(180deg, #2a3fa4 0%, #223688 100%)' }}
                        >
                            <div className="relative mb-2 px-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                                <input
                                    type="search"
                                    value={shellSearchQuery}
                                    onChange={(e) => setShellSearchQuery(e.target.value)}
                                    placeholder={shellSearchPlaceholder}
                                    aria-label={shellSearchPlaceholder}
                                    className="w-full rounded-xl border border-white/20 bg-white/10 py-2.5 pl-10 pr-3 text-sm font-medium text-white placeholder:text-white/45 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20"
                                />
                            </div>
                            {mobileNav.map(({ label, to, icon: Icon, end }) => (
                                <NavLink
                                    key={to}
                                    to={to}
                                    end={end}
                                    onClick={() => setMobileOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${
                                            isActive ? 'bg-white text-[#1d2f82]' : 'text-white/85'
                                        }`
                                    }
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </NavLink>
                            ))}
                            <button
                                type="button"
                                onClick={() => {
                                    logout();
                                    navigate('/');
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-rose-300"
                            >
                                <LogOut className="h-4 w-4" /> Logout
                            </button>
                        </div>
                    )}

                    <header className="flex flex-col gap-2 px-4 pb-1 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:pt-5">
                        <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">{title}</h1>
                        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                            <div className="relative hidden sm:block w-[180px] lg:w-[220px]">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                                <input
                                    type="search"
                                    value={shellSearchQuery}
                                    onChange={(e) => setShellSearchQuery(e.target.value)}
                                    placeholder={shellSearchPlaceholder}
                                    aria-label={shellSearchPlaceholder}
                                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-[11px] font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#2a3fa4] focus:ring-2 focus:ring-[#2a3fa4]/15 dark:border-white/10 dark:bg-[#111827] dark:text-slate-100 dark:placeholder:text-slate-500"
                                />
                            </div>
                            <ThemeToggle compact className="hidden sm:inline-flex" />
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 shadow-sm dark:border-white/10 dark:bg-[#111827] dark:text-slate-300"
                            >
                                {today}
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                            </button>
                        </div>
                    </header>

                    <main className="app-page flex-1 overflow-y-auto px-4 pb-6 pt-3 sm:px-5 lg:px-6">
                        <Outlet />
                    </main>
                </div>
        </div>
    );
};

export default StudentLayout;
