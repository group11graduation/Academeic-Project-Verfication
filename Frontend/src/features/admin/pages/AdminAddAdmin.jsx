import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import adminUserService from '../../../services/adminUserService';

const AdminAddAdmin = () => {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', username: '', password: '' });

    const onSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await adminUserService.createAdmin(form);
            if (res.success) {
                navigate('/admin/admins');
            } else {
                alert(res.message || 'Could not create admin');
            }
        } catch (err) {
            alert(err.response?.data?.message || err.message || 'Could not create admin');
        } finally {
            setSubmitting(false);
        }
    };

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
            <h1 className="text-2xl font-extrabold text-slate-900 mb-6">Add administrator</h1>
            <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                    <label className="block text-[13px] font-bold text-slate-600 mb-1">Username (optional)</label>
                    <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px]"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-[13px] font-bold text-slate-600 mb-1">Password / passcode</label>
                    <input
                        type="password"
                        required
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px]"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                </div>
                <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1e56e3] px-6 py-3 text-[14px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Create
                </button>
            </form>
        </div>
    );
};

export default AdminAddAdmin;
