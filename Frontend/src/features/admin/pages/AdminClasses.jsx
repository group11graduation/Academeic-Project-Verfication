import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, Users, BookOpen, Beaker, GraduationCap, Code2, Calculator, Loader2 } from 'lucide-react';
import adminClassService from '../../../services/adminClassService';

const AdminClasses = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const res = await adminClassService.getClasses();
                if (res.success) setClasses(res.data);
            } catch (error) {
                console.error('Error fetching classes:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchClasses();
    }, []);

    const getCategoryStyles = (category) => {
        switch (category) {
            case 'ACADEMIC':
                return { color: 'bg-gradient-to-br from-[#1D68E3] to-[#3B82F6]', icon: GraduationCap };
            case 'LAB BASED':
                return { color: 'bg-gradient-to-br from-[#1D68E3] to-[#2563EB]', icon: Beaker };
            case 'THEORY':
                return { color: 'bg-gradient-to-br from-[#3B82F6] to-[#60A5FA]', icon: BookOpen };
            case 'WORKSHOP':
                return { color: 'bg-[#1E293B]', icon: Code2 };
            case 'SEMINAR':
                return { color: 'bg-gradient-to-br from-[#1D68E3] to-[#0EA5E9]', icon: Calculator };
            default:
                return { color: 'bg-gradient-to-br from-slate-600 to-slate-800', icon: BookOpen };
        }
    };

    const filteredClasses = classes.filter(
        (item) =>
            (item.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.faculty || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.department || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.category || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="admin-page font-sans text-[13px]">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4 gap-3">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search classes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-3 text-[12px] focus:ring-2 focus:ring-blue-500/10 font-medium text-slate-700 dark:text-slate-200 outline-none"
                    />
                </div>

                <div className="flex items-center gap-2 justify-between sm:justify-end">
                    <button
                        type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-bold text-[12px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        <Filter className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Filter</span>
                    </button>
                    <div className="text-right">
                        <h1 className="text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none">Classes</h1>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Academics</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 text-[#1D68E3] animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
                    {filteredClasses.map((item, index) => {
                        const style = getCategoryStyles(item.category);
                        const IconComponent = style.icon;

                        return (
                            <div
                                key={index}
                                onClick={() => navigate(`/admin/classes/${item.code}`)}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden group hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col active:scale-[0.99]"
                            >
                                <div className={`h-[88px] relative p-4 ${style.color} flex flex-col justify-end`}>
                                    <IconComponent className="absolute right-[-12px] top-[-12px] h-[72px] w-[72px] text-white/10 rotate-[12deg] pointer-events-none" />
                                    <div className="relative z-10">
                                        <span className="inline-block px-2 py-0.5 bg-white/20 backdrop-blur-md rounded text-[8px] font-black text-white uppercase tracking-wider mb-1.5">
                                            {item.category}
                                        </span>
                                        <h2 className="text-xl font-black text-white tracking-tight leading-none">{item.code}</h2>
                                    </div>
                                </div>

                                <div className="p-3.5 flex flex-col flex-1">
                                    <div className="mb-3">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Faculty</p>
                                        <h3 className="text-[13px] font-extrabold text-[#0F172A] dark:text-white line-clamp-1">{item.faculty}</h3>
                                        <p className="text-[11px] font-medium text-slate-500 mt-0.5 line-clamp-1">{item.department || 'No department'}</p>
                                    </div>

                                    <div className="flex items-center gap-2.5 py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 mb-3 mt-auto">
                                        <div className="p-1.5 bg-white dark:bg-slate-700 rounded-md shadow-sm">
                                            <Users className="h-3.5 w-3.5 text-[#1D68E3]" />
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Enrollment</p>
                                            <p className="text-[12px] font-black text-[#0F172A] dark:text-slate-200">{item.students} Students</p>
                                        </div>
                                    </div>

                                    <div className="text-[12px] font-bold text-[#1D68E3] group-hover:underline">View Details</div>
                                </div>
                            </div>
                        );
                    })}

                    <div
                        onClick={() => navigate('/admin/classes/new')}
                        className="bg-slate-50/80 dark:bg-slate-800/30 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center p-6 min-h-[220px] group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all"
                    >
                        <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 mb-2 group-hover:scale-105 transition-transform">
                            <Plus className="h-5 w-5 text-[#1D68E3]" />
                        </div>
                        <h3 className="text-[13px] font-extrabold text-[#0F172A] dark:text-white">Quick Add Class</h3>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5">Create a new section</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminClasses;
