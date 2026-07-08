import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import * as api from "../../api/reports.api";
import * as paymentApi from "../../api/reports.api";
import { motion } from "framer-motion";
import { 
  HomeIcon, 
  UserGroupIcon, 
  ArrowUpRightIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  ChevronDownIcon
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export function ManagerDashboard() {
  const [report, setReport] = useState<any>(null);
  const [paymentStats, setPaymentStats] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Get Manager Info from localStorage (stored during login)
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const managerName = userData.name || "Manager";
  const managerImage = userData.buildingLogo || "";
  const managerEmail = userData.email || "";

  // Load selected building from localStorage on mount
  useEffect(() => {
    const savedBuildingId = localStorage.getItem("selectedBuildingId");
    if (savedBuildingId) {
      setSelectedBuildingId(savedBuildingId);
    }
  }, []);

  useEffect(() => {
    fetchBuildings();
  }, []);

  useEffect(() => {
    if (buildings.length > 0) {
      // If no building selected, use first building
      if (!selectedBuildingId) {
        const firstBuildingId = buildings[0]._id || buildings[0].id;
        setSelectedBuildingId(firstBuildingId);
        localStorage.setItem("selectedBuildingId", firstBuildingId);
      }
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedBuildingId, buildings]);

  const fetchBuildings = async () => {
    try {
      const buildingsData = await api.getManagerBuildings();
      setBuildings(buildingsData || []);
    } catch (err: any) {
      console.error("Failed to fetch buildings:", err);
      toast.error("Failed to load buildings");
    }
  };

  const fetchDashboardData = async () => {
    if (!selectedBuildingId) return;
    
    try {
      setLoading(true);
      const [reportData, statsData] = await Promise.all([
        api.getManagerReport(selectedBuildingId),
        paymentApi.getManagerPaymentStats(selectedBuildingId).catch(() => null)
      ]);
      setReport(reportData);
      setPaymentStats(statsData);
    } catch (err: any) {
      toast.error("Failed to sync dashboard data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildingChange = (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    localStorage.setItem("selectedBuildingId", buildingId);
    // Dispatch event to notify all components (sidebar, other pages) of building change
    window.dispatchEvent(new CustomEvent('buildingChanged', { detail: { buildingId } }));
    // Data will be refetched by useEffect
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-gray-900">
        <div className="w-12 h-12 border-4 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-black text-[#1E3A4C] dark:text-white tracking-widest uppercase text-sm">Initializing Command Center...</p>
      </div>
    );
  }

  // Show message if no buildings assigned
  if (buildings.length === 0) {
    return (
      <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
        <Sidebar />
        <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <BuildingOfficeIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl font-black text-[#1E3A4C] dark:text-white mb-2">No Buildings Assigned</h2>
              <p className="text-slate-500 dark:text-gray-400">You don't have any buildings assigned to manage yet.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Calculate percentage safely
  const occupancyRate = report?.totalRooms > 0 
    ? Math.round((report.occupiedRooms / report.totalRooms) * 100) 
    : 0;

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
        {/* --- HEADER SECTION --- */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-start gap-4"
          >
            {/* Building Logo */}
            <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-gray-700 shadow-lg flex-shrink-0">
              {report?.brandingLogo ? (
                <img src={report.brandingLogo} alt="Building Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 flex items-center justify-center">
                  <BuildingOfficeIcon className="w-6 h-6 text-white" />
                </div>
              )}
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                  <span className="h-1.5 w-1.5 bg-blue-600 dark:bg-blue-500 rounded-full animate-pulse"></span>
                  <span className="text-blue-600 dark:text-blue-400 font-black text-[9px] uppercase tracking-[0.2em]">Operational Live Feed</span>
              </div>
              <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white tracking-tight">
                {report?.brandingName || report?.building || "Building Dashboard"}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mt-1">
                Hello, <span className="text-[#1E3A4C] dark:text-white font-bold">{managerName}</span> <span className="inline-block animate-bounce-subtle">👋</span>
              </p>
              {/* Building Selector - Show only if manager has multiple buildings */}
              {buildings.length > 1 && (
                <div className="mt-3">
                  <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                    Select Building
                  </label>
                  <div className="relative">
                    <select
                      value={selectedBuildingId || ""}
                      onChange={(e) => handleBuildingChange(e.target.value)}
                      className="appearance-none bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 rounded-xl px-4 py-2 pr-8 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
                    >
                      {buildings.map((building) => {
                        const buildingId = building._id || building.id;
                        return (
                          <option key={buildingId} value={buildingId}>
                            {building.name} {building.location ? `- ${building.location}` : ""}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-gray-500 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="flex gap-3"
          >
            <Link to="/reports" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#1E3A4C] dark:text-white px-6 py-3 rounded-2xl font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2">
               Analytics
            </Link>
            <Link to="/manage-people" className="bg-[#1E3A4C] dark:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold shadow-xl hover:shadow-blue-900/20 dark:hover:shadow-blue-800/20 transition-all flex items-center gap-2">
               Assign Person <ArrowUpRightIcon className="h-4 w-4" />
            </Link>
          </motion.div>
        </header>

        {/* --- BENTO GRID --- */}
        <div className="grid grid-cols-12 gap-4">
          
          {/* Main Hero Card: Occupancy Stats */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="col-span-12 lg:col-span-8 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between relative overflow-hidden group"
          >
            <div className="relative z-10">
               <div className="flex items-center gap-2 text-gray-400 dark:text-gray-400 font-black uppercase text-[10px] tracking-widest">
                  <BuildingOfficeIcon className="h-4 w-4" /> Building Health
               </div>
               <div className="flex items-baseline gap-3 mt-4">
                  <span className="text-5xl font-black text-[#1E3A4C] dark:text-white tracking-tighter">
                    {report?.occupiedRooms}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-gray-300 dark:text-gray-400">/ {report?.totalRooms}</span>
                    <span className="text-xs font-black text-gray-400 dark:text-gray-400 uppercase">Occupied Units</span>
                  </div>
               </div>
               
               <div className="mt-6 flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-xl text-xs font-black">
                     <CheckBadgeIcon className="h-4 w-4" /> {occupancyRate}% Efficiency
                  </div>
                  <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-4 py-2 rounded-xl text-xs font-black">
                     <HomeIcon className="h-4 w-4" /> {report?.totalRooms - report?.occupiedRooms} Available Units
                  </div>
               </div>
            </div>
            {/* Elegant Background Decoration */}
            <BoltIcon className="absolute -right-12 -bottom-12 h-60 w-60 text-gray-50/80 dark:text-gray-800/80 -rotate-12 group-hover:text-blue-50 dark:group-hover:text-blue-900/20 transition-colors duration-700" />
          </motion.div>

          {/* Side Card: Staff Overview */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="col-span-12 lg:col-span-4 bg-[#1E3A4C] dark:bg-gray-800 rounded-2xl p-6 text-white shadow-2xl flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
               <div className="bg-blue-500 dark:bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-500/20 dark:shadow-blue-600/20">
                  <UserGroupIcon className="h-6 w-6 text-white" />
               </div>
               <span className="bg-white/10 dark:bg-gray-700/50 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 dark:border-gray-600">Active Staff</span>
            </div>
            <div>
               <h3 className="text-4xl font-black mb-2">{report?.staff}</h3>
               <p className="text-blue-200 dark:text-blue-300 font-medium text-sm leading-relaxed">
                 Professional staff members currently assigned to manage operations.
               </p>
            </div>
          </motion.div>

          {/* Metric 1: Tenants */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="col-span-12 md:col-span-6 lg:col-span-3 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-blue-200 dark:hover:border-blue-600 transition-colors"
          >
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-widest">Total Tenants</p>
            <h4 className="text-2xl font-black text-[#1E3A4C] dark:text-white mt-2">{report?.tenants}</h4>
            <div className="flex items-center gap-2 mt-4 text-xs font-bold text-blue-600 dark:text-blue-400">
                <BriefcaseIcon className="h-4 w-4" /> High Retention
            </div>
          </motion.div>

          {/* Metric 2: Floors */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="col-span-12 md:col-span-6 lg:col-span-3 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-400 uppercase tracking-widest">Floor Capacity</p>
            <h4 className="text-2xl font-black text-[#1E3A4C] dark:text-white mt-2">{report?.totalFloors}</h4>
            <p className="text-xs text-gray-400 dark:text-gray-400 mt-2 font-medium italic">Active building levels</p>
          </motion.div>

          {/* Payment Overview Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="col-span-12 lg:col-span-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-6 border border-green-100 dark:border-green-800/50 shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest">Payment Overview</p>
                <h3 className="text-2xl font-black text-green-700 dark:text-green-300 mt-2">
                  ${paymentStats ? (paymentStats.totalRoomRevenue || 0).toLocaleString() : "0"}
                </h3>
              </div>
              <Link to="/manager-payments" className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-700 dark:hover:bg-green-600 transition-all">
                View All
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-green-600 dark:text-green-400 font-bold">Paid</p>
                <p className="text-lg font-black text-green-700 dark:text-green-300">{paymentStats?.paidCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 font-bold">Pending</p>
                <p className="text-lg font-black text-yellow-700 dark:text-yellow-300">{paymentStats?.pendingCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-red-600 dark:text-red-400 font-bold">Overdue</p>
                <p className="text-lg font-black text-red-700 dark:text-red-300">{paymentStats?.overdueCount || 0}</p>
              </div>
            </div>
          </motion.div>

          {/* Real-time Status / Activity Feed */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="col-span-12 lg:col-span-6 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-black text-[#1E3A4C] dark:text-white flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                    Management Alerts
                </h3>
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">Live Feed</span>
            </div>
            
            <div className="space-y-3">
               <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-transparent dark:border-gray-600 hover:border-orange-100 dark:hover:border-orange-800 transition-all">
                  <div className="h-1.5 w-1.5 bg-orange-500 dark:bg-orange-400 rounded-full"></div>
                  <div>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">New occupancy registered</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-400 font-medium">Building system updated successfully</p>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-400 ml-auto font-black uppercase">Recent</span>
               </div>

               <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-transparent dark:border-gray-600 hover:border-blue-100 dark:hover:border-blue-800 transition-all">
                  <div className="h-1.5 w-1.5 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
                  <div>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Monthly reports generated</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-400 font-medium">Check analytics for deep dive</p>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-400 ml-auto font-black uppercase">Today</span>
               </div>
            </div>
          </motion.div>

        </div>
        </div>
      </main>
    </div>
  );
}