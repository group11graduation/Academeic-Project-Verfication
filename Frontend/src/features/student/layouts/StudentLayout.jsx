import { useState } from 'react';
import { Outlet, useLocation, Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, BookOpen, FolderKanban, UserRound, Rocket, ChevronDown } from 'lucide-react';
import StudentSidebar from '../components/StudentSidebar';
import { useAuth } from '../../../context/authContext';
import { BRAND } from '../../../shared/ui/brandTheme';

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

/** Authenticated student shell — edge-attached sidebar + curved top-right corner. */
const StudentLayout = () => {
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
        <div className="flex min-h-screen w-full font-sans text-slate-900" style={{ backgroundColor: BRAND.contentBg }}>
            <StudentSidebar />

            <div className="flex min-h-screen min-w-0 flex-1 flex-col">
                    {/* Mobile top bar */}
                    <div className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/80 bg-[#f8fafc]">
                        <Link to="/student" className="flex items-center gap-2">
                            <div
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-white"
                                style={{ backgroundColor: BRAND.primary }}
                            >
                                <Rocket className="h-4 w-4" />
                            </div>
                            <span className="font-extrabold text-sm">ScholarVerify</span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => setMobileOpen((v) => !v)}
                            className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center bg-white"
                        >
                            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                    </div>

                    {mobileOpen && (
                        <div
                            className="lg:hidden border-b border-white/10 p-3 space-y-1"
                            style={{ background: 'linear-gradient(180deg, #2a3fa4 0%, #223688 100%)' }}
                        >
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

                    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 pt-4 sm:pt-5 pb-1">
                        <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">{title}</h1>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 shadow-sm"
                        >
                            {today}
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                    </header>

                    <main className="app-page flex-1 overflow-y-auto px-4 sm:px-5 lg:px-6 pb-6 pt-3">
                        <Outlet />
                    </main>
                </div>
        </div>
    );
};

export default StudentLayout;
