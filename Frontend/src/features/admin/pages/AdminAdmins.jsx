import React, { useState, useEffect } from 'react';
import { Search, Shield, Loader2 } from 'lucide-react';
import adminUserService from '../../../services/adminUserService';

const AdminAdmins = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const filteredAdmins = admins.filter(admin =>
        admin.systemId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        admin.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] dark:bg-slate-900 flex flex-col items-center justify-center transition-colors">
                <Loader2 className="h-10 w-10 text-[#1D68E3] animate-spin mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Loading administrators...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB] dark:bg-[#0F172A]/30 p-4 md:p-10 font-sans transition-colors">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 md:mb-8">
                <div className="relative w-full md:w-[350px]">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search admins..."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-[16px] py-3 pl-14 pr-6 text-[14px] focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all outline-none font-medium text-slate-700 dark:text-slate-200 shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <header className="text-center md:text-right">
                    <h1 className="text-xl md:text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none mb-1">Admins</h1>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">System Control</p>
                </header>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden mb-10">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-50 dark:border-slate-800 uppercase tracking-[0.1em] text-[11px] font-black text-slate-400 dark:text-slate-500">
                            <th className="px-10 py-6">#</th>
                            <th className="px-6 py-6">ADMIN ID</th>
                            <th className="px-6 py-6">EMAIL ADDRESS</th>
                            <th className="px-6 py-6">STATUS</th>
                            <th className="px-6 py-6">CREATED AT</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {filteredAdmins.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-16 text-slate-400 dark:text-slate-500 font-medium">
                                    No administrative accounts found.
                                </td>
                            </tr>
                        ) : (
                            filteredAdmins.map((admin, index) => (
                                <tr key={admin._id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-10 py-7 text-[14px] font-bold text-slate-300 dark:text-slate-600">{index + 1}</td>
                                    <td className="px-6 py-7">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg">
                                                <Shield className="h-4 w-4 text-[#1D68E3] dark:text-blue-400" />
                                            </div>
                                            <span className="text-[16px] font-bold text-[#0F172A] dark:text-slate-200">{admin.systemId}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-7">
                                        <span className="text-[14px] font-bold text-slate-600 dark:text-slate-400">{admin.email}</span>
                                    </td>
                                    <td className="px-6 py-7">
                                        <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-black uppercase tracking-widest rounded-full">
                                            {admin.accountStatus || 'ACTIVE'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-7">
                                        <span className="text-[14px] font-bold text-slate-400 dark:text-slate-500">
                                            {new Date(admin.createdAt).toLocaleDateString()}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminAdmins;
