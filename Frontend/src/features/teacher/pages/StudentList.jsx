import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ArrowLeft, Loader2, Users, Mail } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import teacherService from '../../../services/teacherService';
import { getApiOrigin } from '../../../lib/api';
import { getApiErrorMessage } from '../../../shared/utils/apiErrors';
import { usePageSearch } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';

const StudentList = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { query: searchQuery, setQuery: setSearchQuery } = usePageSearch('Search students…');
    const [sortBy, setSortBy] = useState('Name (A-Z)');
    const [students, setStudents] = useState([]);
    const [classTitle, setClassTitle] = useState('');
    const [loadError, setLoadError] = useState('');
    const [loading, setLoading] = useState(true);
    const uploadBase = getApiOrigin();

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setLoadError('');
            setStudents([]);
            setClassTitle('');

            try {
                const studentsRes = await teacherService.getClassStudents(id);
                if (cancelled) return;
                if (studentsRes?.success) {
                    setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
                } else {
                    setStudents([]);
                    setLoadError(studentsRes?.message || 'Could not load students for this class.');
                }
            } catch (error) {
                if (cancelled) return;
                setStudents([]);
                setLoadError(getApiErrorMessage(error, 'Could not load students for this class.'));
            } finally {
                if (!cancelled) setLoading(false);
            }

            teacherService
                .getClassDetails(id)
                .then((classRes) => {
                    if (cancelled) return;
                    if (classRes?.success) {
                        setClassTitle(classRes.data?.title || classRes.data?.code || id);
                    } else {
                        setClassTitle(id);
                    }
                })
                .catch(() => {
                    if (!cancelled) setClassTitle(id);
                });
        };

        if (id) load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const filteredAndSortedStudents = useMemo(() => {
        let list = searchQuery.trim()
            ? students.filter((student) =>
                  matchesSearchQuery(
                      searchQuery,
                      student.name,
                      student.studentId,
                      student.id,
                      student.email,
                      student.userId
                  )
              )
            : students;
        return [...list].sort((a, b) => {
            if (sortBy === 'ID (A-Z)') {
                return String(a.studentId || a.id || '').localeCompare(String(b.studentId || b.id || ''));
            }
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

            {loadError ? (
                <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                    {loadError}
                </div>
            ) : null}

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
                        <option value="ID (A-Z)">Student ID (A-Z)</option>
                        <option value="Attendance (High-Low)">Attendance (High-Low)</option>
                        <option value="Attendance (Low-High)">Attendance (Low-High)</option>
                    </select>
                    <ChevronDown className="h-4 w-4 text-slate-400 absolute right-4 pointer-events-none" />
                </div>
            </div>

            {filteredAndSortedStudents.length > 0 ? (
                <div className="rounded-[28px] border border-slate-100 dark:border-white/10 bg-white dark:bg-[#0F172A] shadow-lg overflow-hidden">
                    <div className="app-table-shell border-0 rounded-none shadow-none">
                        <div className="app-table-wrap custom-scrollbar overflow-x-auto">
                            <table className="app-table w-full min-w-[640px]">
                                <thead>
                                    <tr className="app-table-headrow bg-slate-50/80 dark:bg-[#0B1120]">
                                        <th className="app-table-th w-12 text-center">#</th>
                                        <th className="app-table-th">Student name</th>
                                        <th className="app-table-th text-center">Student ID</th>
                                        <th className="app-table-th hidden md:table-cell">Email</th>
                                        <th className="app-table-th text-center hidden sm:table-cell">Team</th>
                                    </tr>
                                </thead>
                                <tbody className="app-table-body">
                                    {filteredAndSortedStudents.map((student, index) => {
                                        const userId = student.userId;
                                        const displayId = student.studentId || student.id || '—';
                                        const photoUrl =
                                            student.photo && student.photo !== 'default-student.jpg'
                                                ? student.photo.startsWith('http')
                                                    ? student.photo
                                                    : `${uploadBase}/uploads/${student.photo}`
                                                : null;
                                        return (
                                            <tr
                                                key={userId || `${displayId}-${index}`}
                                                className={`app-table-row ${userId ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02]' : ''}`}
                                                onClick={() => {
                                                    if (userId) navigate(`/teacher/classes/${id}/students/${userId}`);
                                                }}
                                            >
                                                <td className="app-table-td text-center text-slate-400 font-bold text-sm">
                                                    {index + 1}
                                                </td>
                                                <td className="app-table-td">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-[#0B1120] flex items-center justify-center overflow-hidden border border-slate-100 dark:border-white/5 shrink-0">
                                                            {photoUrl ? (
                                                                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                                                            ) : (
                                                                <span className="text-xs font-black text-slate-500">
                                                                    {(student.name || '?')
                                                                        .split(' ')
                                                                        .map((n) => n[0])
                                                                        .join('')
                                                                        .slice(0, 2)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="font-bold text-slate-800 dark:text-slate-100">
                                                            {student.name || 'Student'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="app-table-td text-center font-mono text-sm font-bold text-[#1D68E3]">
                                                    {displayId}
                                                </td>
                                                <td className="app-table-td hidden md:table-cell">
                                                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                                                        <Mail className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                                        {student.email || '—'}
                                                    </span>
                                                </td>
                                                <td className="app-table-td text-center hidden sm:table-cell">
                                                    <span className="bg-blue-500/10 text-[#1D68E3] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                                                        {student.group || 'UNASSIGNED'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-[28px] border border-dashed border-slate-200 dark:border-white/10 p-16 text-center">
                    <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold">
                        {students.length === 0
                            ? 'No students enrolled in this class yet. Ask an admin to assign students to this class.'
                            : 'No students match your search.'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default StudentList;
