import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

const ClassCard = ({ code, title, section, students, pending, status, alerts, showReviewButton = false }) => {
    return (
        <div className="bg-white dark:bg-[#0F172A] rounded-[32px] shadow-sm overflow-hidden flex flex-col h-full border border-slate-100 dark:border-white/5 border-t-[6px] border-t-[#1D68E3] transition-all hover:shadow-md group">
            <div className="p-6 md:p-8 pb-4 flex-1">
                <div className="flex justify-between items-start mb-4">
                    <h4 className="text-xl md:text-2xl font-black text-[#0F172A] dark:text-slate-100 transition-colors">{code}</h4>
                    <div className="bg-slate-50 dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 px-2 py-1 rounded-lg text-[10px] font-black text-slate-400 dark:text-slate-600 transition-colors uppercase tracking-widest">
                        SECTION {section}
                    </div>
                </div>
                <p className="text-slate-500 dark:text-slate-500 text-sm md:text-[15px] font-bold leading-tight mb-8 transition-colors">{title}</p>

                <div className="grid grid-cols-2 bg-slate-50 dark:bg-[#0B1120]/50 rounded-[24px] border border-slate-100 dark:border-white/5 mb-8 overflow-hidden transition-colors">
                    <div className="p-4 border-r border-slate-100 dark:border-white/5">
                        <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-600 mb-1 tracking-widest">Students</p>
                        <span className="text-xl md:text-2xl font-black text-[#0F172A] dark:text-slate-100 transition-colors">{students}</span>
                    </div>
                    <div className="p-4">
                        <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-600 mb-1 tracking-widest">Pending</p>
                        <span className="text-xl md:text-2xl font-black text-red-600 dark:text-red-400 transition-colors">{pending}</span>
                    </div>
                </div>

                {status === 'ok' ? (
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-4 flex items-center gap-3 transition-colors">
                        <div className="bg-emerald-500 p-1 rounded-full"><CheckCircle2 className="h-3 w-3 text-white" /></div>
                        <span className="text-emerald-700 dark:text-emerald-500 text-sm font-black transition-colors">Verified integrity</span>
                    </div>
                ) : (
                    <div className="bg-red-50 dark:bg-rose-500/10 rounded-2xl p-4 flex items-center gap-3 transition-colors">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-rose-500" />
                        <span className="text-red-700 dark:text-rose-500 text-sm font-black transition-colors">{alerts} High-similarity alerts</span>
                    </div>
                )}
            </div>
            <div className="p-6 pt-0 mt-auto">
                {status === 'alert' && showReviewButton ? (
                    <Link to={`/teacher/classes/${code}`} className="block w-full text-center py-4 bg-[#1D68E3] hover:bg-blue-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-500/10 transition-all active:scale-[0.98]">
                        Review Alerts
                    </Link>
                ) : (
                    <Link to={`/teacher/classes/${code}`} className="block w-full text-center py-4 bg-slate-50 dark:bg-[#0B1120] text-slate-700 dark:text-slate-100 font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-slate-100 dark:hover:bg-[#0B1120]/80 transition-all border border-slate-100 dark:border-white/5 active:scale-[0.98]">
                        Manage Class
                    </Link>
                )}
            </div>
        </div>
    );
};


export default ClassCard;
