import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
    Rocket,
    LayoutDashboard,
    BookOpen,
    FolderKanban,
    UserRound,
    LogOut,
    ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import { BRAND, RAIL_GRADIENT } from '../../../shared/ui/brandTheme';

const navItems = [
    { label: 'Dashboard', to: '/student', icon: LayoutDashboard, end: true },
    { label: 'Assignments', to: '/student/assignments', icon: BookOpen },
    { label: 'My Projects', to: '/student/project', icon: FolderKanban },
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
            className="hidden lg:flex w-[200px] xl:w-[220px] shrink-0 min-h-screen flex-col text-white py-5 pl-4 pr-3 rounded-tr-[56px] xl:rounded-tr-[64px]"
            style={{ background: RAIL_GRADIENT }}
        >
            <Link to="/student" className="flex items-center gap-2 px-2 mb-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/30">
                    <Rocket className="h-3.5 w-3.5" strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                    <span className="block text-[12px] font-extrabold tracking-tight leading-tight">ScholarVerify</span>
                    <span className="block text-[8px] font-semibold uppercase tracking-[0.16em] text-white/60 mt-0.5">
                        Student console
                    </span>
                </div>
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

            <div className="mt-4 mr-1 rounded-xl bg-white p-3 text-slate-900 shadow-lg ring-1 ring-slate-200/80">
                <p className="text-[10px] font-bold leading-snug text-slate-800">
                    Submit before deadlines and check teacher feedback in Assignments.
                </p>
                <Link
                    to="/student/assignments"
                    className="mt-2.5 inline-flex text-[11px] font-black hover:underline"
                    style={{ color: BRAND.shell }}
                >
                    Open assignments →
                </Link>
            </div>

            <Link
                to="/"
                className="mt-5 flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-white/55 hover:text-white transition-colors"
            >
                <ExternalLink className="h-3.5 w-3.5" /> System overview
            </Link>

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
