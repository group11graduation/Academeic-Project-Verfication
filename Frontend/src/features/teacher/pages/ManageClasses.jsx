import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import teacherService from '../../../services/teacherService';
import ClassCard from '../components/ClassCard';

const ManageClasses = () => {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);

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
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 dark:border-slate-800 pb-3 mb-4 gap-3">
                <div>
                    <h1 className="text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none">My Classes</h1>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Assigned classes for the current semester.</p>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                    <span className="text-slate-700 dark:text-slate-300 text-[12px] font-bold">Spring 2024</span>
                    <div className="bg-[#EBF3FF] dark:bg-blue-900/30 p-1 rounded-full transition-colors">
                        <CalendarIcon className="h-3.5 w-3.5 text-[#1D68E3] dark:text-blue-400" />
                    </div>
                </div>
            </header>

            {/* Active Classes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {classes.length > 0 ? (
                    classes.map((cls, index) => (
                        <ClassCard
                            key={index}
                            code={cls.code}
                            title={cls.title}
                            section={cls.section || 'A'}
                            students={cls.students}
                            pending={0}
                            status="ok"
                        />
                    ))
                ) : (
                    <div className="col-span-full text-center py-8 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl transition-colors">
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 font-bold">You have no active classes assigned.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageClasses;
