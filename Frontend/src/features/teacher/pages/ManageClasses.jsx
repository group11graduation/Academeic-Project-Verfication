import React, { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import teacherService from '../../../services/teacherService';
import ClassCard from '../components/ClassCard';
import TeacherPage from '../components/TeacherPage';
import { useShellSearchFilter } from '../../../context/shellSearchContext';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';
import { TEACHER_PRIMARY } from '../ui/teacherTheme';

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
                console.error('Failed to fetch classes:', error);
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
            <div className="flex min-h-[40vh] flex-col items-center justify-center [font-family:var(--sv-font-sans)]">
                <Loader2 className="mb-2 h-6 w-6 animate-spin" style={{ color: TEACHER_PRIMARY }} />
                <p className="text-[12px] font-medium text-[var(--text-secondary)]">Loading classes...</p>
            </div>
        );
    }

    return (
        <TeacherPage
            title="My Classes"
            subtitle="Assigned classes grouped by academic year and semester."
        >
            {filteredClasses.length > 0 ? (
                <div className="space-y-5">
                    {classesGroupedByTerm.map((group) => (
                        <section key={group.key}>
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--text-secondary)]">
                                {group.heading}
                            </p>
                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--content-bg)] py-8 text-center">
                    <p className="text-[12px] font-medium text-[var(--text-secondary)]">No classes match your search.</p>
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--content-bg)] py-8 text-center">
                    <p className="text-[12px] font-medium text-[var(--text-secondary)]">You have no active classes assigned.</p>
                </div>
            )}
        </TeacherPage>
    );
};

export default ManageClasses;
