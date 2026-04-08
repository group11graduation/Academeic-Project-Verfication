import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, Plus, Trash2, ChevronRight,
    Calendar, Users, FileText, Loader2,
    Clock, BookOpen
} from 'lucide-react';
import teacherService from '../../../services/teacherService';

const Assignments = () => {
    const navigate = useNavigate();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const aRes = await teacherService.getMyAssignments();
            if (aRes.success) setAssignments(aRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Delete this assignment?')) return;
        try {
            await teacherService.deleteAssignment(id);
            setAssignments((prev) => prev.filter((a) => a._id !== id));
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Delete not available.');
        }
    };

    const formatDate = (d) =>
        d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const isPast = (d) => d && new Date(d) < new Date();

    if (loading)
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B1120]">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin" />
            </div>
        );

    return (
        <div className="p-4 md:p-10 max-w-[1400px] mx-auto min-h-screen">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-12 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 mb-1 tracking-tight">
                        Assignments
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">
                        Create assignments first; students submit proposals, then projects after approval.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/teacher/assignments/new')}
                    className="flex items-center gap-2 bg-[#2a3fa4] text-white font-bold text-sm px-5 py-3 rounded-2xl hover:bg-[#223688] transition-all shadow-lg"
                >
                    <Plus className="h-4 w-4" /> New Assignment
                </button>
            </header>

            {assignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-[#0F172A] rounded-[32px] border border-dashed border-slate-200 dark:border-white/5">
                    <div className="bg-blue-500/10 p-5 rounded-full mb-4">
                        <ClipboardList className="h-10 w-10 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-black text-slate-700 dark:text-slate-200 mb-1">No assignments yet</h3>
                    <p className="text-slate-500 text-sm mb-6">Create an assignment tied to your class and subject.</p>
                    <button
                        onClick={() => navigate('/teacher/assignments/new')}
                        className="flex items-center gap-2 bg-[#2a3fa4] text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-[#223688] transition-all"
                    >
                        <Plus className="h-4 w-4" /> New Assignment
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {assignments.map((a) => (
                        <div
                            key={a._id}
                            onClick={() => navigate(`/teacher/assignments/${a._id}`)}
                            className="group bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/5 rounded-[24px] p-6 flex flex-col md:flex-row md:items-center gap-4 hover:border-blue-500/30 hover:shadow-xl transition-all cursor-pointer"
                        >
                            <div className="bg-blue-500/10 p-4 rounded-2xl self-start">
                                <FileText className="h-6 w-6 text-blue-400" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="font-black text-slate-800 dark:text-slate-100 text-base truncate mb-1">
                                    {a.title}
                                </h3>
                                <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <BookOpen className="h-3.5 w-3.5" />
                                        {a.subject?.name || '—'} ({a.subject?.code})
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Users className="h-3.5 w-3.5" />
                                        {a.class?.code || a.class?.name || 'Class'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" />
                                        {a.submissionMode === 'group' ? 'Group' : 'Single'}
                                    </span>
                                    <span
                                        className={`flex items-center gap-1 ${isPast(a.proposalDeadline) ? 'text-rose-400' : 'text-slate-500'}`}
                                    >
                                        <Calendar className="h-3.5 w-3.5" />
                                        Proposal: {formatDate(a.proposalDeadline)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={(e) => handleDelete(a._id, e)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                                <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Assignments;
