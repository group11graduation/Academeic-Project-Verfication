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
            <div className="min-h-screen flex items-center justify-center bg-[#F8FAFB] dark:bg-slate-900 transition-colors">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-10 max-w-[1600px] mx-auto min-h-screen transition-colors">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-12 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-[#0F172A] dark:text-white mb-1 md:mb-2 tracking-tight transition-colors">My Classes</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base font-medium transition-colors">View and manage all your assigned classes for the current semester.</p>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                    <span className="text-slate-700 dark:text-slate-300 text-sm font-bold">Spring 2024</span>
                    <div className="bg-[#EBF3FF] dark:bg-blue-900/30 p-1.5 rounded-full transition-colors">
                        <CalendarIcon className="h-4 w-4 text-[#1D68E3] dark:text-blue-400" />
                    </div>
                </div>
            </header>

            {/* Active Classes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
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
                    <div className="col-span-full text-center py-12 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-[32px] transition-colors">
                        <p className="text-slate-500 dark:text-slate-400 font-bold">You have no active classes assigned.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageClasses;
