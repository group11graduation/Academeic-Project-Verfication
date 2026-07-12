import React, { useState, useEffect } from 'react';
import { Search, Shield, Loader2, Pencil, Trash2, Plus, Eye, EyeOff, Copy, Check, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import adminUserService from '../../../services/adminUserService';
import { usePageSearch } from '../../../context/shellSearchContext';
import { copyTextToClipboard } from '../../../shared/utils/clipboard';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';

const AdminAdmins = () => {
    const { query: searchQuery, setQuery: setSearchQuery } = usePageSearch('Search admins…');
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingId, setDeletingId] = useState('');
    const [revealedPasscodes, setRevealedPasscodes] = useState({});
    const [copiedAdminId, setCopiedAdminId] = useState('');
    const [generatingPasscodeId, setGeneratingPasscodeId] = useState('');

    useEffect(() => {
        const fetchAdmins = async () => {
            try {
                const response = await adminUserService.getUsersByRole('admin');
                if (response.success) {
                    setAdmins(response.data);
                }
            } catch (error) {
                console.error("Failed to fetch admins:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAdmins();
    }, []);

    const filteredAdmins = admins.filter((admin) =>
        matchesSearchQuery(searchQuery, admin.systemId, admin.email, admin.username)
    );

    const startEdit = (admin) => {
        setEditingId(admin._id);
        setEditEmail(admin.email || '');
    };

    const cancelEdit = () => {
        setEditingId('');
        setEditEmail('');
    };

    const submitEdit = async () => {
        if (!editingId) return;
        if (!editEmail.trim()) {
            await appWarning('Email is required');
            return;
        }
        setSavingEdit(true);
        try {
            const response = await adminUserService.updateAdmin(editingId, {
                email: editEmail.trim(),
            });
            if (!response.success) throw new Error(response.message || 'Failed to update admin');
            setAdmins((prev) => prev.map((item) => (
                item._id === editingId
                    ? { ...item, email: editEmail.trim(), systemId: item.username || editEmail.trim() || item._id }
                    : item
            )));
            cancelEdit();
        } catch (error) {
            await appError(error.response?.data?.message || error.message || 'Failed to update admin');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDelete = async (adminId) => {
        const shouldDelete = await appConfirm({
            message: 'Are you sure you want to delete this admin account?',
            danger: true,
            confirmLabel: 'Delete',
        });
        if (!shouldDelete) return;
        setDeletingId(adminId);
        try {
            const response = await adminUserService.deleteAdmin(adminId);
            if (!response.success) throw new Error(response.message || 'Failed to delete admin');
            setAdmins((prev) => prev.filter((item) => item._id !== adminId));
        } catch (error) {
            await appError(error.response?.data?.message || error.message || 'Failed to delete admin');
        } finally {
            setDeletingId('');
        }
    };

    const togglePasscode = (adminId) => {
        setRevealedPasscodes((prev) => ({
            ...prev,
            [adminId]: !prev[adminId],
        }));
    };

    const handleCopyPasscode = async (adminId, passcode) => {
        if (!passcode) return;
        try {
            await copyTextToClipboard(passcode);
            setCopiedAdminId(adminId);
            window.setTimeout(() => {
                setCopiedAdminId((current) => (current === adminId ? '' : current));
            }, 2000);
        } catch (error) {
            await appError('Failed to copy passcode.');
        }
    };

    const handleGeneratePasscode = async (adminId) => {
        setGeneratingPasscodeId(adminId);
        try {
            const response = await adminUserService.regenerateAdminPasscode(adminId);
            if (!response.success) throw new Error(response.message || 'Failed to generate passcode');
            const passcode = response.data?.passcode || '';
            setAdmins((prev) => prev.map((item) => (
                item._id === adminId ? { ...item, passcode } : item
            )));
            setRevealedPasscodes((prev) => ({ ...prev, [adminId]: true }));
        } catch (error) {
            await appError(error.response?.data?.message || error.message || 'Failed to generate passcode');
        } finally {
            setGeneratingPasscodeId('');
        }
    };

    if (loading) {
        return (
            <div className="min-h-[40vh] flex flex-col items-center justify-center">
                <Loader2 className="h-7 w-7 text-[#1D68E3] animate-spin mb-2" />
                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Loading administrators...</p>
            </div>
        );
    }

    return (
        <div className="font-sans text-[13px] transition-colors">
            <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3 gap-3">
                <div className="relative w-full md:w-[280px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search admins..."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-3 text-[12px] focus:ring-2 focus:ring-blue-500/10 outline-none font-medium text-slate-700 dark:text-slate-200"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to="/admin/admins/new"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D68E3] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        New Admin
                    </Link>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Total: <span className="font-bold text-slate-700 dark:text-slate-200">{filteredAdmins.length}</span>
                    </div>
                    <div className="text-right">
                        <h1 className="text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none">Admins</h1>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">System</p>
                    </div>
                </div>
            </div>

            <div className="app-table-shell">
                <div className="app-table-wrap">
                <table className="app-table">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">#</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Admin ID</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Email Address</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Passcode</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Status</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Created At</th>
                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/90 dark:divide-slate-800">
                        {filteredAdmins.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-8 text-center text-[12px] font-medium text-slate-400 dark:text-slate-500">
                                    No administrative accounts found.
                                </td>
                            </tr>
                        ) : (
                            filteredAdmins.map((admin, index) => (
                                <tr key={admin._id} className="transition-colors hover:bg-blue-50/30 dark:hover:bg-[#162033]">
                                    <td className="px-3 py-2 text-[12px] font-bold text-slate-400 dark:text-slate-500">{index + 1}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="bg-blue-50 p-1.5 rounded-md">
                                                <Shield className="h-3.5 w-3.5 text-[#1D68E3]" />
                                            </div>
                                            <span className="text-[12px] font-bold text-slate-800 dark:text-slate-100">{admin.systemId}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        {editingId === admin._id ? (
                                            <input
                                                type="email"
                                                value={editEmail}
                                                onChange={(e) => setEditEmail(e.target.value)}
                                                className="w-full min-w-[220px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            />
                                        ) : (
                                            <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{admin.email}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        {admin.passcode ? (
                                            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                                                <span className="font-mono text-[12px] font-black tracking-wider text-slate-700 dark:text-slate-200">
                                                    {revealedPasscodes[admin._id] ? admin.passcode : '••••••'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyPasscode(admin._id, admin.passcode)}
                                                    className="text-slate-500 transition-colors hover:text-[#1D68E3] dark:text-slate-400 dark:hover:text-blue-300"
                                                    title="Copy passcode"
                                                >
                                                    {copiedAdminId === admin._id ? (
                                                        <Check className="h-4 w-4 text-emerald-500" />
                                                    ) : (
                                                        <Copy className="h-4 w-4" />
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => togglePasscode(admin._id)}
                                                    className="text-slate-500 transition-colors hover:text-[#1D68E3] dark:text-slate-400 dark:hover:text-blue-300"
                                                    title={revealedPasscodes[admin._id] ? 'Hide passcode' : 'Show passcode'}
                                                >
                                                    {revealedPasscodes[admin._id] ? (
                                                        <EyeOff className="h-4 w-4" />
                                                    ) : (
                                                        <Eye className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleGeneratePasscode(admin._id)}
                                                disabled={generatingPasscodeId === admin._id}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                                            >
                                                {generatingPasscodeId === admin._id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                )}
                                                Generate
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
                                            {admin.accountStatus || 'ACTIVE'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                                            {new Date(admin.createdAt).toLocaleDateString()}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center justify-center gap-2">
                                            {editingId === admin._id ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={submitEdit}
                                                        disabled={savingEdit}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                                                    >
                                                        {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                                                        Save
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={cancelEdit}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => startEdit(admin)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" /> Update
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(admin._id)}
                                                        disabled={deletingId === admin._id}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-60"
                                                    >
                                                        {deletingId === admin._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            </div>
        </div>
    );
};

export default AdminAdmins;
