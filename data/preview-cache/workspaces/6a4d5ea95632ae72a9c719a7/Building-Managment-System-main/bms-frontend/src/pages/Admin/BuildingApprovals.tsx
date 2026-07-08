import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ReusableTable } from "../../components/ReusableTable";
import { DetailModal } from "../../components/DetailModal";
import { getPendingBuildingApprovals, approveBuildingCreation } from "../../api/admin.api";
import { toast } from "sonner";
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon, 
  BuildingOfficeIcon,
  UserIcon,
  MapPinIcon
} from "@heroicons/react/24/outline";

export function BuildingApprovals() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchRequests();
    // Refresh every 30 seconds
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await getPendingBuildingApprovals();
      setRequests(data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Error fetching building approval requests");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, status: "APPROVED" | "REJECTED", reason?: string) => {
    try {
      await approveBuildingCreation(id, status, reason || `Processed by Admin - ${status}`);
      toast.success(`Building creation request ${status.toLowerCase()} successfully`);
      fetchRequests();
      setIsDetailModalOpen(false);
      setSelectedRequest(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to process request");
    }
  };

  const handleRowClick = (request: any) => {
    setSelectedRequest(request);
    setIsDetailModalOpen(true);
  };

  const columns = [
    {
      header: "BUILDING DETAILS",
      render: (req: any) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <BuildingOfficeIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">{req.buildingData?.name || "N/A"}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <MapPinIcon className="w-3 h-3" />
              {req.buildingData?.location || "N/A"}
            </p>
          </div>
        </div>
      )
    },
    {
      header: "REQUESTED BY",
      render: (req: any) => (
        <div className="flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            {req.requestedBy?.name || "Unknown"}
          </span>
        </div>
      )
    },
    {
      header: "APPROVAL STATUS",
      render: (req: any) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {req.managerApproved ? (
              <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                <CheckCircleIcon className="w-4 h-4" /> Manager Approved
              </span>
            ) : (
              <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                <ClockIcon className="w-4 h-4" /> Manager Pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {req.adminApproved ? (
              <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                <CheckCircleIcon className="w-4 h-4" /> Admin Approved
              </span>
            ) : (
              <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                <ClockIcon className="w-4 h-4" /> Admin Pending
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      header: "POLICY",
      render: (req: any) => (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
          {req.approvalPolicy === "BOTH" ? "Both Required" : req.approvalPolicy}
        </span>
      )
    },
    {
      header: "STATUS",
      render: (req: any) => (
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
          req.status === "APPROVED" 
            ? "bg-green-100 text-green-700"
            : req.status === "REJECTED"
            ? "bg-red-100 text-red-700"
            : "bg-yellow-100 text-yellow-700"
        }`}>
          {req.status}
        </span>
      )
    }
  ];

  const detailFields = [
    { label: "Building Name", key: "buildingData.name" },
    { label: "Location", key: "buildingData.location" },
    { label: "Manager ID", key: "buildingData.managerId", transform: (val: any) => val?.toString() || "N/A" },
    { label: "Branding Name", key: "buildingData.brandingName" },
    { label: "Floor Limit", key: "buildingData.floorLimit" },
    { label: "Allowed Room Types", key: "buildingData.allowedRoomTypes", transform: (val: any) => Array.isArray(val) ? val.join(", ") : "N/A" },
    { label: "Requested By", key: "requestedBy.name" },
    { label: "Manager Approved", key: "managerApproved", transform: (val: boolean) => val ? "Yes" : "No" },
    { label: "Admin Approved", key: "adminApproved", transform: (val: boolean) => val ? "Yes" : "No" },
    { label: "Status", key: "status" }
  ];

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
          <header className="mb-8">
            <h1 className="text-2xl font-black text-[#1E3A4C]">Building Approval Requests</h1>
            <p className="text-sm text-gray-500">Review and approve building creation requests.</p>
          </header>

          <ReusableTable
            data={requests}
            columns={columns}
            isLoading={loading}
            onRowClick={handleRowClick}
            emptyMessage="No pending building approval requests at the moment."
          />

          <DetailModal
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            title="Building Approval Request Details"
            data={selectedRequest}
            fields={detailFields}
            onEdit={selectedRequest && !selectedRequest.adminApproved ? () => {
              const reason = prompt("Enter approval reason (optional):");
              handleApprove(selectedRequest._id, "APPROVED", reason || undefined);
            } : undefined}
            onDelete={selectedRequest && !selectedRequest.adminApproved ? () => {
              const reason = prompt("Enter rejection reason:");
              if (reason) {
                handleApprove(selectedRequest._id, "REJECTED", reason);
              }
            } : undefined}
          />
        </div>
      </main>
    </div>
  );
}
