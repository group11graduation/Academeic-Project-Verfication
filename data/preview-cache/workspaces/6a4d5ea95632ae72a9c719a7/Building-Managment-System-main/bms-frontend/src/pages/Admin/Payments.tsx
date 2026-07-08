import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ReusableTable } from "../../components/ReusableTable";
import { DetailModal } from "../../components/DetailModal";
import * as api from "../../api/admin.api";
import { toast } from "sonner";
import { 
  CurrencyDollarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  BellIcon
} from "@heroicons/react/24/outline";

const SYSTEM_BLUE = "#1E3A4C";

export function Payments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentStats, setPaymentStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchAllData();
    // Real-time updates every 30 seconds
    const interval = setInterval(fetchAllData, 30000);
    
    // Listen for building creation/update events to refresh payments
    const handleBuildingChange = (event: Event) => {
      console.log('Building change event received:', event.type);
      // Add a small delay to ensure backend has processed the building creation
      setTimeout(() => {
        fetchAllData(true); // Pass true to show notification
      }, 1000); // Increased delay to 1 second to ensure backend processing
    };
    
    window.addEventListener('buildingCreated', handleBuildingChange);
    window.addEventListener('buildingUpdated', handleBuildingChange);
    window.addEventListener('buildingDeleted', handleBuildingChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('buildingCreated', handleBuildingChange);
      window.removeEventListener('buildingUpdated', handleBuildingChange);
      window.removeEventListener('buildingDeleted', handleBuildingChange);
    };
  }, []);

  const fetchAllData = async (showNotification = false) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login first");
        return;
      }

      const [paymentsData, statsData] = await Promise.all([
        api.getAllPayments().catch((e) => {
          if (e.message?.includes("Authentication")) {
            toast.error("Please login again");
            return [];
          }
          return [];
        }),
        api.getPaymentStats().catch(() => null)
      ]);

      setPayments(paymentsData || []);
      setPaymentStats(statsData);
      
      if (showNotification) {
        toast.success("Payment data refreshed");
      }
    } catch (err: any) {
      console.error("Failed to fetch payments", err);
      if (err.message?.includes("Authentication")) {
        toast.error("Please login again");
      } else {
        toast.error("Failed to load payments");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      await api.markPaymentAsPaid(paymentId, "Marked as paid via admin panel");
      toast.success("Payment marked as paid");
      fetchAllData(false); // Don't show notification for this refresh
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update payment");
    }
  };

  const handleRowClick = (payment: any) => {
    setSelectedPayment(payment);
    setIsDetailModalOpen(true);
  };

  // Group payments by building
  const paymentsByBuilding = payments.reduce((acc, payment) => {
    const buildingId = payment.building?._id || payment.building || 'unknown';
    if (!acc[buildingId]) {
      acc[buildingId] = {
        building: payment.building,
        payments: []
      };
    }
    acc[buildingId].payments.push(payment);
    return acc;
  }, {} as Record<string, { building: any; payments: any[] }>);

  // Filter and group payments
  const filteredPaymentsByBuilding = Object.values(paymentsByBuilding)
    .map(group => {
      const filteredPayments = group.payments.filter(p => {
        const matchesSearch = 
          p.building?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.manager?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.manager?.email?.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (activeTab === "all") return matchesSearch;
        if (activeTab === "overdue") return p.status === "OVERDUE" && matchesSearch;
        if (activeTab === "pending") return p.status === "PENDING" && matchesSearch;
        if (activeTab === "paid") return p.status === "PAID" && matchesSearch;
        return matchesSearch;
      });
      
      return {
        ...group,
        payments: filteredPayments
      };
    })
    .filter(group => group.payments.length > 0);

  // Flatten for table display (but keep building grouping visible)
  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      p.building?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.manager?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.manager?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "overdue") return p.status === "OVERDUE" && matchesSearch;
    if (activeTab === "pending") return p.status === "PENDING" && matchesSearch;
    if (activeTab === "paid") return p.status === "PAID" && matchesSearch;
    return matchesSearch;
  });

  const overduePayments = payments.filter(p => p.status === "OVERDUE");

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white tracking-tight">Payment Tracking</h1>
                <p className="text-[10px] text-slate-400 dark:text-gray-400 font-bold uppercase tracking-[0.2em] mt-0.5">
                  Monitor & Manage All Payments
                </p>
              </div>
              <div className="flex items-center gap-3">
                {overduePayments.length > 0 && (
                  <div className="relative">
                    <BellIcon className="w-6 h-6 text-red-500 dark:text-red-400" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 dark:bg-red-400 rounded-full text-white text-[8px] flex items-center justify-center font-black">
                      {overduePayments.length}
                    </span>
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Search by building or manager..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 rounded-xl text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 w-64"
                />
                <button
                  onClick={() => fetchAllData(true)}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 rounded-xl text-[13px] font-bold hover:bg-slate-50 dark:hover:bg-gray-700 transition-all shadow-sm"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Payment Stats Cards */}
            {paymentStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-slate-200 dark:border-gray-700 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase mb-2">Total Payments</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-white">{paymentStats.total || 0}</p>
                </div>
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
              </div>
            )}

            {/* Overdue Payments Alert */}
            {overduePayments.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-400 rounded-xl p-6 animate-in slide-in-from-top-4">
                <div className="flex items-start gap-4">
                  <ExclamationTriangleIcon className="w-6 h-6 text-red-500 dark:text-red-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">Overdue Payments Alert</h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                      {overduePayments.length} payment{overduePayments.length !== 1 ? 's' : ''} {overduePayments.length === 1 ? 'is' : 'are'} overdue and require immediate attention.
                    </p>
                    <div className="space-y-2">
                      {overduePayments.slice(0, 3).map((payment) => (
                        <div key={payment._id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-red-200 dark:border-red-800 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-gray-200">
                              {payment.building?.name} - {payment.manager?.name}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-gray-400">
                              Amount: ${payment.amount} | Due: {new Date(payment.nextDueDate).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleMarkAsPaid(payment._id)}
                            className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg text-xs font-bold hover:bg-green-700 dark:hover:bg-green-600 transition-all"
                          >
                            Mark Paid
                          </button>
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

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === "all"
                    ? "bg-purple-600 dark:bg-purple-700 text-white shadow-lg"
                    : "bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700"
                }`}
              >
                All Payments ({payments.length})
              </button>
              <button
                onClick={() => setActiveTab("overdue")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === "overdue"
                    ? "bg-red-600 dark:bg-red-700 text-white shadow-lg"
                    : "bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700"
                }`}
              >
                Overdue ({payments.filter(p => p.status === "OVERDUE").length})
              </button>
              <button
                onClick={() => setActiveTab("pending")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === "pending"
                    ? "bg-yellow-600 dark:bg-yellow-700 text-white shadow-lg"
                    : "bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700"
                }`}
              >
                Pending ({payments.filter(p => p.status === "PENDING").length})
              </button>
              <button
                onClick={() => setActiveTab("paid")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === "paid"
                    ? "bg-green-600 dark:bg-green-700 text-white shadow-lg"
                    : "bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700"
                }`}
              >
                Paid ({payments.filter(p => p.status === "PAID").length})
              </button>
            </div>

            {/* Payments Grouped by Building */}
            <div className="space-y-4">
              {filteredPaymentsByBuilding.length > 0 ? (
                filteredPaymentsByBuilding.map((group) => {
                  const buildingTotal = group.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                  const buildingPaid = group.payments.filter(p => p.status === "PAID").length;
                  const buildingPending = group.payments.filter(p => p.status === "PENDING").length;
                  const buildingOverdue = group.payments.filter(p => p.status === "OVERDUE").length;
                  
                  return (
                    <div key={group.building?._id || 'unknown'} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
                      {/* Building Header */}
                      <div className="p-4 bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                              <BuildingOfficeIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 dark:text-white text-base">{group.building?.name || "Unknown Building"}</p>
                              <p className="text-xs text-slate-500 dark:text-gray-400">{group.building?.location || "—"}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase">Total Amount</p>
                            <p className="text-lg font-black text-slate-800 dark:text-white">${buildingTotal.toLocaleString()}</p>
                            <div className="flex gap-3 mt-1 text-[10px] font-bold">
                              {buildingPaid > 0 && <span className="text-green-600 dark:text-green-400">Paid: {buildingPaid}</span>}
                              {buildingPending > 0 && <span className="text-yellow-600 dark:text-yellow-400">Pending: {buildingPending}</span>}
                              {buildingOverdue > 0 && <span className="text-red-600 dark:text-red-400">Overdue: {buildingOverdue}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Payments for this Building */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 dark:bg-gray-700/30">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-black text-slate-500 dark:text-gray-400 uppercase tracking-wider">Manager</th>
                              <th className="px-4 py-3 text-left text-xs font-black text-slate-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                              <th className="px-4 py-3 text-left text-xs font-black text-slate-500 dark:text-gray-400 uppercase tracking-wider">Due Date</th>
                              <th className="px-4 py-3 text-left text-xs font-black text-slate-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-black text-slate-500 dark:text-gray-400 uppercase tracking-wider">Last Paid</th>
                              <th className="px-4 py-3 text-right text-xs font-black text-slate-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                            {group.payments.map((p) => {
                              const dueDate = p.nextDueDate ? new Date(p.nextDueDate) : null;
                              const isOverdue = dueDate && dueDate < new Date() && p.status !== "PAID";
                              const statusColors = {
                                PAID: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
                                PENDING: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
                                OVERDUE: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                              };
                              
                              return (
                                <tr 
                                  key={p._id} 
                                  onClick={() => handleRowClick(p)}
                                  className="hover:bg-slate-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 font-bold text-xs">
                                        {p.manager?.name?.charAt(0) || "?"}
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">{p.manager?.name || "—"}</p>
                                        <p className="text-[10px] text-slate-400 dark:text-gray-500">{p.manager?.email || "—"}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div>
                                      <p className="text-sm font-bold text-slate-800 dark:text-white">${p.amount || 0}</p>
                                      <p className="text-[10px] text-slate-500 dark:text-gray-400">{p.frequency || "—"}</p>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <ClockIcon className={`w-4 h-4 ${isOverdue ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-gray-500'}`} />
                                      <div>
                                        <p className={`text-sm font-medium ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-gray-300'}`}>
                                          {dueDate ? dueDate.toLocaleDateString() : "—"}
                                        </p>
                                        {isOverdue && (
                                          <p className="text-[10px] text-red-600 dark:text-red-400 font-bold">OVERDUE</p>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${statusColors[p.status as keyof typeof statusColors] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>
                                      {p.status || "—"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-sm text-slate-600 dark:text-gray-300">
                                      {p.lastPaidDate ? new Date(p.lastPaidDate).toLocaleDateString() : "Never"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                      {p.status !== "PAID" && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkAsPaid(p._id);
                                          }}
                                          className="px-3 py-1.5 bg-green-600 dark:bg-green-700 text-white rounded-lg text-xs font-bold hover:bg-green-700 dark:hover:bg-green-600 transition-all"
                                        >
                                          Mark Paid
                                        </button>
                                      )}
                                      {p.status === "PAID" && (
                                        <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-slate-200 dark:border-gray-700">
                  <CurrencyDollarIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">No Payments Found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {searchQuery ? "No payments match your search criteria." : "No payment records available. Create buildings with payment details to see them here."}
                  </p>
                </div>
              )}
            </div>

            <DetailModal
              isOpen={isDetailModalOpen}
              onClose={() => setIsDetailModalOpen(false)}
              title="Payment Details"
              data={selectedPayment}
              fields={[
                { key: "building.name", label: "Building" },
                { key: "building.location", label: "Building Location" },
                { key: "manager.name", label: "Manager" },
                { key: "manager.email", label: "Manager Email" },
                { key: "amount", label: "Amount", render: (v) => `$${v || 0}` },
                { key: "frequency", label: "Frequency" },
                { key: "nextDueDate", label: "Next Due Date", render: (v) => v ? new Date(v).toLocaleDateString() : "—" },
                { key: "lastPaidDate", label: "Last Paid Date", render: (v) => v ? new Date(v).toLocaleDateString() : "Never" },
                { key: "status", label: "Status" },
                { key: "paymentHistory", label: "Payment History", render: (v) => {
                  if (!Array.isArray(v) || v.length === 0) return "No payment history";
                  return v.map((p: any, i: number) => (
                    <div key={i} className="mb-2 p-2 bg-slate-50 rounded">
                      <p className="text-xs font-semibold">${p.amount} on {new Date(p.paidDate).toLocaleDateString()}</p>
                      {p.notes && <p className="text-xs text-slate-500">{p.notes}</p>}
                    </div>
                  ));
                }},
                { key: "createdAt", label: "Created At", render: (v) => v ? new Date(v).toLocaleDateString() : "—" }
              ]}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
