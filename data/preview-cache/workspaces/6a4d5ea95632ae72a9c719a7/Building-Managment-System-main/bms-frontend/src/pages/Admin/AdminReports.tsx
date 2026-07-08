import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { api, AdminReport } from "../../api/report.api";
import { motion } from "framer-motion";
import { 
  ChartPieIcon, 
  BuildingOffice2Icon, 
  UserGroupIcon, 
  ArrowTrendingUpIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ExclamationCircleIcon
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

export function AdminReports() {
  // Initialize with a default structure to prevent 'undefined' crashes
  const [data, setData] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchReport = async () => {
    try {
      setLoading(true);
      const result = await api.getAdminReport();
      setData(result);
    } catch (err) {
      toast.error("Cloud sync failed. Showing local cache if available.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  // 1. LOADING STATE
  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-gray-900">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-black text-[#1E3A4C] dark:text-white tracking-widest uppercase text-sm">Loading Reports...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. ERROR/EMPTY STATE GUARD
  if (!data) {
    return (
      <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-gray-900">
          <ExclamationCircleIcon className="h-12 w-12 text-red-400 dark:text-red-500 mb-4" />
          <p className="text-slate-600 dark:text-gray-300 font-bold mb-4">No data available from the server.</p>
          <button 
            onClick={fetchReport} 
            className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-xl text-sm font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // 3. SAFE DATA PROCESSING
  // We use optional chaining and nullish coalescing to prevent .filter() errors
  const buildings = data?.buildings ?? [];
  
  const filteredBuildings = buildings.filter(b => 
    (b?.name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (b?.managerName ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = [
    { label: "Portfolio Buildings", value: data?.summary?.totalBuildings ?? 0, icon: BuildingOffice2Icon, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Managers", value: data?.summary?.totalManagers ?? 0, icon: UserGroupIcon, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Total Units", value: data?.summary?.totalRooms ?? 0, icon: ChartPieIcon, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Global Occupants", value: data?.summary?.totalOccupants ?? 0, icon: ArrowTrendingUpIcon, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-6">
        {/* --- HEADER --- */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white tracking-tight">Executive Report</h1>
            <p className="text-[10px] text-slate-400 dark:text-gray-400 font-bold uppercase tracking-[0.2em] mt-0.5">
              Live Global Intelligence
            </p>
          </div>
          <button 
            onClick={fetchReport}
            className="group flex items-center gap-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 px-4 py-2 rounded-xl text-[13px] font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-all shadow-sm"
          >
            <ArrowPathIcon className="h-4 w-4 group-active:rotate-180 transition-transform duration-500" /> 
            Refresh
          </button>
        </div>

        {/* --- STATS GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((s, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 relative overflow-hidden"
            >
              <div className={`${s.bg} dark:bg-opacity-20 w-10 h-10 rounded-xl flex items-center justify-center mb-4 relative z-10`}>
                <s.icon className={`h-5 w-5 ${s.color} dark:${s.color.replace('text-', 'text-').replace('-600', '-400')}`} />
              </div>
              <p className="text-[10px] font-black text-slate-400 dark:text-gray-400 uppercase tracking-widest relative z-10">{s.label}</p>
              <h2 className="text-2xl font-black text-[#1E3A4C] dark:text-white mt-2 z-10 relative tracking-tighter">{s.value}</h2>
            </motion.div>
          ))}
        </div>

        {/* --- PERFORMANCE TABLE --- */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-lg font-bold text-[#1E3A4C] dark:text-white">Management Portfolio Breakdown</h3>
            
            <div className="relative w-full md:w-64">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-gray-500" />
              <input 
                type="text"
                placeholder="Search buildings or managers..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-sm dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-gray-700/30 text-[10px] font-black uppercase text-slate-500 dark:text-gray-400 tracking-[0.2em]">
                <tr>
                  <th className="px-4 py-3">Asset Name</th>
                  <th className="px-4 py-3">Management</th>
                  <th className="px-4 py-3">Live Occupancy</th>
                  <th className="px-4 py-3 text-right">Operational Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                {filteredBuildings.length > 0 ? filteredBuildings.map((b) => (
                  <tr key={b?._id} className="group hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-all">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#1E3A4C] dark:text-white text-sm">{b?.name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-gray-400 font-bold uppercase mt-0.5 tracking-widest">Building Unit</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-[#1E3A4C] dark:bg-gray-700 text-white rounded-lg flex items-center justify-center text-xs font-black">
                          {b?.managerName?.charAt(0) || "U"}
                        </div>
                        <div>
                           <div className="font-semibold text-slate-700 dark:text-gray-300 text-sm">{b?.managerName}</div>
                           <div className="text-[10px] text-blue-500 dark:text-blue-400 font-bold uppercase tracking-tighter">Assigned Manager</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-black text-[#1E3A4C] dark:text-white">{b?.occupantCount}</span>
                        <span className="text-[10px] text-slate-400 dark:text-gray-400 font-bold uppercase tracking-widest">Tenants</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${
                        b?.occupantCount > 0 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' 
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                      }`}>
                        {b?.occupantCount > 0 ? 'Active' : 'Empty'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <div className="max-w-xs mx-auto">
                        <MagnifyingGlassIcon className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-slate-400 dark:text-gray-400 font-bold uppercase tracking-widest text-xs">No matching records found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
          </div>
        </div>
      </main>
    </div>
  );
}