import React from 'react';
import { ArrowRight, CheckCircle2, AlertTriangle, Users, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TEACHER_GRADIENT, TEACHER_PRIMARY } from '../ui/teacherTheme';

const ClassCard = ({ code, title, section, students, pending, status, alerts, showReviewButton = false }) => {
    const monogram = String(code || 'C')
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 2)
        .toUpperCase();
    const pendingCount = Number(pending) || 0;
    const isAlert = status === 'alert';

    return (
        <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_-18px_rgba(47,74,173,0.45)] ring-1 ring-[#d5dcf0] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-18px_rgba(47,74,173,0.55)] [font-family:var(--sv-font-sans)]">
            {/* Soft header wash */}
            <div
                className="relative px-4 pb-4 pt-4"
                style={{
                    background:
                        'linear-gradient(165deg, #e8eeff 0%, #f4f7ff 45%, #ffffff 100%)',
                }}
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-40 blur-2xl"
                    style={{ background: TEACHER_PRIMARY }}
                />
                <div className="relative flex items-start gap-3">
                    <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold tracking-wide text-white shadow-md"
                        style={{ background: TEACHER_GRADIENT }}
                        aria-hidden
                    >
                        {monogram || 'CL'}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <h4 className="truncate text-[15px] font-bold tracking-tight text-[#0f172a]">
                                {code}
                            </h4>
                            <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#2f4aad] ring-1 ring-[#d5dcf0]">
                                Sec {section}
                            </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] font-normal leading-snug text-[#647092]">
                            {title}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 flex-col px-4 pb-4">
                {/* Stats row */}
                <div className="mt-1 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-[#f8f9fd] px-3 py-2.5 ring-1 ring-[#e8eefc]">
                        <div className="mb-1 flex items-center gap-1.5 text-[#647092]">
                            <Users className="h-3 w-3" strokeWidth={2.2} />
                            <span className="text-[9px] font-semibold uppercase tracking-[0.5px]">Students</span>
                        </div>
                        <p className="text-lg font-bold leading-none tracking-tight text-[#0f172a]">
                            {students}
                        </p>
                    </div>
                    <div className="rounded-xl bg-[#f8f9fd] px-3 py-2.5 ring-1 ring-[#e8eefc]">
                        <div className="mb-1 flex items-center gap-1.5 text-[#647092]">
                            <Clock3 className="h-3 w-3" strokeWidth={2.2} />
                            <span className="text-[9px] font-semibold uppercase tracking-[0.5px]">Pending</span>
                        </div>
                        <p
                            className={`text-lg font-bold leading-none tracking-tight ${
                                pendingCount > 0 ? 'text-rose-600' : 'text-[#0f172a]'
                            }`}
                        >
                            {pendingCount}
                        </p>
                    </div>
                </div>

                {/* Status */}
                <div className="mt-3">
                    {isAlert ? (
                        <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 ring-1 ring-rose-100">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                            <span className="text-[11px] font-semibold text-rose-700">
                                {alerts} review alert{alerts === 1 ? '' : 's'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                                <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-700">Verified integrity</span>
                        </div>
                    )}
                </div>

                {/* CTA */}
                <div className="mt-auto pt-3">
                    {isAlert && showReviewButton ? (
                        <Link
                            to={`/teacher/classes/${code}?focus=alerts`}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-semibold text-white transition hover:brightness-110 active:scale-[0.99]"
                            style={{ background: TEACHER_GRADIENT }}
                        >
                            Review Alerts
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    ) : (
                        <Link
                            to={`/teacher/classes/${code}/students`}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-semibold text-white transition hover:brightness-110 active:scale-[0.99]"
                            style={{ background: TEACHER_GRADIENT }}
                        >
                            Manage Class
                            <ArrowRight className="h-3.5 w-3.5 opacity-90 transition group-hover:translate-x-0.5" />
                        </Link>
                    )}
                </div>
            </div>
        </article>
    );
};

export default ClassCard;
