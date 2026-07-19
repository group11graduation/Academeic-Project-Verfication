import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    BookOpen,
    Building2,
    IdCard,
    Loader2,
    Mail,
    Phone,
    User,
} from 'lucide-react';
import teacherService from '../../../services/teacherService';
import { getApiOrigin } from '../../../lib/api';
import { resolveProfilePhotoUrl } from '../../../shared/utils/profilePhoto';

const TeacherMyProfile = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await teacherService.getMyProfile();
                if (!cancelled) {
                    if (res.success) setProfile(res.data);
                    else setError(res.message || 'Failed to load profile');
                }
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load profile');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#1D68E3]" />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
                <p className="text-sm font-bold text-rose-800">{error || 'Profile not found'}</p>
                <button
                    type="button"
                    onClick={() => navigate('/teacher')}
                    className="mt-4 text-sm font-bold text-[#1D68E3] hover:underline"
                >
                    Back to dashboard
                </button>
            </div>
        );
    }

    const photoUrl = resolveProfilePhotoUrl(profile.photo, getApiOrigin());
    const initial = (profile.name || 'T').trim().slice(0, 1).toUpperCase();

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800"
            >
                <ArrowLeft className="h-4 w-4" />
                Back
            </button>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0F172A]">
                <div className="border-b border-slate-100 bg-gradient-to-r from-[#eef3ff] via-white to-[#eef3ff] px-5 py-6 dark:border-white/10 dark:from-[#111827] dark:via-[#0F172A] dark:to-[#111827]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#1D68E3] text-xl font-black text-white shadow-md">
                            {photoUrl ? (
                                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                                initial
                            )}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">{profile.name || 'Teacher'}</h1>
                            <p className="mt-0.5 text-sm font-semibold text-slate-500">
                                {[profile.department, profile.faculty].filter(Boolean).join(' · ') || 'Faculty account'}
                            </p>
                            {profile.employeeId ? (
                                <p className="mt-1 text-xs font-mono font-bold text-slate-400">ID {profile.employeeId}</p>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 p-5 sm:grid-cols-2">
                    {[
                        { icon: Mail, label: 'Email', value: profile.email },
                        { icon: User, label: 'Username', value: profile.username },
                        { icon: Phone, label: 'Phone', value: profile.phone },
                        { icon: IdCard, label: 'Employee ID', value: profile.employeeId },
                        { icon: Building2, label: 'Faculty', value: profile.faculty },
                        { icon: BookOpen, label: 'Department', value: profile.department },
                    ].map((row) => (
                        <div
                            key={row.label}
                            className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3 dark:border-white/10 dark:bg-white/[0.03]"
                        >
                            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                <row.icon className="h-3.5 w-3.5" />
                                {row.label}
                            </div>
                            <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                                {row.value || '—'}
                            </p>
                        </div>
                    ))}
                </div>

                {Array.isArray(profile.skills) && profile.skills.length > 0 ? (
                    <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Skills</p>
                        <div className="flex flex-wrap gap-1.5">
                            {profile.skills.map((skill) => (
                                <span
                                    key={skill}
                                    className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#1D68E3] dark:bg-blue-950/40 dark:text-blue-300"
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null}

                <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Assigned classes</p>
                    {(profile.classes || []).length === 0 ? (
                        <p className="text-sm font-medium text-slate-500">No classes assigned yet.</p>
                    ) : (
                        <ul className="space-y-1.5">
                            {profile.classes.map((cls) => (
                                <li
                                    key={cls._id || cls.code}
                                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-white/10"
                                >
                                    <span className="font-bold text-slate-800 dark:text-slate-100">
                                        {cls.code}
                                        {cls.name ? (
                                            <span className="font-medium text-slate-500"> — {cls.name}</span>
                                        ) : null}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/teacher/classes/${encodeURIComponent(cls.code)}`)}
                                        className="text-xs font-black text-[#1D68E3] hover:underline"
                                    >
                                        Open
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeacherMyProfile;
