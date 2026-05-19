import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ArrowLeft, Loader2, ChevronRight, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import teacherService from '../../../services/teacherService';
import { getApiOrigin } from '../../../lib/api';

const StudentList = () => {
    const { id } = useParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('Name (A-Z)');
    const [students, setStudents] = useState([]);
    const [classTitle, setClassTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const uploadBase = getApiOrigin();

    useEffect(() => {
        let cancelled = false;
        const fetchStudents = async () => {
            setLoading(true);
            try {
                const [studentsRes, classRes] = await Promise.all([
                    teacherService.getClassStudents(id),
                    teacherService.getClassDetails(id),
                ]);
                if (cancelled) return;
                if (studentsRes.success) setStudents(studentsRes.data);
                if (classRes.success) setClassTitle(classRes.data?.title || classRes.data?.code || id);
            } catch (error) {
                console.error('Failed to fetch students:', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        if (id) fetchStudents();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const filteredAndSortedStudents = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        let list = students;
        if (q) {
            list = list.filter(
                (student) =>
                    (student.name || '').toLowerCase().includes(q) ||
                    String(student.id || '').toLowerCase().includes(q) ||
                    (student.email || '').toLowerCase().includes(q),
            );
        }
        return [...list].sort((a, b) => {
            if (sortBy === 'Name (A-Z)') return (a.name || '').localeCompare(b.name || '');
            if (sortBy === 'Attendance (Low-High)') return (a.attendance ?? 0) - (b.attendance ?? 0);
            if (sortBy === 'Attendance (High-Low)') return (b.attendance ?? 0) - (a.attendance ?? 0);
            return 0;
        });
    }, [students, searchQuery, sortBy]);

    if (loading) {
        return (
            <div className="h-[400px] flex items-center justify-center bg-white dark:bg-[#0B1120]">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-10 max-w-[1600px] mx-auto min-h-screen transition-colors bg-white dark:bg-[#0B1120]">
            <div className="mb-8 md:mb-12">
                <nav className="flex items-center gap-2 text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6">
                    <Link to="/teacher/classes" className="hover:text-blue-400 transition-colors">
                        My Classes
                    </Link>
                    <span className="text-slate-700">/</span>
                    <span className="text-blue-400">{id}</span>
                </nav>

                <Link
                    to="/teacher/classes"
                    className="flex items-center gap-2 text-slate-400 dark:text-slate-500 hover:text-[#1D68E3] dark:hover:text-blue-400 transition-colors mb-8 group w-fit"
                >
                    <div className="bg-white dark:bg-[#0F172A] p-2 rounded-xl border border-slate-100 dark:border-white/5 shadow-xl group-hover:border-blue-200 dark:group-hover:border-blue-900 transition-all">
                        <ArrowLeft className="h-4 w-4" />
                    </div>
                    <span className="text-[12px] font-black uppercase tracking-widest">Back to My Classes</span>
                </Link>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
                            Students
                        </h1>
                        <p className="text-slate-500 dark:text-slate-500 text-sm md:text-base font-medium">
                            {classTitle} • {students.length} enrolled
                        </p>
                    </div>
                    <Link
                        to={`/teacher/classes/${id}`}
                        className="text-xs font-black uppercase tracking-widest text-[#1D68E3] hover:underline"
                    >
                        Class overview
                    </Link>
                </div>
            </div>

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

                <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 dark:bg-[#0B1120] rounded-2xl border border-slate-100 dark:border-transparent relative">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort:</span>
                    <select
                        className="bg-transparent border-none text-[13px] font-black text-slate-800 dark:text-slate-100 focus:ring-0 cursor-pointer p-0 pr-8 appearance-none"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="Name (A-Z)">Name (A-Z)</option>
                        <option value="Attendance (High-Low)">Attendance (High-Low)</option>
                        <option value="Attendance (Low-High)">Attendance (Low-High)</option>
                    </select>
                    <ChevronDown className="h-4 w-4 text-slate-400 absolute right-4 pointer-events-none" />
                </div>
            </div>

            {filteredAndSortedStudents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredAndSortedStudents.map((student) => {
                        const userId = student.userId;
                        if (!userId) return null;
                        const photoUrl =
                            student.photo && student.photo !== 'default-student.jpg'
                                ? student.photo.startsWith('http')
                                    ? student.photo
                                    : `${uploadBase}/uploads/${student.photo}`
                                : null;
                        return (
                            <Link
                                key={userId}
                                to={`/teacher/classes/${id}/students/${userId}`}
                                className="group rounded-[28px] border border-slate-100 dark:border-white/10 bg-white dark:bg-[#0F172A] p-6 md:p-8 shadow-lg hover:border-[#1D68E3]/40 hover:shadow-xl transition-all active:scale-[0.99]"
                            >
                                <div className="flex items-start gap-4 mb-5">
                                    <div
                                        className={`h-14 w-14 rounded-2xl ${student.avatarColor || 'bg-blue-500/10'} flex items-center justify-center overflow-hidden border-2 border-slate-100 dark:border-white/5 shrink-0`}
                                    >
                                        {photoUrl ? (
                                            <img
                                                src={photoUrl}
                                                alt=""
                                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                            />
                                        ) : (
                                            <span className="text-sm font-black text-slate-500">
                                                {(student.name || '?')
                                                    .split(' ')
                                                    .map((n) => n[0])
                                                    .join('')
                                                    .slice(0, 2)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-lg font-black text-slate-800 dark:text-slate-100 truncate group-hover:text-[#1D68E3] transition-colors">
                                            {student.name}
                                        </p>
                                        <p className="text-xs font-mono text-slate-500 mt-0.5">{student.id}</p>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-[#1D68E3] shrink-0 transition-colors" />
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate mb-4">{student.email}</p>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="bg-blue-500/10 text-[#1D68E3] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                                        {student.group || 'UNASSIGNED'}
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-[#1D68E3]">
                                        View profile
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-[28px] border border-dashed border-slate-200 dark:border-white/10 p-16 text-center">
                    <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold">
                        {students.length === 0
                            ? 'No students enrolled in this class yet.'
                            : 'No students match your search.'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default StudentList;
