import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import * as api from "../../api/reports.api";
import { motion } from "framer-motion";
import { 
  BuildingOffice2Icon, 
  Squares2X2Icon, 
  UserGroupIcon, 
  KeyIcon,
  BriefcaseIcon,
  ChartBarIcon,
  UserIcon
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

export function ReportsPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  useEffect(() => {
    // Get selected building ID from localStorage
    const savedBuildingId = localStorage.getItem("selectedBuildingId");
    setSelectedBuildingId(savedBuildingId);
    fetchReport(savedBuildingId);
  }, []);

  useEffect(() => {
    // Listen for building changes
    const handleBuildingChange = (event: any) => {
      const buildingId = event.detail?.buildingId || localStorage.getItem("selectedBuildingId");
      setSelectedBuildingId(buildingId);
      fetchReport(buildingId);
    };

    window.addEventListener('buildingChanged', handleBuildingChange);
    return () => window.removeEventListener('buildingChanged', handleBuildingChange);
  }, []);

  const fetchReport = async (buildingId?: string | null) => {
    try {
      setLoading(true);
      const data = await api.getManagerReport(buildingId || undefined);
      setReport(data);
    } catch (err: any) {
      console.error("Failed to load report:", err);
      toast.error("Failed to load analytics");
      // Set empty report to allow page to render
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center bg-[#F0F5F9] dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-black text-[#1E3A4C] dark:text-white">Loading Analytics...</p>
        </div>
      </div>
    </div>
  );

  const stats = [
    { title: "Total Floors", value: report?.totalFloors, icon: Squares2X2Icon, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Total Rooms", value: report?.totalRooms, icon: KeyIcon, color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "Total People", value: report?.totalPeople, icon: UserGroupIcon, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Active Tenants", value: report?.tenants, icon: UserIcon, color: "text-orange-600", bg: "bg-orange-50" },
    { title: "Working Staff", value: report?.staff, icon: BriefcaseIcon, color: "text-purple-600", bg: "bg-purple-50" },
    { title: "Occupied Rooms", value: report?.occupiedRooms, icon: ChartBarIcon, color: "text-rose-600", bg: "bg-rose-50" },
  ];

  const occupancyRate = report?.totalRooms > 0 
    ? Math.round((report.occupiedRooms / report.totalRooms) * 100) 
    : 0;

  // Show error state if report failed to load
  if (!report && !loading) {
    return (
      <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
        <Sidebar />
        <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-black text-[#1E3A4C] dark:text-white mb-2">Failed to load analytics</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Please try refreshing the page</p>
              <button
                onClick={() => fetchReport()}
                className="bg-blue-600 dark:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-all"
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />

      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6"
        >
          <div>
            <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white tracking-tight flex items-center gap-3">
              <BuildingOffice2Icon className="h-6 w-6 text-blue-500 dark:text-blue-400" />
              {report?.building || "Building"} Analytics
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Real-time building performance and occupancy report</p>
          </div>
          
          <div className="mt-4 md:mt-0 px-4 py-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-sm font-bold text-[#1E3A4C] dark:text-white">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </motion.div>

        {/* Occupancy Progress Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-5 mb-6 border border-gray-100 dark:border-gray-700 shadow-sm"
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-400 mb-2">Occupancy Rate</p>
              <h2 className="text-2xl font-black text-[#1E3A4C] dark:text-white mb-1">{occupancyRate}%</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Building occupancy status</p>
            </div>
            <div className="h-20 w-20 rounded-full border-4 border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-xl font-black text-[#1E3A4C] dark:text-white">
               {report?.occupiedRooms}/{report?.totalRooms}
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.2 }}
              whileHover={{ y: -2 }}
              className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 group hover:shadow-md hover:shadow-blue-500/5 dark:hover:shadow-blue-500/10 transition-all"
            >
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-105 transition-transform`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-400 mb-1">{stat.title}</p>
                <h3 className="text-2xl font-black text-[#1E3A4C] dark:text-white">{stat.value}</h3>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer Chart */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-400 mb-3">People Distribution</p>
          <div className="flex gap-2 w-full h-3 relative bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
             <div 
               style={{ width: `${report?.totalPeople > 0 ? (report?.tenants/report?.totalPeople)*100 : 0}%` }} 
               className="bg-orange-500 dark:bg-orange-400 h-full"
             ></div>
             <div 
               style={{ width: `${report?.totalPeople > 0 ? (report?.staff/report?.totalPeople)*100 : 0}%` }} 
               className="bg-purple-500 dark:bg-purple-400 h-full"
             ></div>
          </div>
          <div className="flex gap-6 text-xs font-bold text-gray-600 dark:text-gray-300">
            <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-orange-500 dark:bg-orange-400 rounded-full"></div> Tenants ({report?.tenants || 0})</span>
            <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-purple-500 dark:bg-purple-400 rounded-full"></div> Staff ({report?.staff || 0})</span>
          </div>
        </motion.div>
        </div>
      </main>
    </div>
  );
}