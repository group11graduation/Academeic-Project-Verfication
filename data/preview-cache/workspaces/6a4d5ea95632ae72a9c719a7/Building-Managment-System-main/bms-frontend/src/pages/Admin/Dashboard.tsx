import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggle } from "../../components/ThemeToggle";
import * as api from "../../api/admin.api";
import * as dashboardApi from "../../api/dashboardApi";
import { toast } from "sonner";
import { 
  BuildingOfficeIcon, 
  UserGroupIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  BellIcon,
  ArrowTrendingUpIcon,
  ClockIcon
} from "@heroicons/react/24/outline";

const SYSTEM_BLUE = "#1E3A4C";

export function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [paymentStats, setPaymentStats] = useState<any>(null);
  const [overduePayments, setOverduePayments] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
    // Real-time updates every 30 seconds
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      
      // Check if user is authenticated
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      
      if (!token || user.role !== "SUPER_ADMIN") {
        toast.error("Access denied. Please login as SUPER_ADMIN.");
        return;
      }

      const [dashboardData, paymentData, overdueData, buildingsData, managersData] = await Promise.all([
        dashboardApi.getDashboardStats().catch(() => null),
        api.getPaymentStats().catch((e) => {
          if (e.message?.includes("Authentication")) {
            toast.error("Please login again");
            return null;
          }
          return null;
        }),
        api.getOverduePayments().catch((e) => {
          if (e.message?.includes("Authentication")) {
            return [];
          }
          return [];
        }),
        api.getAllBuildings().catch((e) => {
          if (e.message?.includes("Authentication")) {
            toast.error("Please login again");
            return [];
          }
          return [];
        }),
        api.getAllManagers().catch((e) => {
          if (e.message?.includes("Authentication")) {
            toast.error("Please login again");
            return [];
          }
          return [];
        })
      ]);

      setStats(dashboardData);
      setPaymentStats(paymentData);
      setOverduePayments(overdueData || []);
      setBuildings(buildingsData || []);
      setManagers(managersData || []);
    } catch (err: any) {
      console.error("Failed to fetch dashboard data", err);
      if (err.message?.includes("Authentication")) {
        toast.error("Please login again");
      } else {
        toast.error("Failed to load dashboard data");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !stats) {
    return (
      <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center bg-[#F8FAFC] dark:bg-gray-900">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-black text-[#1E3A4C] tracking-widest uppercase text-sm">Loading Dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white tracking-tight">Admin Dashboard</h1>
                <p className="text-[10px] text-slate-400 dark:text-gray-400 font-bold uppercase tracking-[0.2em] mt-0.5">
                  Real-Time System Overview
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                {overduePayments.length > 0 && (
                  <div className="relative">
                    <BellIcon className="w-6 h-6 text-red-500" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center font-black">
                      {overduePayments.length}
                    </span>
                  </div>
                )}
                <button
                  onClick={fetchAllData}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 rounded-xl text-[13px] font-bold hover:bg-slate-50 dark:hover:bg-gray-700 transition-all shadow-sm"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Payment Notifications */}
            {overduePayments.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-400 rounded-xl p-6 mb-6 animate-in slide-in-from-top-4">
                <div className="flex items-start gap-4">
                  <ExclamationTriangleIcon className="w-6 h-6 text-red-500 dark:text-red-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">Payment Alerts</h3>
                    <div className="space-y-2">
                      {overduePayments.slice(0, 3).map((payment) => (
                        <div key={payment._id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-red-200 dark:border-red-800">
                          <p className="text-sm font-semibold text-slate-800 dark:text-gray-200">
                            {payment.building?.name} - {payment.manager?.name}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-gray-400">
                            Amount: ${payment.amount} | Due: {new Date(payment.nextDueDate).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                      {overduePayments.length > 3 && (
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                          +{overduePayments.length - 3} more overdue payments
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                icon={BuildingOfficeIcon}
                label="Total Buildings"
                value={buildings.length}
                color="blue"
                trend={null}
              />
              <StatCard
                icon={UserGroupIcon}
                label="Total Managers"
                value={managers.length}
                color="green"
                trend={null}
              />
              <StatCard
                icon={CurrencyDollarIcon}
                label="Total Payments"
                value={paymentStats?.total || 0}
                color="purple"
                trend={null}
              />
              <StatCard
                icon={ExclamationTriangleIcon}
                label="Overdue Payments"
                value={overduePayments.length}
                color="red"
                trend={null}
              />
            </div>

            {/* Payment Stats */}
            {paymentStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-slate-200 dark:border-gray-700 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase mb-2">Paid</p>
                  <p className="text-2xl font-black text-green-600 dark:text-green-400">{paymentStats.paid || 0}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-slate-200 dark:border-gray-700 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase mb-2">Pending</p>
                  <p className="text-2xl font-black text-yellow-600 dark:text-yellow-400">{paymentStats.pending || 0}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-slate-200 dark:border-gray-700 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase mb-2">Overdue</p>
                  <p className="text-2xl font-black text-red-600 dark:text-red-400">{paymentStats.overdue || 0}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-slate-200 dark:border-gray-700 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase mb-2">Upcoming (7d)</p>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{paymentStats.upcoming || 0}</p>
                </div>
              </div>
            )}

            {/* Buildings & Managers Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                  <BuildingOfficeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Recent Buildings
                </h3>
                <div className="space-y-3">
                  {buildings.slice(0, 5).map((building) => (
                    <div key={building._id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-700/50 rounded-lg">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-gray-200 text-sm">{building.name}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">{building.location}</p>
                      </div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                        {building.manager?.name || "Unassigned"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                  <UserGroupIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Active Managers
                </h3>
                <div className="space-y-3">
                  {managers.slice(0, 5).map((manager) => (
                    <div key={manager._id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-700/50 rounded-lg">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-gray-200 text-sm">{manager.name}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">{manager.email}</p>
                      </div>
                      <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* System Stats */}
            {stats && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">System Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase mb-1">Total Rooms</p>
                    <p className="text-xl font-black text-slate-800 dark:text-white">{stats.totalRooms || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase mb-1">Occupied</p>
                    <p className="text-xl font-black text-green-600 dark:text-green-400">{stats.occupiedRooms || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase mb-1">Occupancy Rate</p>
                    <p className="text-xl font-black text-blue-600 dark:text-blue-400">{stats.occupancyRate || 0}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase mb-1">Monthly Revenue</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">${(stats.monthlyRevenue || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, trend }: any) {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    green: "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    purple: "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    red: "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-slate-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClasses[color as keyof typeof colorClasses]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <ArrowTrendingUpIcon className="w-4 h-4" />
            <span className="text-xs font-bold">{trend}%</span>
          </div>
        )}
      </div>
      <p className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-800 dark:text-white">{value}</p>
    </div>
  );
}
