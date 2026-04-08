import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Search, Filter, Download, Plus, Users,
    BookOpen, Beaker, GraduationCap, Code2, Calculator,
    ChevronRight, MoreVertical, Loader2
} from 'lucide-react';
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
                if (res.success) {
                    setClasses(res.data);
                }
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


    const filteredClasses = classes.filter(item =>
        (item.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.faculty || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.department || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-4 md:p-10 max-w-[1600px] mx-auto font-sans bg-[#F8FAFB] dark:bg-[#0F172A]/30 min-h-screen transition-colors">

            {/* Top Bar Area */}
            <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5 mb-6 md:mb-8 gap-4">
                {/* Search Bar */}
                <div className="relative w-full max-w-[450px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search classes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[12px] py-3 pl-12 pr-4 text-[14px] focus:ring-2 focus:ring-blue-500/10 transition-all font-medium text-slate-700 dark:text-slate-200 outline-none"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[10px] text-slate-600 dark:text-slate-300 font-bold text-[14px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                        <Filter className="h-4 w-4" />
                        <span className="hidden sm:inline">Filter</span>
                    </button>
                    <div className="text-right hidden sm:block">
                        <h1 className="text-xl md:text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none mb-1">Classes</h1>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">Academics</p>
                    </div>
                </div>
            </div>

            {/* Grid Area */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">

                    {filteredClasses.map((item, index) => {
                        const style = getCategoryStyles(item.category);
                        const IconComponent = style.icon;

                        return (
                            <div
                                key={index}
                                onClick={() => navigate(`/admin/classes/${item.code}`)}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden group hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer flex flex-col active:scale-[0.98]"
                            >

                                {/* Header Part with Category Icon */}
                                <div className={`h-[160px] relative p-8 ${style.color} flex flex-col justify-center`}>
                                    {/* Abstract Graphic/Icon overlay */}
                                    <IconComponent className="absolute right-[-20px] top-[-20px] h-[180px] w-[180px] text-white/10 rotate-[15deg] pointer-events-none transition-transform group-hover:scale-110" />

                                    <div className="relative z-10">
                                        <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-[6px] text-[10px] font-black text-white uppercase tracking-widest mb-4">
                                            {item.category}
                                        </span>
                                        <h2 className="text-[36px] font-black text-white tracking-tighter">
                                            {item.code}
                                        </h2>
                                    </div>
                                </div>

                                {/* Card Content */}
                                <div className="p-8 pb-6 flex flex-col flex-1">
                                    <div className="mb-6">
                                        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Faculty</p>
                                        <h3 className="text-[18px] font-extrabold text-[#0F172A] dark:text-white">{item.faculty}</h3>
                                        <p className="text-[12px] font-semibold text-slate-500 mt-1">{item.department || 'No department'}</p>
                                    </div>

                                    <div className="flex items-center gap-4 py-4 px-5 bg-slate-50 dark:bg-slate-800/50 rounded-[16px] border border-slate-100 dark:border-slate-800 mb-8 mt-auto">
                                        <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                                            <Users className="h-5 w-5 text-[#1D68E3] dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Enrollment</p>
                                            <p className="text-[16px] font-black text-[#0F172A] dark:text-slate-200">{item.students} Students</p>
                                        </div>
                                    </div>

                                    <div className="text-[14px] font-black text-[#1D68E3] dark:text-blue-400 group-hover:underline flex items-center gap-1 mt-auto">
                                        View Details
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {/* Quick Add Class Card */}
                    <div
                        onClick={() => navigate('/admin/classes/new')}
                        className="bg-[#F8FAFB] dark:bg-slate-800/30 border-[2px] border-dashed border-slate-200 dark:border-slate-700 rounded-[24px] flex flex-col items-center justify-center p-8 min-h-[460px] group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all hover:border-slate-300 dark:hover:border-slate-600"
                    >
                        <div className="w-[50px] h-[50px] bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 mb-4 group-hover:scale-110 transition-transform">
                            <Plus className="h-6 w-6 text-[#1D68E3] dark:text-blue-400" />
                        </div>
                        <h3 className="text-[18px] font-extrabold text-[#0F172A] dark:text-white mb-1">Quick Add Class</h3>
                        <p className="text-[14px] font-medium text-slate-400 dark:text-slate-500">Create a new section</p>
                    </div>

                </div>
            )}


        </div>
    );
};

export default AdminClasses;
