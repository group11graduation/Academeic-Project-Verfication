import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ReusableTable } from "../../components/ReusableTable";
import { DetailModal } from "../../components/DetailModal";
import * as reportsApi from "../../api/reports.api";
import * as managerApi from "../../api/manager.api";
import { toast } from "sonner";
import { 
  CurrencyDollarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
  HomeIcon,
  UserIcon,
  PlusIcon
} from "@heroicons/react/24/outline";

const SYSTEM_BLUE = "#1E3A4C";

// Helper function to aggregate child room payments into parent apartments
const processApartmentPayments = (rooms: any[]) => {
  if (!rooms || rooms.length === 0) return [];
  
  // Separate apartments and regular rooms
  const apartments: any[] = [];
  const regularRooms: any[] = [];
  const childRoomsMap = new Map<string, any[]>(); // Map apartment ID to its child rooms
  
  rooms.forEach(room => {
    const isApartment = room.isApartment || (room.type && room.type.toLowerCase().includes("apartment"));
    
    if (isApartment && !room.parentApartment) {
      // This is a parent apartment
      apartments.push(room);
    } else if (room.parentApartment) {
      // This is a child room inside an apartment
      const parentId = room.parentApartment._id || room.parentApartment;
      if (!childRoomsMap.has(parentId)) {
        childRoomsMap.set(parentId, []);
      }
      childRoomsMap.get(parentId)!.push(room);
    } else {
      // Regular room (not apartment, not inside apartment)
      regularRooms.push(room);
    }
  });
  
  // Process apartments with aggregated child room payments
  const processedApartments = apartments.map(apt => {
    const aptId = apt._id || apt.id;
    const childRooms = childRoomsMap.get(aptId) || [];
    
    // Calculate total payment from child rooms
    const childRoomsTotal = childRooms.reduce((sum, room) => {
      return sum + (room.payment?.amount || 0);
    }, 0);
    
    // Apartment's own payment
    const apartmentPayment = apt.payment?.amount || 0;
    
    // Total = apartment's payment + all child rooms' payments
    const totalPayment = apartmentPayment + childRoomsTotal;
    
    return {
      ...apt,
      childRoomsList: childRooms,
      childRoomsCount: childRooms.length,
      childRoomsTotal: childRoomsTotal,
      totalPayment: totalPayment,
      payment: {
        ...apt.payment,
        amount: totalPayment, // Override with total
        originalAmount: apartmentPayment // Keep original apartment payment
      },
      isProcessedApartment: true
    };
  });
  
  // Return processed apartments + regular rooms (exclude child rooms from main list)
  return [...processedApartments, ...regularRooms];
};

