import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import adminUserService from '../../../services/adminUserService';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';

const AdminAdminDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', email: '', username: '', password: '' });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await adminUserService.getAdmin(id);
                if (cancelled) return;
                if (res.success && res.data) {
                    const d = res.data;
                    setForm({
                        name: d.name || '',
                        email: d.email || '',
                        username: d.username || '',
                        password: '',
                    });
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const onSave = async (e) => {
        e.preventDefault();
        const body = { ...form };
        if (!body.password) delete body.password;
        try {
            const res = await adminUserService.updateAdmin(id, body);
            if (res.success) {
                navigate('/admin/admins');
            } else {
                await appError(res.message || 'Update failed');
            }
        } catch (err) {
            await appError(err.response?.data?.message || err.message || 'Update failed');
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-[#1e56e3]" />
            </div>
        );
    }

    return (
        <div className="max-w-lg font-sans">
            <button
                type="button"
                onClick={() => navigate('/admin/admins')}
                className="mb-6 inline-flex items-center gap-2 text-[14px] font-bold text-slate-600 hover:text-slate-900"
            >
                <ArrowLeft className="h-4 w-4" />
                Back
            </button>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-6">Edit administrator</h1>
            <form onSubmit={onSave} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                    <label className="block text-[13px] font-bold text-slate-600 mb-1">Name</label>
                    <input
                        required
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px]"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-[13px] font-bold text-slate-600 mb-1">Email</label>
                    <input
                        type="email"
                        required
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px]"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-[13px] font-bold text-slate-600 mb-1">Username</label>
                    <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px]"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-[13px] font-bold text-slate-600 mb-1">New password (optional)</label>
                    <input
                        type="password"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px]"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                </div>
                <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1e56e3] px-6 py-3 text-[14px] font-bold text-white hover:bg-blue-700"
                >
                    Save
                </button>
            </form>
        </div>
    );
};

export default AdminAdminDetail;
