import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ReusableTable } from "../../components/ReusableTable";
import { DetailModal } from "../../components/DetailModal";
import * as api from "../../api/admin.api";
import { toast } from "sonner";
import { 
  BuildingOfficeIcon,
  UserGroupIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";

const SYSTEM_BLUE = "#1E3A4C";

export function BuildingOverview() {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"building" | "manager" | "payment">("building");

  useEffect(() => {
    fetchAllData();
    // Real-time updates every 30 seconds
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // Check authentication
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login first");
        return;
      }

      const [buildingsData, managersData, paymentsData] = await Promise.all([
        api.getAllBuildings().catch((e) => {
          if (e.message?.includes("Authentication")) {
            toast.error("Please login again");
            return [];
          }
          return [];
        }),
        api.getAllManagers().catch((e) => {
          if (e.message?.includes("Authentication")) {
            return [];
          }
          return [];
        }),
        api.getAllPayments().catch((e) => {
          if (e.message?.includes("Authentication")) {
            return [];
          }
          return [];
        })
      ]);
      setBuildings(buildingsData || []);
      setManagers(managersData || []);
      setPayments(paymentsData || []);
      
      // Debug: Log building and manager data to check structure
      console.log("Buildings data:", buildingsData);
      console.log("Managers data:", managersData);
      if (buildingsData && buildingsData.length > 0) {
        console.log("First building:", buildingsData[0]);
        console.log("First building manager:", buildingsData[0].manager);
        console.log("First building manager keys:", buildingsData[0].manager ? Object.keys(buildingsData[0].manager) : 'no manager');
      }
      if (managersData && managersData.length > 0) {
        console.log("First manager:", managersData[0]);
        console.log("First manager keys:", Object.keys(managersData[0]));
      }
    } catch (err: any) {
      console.error("Failed to fetch data", err);
      if (err.message?.includes("Authentication")) {
        toast.error("Please login again");
      } else {
        toast.error("Failed to fetch data");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (item: any, type: "building" | "manager" | "payment") => {
    setSelectedItem(item);
    setModalType(type);
    setIsDetailModalOpen(true);
  };

  const getBuildingPayments = (buildingId: string) => {
    return payments.filter(p => {
      const paymentBuildingId = p.building?.id || p.building?._id;
      return paymentBuildingId === buildingId;
    });
  };

  const getManagerPayments = (managerId: string) => {
    return payments.filter(p => {
      const paymentManagerId = p.manager?.id || p.manager?._id;
      return paymentManagerId === managerId;
    });
  };

  // Helper function to normalize ID for comparison (handles ObjectId, string, etc.)
  // Note: DTOs convert _id to id, so we need to check both
  const normalizeId = (id: any): string => {
    if (!id) return '';
    // If it's an object with id or _id, use that (DTOs use 'id', raw MongoDB uses '_id')
    if (typeof id === 'object' && id !== null) {
      // Check for 'id' first (DTO format)
      if (id.id !== undefined && id.id !== null) return String(id.id);
      // Then check for '_id' (raw MongoDB format)
      if (id._id !== undefined && id._id !== null) return String(id._id);
      // Try to convert the object itself (might be ObjectId)
      try {
        const str = String(id);
        // If it's a valid ObjectId-like string, return it
        if (str && str !== '[object Object]') return str;
      } catch (e) {
        // Ignore conversion errors
      }
    }
    // Otherwise convert to string
    return String(id);
  };

  // Helper function to check if a building is assigned to a manager
  const isBuildingAssignedToManager = (building: any, managerId: string): boolean => {
    if (!building || !managerId) {
      return false;
    }
    
    const managerIdNormalized = normalizeId(managerId);
    if (!managerIdNormalized) return false;
    
    // Check if manager is an object with _id (populated manager)
    if (building.manager) {
      const buildingManagerId = normalizeId(building.manager);
      if (buildingManagerId && buildingManagerId === managerIdNormalized) {
        return true;
      }
    }
    
    // Check if there's a separate managerId field (fallback)
    if (building.managerId) {
      const buildingManagerId = normalizeId(building.managerId);
      if (buildingManagerId && buildingManagerId === managerIdNormalized) {
        return true;
      }
    }
    
    return false;
  };

  const filteredBuildings = buildings.filter(b =>
    b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.manager?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredManagers = managers.filter(m =>
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-6">
            
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white tracking-tight">Building Overview</h1>
                <p className="text-[10px] text-slate-400 dark:text-gray-400 font-bold uppercase tracking-[0.2em] mt-0.5">
                  Managers, Buildings & Payments Directory
                </p>
              </div>
              <input
                type="text"
                placeholder="Search managers or buildings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-64"
              />
            </div>

            {/* Managers Table with Admin Person */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-gray-700">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <UserGroupIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Managers ({managers.length})
                </h2>
              </div>
              <ReusableTable
                themeColor="green"
                data={filteredManagers}
                isLoading={isLoading}
                onRowClick={(item) => handleRowClick(item, "manager")}
                columns={[
                  {
                    header: "MANAGER",
                    render: (m) => (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center font-black text-green-600 dark:text-green-400">
                          {m.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-gray-200 text-sm">{m.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-gray-400">{m.email}</p>
                          {m.phone && (
                            <p className="text-[10px] text-slate-500 dark:text-gray-400">{m.phone}</p>
                          )}
                        </div>
                      </div>
                    )
                  },
                  {
                    header: "ADMIN PERSON",
                    render: (m) => {
                      if (m.adminPerson && (m.adminPerson.name || m.adminPerson.email || m.adminPerson.phone)) {
                        return (
                          <div>
                            {m.adminPerson.name && (
                              <p className="text-sm font-semibold text-slate-800 dark:text-white">{m.adminPerson.name}</p>
                            )}
                            {m.adminPerson.email && (
                              <p className="text-xs text-slate-500 dark:text-gray-400">{m.adminPerson.email}</p>
                            )}
                            {m.adminPerson.phone && (
                              <p className="text-xs text-slate-500 dark:text-gray-400">{m.adminPerson.phone}</p>
                            )}
                          </div>
                        );
                      }
                      return <span className="text-sm text-slate-400 dark:text-gray-500">Not assigned</span>;
                    }
                  },
                  {
                    header: "ASSIGNED BUILDINGS",
                    render: (m) => {
                      const managerId = m.id || m._id;
                      const assignedBuildings = buildings.filter(b => 
                        isBuildingAssignedToManager(b, managerId)
                      );
                      return (
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-white">
                            {assignedBuildings.length} Building{assignedBuildings.length !== 1 ? 's' : ''}
                          </p>
                          {assignedBuildings.length > 0 && (
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                              {assignedBuildings.map(b => b.name).join(", ")}
                            </p>
                          )}
                        </div>
                      );
                    }
                  }
                ]}
              />
            </div>

            {/* Managers with Assigned Buildings */}
            <div className="space-y-4">
              {filteredManagers.length > 0 ? (
                filteredManagers.map((manager) => {
                  // Get manager ID (DTOs use 'id', raw data uses '_id')
                  const managerId = manager.id || manager._id;
                  
                  // Filter buildings assigned to this specific manager
                  const assignedBuildings = buildings.filter(b => 
                    isBuildingAssignedToManager(b, managerId)
                  );
                  const managerPayments = getManagerPayments(managerId);
                  const totalAmount = managerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
                  const overdue = managerPayments.filter(p => p.status === "OVERDUE").length;
                  const paid = managerPayments.filter(p => p.status === "PAID").length;
                  const pending = managerPayments.filter(p => p.status === "PENDING").length;
                  
                  // Always show managers (even if they have no assigned buildings)
                  // This ensures all managers are visible with their building assignments
                  
                  return (
                    <div key={managerId || manager._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
                      {/* Manager Header */}
                      <div className="p-6 bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center font-black text-green-600 dark:text-green-400 text-xl">
                              {manager.name?.charAt(0)}
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-slate-800 dark:text-white">{manager.name}</h3>
                              <p className="text-xs text-slate-500 dark:text-gray-400">{manager.email}</p>
                              {manager.phone && (
                                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{manager.phone}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase">Total Payments</p>
                            <p className="text-xl font-black text-slate-800 dark:text-white">${totalAmount.toLocaleString()}</p>
                            <div className="flex gap-3 mt-1 text-[10px] font-bold">
                              {paid > 0 && <span className="text-green-600 dark:text-green-400">Paid: {paid}</span>}
                              {pending > 0 && <span className="text-yellow-600 dark:text-yellow-400">Pending: {pending}</span>}
                              {overdue > 0 && (
                                <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                  <ExclamationTriangleIcon className="w-3 h-3" />
                                  Overdue: {overdue}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Admin Person Contact Section */}
                        {manager.adminPerson && (manager.adminPerson.name || manager.adminPerson.email || manager.adminPerson.phone) && (
                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-gray-600">
                            <div className="flex items-center gap-2 mb-2">
                              <UserGroupIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <p className="text-xs font-bold text-slate-600 dark:text-gray-400 uppercase">Admin Person Contact</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div>
                                {manager.adminPerson.name && (
                                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                    {manager.adminPerson.name}
                                  </p>
                                )}
                                {manager.adminPerson.email && (
                                  <p className="text-xs text-slate-500 dark:text-gray-400">{manager.adminPerson.email}</p>
                                )}
                                {manager.adminPerson.phone && (
                                  <p className="text-xs text-slate-500 dark:text-gray-400">{manager.adminPerson.phone}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Assigned Buildings */}
                      {assignedBuildings.length > 0 ? (
                        <div className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <BuildingOfficeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <h4 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase">
                              Assigned Buildings ({assignedBuildings.length})
                            </h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {assignedBuildings.map((building) => {
                              const buildingId = building.id || building._id;
                              const buildingPayments = getBuildingPayments(buildingId);
                              const buildingTotal = buildingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
                              const buildingOverdue = buildingPayments.filter(p => p.status === "OVERDUE").length;
                              const buildingPaid = buildingPayments.filter(p => p.status === "PAID").length;
                              const buildingPending = buildingPayments.filter(p => p.status === "PENDING").length;
                              
                              return (
                                <div
                                  key={buildingId || building._id}
                                  onClick={() => handleRowClick(building, "building")}
                                  className="p-4 bg-slate-50 dark:bg-gray-700/30 rounded-xl border border-slate-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-all hover:shadow-md"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <BuildingOfficeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                      <div>
                                        <p className="font-bold text-slate-800 dark:text-white text-sm">{building.name}</p>
                                        <p className="text-[10px] text-slate-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                          <MapPinIcon className="w-3 h-3" />
                                          {building.location}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {buildingPayments.length > 0 ? (
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-600 dark:text-gray-400">Payment Amount</span>
                                        <span className="text-sm font-black text-slate-800 dark:text-white">${buildingTotal.toLocaleString()}</span>
                                      </div>
                                      <div className="flex gap-2 text-[10px] font-bold">
                                        {buildingPaid > 0 && <span className="text-green-600 dark:text-green-400">Paid: {buildingPaid}</span>}
                                        {buildingPending > 0 && <span className="text-yellow-600 dark:text-yellow-400">Pending: {buildingPending}</span>}
                                        {buildingOverdue > 0 && (
                                          <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                            <ExclamationTriangleIcon className="w-3 h-3" />
                                            Overdue: {buildingOverdue}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 dark:text-gray-500">No payments configured</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center">
                          <p className="text-sm text-slate-400 dark:text-gray-500">No buildings assigned to this manager</p>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-slate-200 dark:border-gray-700">
                  <UserGroupIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">No Managers Found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {searchQuery ? "No managers match your search criteria." : "No managers available."}
                  </p>
                </div>
              )}
            </div>

            {/* Payments Overview */}
            {payments.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-gray-700">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <CurrencyDollarIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Payments ({payments.length})
                  </h2>
                </div>
                <ReusableTable
                  themeColor="purple"
                  data={payments}
                  isLoading={isLoading}
                  onRowClick={(item) => handleRowClick(item, "payment")}
                  columns={[
                    {
                      header: "BUILDING",
                      render: (p) => (
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{p.building?.name || "—"}</span>
                      )
                    },
                    {
                      header: "MANAGER",
                      render: (p) => (
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{p.manager?.name || "—"}</span>
                      )
                    },
                    {
                      header: "AMOUNT",
                      render: (p) => (
                        <span className="text-sm font-bold text-slate-800 dark:text-white">${p.amount}</span>
                      )
                    },
                    {
                      header: "FREQUENCY",
                      render: (p) => (
                        <span className="text-sm text-slate-600 dark:text-gray-300">{p.frequency}</span>
                      )
                    },
                    {
                      header: "DUE DATE",
                      render: (p) => (
                        <div className="flex items-center gap-2">
                          <ClockIcon className="w-4 h-4 text-slate-400 dark:text-gray-500" />
                          <span className="text-sm text-slate-600 dark:text-gray-300">
                            {new Date(p.nextDueDate).toLocaleDateString()}
                          </span>
                        </div>
                      )
                    },
                    {
                      header: "STATUS",
                      render: (p) => {
                        const statusColors = {
                          PAID: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
                          PENDING: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
                          OVERDUE: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                        };
                        return (
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusColors[p.status as keyof typeof statusColors] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                            {p.status}
                          </span>
                        );
                      }
                    }
                  ]}
                />
              </div>
            )}

            <DetailModal
              isOpen={isDetailModalOpen}
              onClose={() => setIsDetailModalOpen(false)}
              title={
                modalType === "building" ? "Building Details" :
                modalType === "manager" ? "Manager Details" :
                "Payment Details"
              }
              data={selectedItem}
              fields={
                modalType === "building" ? [
                  { key: "name", label: "Building Name" },
                  { key: "location", label: "Location" },
                  { key: "manager.name", label: "Manager" },
                  { key: "manager.email", label: "Manager Email" },
                  { key: "approvalPolicy", label: "Approval Policy" },
                  { key: "floorLimit", label: "Floor Limit" },
                  { key: "allowedRoomTypes", label: "Allowed Room Types", render: (v) => Array.isArray(v) ? v.join(", ") : "—" }
                ] : modalType === "manager" ? [
                  { key: "name", label: "Full Name" },
                  { key: "email", label: "Email" },
                  { key: "phone", label: "Phone" },
                  { key: "adminPerson.name", label: "Admin Person" },
                  { key: "paymentDetails.amount", label: "Payment Amount", render: (v) => v ? `$${v}` : "—" },
                  { key: "paymentDetails.frequency", label: "Payment Frequency" },
                  { key: "sections", label: "Sections", render: (v) => Array.isArray(v) ? v.join(", ") : "—" }
                ] : [
                  { key: "building.name", label: "Building" },
                  { key: "manager.name", label: "Manager" },
                  { key: "amount", label: "Amount", render: (v) => `$${v}` },
                  { key: "frequency", label: "Frequency" },
                  { key: "nextDueDate", label: "Next Due Date", render: (v) => v ? new Date(v).toLocaleDateString() : "—" },
                  { key: "status", label: "Status" },
                  { key: "lastPaidDate", label: "Last Paid Date", render: (v) => v ? new Date(v).toLocaleDateString() : "—" }
                ]
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}
