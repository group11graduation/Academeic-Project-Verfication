import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TEACHER_PRIMARY } from '../ui/teacherTheme';

const ClassCard = ({ code, title, section, students, pending, status, alerts, showReviewButton = false }) => {
    return (
        <div className="group flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[#d5dcf0] transition hover:shadow-md [font-family:var(--sv-font-sans)]">
            <div className="h-1 w-full" style={{ backgroundColor: TEACHER_PRIMARY }} />
            <div className="flex flex-1 flex-col p-3 pb-2">
                <div className="mb-2 flex items-start justify-between gap-2">
                    <h4 className="text-[13px] font-semibold tracking-tight text-[#0f172a]">{code}</h4>
                    <div className="rounded-md bg-[#eef2fb] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-[#2f4aad]">
                        SEC {section}
                    </div>
                </div>
                <p className="mb-3 line-clamp-2 text-[11px] font-normal leading-tight text-slate-500">{title}</p>

                <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-lg bg-[#f8f9fd] ring-1 ring-[#d5dcf0]">
                    <div className="border-r border-[#d5dcf0] p-2">
                        <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-wider text-slate-400">Students</p>
                        <span className="text-base font-bold text-[#0f172a]">{students}</span>
                    </div>
                    <div className="p-2">
                        <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-wider text-slate-400">Pending</p>
                        <span className="text-base font-bold text-rose-600">{pending}</span>
                    </div>
                </div>

                {status === 'ok' ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2">
                        <div className="rounded-full bg-emerald-500 p-0.5">
                            <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-700">Verified integrity</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                        <span className="text-[10px] font-semibold text-rose-700">
                            {alerts} review alert{alerts === 1 ? '' : 's'}
                        </span>
                    </div>
                )}
            </div>
            <div className="mt-auto p-3 pt-0">
                {status === 'alert' && showReviewButton ? (
                    <Link
                        to={`/teacher/classes/${code}?focus=alerts`}
                        className="block w-full rounded-lg py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-white transition hover:brightness-110 active:scale-[0.98]"
                        style={{ backgroundColor: TEACHER_PRIMARY }}
                    >
                        Review Alerts
                    </Link>
                ) : (
                    <Link
                        to={`/teacher/classes/${code}/students`}
                        className="block w-full rounded-lg border border-[#d5dcf0] bg-[#f8f9fd] py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[#2f4aad] transition hover:bg-[#eef2fb] active:scale-[0.98]"
                    >
                        Manage Class
                    </Link>
                )}
            </div>
        </div>
    );
};

export default ClassCard;
