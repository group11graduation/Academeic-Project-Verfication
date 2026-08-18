import { useState } from 'react';
import { Outlet, useLocation, Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, BookOpen, FolderKanban, UserRound, Users, ChevronDown } from 'lucide-react';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';
import StudentSidebar from '../components/StudentSidebar';
import { useAuth } from '../../../context/authContext';
import { ShellSearchProvider } from '../../../context/shellSearchContext';
import ThemeToggle from '../../../shared/components/ThemeToggle';
import { ADMIN_SIDEBAR_GRADIENT } from '../../admin/ui/adminTheme';

const pageTitles = [
    { match: /^\/student\/assignments\/[^/]+\/proposal/, title: 'Submit proposal' },
    { match: /^\/student\/assignments\/[^/]+/, title: 'Assignment detail' },
    { match: /^\/student\/assignments/, title: 'Assignments' },
    { match: /^\/student\/groups/, title: 'My groups' },
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
    { label: 'Home', to: '/student', icon: LayoutDashboard, end: true },
    { label: 'Groups', to: '/student/groups', icon: Users },
    { label: 'Work', to: '/student/assignments', icon: BookOpen },
    { label: 'Projects', to: '/student/project', icon: FolderKanban },
    { label: 'Profile', to: '/student/profile', icon: UserRound },
];

const StudentLayout = () => (
    <ShellSearchProvider>
        <StudentLayoutInner />
    </ShellSearchProvider>
);

/** Authenticated student shell - edge-attached sidebar + curved top-right corner. */
const StudentLayoutInner = () => {
    const { pathname } = useLocation();
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);
    const title = resolveTitle(pathname);
    const today = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <div className="flex min-h-screen w-full bg-[#f8fafc] text-[var(--sv-text)] antialiased [font-family:var(--sv-font-sans)] dark:bg-[#020617] dark:text-slate-100">
            <StudentSidebar />

            <div className="flex min-h-screen min-w-0 flex-1 flex-col [font-family:var(--sv-font-sans)]">
                    {/* Mobile top bar */}
                    <div className="lg:hidden flex items-center justify-between gap-3 border-b border-slate-200/80 bg-[#f8fafc] px-4 py-3 dark:border-white/10 dark:bg-[#0b1220]">
                        <Link to="/student">
                            <ProjectVerifyLogo size="lg" hideTextOnMobile tagline="" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <ThemeToggle compact />
                            <button
                                type="button"
                                onClick={() => setMobileOpen((v) => !v)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--sv-border)] bg-[var(--sv-card)] dark:border-white/10 dark:bg-[#111827]"
                            >
                                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    {mobileOpen && (
                        <div
                            className="lg:hidden border-b border-white/10 p-3 space-y-1 safe-area-px"
                            style={{ background: ADMIN_SIDEBAR_GRADIENT }}
                        >
                            {mobileNav.map(({ label, to, icon: Icon, end }) => (
                                <NavLink
                                    key={to}
                                    to={to}
                                    end={end}
                                    onClick={() => setMobileOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                                            isActive ? 'bg-[var(--sv-card)] font-semibold text-[#1d2f82]' : 'font-normal text-white/85'
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
                                className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-rose-300"
                            >
                                <LogOut className="h-4 w-4" /> Logout
                            </button>
                        </div>
                    )}

                    <header className="flex flex-col gap-2 px-4 pb-1 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:pt-5">
                        <h1 className="text-lg font-extrabold tracking-tight text-[var(--sv-text)] dark:text-slate-100 sm:text-xl">{title}</h1>
                        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                            <ThemeToggle compact className="hidden sm:inline-flex" />
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-[var(--sv-card)] px-3 py-1.5 text-[12px] font-semibold text-[var(--sv-muted)] shadow-sm dark:border-white/10 dark:bg-[#111827] dark:text-slate-300"
                            >
                                {today}
                                <ChevronDown className="h-3.5 w-3.5 text-[var(--sv-muted)] dark:text-[var(--sv-muted)]" />
                            </button>
                        </div>
                    </header>

                    <main className="app-page flex-1 overflow-y-auto px-4 pb-6 pt-3 sm:px-5 lg:px-6 [font-family:var(--sv-font-sans)]">
                        <Outlet />
                    </main>
                </div>
        </div>
    );
};

export default StudentLayout;
