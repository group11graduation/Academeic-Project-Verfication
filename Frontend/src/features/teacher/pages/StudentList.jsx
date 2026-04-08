import React, { useState, useEffect } from 'react';
import {
    Search,
    ChevronDown,
    ArrowLeft,
    MoreVertical,
    Loader2
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import teacherService from '../../../services/teacherService';

const StudentList = () => {
    const { id } = useParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('Name (A-Z)');
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const response = await teacherService.getClassStudents(id);
                if (response.success) {
                    setStudents(response.data);
                }
            } catch (error) {
                console.error("Failed to fetch students:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStudents();
    }, [id]);

    // Filter and Sort Logic
    const filteredAndSortedStudents = students
        .filter(student =>
            student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.id.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'Name (A-Z)') return a.name.localeCompare(b.name);
            if (sortBy === 'Attendance (Low-High)') return a.attendance - b.attendance;
            if (sortBy === 'Attendance (High-Low)') return b.attendance - a.attendance;
            return 0;
        });

    if (loading) {
        return (
            <div className="h-[400px] flex items-center justify-center bg-white dark:bg-[#0B1120]">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-10 max-w-[1600px] mx-auto min-h-screen transition-colors bg-white dark:bg-[#0B1120]">
            {/* Breadcrumbs & Header */}
            <div className="mb-8 md:mb-12">
                <nav className="flex items-center gap-2 text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6">
                    <span className="hover:text-blue-400 cursor-pointer transition-colors">COURSES</span>
                    <span className="text-slate-700">/</span>
                    <span className="text-blue-400">{id || 'CA222'}</span>
                </nav>

                <Link
                    to={`/teacher/classes/${id}`}
                    className="flex items-center gap-2 text-slate-400 dark:text-slate-500 hover:text-[#1D68E3] dark:hover:text-blue-400 transition-colors mb-8 group w-fit"
                >
                    <div className="bg-white dark:bg-[#0F172A] p-2 rounded-xl border border-slate-100 dark:border-white/5 shadow-xl group-hover:border-blue-200 dark:group-hover:border-blue-900 transition-all">
                        <ArrowLeft className="h-4 w-4" />
                    </div>
                    <span className="text-[12px] font-black uppercase tracking-widest">Back to Overview</span>
                </Link>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-slate-100 mb-2 tracking-tight">Student List</h1>
                        <p className="text-slate-500 dark:text-slate-500 text-sm md:text-base font-medium">Class Roster • Academic Year 2023/2024</p>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white dark:bg-[#0F172A] p-4 md:p-6 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl mb-6 md:mb-8 flex flex-col lg:flex-row items-stretch lg:items-center gap-4 md:gap-6">
                <div className="relative flex-1">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-600" />
                    <input
                        type="text"
                        placeholder="Search students or IDs..."
                        className="w-full bg-slate-50 dark:bg-[#0B1120] border border-slate-100 dark:border-transparent rounded-2xl py-4 pl-14 pr-6 text-sm focus:ring-2 focus:ring-blue-500/10 transition-all font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 shadow-inner"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 dark:bg-[#0B1120] rounded-2xl border border-slate-100 dark:border-transparent hover:border-slate-200 dark:hover:border-white/5 transition-all cursor-pointer group relative shadow-inner">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Sort by:</span>
                        <select
                            className="bg-transparent border-none text-[13px] font-black text-slate-800 dark:text-slate-100 focus:ring-0 cursor-pointer p-0 pr-8 appearance-none"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="Name (A-Z)" className="bg-white dark:bg-[#0B1120]">Name (A-Z)</option>
                            <option value="Attendance (High-Low)" className="bg-white dark:bg-[#0B1120]">Attendance (High-Low)</option>
                            <option value="Attendance (Low-High)" className="bg-white dark:bg-[#0B1120]">Attendance (Low-High)</option>
                        </select>
                        <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-600 absolute right-6 pointer-events-none group-hover:text-[#1D68E3] dark:group-hover:text-blue-400 transition-colors" />
                    </div>
                </div>
            </div>

            {/* Students Table */}
            <div className="bg-white dark:bg-[#0F172A] rounded-[32px] border border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden transition-colors">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="px-6 md:px-10 py-6 text-[10px] md:text-[11px] font-black text-slate-600 uppercase tracking-[0.2em]">Student Name</th>
                                <th className="px-6 md:px-10 py-6 text-[10px] md:text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] text-center">Student ID</th>
                                <th className="px-6 md:px-10 py-6 text-[10px] md:text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] text-center">Team / Group</th>
                                <th className="px-6 md:px-10 py-6 text-[10px] md:text-[11px] font-black text-slate-600 uppercase tracking-[0.2em]">Attendance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredAndSortedStudents.length > 0 ? (
                                filteredAndSortedStudents.map((student) => (
                                    <tr key={student.id} className="group hover:bg-slate-50 dark:hover:bg-[#0B1120] transition-colors">
                                        <td className="px-6 md:px-10 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-10 w-10 md:h-12 md:w-12 rounded-2xl ${student.avatarColor || 'bg-blue-500/10'} flex items-center justify-center overflow-hidden border-2 border-slate-100 dark:border-[#0B1120] shadow-sm`}>
                                                    {student.photo && student.photo !== 'default-student.jpg' ? (
                                                        <img
                                                            src={student.photo.startsWith('http') ? student.photo : `http://localhost:5000/uploads/${student.photo}`}
                                                            alt={student.name}
                                                            className="h-full w-full object-cover transition-transform group-hover:scale-110"
                                                        />
                                                    ) : (
                                                        <span className="text-[14px] font-black text-slate-400 dark:text-slate-500">
                                                            {student.name.split(' ').map(n => n[0]).join('')}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-[15px] md:text-[17px] font-black text-slate-800 dark:text-slate-100 leading-tight">{student.name}</p>
                                                    <p className="text-slate-500 dark:text-slate-500 text-xs md:text-sm font-medium">{student.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 md:px-10 py-6 text-center">
                                            <span className="text-[14px] md:text-[16px] font-black text-slate-800 dark:text-slate-100">{student.id}</span>
                                        </td>
                                        <td className="px-6 md:px-10 py-6 text-center">
                                            <span className="bg-blue-500/10 text-[#1D68E3] dark:text-blue-400 text-[10px] md:text-[11px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                                                {student.group || 'UNASSIGNED'}
                                            </span>
                                        </td>
                                        <td className="px-6 md:px-10 py-6">
                                            <div className="flex items-center gap-4 md:gap-6">
                                                <div className="flex-1 h-2 bg-slate-100 dark:bg-[#0B1120] rounded-full overflow-hidden min-w-[100px] md:min-w-[150px] border border-slate-200 dark:border-white/5 shadow-inner">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 shadow-sm ${student.attendance >= 50 ? 'bg-gradient-to-r from-blue-400 to-blue-600' : 'bg-gradient-to-r from-rose-400 to-rose-600'}`}
                                                        style={{ width: `${student.attendance}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-[13px] md:text-[14px] font-black text-slate-800 dark:text-slate-100 w-10 text-right">{student.attendance}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-6 md:px-10 py-16 text-center text-slate-600 font-bold uppercase tracking-widest">
                                        No students matching search
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const FilterDropdown = ({ label, value }) => (
    <div className="flex items-center gap-3 px-6 py-4 bg-[#F8FAFB] rounded-2xl border border-transparent hover:border-slate-100 transition-all cursor-pointer group">
        <span className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">{label}:</span>
        <span className="text-[14px] font-bold text-[#0F172A]">{value}</span>
        <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
    </div>
);

export default StudentList;
