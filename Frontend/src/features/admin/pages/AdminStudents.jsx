import React, { useState, useEffect } from 'react';
import {
    Search,
    Plus,
    ChevronDown,
    Users,
    Loader2
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import adminStudentService from '../../../services/adminStudentService';

const AdminStudents = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchQuery, setSearchQuery] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [facultyFilter, setFacultyFilter] = useState('');
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const response = await adminStudentService.getStudents();
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
    }, []);

    const handleGeneratePasscode = async (studentId) => {
        try {
            const response = await adminStudentService.generatePasscode(studentId);
            if (response.success) {
                // Update local state
                setStudents(prev => prev.map(s =>
                    s.studentId === studentId ? { ...s, passcode: response.data.passcode } : s
                ));
            }
        } catch (error) {
            console.error("Failed to generate passcode:", error);
        }
    };

    // Derive unique classes and faculties from actual data
    const uniqueClasses = [...new Set(students.map(s => s.classId).filter(Boolean))].sort();
    const uniqueFaculties = [...new Set(students.map(s => s.academicInfo?.faculty).filter(Boolean))].sort();

    const filteredStudents = students.filter(student => {
        const matchesSearch =
            (student.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (student.studentId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (student.classId || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchesClass = classFilter ? student.classId === classFilter : true;
        const matchesFaculty = facultyFilter ? student.academicInfo?.faculty === facultyFilter : true;

        return matchesSearch && matchesClass && matchesFaculty;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] dark:bg-slate-900 flex flex-col items-center justify-center transition-colors">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Loading students...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB] dark:bg-[#0F172A]/30 p-4 md:p-10 font-sans transition-colors">

            {/* ── Top Bar: Search + Filters + Add ── */}
            <div className="flex flex-col lg:flex-row items-center gap-4 mb-6 md:mb-8">
                {/* Search */}
                <div className="relative w-full lg:w-[320px] shrink-0">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search by name, ID or class..."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-[16px] py-3 pl-14 pr-6 text-[14px] focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all outline-none font-medium text-slate-700 dark:text-slate-200 shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                    {/* Class Filter */}
                    <div className="relative w-[140px] shrink-0">
                        <select
                            value={classFilter}
                            onChange={(e) => setClassFilter(e.target.value)}
                            className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[16px] py-3 pl-5 pr-10 text-[14px] font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all shadow-sm cursor-pointer"
                        >
                            <option value="">Classes</option>
                            {uniqueClasses.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    </div>

                    {/* Faculty Filter */}
                    <div className="relative w-[180px] shrink-0">
                        <select
                            value={facultyFilter}
                            onChange={(e) => setFacultyFilter(e.target.value)}
                            className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[16px] py-3 pl-5 pr-10 text-[14px] font-semibold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/10 focus:border-[#1D68E3] outline-none transition-all shadow-sm cursor-pointer"
                        >
                            <option value="">Faculties</option>
                            {uniqueFaculties.map(fac => (
                                <option key={fac} value={fac}>{fac}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Clear Filters */}
                    {(classFilter || facultyFilter) && (
                        <button
                            onClick={() => { setClassFilter(''); setFacultyFilter(''); }}
                            className="text-[13px] font-bold text-red-400 hover:text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 px-4 py-3 rounded-[16px] transition-all whitespace-nowrap shrink-0"
                        >
                            Clear
                        </button>
                    )}
                </div>

                <div className="flex items-center justify-between lg:justify-end w-full gap-4 shrink-0">
                    <button
                        onClick={() => navigate('/admin/students/new')}
                        className="flex items-center gap-2 bg-[#1D68E3] text-white px-7 py-3 rounded-[16px] font-bold text-[14px] hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20 whitespace-nowrap active:scale-[0.98]"
                    >
                        <Plus className="h-4 w-4 stroke-[3px]" />
                        <span className="hidden md:inline">Add Student</span>
                        <span className="md:hidden">Add</span>
                    </button>
                    
                    <header className="hidden sm:block text-right">
                        <h1 className="text-xl md:text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none mb-1">Students</h1>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">Management</p>
                    </header>
                </div>
            </div>

            {/* Result count & Info */}
            <div className="flex items-center gap-4 mb-4">
                <p className="text-[13px] font-semibold text-slate-400 dark:text-slate-500">
                    Showing <span className="text-slate-700 dark:text-slate-300 font-black">{filteredStudents.length}</span> of {students.length} students
                </p>
            </div>

            {/* ── Table ── */}
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden mb-10">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-50 dark:border-slate-800 uppercase tracking-[0.1em] text-[11px] font-black text-slate-400 dark:text-slate-500">
                            <th className="px-10 py-6">#</th>
                            <th className="px-6 py-6 text-center">PHOTO</th>
                            <th className="px-6 py-6">STUDENT NAME</th>
                            <th className="px-6 py-6">STUDENT ID</th>
                            <th className="px-6 py-6">CLASS</th>
                            <th className="px-6 py-6">FACULTY</th>
                            <th className="px-6 py-6 text-center">PASSCODE</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {filteredStudents.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-16 text-slate-400 font-medium">
                                    No students match the selected filters.
                                </td>
                            </tr>
                        ) : (
                            filteredStudents.map((student, index) => (
                                <tr key={student.studentId || index} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-10 py-7 text-[14px] font-bold text-slate-300 dark:text-slate-600">{index + 1}</td>
                                    <td className="px-6 py-7">
                                        <div className="flex justify-center">
                                            <Link to={`/admin/students/${student.studentId || ''}`} state={{ from: location.pathname }}>
                                                <img
                                                    src={student.photo || 'https://via.placeholder.com/150'}
                                                    alt={student.name || 'Student'}
                                                    className="h-12 w-12 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-md hover:scale-110 transition-transform cursor-pointer"
                                                />
                                            </Link>
                                        </div>
                                    </td>
                                    <td className="px-6 py-7">
                                        <Link
                                            to={`/admin/students/${student.studentId || ''}`}
                                            state={{ from: location.pathname }}
                                            className="text-[16px] font-bold text-[#0F172A] dark:text-slate-200 hover:text-[#1D68E3] dark:hover:text-blue-400 transition-colors"
                                        >
                                            {student.name || 'Unknown Student'}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-7">
                                        <span className="text-[14px] font-bold text-slate-400 tracking-wide">{student.studentId || 'N/A'}</span>
                                    </td>
                                    <td className="px-6 py-7">
                                        <Link
                                            to={`/admin/classes/${student.classId}`}
                                            className="text-[14px] font-bold text-[#1D68E3] hover:underline"
                                        >
                                            {student.classId}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-7">
                                        <span className="text-[14px] font-bold text-slate-500">{student.academicInfo?.faculty || 'N/A'}</span>
                                    </td>
                                    <td className="px-6 py-7">
                                        <div className="flex flex-col items-center gap-1.5">
                                            {student.passcode ? (
                                                <div
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all group/code"
                                                    onClick={(e) => {
                                                        const el = e.currentTarget.querySelector('.code-val');
                                                        const icon = e.currentTarget.querySelector('.eye-icon');
                                                        if (el.dataset.revealed === 'true') {
                                                            el.innerText = '••••••';
                                                            el.dataset.revealed = 'false';
                                                        } else {
                                                            el.innerText = student.passcode;
                                                            el.dataset.revealed = 'true';
                                                        }
                                                    }}
                                                    title="Click to reveal/hide"
                                                >
                                                    <span className="code-val text-[14px] font-black text-slate-700 dark:text-slate-300 font-mono tracking-wider" data-revealed="false">
                                                        ••••••
                                                    </span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleGeneratePasscode(student.studentId)}
                                                    className="flex items-center gap-1.5 text-[#1D68E3] dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-4 py-2 rounded-[10px] text-[12px] font-bold transition-all active:scale-[0.95] group"
                                                >
                                                    <Plus className="h-3.5 w-3.5 stroke-[3px] group-hover:rotate-90 transition-transform" />
                                                    Generate
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminStudents;
