import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

const ClassCard = ({ code, title, section, students, pending, status, alerts, showReviewButton = false }) => {
    return (
        <div className="bg-white dark:bg-[#0F172A] rounded-xl shadow-sm overflow-hidden flex flex-col h-full border border-slate-100 dark:border-white/5 border-t-[4px] border-t-[#1D68E3] transition-all hover:shadow-md group">
            <div className="p-3 pb-2 flex-1">
                <div className="flex justify-between items-start mb-2">
                    <h4 className="text-[13px] font-black text-[#0F172A] dark:text-slate-100 transition-colors">{code}</h4>
                    <div className="bg-slate-50 dark:bg-[#0B1120] border border-slate-100 dark:border-white/5 px-1.5 py-0.5 rounded text-[8px] font-black text-slate-400 dark:text-slate-600 transition-colors uppercase tracking-widest">
                        SEC {section}
                    </div>
                </div>
                <p className="text-slate-500 dark:text-slate-500 text-[11px] font-bold leading-tight mb-3 transition-colors line-clamp-2">{title}</p>

                <div className="grid grid-cols-2 bg-slate-50 dark:bg-[#0B1120]/50 rounded-lg border border-slate-100 dark:border-white/5 mb-3 overflow-hidden transition-colors">
                    <div className="p-2 border-r border-slate-100 dark:border-white/5">
                        <p className="text-[8px] uppercase font-black text-slate-400 dark:text-slate-600 mb-0.5 tracking-widest">Students</p>
                        <span className="text-base font-black text-[#0F172A] dark:text-slate-100 transition-colors">{students}</span>
                    </div>
                    <div className="p-2">
                        <p className="text-[8px] uppercase font-black text-slate-400 dark:text-slate-600 mb-0.5 tracking-widest">Pending</p>
                        <span className="text-base font-black text-red-600 dark:text-red-400 transition-colors">{pending}</span>
                    </div>
                </div>

                {status === 'ok' ? (
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-2 flex items-center gap-2 transition-colors">
                        <div className="bg-emerald-500 p-0.5 rounded-full"><CheckCircle2 className="h-2.5 w-2.5 text-white" /></div>
                        <span className="text-emerald-700 dark:text-emerald-500 text-[10px] font-black transition-colors">Verified integrity</span>
                    </div>
                ) : (
                    <div className="bg-red-50 dark:bg-rose-500/10 rounded-lg p-2 flex items-center gap-2 transition-colors">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-rose-500 shrink-0" />
                        <span className="text-red-700 dark:text-rose-500 text-[10px] font-black transition-colors">{alerts} High-similarity alerts</span>
                    </div>
                )}
            </div>
            <div className="p-3 pt-0 mt-auto">
                {status === 'alert' && showReviewButton ? (
                    <Link to={`/teacher/classes/${code}`} className="block w-full text-center py-2 bg-[#1D68E3] hover:bg-blue-600 text-white font-black text-[10px] uppercase tracking-wider rounded-lg transition-all active:scale-[0.98]">
                        Review Alerts
                    </Link>
                ) : (
                    <Link to={`/teacher/classes/${code}/students`} className="block w-full text-center py-2 bg-slate-50 dark:bg-[#0B1120] text-slate-700 dark:text-slate-100 font-black text-[10px] uppercase tracking-wider rounded-lg hover:bg-slate-100 dark:hover:bg-[#0B1120]/80 transition-all border border-slate-100 dark:border-white/5 active:scale-[0.98]">
                        Manage Class
                    </Link>
                )}
            </div>
        </div>
    );
};

export default ClassCard;