export function ManagerPaymentTracking() {
  // Room payment data (room overview)
  const [roomPayments, setRoomPayments] = useState<any[]>([]);
  const [paymentStats, setPaymentStats] = useState<any>(null);
  
  // Tenant payment records
  const [tenantPayments, setTenantPayments] = useState<any[]>([]);
  const [tenantPaymentStats, setTenantPaymentStats] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isMarkPaidModalOpen, setIsMarkPaidModalOpen] = useState(false);
  const [paymentToMark, setPaymentToMark] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"rooms" | "tenants">("tenants");
  const [markPaidForm, setMarkPaidForm] = useState({ paidAmount: "", paymentMethod: "CASH", notes: "" });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null);

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  useEffect(() => {
    // Get selected building ID from localStorage
    const savedBuildingId = localStorage.getItem("selectedBuildingId");
    setSelectedBuildingId(savedBuildingId);
    fetchAllData(savedBuildingId);
    const interval = setInterval(() => {
      const currentBuildingId = localStorage.getItem("selectedBuildingId");
      fetchAllData(currentBuildingId);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Listen for building changes
    const handleBuildingChange = (event: any) => {
      const buildingId = event.detail?.buildingId || localStorage.getItem("selectedBuildingId");
      setSelectedBuildingId(buildingId);
      fetchAllData(buildingId);
    };

    window.addEventListener('buildingChanged', handleBuildingChange);
    return () => window.removeEventListener('buildingChanged', handleBuildingChange);
  }, []);

  const fetchAllData = async (buildingId?: string | null) => {
    setIsLoading(true);
    try {
      const [roomPaymentsResponse, statsResponse, tenantPaymentsResponse, tenantStatsResponse] = await Promise.all([
        reportsApi.getManagerRoomPayments(buildingId || undefined).catch((err) => {
          console.error("Room payments error:", err);
          return [];
        }),
        reportsApi.getManagerPaymentStats(buildingId || undefined).catch((err) => {
          console.error("Payment stats error:", err);
          return null;
        }),
        managerApi.getRoomPayments({ buildingId: buildingId || undefined }).catch((err) => {
          console.error("Tenant payments error:", err);
          return [];
        }),
        managerApi.getRoomPaymentStats(buildingId || undefined).catch((err) => {
          console.error("Tenant payment stats error:", err);
          return null;
        })
      ]);

      // Handle response structure - check if data is wrapped
      const roomPaymentsData = Array.isArray(roomPaymentsResponse) ? roomPaymentsResponse : (roomPaymentsResponse?.data || []);
      const statsData = statsResponse?.data || statsResponse;
      const tenantPaymentsData = Array.isArray(tenantPaymentsResponse) ? tenantPaymentsResponse : (tenantPaymentsResponse?.data || []);
      const tenantStatsData = tenantStatsResponse?.data || tenantStatsResponse;

      console.log("Room Payments Data:", roomPaymentsData);
      console.log("Payment Stats:", statsData);
      console.log("Tenant Payments Data:", tenantPaymentsData);
      console.log("Tenant Payment Stats:", tenantStatsData);

      // Process room payments to aggregate child rooms into parent apartments
      const processedRoomPayments = processApartmentPayments(roomPaymentsData || []);
      
      setRoomPayments(processedRoomPayments);
      setPaymentStats(statsData);
      setTenantPayments(tenantPaymentsData || []);
      setTenantPaymentStats(tenantStatsData);
    } catch (err: any) {
      console.error("Fetch error:", err);
      toast.error(err.response?.data?.message || "Failed to load payment data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (payment: any) => {
    setSelectedPayment(payment);
    setIsDetailModalOpen(true);
  };

  const handleMarkAsPaid = (payment: any) => {
    setPaymentToMark(payment);
    // If partial payment, set default to remaining amount, otherwise full amount
    const defaultAmount = payment.status === "PARTIAL"
      ? ((payment.amount || 0) - (payment.paidAmount || 0)).toFixed(2)
      : (payment.amount?.toString() || "");
    
    setMarkPaidForm({
      paidAmount: defaultAmount,
      paymentMethod: "CASH",
      notes: ""
    });
    setIsMarkPaidModalOpen(true);
  };

  const handleMarkPaidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentToMark) return;

    const paidAmount = parseFloat(markPaidForm.paidAmount);
    if (!paidAmount || paidAmount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    try {
      const result = await managerApi.markRoomPaymentAsPaid(paymentToMark._id, {
        paidAmount: paidAmount,
        paymentMethod: markPaidForm.paymentMethod,
        notes: markPaidForm.notes,
        buildingId: selectedBuildingId || undefined
      });
      
      if (result.message) {
        toast.success(result.message);
      } else {
        toast.success("Payment recorded successfully");
      }
      
      // Show message about next payment if fully paid
      if (paymentToMark.status !== "PAID" && result.status === "PAID") {
        toast.info("Next payment period has been automatically created and is now in PENDING status");
      }
      
      setIsMarkPaidModalOpen(false);
      setPaymentToMark(null);
      setMarkPaidForm({ paidAmount: "", paymentMethod: "CASH", notes: "" });
      
      // Refresh data to show the new pending payment
      await fetchAllData(selectedBuildingId);
      
      // If fully paid, switch to pending tab to show the new payment
      if (result.status === "PAID" && paymentToMark.frequency !== "ONE_TIME") {
        setTimeout(() => {
          setActiveTab("pending");
        }, 500);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Failed to mark payment as paid";
      toast.error(errorMsg);
      
      // If overpayment error, show remaining amount
      if (err.response?.data?.remainingAmount) {
        setMarkPaidForm({
          ...markPaidForm,
          paidAmount: err.response.data.remainingAmount
        });
      }
    }
  };

  const handleAutoCreate = async () => {
    try {
      const result = await managerApi.autoCreateRoomPayments(selectedBuildingId || undefined);
      toast.success(`Created ${result.created} payment records. ${result.skipped} already existed.`);
      fetchAllData(selectedBuildingId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create payment records");
    }
  };

  const handleDeletePayment = (payment: any) => {
    setPaymentToDelete(payment);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!paymentToDelete) return;
    try {
      await managerApi.deleteRoomPayment(paymentToDelete._id, selectedBuildingId || undefined);
      toast.success("Payment record deleted successfully");
      setDeleteConfirmOpen(false);
      setPaymentToDelete(null);
      fetchAllData(selectedBuildingId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete payment record");
    }
  };

  // Mark payment as fully paid (without showing modal)
  const handleMarkFullyPaid = async (payment: any) => {
    try {
      const fullAmount = payment.status === "PARTIAL"
        ? (payment.amount || 0) - (payment.paidAmount || 0)
        : payment.amount || 0;
      
      const result = await managerApi.markRoomPaymentAsPaid(payment._id, {
        paidAmount: fullAmount,
        paymentMethod: "CASH",
        notes: "Marked as fully paid",
        buildingId: selectedBuildingId || undefined
      });
      
      toast.success("Payment marked as paid!");
      
      // Refresh data
      await fetchAllData(selectedBuildingId);
      
      // If fully paid and recurring, show info about next payment
      if (result.status === "PAID" && payment.frequency !== "ONE_TIME") {
        toast.info("Next payment period has been created");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to mark payment as paid");
    }
  };

  // Filter room payments
  const filteredRoomPayments = roomPayments.filter(r => {
    const matchesSearch = 
      r.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.floor?.floorNumber?.toString().includes(searchQuery);
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "apartments") return r.isProcessedApartment || r.isApartment || r.paymentSource === "APARTMENT";
    if (activeTab === "rooms") return !r.isProcessedApartment && !r.isApartment && r.paymentSource !== "APARTMENT";
    return matchesSearch;
  });
  
  // Calculate apartment stats
  const apartmentCount = roomPayments.filter(r => r.isProcessedApartment || r.isApartment).length;
  const regularRoomCount = roomPayments.filter(r => !r.isProcessedApartment && !r.isApartment).length;

  // Filter tenant payments
  const filteredTenantPayments = tenantPayments.filter(p => {
    const matchesSearch = 
      p.person?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.person?.phone?.includes(searchQuery) ||
      p.room?.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.period?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "paid") return p.status === "PAID" && matchesSearch;
    if (activeTab === "pending") return p.status === "PENDING" && matchesSearch;
    if (activeTab === "overdue") return (p.status === "OVERDUE" || (p.status === "PENDING" && new Date(p.dueDate) < new Date())) && matchesSearch;
    if (activeTab === "partial") return p.status === "PARTIAL" && matchesSearch;
    return matchesSearch;
  });

  // Room Payment Columns (for room overview)
  const roomPaymentColumns = [
    {
      header: "ROOM",
      render: (r: any) => (
        <div>
          <div className="flex items-center gap-2">
            <div className="font-black text-[#1E3A4C] dark:text-white">{r.displayName || r.roomNumber}</div>
            {r.isProcessedApartment && (
              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-[9px] font-bold">
                APARTMENT
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{r.type}</div>
          {r.isProcessedApartment && r.childRoomsList && r.childRoomsList.length > 0 && (
            <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
              <div className="text-[10px] text-purple-700 dark:text-purple-400 font-bold mb-1">
                {r.childRoomsCount} Room{r.childRoomsCount !== 1 ? 's' : ''} Inside:
              </div>
              <div className="space-y-1">
                {r.childRoomsList.map((cr: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[9px]">
                    <span className="text-gray-600 dark:text-gray-400">{cr.roomNumber} ({cr.type})</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">${cr.payment?.amount || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      header: "LOCATION",
      render: (r: any) => (
        <div className="text-sm dark:text-gray-300">
          Level {r.floor?.floorNumber || "N/A"}
        </div>
      )
    },
    {
      header: "PAYMENT",
      render: (r: any) => (
        <div>
          <div className="font-black text-lg text-[#1E3A4C] dark:text-white">
            ${r.payment?.amount?.toLocaleString() || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {r.payment?.frequency || "MONTHLY"}
          </div>
          {r.isProcessedApartment && r.childRoomsCount > 0 && (
            <div className="mt-1 text-[10px] space-y-0.5">
              <div className="text-purple-600 dark:text-purple-400">
                Apt: ${r.payment?.originalAmount?.toLocaleString() || 0}
              </div>
              <div className="text-blue-600 dark:text-blue-400">
                Rooms: ${r.childRoomsTotal?.toLocaleString() || 0}
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      header: "STATUS",
      render: (r: any) => (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
          r.status === "OCCUPIED" 
            ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400" 
            : "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        }`}>
          {r.status || "AVAILABLE"}
        </span>
      )
    }
  ];

  // Tenant Payment Columns (for actual payment records)
  const tenantPaymentColumns = [
    {
      header: "TENANT",
      render: (p: any) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="font-bold text-gray-800 text-sm">{p.person?.name || "N/A"}</div>
            <div className="text-xs text-gray-400">{p.person?.phone || ""}</div>
          </div>
        </div>
      )
    },
    {
      header: "ROOM",
      render: (p: any) => (
        <div>
          <div className="font-bold text-[#1E3A4C]">Room {p.room?.roomNumber || "N/A"}</div>
          <div className="text-xs text-gray-500">
            Level {p.room?.floor?.floorNumber || "N/A"}
          </div>
        </div>
      )
    },
    {
      header: "AMOUNT",
      render: (p: any) => (
        <div>
          <div className="font-black text-[#1E3A4C]">
            ${p.amount?.toLocaleString() || 0}
          </div>
          {p.status === "PARTIAL" && (
            <div className="text-xs text-orange-600">
              Paid: ${p.paidAmount?.toLocaleString() || 0}
            </div>
          )}
        </div>
      )
    },
    {
      header: "PERIOD",
      render: (p: any) => (
        <div>
          <div className="text-sm font-bold text-gray-700">{p.period || "N/A"}</div>
          <div className="text-xs text-gray-500">{p.frequency || "MONTHLY"}</div>
        </div>
      )
    },
    {
      header: "DUE DATE",
      render: (p: any) => {
        const dueDate = new Date(p.dueDate);
        const isOverdue = dueDate < new Date() && p.status !== "PAID";
        return (
          <div>
            <div className={`text-sm font-bold ${isOverdue ? "text-red-600" : "text-gray-700"}`}>
              {dueDate.toLocaleDateString()}
            </div>
            {isOverdue && (
              <div className="text-xs text-red-500">Overdue</div>
            )}
          </div>
        );
      }
    },
    {
      header: "STATUS",
      render: (p: any) => {
        const statusColors = {
          PAID: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
          PENDING: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
          OVERDUE: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
          PARTIAL: "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
        };
        const status = p.status === "PENDING" && new Date(p.dueDate) < new Date() ? "OVERDUE" : p.status;
        return (
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
            statusColors[status as keyof typeof statusColors] || "bg-gray-50 text-gray-600"
          }`}>
            {status}
          </span>
        );
      }
    },
    {
      header: "ACTIONS",
      render: (p: any) => {
        if (p.status === "PAID") {
          return (
            <span className="text-xs text-green-600 dark:text-green-400 font-bold">
              ✓ Completed
            </span>
          );
        }
        return (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMarkFullyPaid(p);
              }}
              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Paid
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMarkAsPaid(p);
              }}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Partial
            </button>
          </div>
        );
      }
    }
  ];

  const roomDetailFields = [
    { label: "Room Number", key: "roomNumber" },
    { label: "Type", key: "type" },
    { label: "Status", key: "status" },
    { label: "Floor", key: "floor.floorNumber", transform: (val: number) => `Level ${val}` },
    { label: "Capacity", key: "capacity", transform: (val: number) => val ? (val.toString() + (val === 1 ? " room" : " rooms")) : "N/A" },
    { label: "Payment Amount", key: "payment.amount", transform: (val: number) => `$${val?.toLocaleString() || 0}` },
    { label: "Payment Frequency", key: "payment.frequency" },
    { label: "Payment Source", key: "paymentSource" },
    { label: "Parent Apartment", key: "parentApartment.roomNumber", transform: (val: string) => val || "N/A" },
    { label: "Is Apartment", key: "isApartment", transform: (val: boolean) => val ? "Yes" : "No" },
    { label: "Child Rooms Count", key: "childRooms", transform: (val: number) => val ? `${val} rooms` : "0 rooms" }
  ];

  const tenantPaymentDetailFields = [
    { label: "Tenant Name", key: "person.name" },
    { label: "Phone", key: "person.phone" },
    { label: "Room Number", key: "room.roomNumber" },
    { label: "Floor", key: "room.floor.floorNumber", transform: (val: number) => `Level ${val}` },
    { label: "Amount", key: "amount", transform: (val: number) => `$${val?.toLocaleString() || 0}` },
    { label: "Paid Amount", key: "paidAmount", transform: (val: number) => val ? `$${val.toLocaleString()}` : "$0" },
    { label: "Period", key: "period" },
    { label: "Frequency", key: "frequency" },
    { label: "Due Date", key: "dueDate", transform: (val: string) => new Date(val).toLocaleDateString() },
    { label: "Paid Date", key: "paidDate", transform: (val: string) => val ? new Date(val).toLocaleDateString() : "Not paid" },
    { label: "Status", key: "status" },
    { label: "Payment Method", key: "paymentMethod" },
    { label: "Notes", key: "notes", transform: (val: string) => val || "No notes" },
    { label: "Recorded By", key: "recordedBy.name" }
  ];

  // Combined stats
  const combinedStats = {
    totalRevenue: paymentStats?.totalRoomRevenue || 0,
    totalTenantAmount: tenantPaymentStats?.totalAmount || 0,
    paidAmount: tenantPaymentStats?.paidAmount || 0,
    pendingAmount: tenantPaymentStats?.pendingAmount || 0,
    overdueAmount: tenantPaymentStats?.overdueAmount || 0,
    apartmentCount: paymentStats?.apartmentCount || 0,
    totalRooms: paymentStats?.totalRooms || 0,
    occupiedPersons: paymentStats?.occupiedPersons || 0,
    paidCount: tenantPaymentStats?.paidCount || 0,
    pendingCount: tenantPaymentStats?.pendingCount || 0,
    overdueCount: tenantPaymentStats?.overdueCount || 0,
    partialCount: tenantPaymentStats?.partialCount || 0
  };

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white">Payment Tracking</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monitor room payments and tenant payment records</p>
            </div>
            <div className="flex gap-3">
              {viewMode === "tenants" && (
                <button
                  onClick={handleAutoCreate}
                  className="bg-blue-600 dark:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-lg"
                >
                  <PlusIcon className="w-4 h-4 inline-block mr-2" /> Auto-Create Payments
                </button>
              )}
              <button
                onClick={() => setViewMode(viewMode === "rooms" ? "tenants" : "rooms")}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  viewMode === "tenants"
                    ? "bg-[#1E3A4C] dark:bg-blue-700 text-white shadow-lg"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                }`}
              >
                {viewMode === "tenants" ? "Room Overview" : "Tenant Payments"}
              </button>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode("tenants")}
              className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                viewMode === "tenants"
                  ? "border-[#1E3A4C] dark:border-blue-500 text-[#1E3A4C] dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Tenant Payments ({tenantPayments.length})
              {tenantPayments.length === 0 && (
                <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">(No records - Click Auto-Create)</span>
              )}
            </button>
            <button
              onClick={() => setViewMode("rooms")}
              className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                viewMode === "rooms"
                  ? "border-[#1E3A4C] dark:border-blue-500 text-[#1E3A4C] dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Room Overview ({roomPayments.length})
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Total Revenue</span>
                <CurrencyDollarIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
              </div>
              <div className="text-xl font-black text-[#1E3A4C] dark:text-white">
                ${(combinedStats.totalRevenue || combinedStats.totalTenantAmount || 0).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {viewMode === "tenants" ? "From tenant payments" : "Room payment potential"}
              </div>
            </div>
            {viewMode === "tenants" ? (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Paid</span>
                    <CheckCircleIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
                  </div>
                  <div className="text-xl font-black text-green-600 dark:text-green-400">
                    ${combinedStats.paidAmount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {combinedStats.paidCount || 0} payments
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Pending</span>
                    <ClockIcon className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                  </div>
                  <div className="text-xl font-black text-yellow-600 dark:text-yellow-400">
                    ${combinedStats.pendingAmount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {combinedStats.pendingCount || 0} payments
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Overdue</span>
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-500 dark:text-red-400" />
                  </div>
                  <div className="text-xl font-black text-red-600 dark:text-red-400">
                    ${combinedStats.overdueAmount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {combinedStats.overdueCount || 0} payments
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Apartments</span>
                    <BuildingOfficeIcon className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                  </div>
                  <div className="text-xl font-black text-purple-600 dark:text-purple-400">{apartmentCount || combinedStats.apartmentCount}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total apartments in building</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Occupied</span>
                    <HomeIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  </div>
                  <div className="text-xl font-black text-blue-600 dark:text-blue-400">{combinedStats.occupiedPersons}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">People with room assignments</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Total Rooms</span>
                    <HomeIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  </div>
                  <div className="text-xl font-black text-blue-600 dark:text-blue-400">{combinedStats.totalRooms}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Rooms in building</div>
                </div>
              </>
            )}
          </div>

          {/* Revenue by Floor (only for room overview) */}
          {viewMode === "rooms" && paymentStats?.revenueByFloor && paymentStats.revenueByFloor.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm mb-6">
              <h3 className="text-base font-black text-[#1E3A4C] dark:text-white mb-4">Revenue by Floor</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {paymentStats.revenueByFloor.map((floor: any) => (
                  <div key={floor.floorNumber} className="bg-slate-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-200 dark:border-gray-600">
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Level {floor.floorNumber}</div>
                    <div className="text-lg font-black text-[#1E3A4C] dark:text-white">
                      ${floor.revenue?.toLocaleString() || 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{floor.roomCount || 0} rooms</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                activeTab === "all"
                  ? "border-[#1E3A4C] dark:border-blue-500 text-[#1E3A4C] dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              All ({viewMode === "tenants" ? tenantPayments.length : roomPayments.length})
            </button>
            {viewMode === "tenants" ? (
              <>
                <button
                  onClick={() => setActiveTab("paid")}
                  className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                    activeTab === "paid"
                      ? "border-green-500 dark:border-green-400 text-green-600 dark:text-green-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  Paid ({combinedStats.paidCount || 0})
                </button>
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                    activeTab === "pending"
                      ? "border-yellow-500 dark:border-yellow-400 text-yellow-600 dark:text-yellow-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  Pending ({combinedStats.pendingCount || 0})
                </button>
                <button
                  onClick={() => setActiveTab("overdue")}
                  className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                    activeTab === "overdue"
                      ? "border-red-500 dark:border-red-400 text-red-600 dark:text-red-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  Overdue ({combinedStats.overdueCount || 0})
                </button>
                <button
                  onClick={() => setActiveTab("partial")}
                  className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                    activeTab === "partial"
                      ? "border-orange-500 dark:border-orange-400 text-orange-600 dark:text-orange-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  Partial ({combinedStats.partialCount || 0})
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab("apartments")}
                  className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                    activeTab === "apartments"
                      ? "border-purple-500 dark:border-purple-400 text-purple-600 dark:text-purple-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  Apartments ({apartmentCount})
                </button>
                <button
                  onClick={() => setActiveTab("rooms")}
                  className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                    activeTab === "rooms"
                      ? "border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  Regular Rooms ({regularRoomCount})
                </button>
              </>
            )}
          </div>

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder={viewMode === "tenants" ? "Search by tenant name, phone, room, or period..." : "Search by room number, type, or floor..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          {/* Table */}
          {viewMode === "tenants" && tenantPayments.length === 0 && !isLoading ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
              <UserIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">No Tenant Payment Records</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Payment records are automatically created when tenants are assigned to rooms. 
                You can also manually create payment records for all existing tenants.
              </p>
              <button
                onClick={handleAutoCreate}
                className="bg-blue-600 dark:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-lg inline-flex items-center gap-2"
              >
                <PlusIcon className="w-5 h-5" />
                Auto-Create Payment Records
              </button>
            </div>
          ) : (
            <ReusableTable
              data={viewMode === "tenants" ? filteredTenantPayments : filteredRoomPayments}
              columns={viewMode === "tenants" ? tenantPaymentColumns : roomPaymentColumns}
              isLoading={isLoading}
              onRowClick={handleRowClick}
              emptyMessage={viewMode === "tenants" 
                ? "No payment records match your search. Try adjusting your filters."
                : "No room payments found."}
            />
          )}

          {/* Detail Modal */}
          <DetailModal
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            title={viewMode === "tenants" ? "Payment Details" : "Room Payment Details"}
            data={selectedPayment}
            fields={viewMode === "tenants" ? tenantPaymentDetailFields : roomDetailFields}
            onEdit={viewMode === "tenants" && selectedPayment && selectedPayment.status !== "PAID" ? () => {
              setIsDetailModalOpen(false);
              handleMarkAsPaid(selectedPayment);
            } : undefined}
          />

          {/* Delete Confirmation Modal */}
          {deleteConfirmOpen && paymentToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
                <h2 className="text-xl font-black text-red-600 dark:text-red-400 mb-4">Delete Payment Record</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Are you sure you want to delete this payment record?
                </p>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
                  <div className="font-bold text-gray-800 dark:text-gray-200">{paymentToDelete.person?.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Room {paymentToDelete.room?.roomNumber} • {paymentToDelete.period} • ${paymentToDelete.amount}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setDeleteConfirmOpen(false); setPaymentToDelete(null); }}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mark as Paid Modal */}
          {isMarkPaidModalOpen && paymentToMark && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
                <h2 className="text-xl font-black text-[#1E3A4C] dark:text-white mb-4">Mark Payment as Paid</h2>
                <form onSubmit={handleMarkPaidSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Tenant</label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <div className="font-bold text-gray-800 dark:text-gray-200">{paymentToMark.person?.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Room {paymentToMark.room?.roomNumber}</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Amount Due</label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl font-bold text-lg text-gray-800 dark:text-gray-200">
                      ${paymentToMark.amount?.toLocaleString() || 0}
                    </div>
                    {paymentToMark.status === "PARTIAL" && (
                      <>
                        <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-bold">
                          Already paid: ${paymentToMark.paidAmount?.toLocaleString() || 0}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-bold">
                          Remaining: ${((paymentToMark.amount || 0) - (paymentToMark.paidAmount || 0)).toLocaleString()}
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Amount Paid *
                      {paymentToMark.status === "PARTIAL" && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-normal ml-2">
                          (Max: ${((paymentToMark.amount || 0) - (paymentToMark.paidAmount || 0)).toFixed(2)})
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={paymentToMark.status === "PARTIAL" 
                        ? ((paymentToMark.amount || 0) - (paymentToMark.paidAmount || 0)).toFixed(2)
                        : paymentToMark.amount
                      }
                      required
                      value={markPaidForm.paidAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        const maxAmount = paymentToMark.status === "PARTIAL"
                          ? (paymentToMark.amount || 0) - (paymentToMark.paidAmount || 0)
                          : paymentToMark.amount || 0;
                        
                        if (value === "" || parseFloat(value) <= maxAmount) {
                          setMarkPaidForm({ ...markPaidForm, paidAmount: value });
                        }
                      }}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      placeholder={paymentToMark.status === "PARTIAL" 
                        ? `Enter amount (max: $${((paymentToMark.amount || 0) - (paymentToMark.paidAmount || 0)).toFixed(2)})`
                        : "Enter amount paid"
                      }
                    />
                    {paymentToMark.status === "PARTIAL" && (
                      <button
                        type="button"
                        onClick={() => {
                          const remaining = (paymentToMark.amount || 0) - (paymentToMark.paidAmount || 0);
                          setMarkPaidForm({ ...markPaidForm, paidAmount: remaining.toFixed(2) });
                        }}
                        className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold"
                      >
                        Pay Remaining Amount
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Payment Method</label>
                    <select
                      value={markPaidForm.paymentMethod}
                      onChange={(e) => setMarkPaidForm({ ...markPaidForm, paymentMethod: e.target.value })}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    >
                      <option value="CASH">Cash</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHECK">Check</option>
                      <option value="CARD">Card</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Notes (Optional)</label>
                    <textarea
                      value={markPaidForm.notes}
                      onChange={(e) => setMarkPaidForm({ ...markPaidForm, notes: e.target.value })}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      rows={3}
                      placeholder="Add any notes about this payment..."
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMarkPaidModalOpen(false);
                        setPaymentToMark(null);
                      }}
                      className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-green-600 dark:bg-green-700 text-white hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                    >
                      Mark as Paid
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
