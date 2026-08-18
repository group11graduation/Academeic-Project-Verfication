import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    BookOpen,
    FolderKanban,
    UserRound,
    MessageSquare,
    LogOut,
    ExternalLink,
    Users,
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import { BRAND } from '../../../shared/ui/brandTheme';
import { ADMIN_SIDEBAR_GRADIENT } from '../../admin/ui/adminTheme';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';
import ThemeToggle from '../../../shared/components/ThemeToggle';

const navItems = [
    { label: 'Dashboard', to: '/student', icon: LayoutDashboard, end: true },
    { label: 'My groups', to: '/student/groups', icon: Users },
    { label: 'Assignments', to: '/student/assignments', icon: BookOpen },
    { label: 'My Projects', to: '/student/project', icon: FolderKanban },
    { label: 'Contact teacher', to: '/student/messages', icon: MessageSquare },
    { label: 'Profile', to: '/student/profile', icon: UserRound },
];

const StudentSidebar = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <aside
            className="hidden min-h-screen w-[200px] shrink-0 flex-col rounded-tr-[56px] py-5 pl-4 pr-3 text-white antialiased [font-family:var(--sv-font-sans)] lg:flex xl:w-[220px] xl:rounded-tr-[64px]"
            style={{ background: ADMIN_SIDEBAR_GRADIENT }}
        >
            <Link to="/student" className="mb-5 px-2">
                <ProjectVerifyLogo onDark plainMark size="sm" tagline="" />
            </Link>

            <nav className="flex-1 space-y-1 px-1">
                {navItems.map(({ label, to, icon: Icon, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                            `flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-semibold transition-all ${
                                isActive
                                    ? 'bg-white text-[#1d2f82] shadow-[0_10px_22px_-12px_rgba(15,23,42,0.55)]'
                                    : 'text-white/85 hover:bg-white/12 hover:text-white'
                            }`
                        }
                    >
                        <Icon className="h-[17px] w-[17px] shrink-0 stroke-[2.2]" />
                        {label}
                    </NavLink>
                ))}
            </nav>

            <div className="mt-4 mr-1 rounded-xl bg-[var(--sv-card)] p-3 text-[var(--sv-text)] shadow-lg ring-1 ring-[var(--sv-border)]/80 dark:bg-[#111827] dark:text-slate-100 dark:ring-white/10">
                <p className="text-[10px] font-bold leading-snug text-[var(--sv-text)] dark:text-slate-100">
                    Need more time? Use Contact teacher to request a deadline extension.
                </p>
                <Link
                    to="/student/messages"
                    className="mt-2.5 inline-flex text-[11px] font-black hover:underline"
                    style={{ color: BRAND.shell }}
                >
                    Open messages →
                </Link>
            </div>

            <Link
                to="/"
                className="mt-5 flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-white/55 hover:text-white transition-colors"
            >
                <ExternalLink className="h-3.5 w-3.5" /> System overview
            </Link>

            <div className="mt-2 px-3">
                <ThemeToggle
                    compact
                    iconOnly
                    className="w-full border-white/20 bg-white/10 text-white hover:bg-white/15 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                />
            </div>

            <button
                type="button"
                onClick={handleLogout}
                className="mt-1 mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-white/80 hover:bg-white/12 w-full text-left transition-colors"
            >
                <LogOut className="h-[17px] w-[17px]" />
                Logout
            </button>
        </aside>
    );
};

export default StudentSidebar;
