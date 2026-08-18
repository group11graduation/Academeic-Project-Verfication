import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Copy, Check, Eye, EyeOff, Shield } from 'lucide-react';
import adminUserService from '../../../services/adminUserService';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';
import { copyTextToClipboard } from '../../../shared/utils/clipboard';

const AdminAddAdmin = () => {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const generatedPasscode = Math.floor(100000 + Math.random() * 900000).toString();
    const [form, setForm] = useState({ name: '', email: '', username: '', password: generatedPasscode });
    const [showPasscode, setShowPasscode] = useState(false);
    const [copiedPasscode, setCopiedPasscode] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await adminUserService.createAdmin(form);
            if (res.success) {
                navigate('/admin/admins');
            } else {
                await appError(res.message || 'Could not create admin');
            }
        } catch (err) {
            await appError(err.response?.data?.message || err.message || 'Could not create admin');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopyPasscode = async () => {
        if (!form.password) return;
        try {
            await copyTextToClipboard(form.password);
            setCopiedPasscode(true);
            window.setTimeout(() => setCopiedPasscode(false), 2000);
        } catch (err) {
            await appError('Failed to copy passcode.');
        }
    };

    return (
        <div className="max-w-lg font-sans">
            <button
                type="button"
                onClick={() => navigate('/admin/admins')}
                className="mb-6 inline-flex items-center gap-2 text-[14px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
                <ArrowLeft className="h-4 w-4" />
                Back
            </button>
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] mb-6">Add administrator</h1>
            <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm">
                <div>
                    <label className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1">Name</label>
                    <input
                        required
                        className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5 text-[14px]"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1">Email</label>
                    <input
                        type="email"
                        required
                        className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5 text-[14px]"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1">Username (optional)</label>
                    <input
                        className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5 text-[14px]"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1">Password / passcode</label>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                                <Shield className="h-4 w-4 text-[var(--brand-primary)]" />
                                <span className="text-[12px] font-bold uppercase tracking-wider">Admin Passcode</span>
                            </div>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2">
                            <span className="text-[16px] font-black tracking-widest font-mono text-[var(--text-primary)]">
                                {showPasscode ? form.password : '••••••'}
                            </span>
                            <button
                                type="button"
                                onClick={handleCopyPasscode}
                                className="text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors"
                                title="Copy passcode"
                            >
                                {copiedPasscode ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowPasscode((prev) => !prev)}
                                className="text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors"
                                title={showPasscode ? 'Hide passcode' : 'Show passcode'}
                            >
                                {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        <input type="hidden" required readOnly value={form.password} />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-6 py-3 text-[14px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Create
                </button>
            </form>
        </div>
    );
};

export default AdminAddAdmin;
