import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Calendar,
    Clock,
    IdCard,
    Loader2,
    Mail,
    Shield,
    User,
} from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import adminUserService from '../../../services/adminUserService';
import { getApiOrigin } from '../../../lib/api';
import { resolveProfilePhotoUrl } from '../../../shared/utils/profilePhoto';

const AdminProfile = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        const adminId = user?._id || user?.id;

        (async () => {
            if (!adminId) {
                setError('Not signed in');
                setLoading(false);
                return;
            }
            try {
                const res = await adminUserService.getAdmin(adminId);
                if (cancelled) return;
                if (res.success && res.data) {
                    setProfile(res.data);
                } else {
                    // Fall back to auth user if admin-by-id is unavailable
                    setProfile({
                        _id: adminId,
                        name: user?.name || '',
                        email: user?.email || '',
                        username: user?.username || '',
                        photo: user?.photo || '',
                        isActive: user?.isActive !== false,
                        createdAt: user?.createdAt || null,
                        lastLoginAt: user?.lastLoginAt || null,
                    });
                }
            } catch (err) {
                if (cancelled) return;
                setProfile({
                    _id: adminId,
                    name: user?.name || '',
                    email: user?.email || '',
                    username: user?.username || '',
                    photo: user?.photo || '',
                    isActive: user?.isActive !== false,
                    createdAt: user?.createdAt || null,
                    lastLoginAt: user?.lastLoginAt || null,
                });
                if (!user?.email) {
                    setError(err.response?.data?.message || 'Failed to load profile');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [user]);

    if (loading) {
        return (
            <div className="flex min-h-[40vh] flex-col items-center justify-center">
                <Loader2 className="mb-2 h-7 w-7 animate-spin text-[var(--brand-primary)]" />
                <p className="text-[12px] font-medium text-[var(--text-secondary)]">Loading profile...</p>
            </div>
        );
    }

    if (error && !profile) {
        return (
            <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
                <p className="text-sm font-bold text-rose-800">{error}</p>
                <button
                    type="button"
                    onClick={() => navigate('/admin')}
                    className="mt-4 text-sm font-bold text-[var(--brand-primary)] hover:underline"
                >
                    Back to dashboard
                </button>
            </div>
        );
    }

    const photoUrl = resolveProfilePhotoUrl(profile?.photo, getApiOrigin());
    const initial = (profile?.name || profile?.email || 'A').trim().slice(0, 1).toUpperCase();
    const roles = user?.roles?.length ? user.roles : [user?.role || 'admin'];
    const statusActive = profile?.isActive !== false;

    const formatDate = (value) => {
        if (!value) return '—';
        try {
            return new Date(value).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
            });
        } catch {
            return '—';
        }
    };

    return (
        <div className="mx-auto max-w-3xl space-y-4 font-sans">
            <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
                <ArrowLeft className="h-4 w-4" />
                Back
            </button>

            <div className="overflow-hidden rounded-[1.25rem] bg-[var(--bg-card)] shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)] ring-1 ring-[var(--border)]">
                <div className="border-b border-[var(--border)] bg-gradient-to-r from-[#eef2fb] via-white to-[#eef2fb] px-5 py-6 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div
                            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-extrabold text-white ring-4 ring-white shadow-md"
                            style={{ background: 'linear-gradient(145deg, #6b84d4 0%, #2f4aad 100%)' }}
                        >
                            {photoUrl ? (
                                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                                initial
                            )}
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
                                {profile?.name || 'Administrator'}
                            </h1>
                            <p className="mt-0.5 truncate text-[13px] font-medium text-[var(--text-secondary)]">
                                {profile?.email || '—'}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                                    <Shield className="h-3 w-3" />
                                    {roles.join(' · ')}
                                </span>
                                <span
                                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
 statusActive
 ? 'bg-emerald-50 text-emerald-700'
 : 'bg-amber-50 text-amber-700'
 }`}
                                >
                                    {statusActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 p-5 sm:grid-cols-2">
                    {[
                        { icon: User, label: 'Full name', value: profile?.name },
                        { icon: Mail, label: 'Email', value: profile?.email },
                        { icon: IdCard, label: 'Username', value: profile?.username },
                        { icon: Shield, label: 'Role', value: roles.join(', ') },
                        { icon: Calendar, label: 'Account created', value: formatDate(profile?.createdAt) },
                        { icon: Clock, label: 'Last login', value: formatDate(profile?.lastLoginAt) },
                    ].map((row) => (
                        <div
                            key={row.label}
                            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-3 dark:bg-white/[0.03]"
                        >
                            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                <row.icon className="h-3.5 w-3.5" />
                                {row.label}
                            </div>
                            <p className="truncate text-[13px] font-bold text-[var(--text-primary)]">
                                {row.value || '—'}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminProfile;
