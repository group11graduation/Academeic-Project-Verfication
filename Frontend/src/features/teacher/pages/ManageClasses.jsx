import React, { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import teacherService from '../../../services/teacherService';
import ClassCard from '../components/ClassCard';
import { useShellSearchFilter } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';

const ManageClasses = () => {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const searchQuery = useShellSearchFilter('Search classes by code or title…');

    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const response = await teacherService.getMyClasses();
                if (response.success) {
                    setClasses(response.data);
                }
            } catch (error) {
                console.error("Failed to fetch classes:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchClasses();
    }, []);

    const filteredClasses = useMemo(
        () => classes.filter((cls) => matchesSearchQuery(searchQuery, cls.code, cls.title, cls.section)),
        [classes, searchQuery]
    );

    const classesGroupedByTerm = useMemo(() => {
        const groups = new Map();
        for (const cls of filteredClasses) {
            const yearId = String(cls.academicYear?._id || cls.academicYear || 'none');
            const semId = String(cls.semester?._id || cls.semester || 'none');
            const key = `${yearId}|${semId}`;
            if (!groups.has(key)) {
                const yearLabel = cls.academicYearLabel || cls.academicYear?.label || '';
                const semesterLabel = cls.semesterLabel || cls.semester?.name || '';
                const semesterOrder = Number(cls.semester?.order) || 0;
                const yearStart = cls.academicYear?.startDate
                    ? new Date(cls.academicYear.startDate).getTime()
                    : 0;
                groups.set(key, {
                    key,
                    yearLabel,
                    semesterLabel,
                    semesterOrder,
                    yearStart,
                    heading:
                        yearLabel && semesterLabel
                            ? `${yearLabel} · ${semesterLabel}`
                            : yearLabel || semesterLabel || 'Unassigned term',
                    classes: [],
                });
            }
            groups.get(key).classes.push(cls);
        }
        return Array.from(groups.values()).sort((a, b) => {
            if (a.yearStart !== b.yearStart) return b.yearStart - a.yearStart;
            const yearCmp = String(b.yearLabel || '').localeCompare(String(a.yearLabel || ''));
            if (yearCmp) return yearCmp;
            if (a.semesterOrder !== b.semesterOrder) return a.semesterOrder - b.semesterOrder;
            return String(a.semesterLabel || '').localeCompare(String(b.semesterLabel || ''));
        });
    }, [filteredClasses]);

    if (loading) {
        return (
            <div className="min-h-[40vh] flex flex-col items-center justify-center">
                <Loader2 className="h-7 w-7 text-[#1D68E3] animate-spin mb-2" />
                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Loading classes...</p>
            </div>
        );
    }

    return (
        <div className="font-sans text-[13px] transition-colors">
            {/* Header */}
            <header className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <h1 className="text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none">My Classes</h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Assigned classes grouped by academic year and semester.</p>
            </header>

            {filteredClasses.length > 0 ? (
                <div className="space-y-5">
                    {classesGroupedByTerm.map((group) => (
                        <section key={group.key}>
                            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                {group.heading}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                                {group.classes.map((cls, index) => (
                                    <ClassCard
                                        key={cls._id || index}
                                        code={cls.code}
                                        title={cls.title}
                                        section={cls.section || 'A'}
                                        students={cls.students}
                                        pending={0}
                                        status="ok"
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : classes.length > 0 ? (
                <div className="col-span-full text-center py-8 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl transition-colors">
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 font-bold">No classes match your search.</p>
                </div>
            ) : (
                <div className="col-span-full text-center py-8 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl transition-colors">
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 font-bold">You have no active classes assigned.</p>
                </div>
            )}
        </div>
    );
};

export default ManageClasses;
