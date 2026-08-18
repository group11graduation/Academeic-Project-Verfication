import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Pencil, Trash2, Plus, Eye, EyeOff, Copy, Check, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import adminUserService from '../../../services/adminUserService';
import { usePageSearch } from '../../../context/shellSearchContext';
import { copyTextToClipboard } from '../../../shared/utils/clipboard';
import { matchesSearchQuery } from '../../../shared/utils/searchUtils';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';
import TablePagination, { slicePage } from '../../../shared/components/TablePagination';

const PAGE_SIZE = 8;

const AdminAdmins = () => {
    const { query: searchQuery, setQuery: setSearchQuery } = usePageSearch('Search admins…');
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
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

    const filteredAdmins = useMemo(
        () =>
            admins.filter((admin) =>
                matchesSearchQuery(searchQuery, admin.systemId, admin.email, admin.username)
            ),
        [admins, searchQuery]
    );

    useEffect(() => {
        setPage(1);
    }, [searchQuery]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(filteredAdmins.length / PAGE_SIZE));
        if (page > totalPages) setPage(totalPages);
    }, [filteredAdmins.length, page]);

    const pagedAdmins = useMemo(
        () => slicePage(filteredAdmins, page, PAGE_SIZE),
        [filteredAdmins, page]
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
                <Loader2 className="h-7 w-7 text-[var(--brand-primary)] animate-spin mb-2" />
                <p className="text-[12px] text-[var(--text-secondary)] dark:text-[var(--text-secondary)] font-medium">Loading administrators...</p>
            </div>
        );
    }

    return (
        <div className="font-sans text-[13px] transition-colors">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-lg font-extrabold tracking-tight text-[var(--text-primary)]">Admins</h1>
                    <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">System administrators</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-[260px]">
                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder="Search"
                            className="w-full rounded-full border border-[var(--border)] bg-[var(--bg-card)] py-2.5 pl-10 pr-4 text-[12px] font-medium text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[#2f4aad]/15"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Link
                        to="/admin/admins/new"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-4 py-2.5 text-[12px] font-bold text-white transition hover:brightness-110"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        New Admin
                    </Link>
                </div>
            </div>

            <div className="overflow-hidden rounded-[1.25rem] bg-[var(--bg-card)] shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)] ring-1 ring-[var(--border)]">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[36rem] border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[var(--border)]">
                                <th className="px-5 py-3.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                                    <span className="text-[var(--brand-primary)]">Admin</span>
                                    <span className="text-slate-300"> / ID</span>
                                </th>
                                <th className="px-5 py-3.5 text-[11px] font-semibold text-[var(--text-secondary)]">Email</th>
                                <th className="px-5 py-3.5 text-[11px] font-semibold text-[var(--text-secondary)]">Passcode</th>
                                <th className="px-5 py-3.5 text-[11px] font-semibold text-[var(--text-secondary)]">Status</th>
                                <th className="px-5 py-3.5 text-[11px] font-semibold text-[var(--text-secondary)]">Created</th>
                                <th className="px-5 py-3.5 text-[11px] font-semibold text-[var(--text-secondary)] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAdmins.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-[12px] font-medium text-[var(--text-secondary)]">
                                        No administrative accounts found.
                                    </td>
                                </tr>
                            ) : (
                                pagedAdmins.map((admin) => {
                                    const initial = String(admin.email || admin.systemId || 'A').trim().slice(0, 1).toUpperCase();
                                    const isEditing = editingId === admin._id;
                                    return (
                                        <tr
                                            key={admin._id}
                                            className="group border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--bg-elevated)]/70 dark:hover:bg-white/5"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[13px] font-extrabold text-[var(--brand-primary)]">
                                                        {initial}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-[13px] font-bold text-[var(--text-primary)]">
                                                            {admin.systemId || admin.username || 'Admin'}
                                                        </p>
                                                        <p className="truncate text-[11px] font-semibold text-[var(--brand-primary)]">
                                                            {admin.username || admin.systemId || '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="email"
                                                        value={editEmail}
                                                        onChange={(e) => setEditEmail(e.target.value)}
                                                        className="w-full min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[12px] font-semibold text-[var(--text-primary)]"
                                                    />
                                                ) : (
                                                    <span className="text-[13px] font-medium text-[var(--text-secondary)]">
                                                        {admin.email}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {admin.passcode ? (
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <span className="font-mono text-[12px] font-bold tracking-wider text-[var(--text-primary)]">
                                                            {revealedPasscodes[admin._id] ? admin.passcode : '••••••'}
                                                        </span>
                                                        <button type="button" onClick={() => handleCopyPasscode(admin._id, admin.passcode)} className="rounded-full p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--brand-primary)]" title="Copy">
                                                            {copiedAdminId === admin._id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                                        </button>
                                                        <button type="button" onClick={() => togglePasscode(admin._id)} className="rounded-full p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--brand-primary)]" title="Toggle">
                                                            {revealedPasscodes[admin._id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleGeneratePasscode(admin._id)}
                                                        disabled={generatingPasscodeId === admin._id}
                                                        className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px] font-bold text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white disabled:opacity-60"
                                                    >
                                                        {generatingPasscodeId === admin._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                                        Generate
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                                                    {admin.accountStatus || 'ACTIVE'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                                                    {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : '—'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isEditing ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={submitEdit}
                                                                disabled={savingEdit}
                                                                className="rounded-full bg-[var(--brand-primary)] px-4 py-1.5 text-[11px] font-bold text-white hover:brightness-110 disabled:opacity-60"
                                                            >
                                                                {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                                                            </button>
                                                            <button type="button" onClick={cancelEdit} className="rounded-full px-3 py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]">
                                                                Cancel
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => startEdit(admin)}
                                                                className="rounded-full bg-[var(--brand-primary)] px-4 py-1.5 text-[11px] font-bold text-white opacity-0 transition group-hover:opacity-100"
                                                            >
                                                                View
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => startEdit(admin)}
                                                                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-slate-200 dark:bg-white/10"
                                                                title="Update"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(admin._id)}
                                                                disabled={deletingId === admin._id}
                                                                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:bg-white/10"
                                                                title="Delete"
                                                            >
                                                                {deletingId === admin._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <TablePagination
                    page={page}
                    pageSize={PAGE_SIZE}
                    totalItems={filteredAdmins.length}
                    onPageChange={setPage}
                />
            </div>
        </div>
    );
};

export default AdminAdmins;
