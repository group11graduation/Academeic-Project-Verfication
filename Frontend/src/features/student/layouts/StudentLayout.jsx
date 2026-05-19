import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    BookOpen,
    Rocket,
    UserRound,
    LogOut,
    Search
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';

const StudentLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const links = [
        { label: 'Dashboard', to: '/student', end: true, icon: LayoutDashboard },
        { label: 'Assignments', to: '/student/assignments', icon: BookOpen },
        { label: 'My Project', to: '/student/project', icon: Rocket },
        { label: 'Profile', to: '/student/profile', icon: UserRound },
    ];

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-[#F8FAFB] p-4 md:p-6">
            <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1600px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm md:h-[calc(100vh-3rem)]">
                <aside className="hidden w-[250px] shrink-0 border-r border-slate-200 bg-gradient-to-b from-[#2a3fa4] to-[#223688] p-4 text-white lg:flex lg:flex-col">
                    <div className="mb-6 flex items-center gap-2">
                        <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                            <Rocket className="h-5 w-5" />
                        </div>
                        <span className="text-[14px] font-black tracking-wide">Student Hub</span>
                    </div>

                    <div className="mb-6 rounded-xl bg-white/15 p-3">
                        <p className="text-[12px] font-bold">{user?.name || 'Student'}</p>
                        <p className="text-[10px] uppercase tracking-wider text-white/80">
                            {user?.studentId || user?.email || 'Academic account'}
                        </p>
                    </div>

                    <nav className="space-y-1.5">
                        {links.map((link) => {
                            const Icon = link.icon;
                            return (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    end={link.end}
                                    className={({ isActive }) =>
                                        `flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold transition-colors ${
                                            isActive ? 'bg-white text-[#1d2f82]' : 'text-white/95 hover:bg-white/15'
                                        }`
                                    }
                                >
                                    <Icon className="h-4 w-4" />
                                    {link.label}
                                </NavLink>
                            );
                        })}
                    </nav>

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="mt-auto flex items-center gap-2 rounded-xl border border-white/30 px-3 py-2.5 text-[12px] font-bold text-white hover:bg-white/15"
                    >
                        <LogOut className="h-4 w-4" />
                        Logout
                    </button>
                </aside>

                <section className="min-w-0 flex-1 bg-[#f7f9fc]">
                    <div className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h1 className="text-[15px] font-extrabold text-slate-800">Student Workspace</h1>
                                <p className="text-[11px] font-semibold text-slate-500">Project and assignment timeline</p>
                            </div>
                            <div className="relative w-[220px] max-w-[45vw]">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[12px] text-slate-700 outline-none focus:border-[#1D68E3]"
                                />
                            </div>
                        </div>
                    </div>
                    <main className="h-[calc(100%-65px)] overflow-y-auto p-4 md:p-6">
                        <Outlet />
                    </main>
                </section>
            </div>
        </div>
    );
};

export default StudentLayout;

