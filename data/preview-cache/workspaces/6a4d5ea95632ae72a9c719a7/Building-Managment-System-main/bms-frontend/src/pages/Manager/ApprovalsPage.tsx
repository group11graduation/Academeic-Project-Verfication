import React, { useEffect, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { getPendingRequests, reviewRequest } from "../../api/manager.api";
import { toast } from "sonner";
import { ReusableTable } from "../../components/ReusableTable";
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon, 
  InformationCircleIcon 
} from "@heroicons/react/24/outline";

export function ApprovalsPage() {
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
      const data = await getPendingRequests();
      setRequests(data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Error fetching approval requests");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED', reason?: string) => {
    try {
      await reviewRequest(id, status, reason || `Processed by Manager - ${status}`);
      toast.success(`Request ${status.toLowerCase()} successfully`);
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

  const requestColumns = [
    {
      header: "REQUEST TYPE",
      render: (req: any) => (
        <div className="flex items-center gap-2">
          <div className="bg-blue-600/10 p-2 rounded-lg">
            <InformationCircleIcon className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="font-bold text-[#1E3A4C] text-sm">{req.targetType} {req.actionType}</div>
            <div className="text-xs text-gray-500">{req.targetId?.slice(-6).toUpperCase()}</div>
          </div>
        </div>
      )
    },
    {
      header: "REQUESTED BY",
      render: (req: any) => (
        <div>
          <div className="font-bold text-sm text-gray-700">{req.requestedBy?.name || "Unknown"}</div>
          <div className="text-xs text-gray-500">{req.requestedBy?.email || ""}</div>
        </div>
      )
    },
    {
      header: "CHANGES",
      render: (req: any) => (
        <div className="max-w-xs">
          <pre className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded overflow-x-auto">
            {JSON.stringify(req.payload || {}, null, 1)}
          </pre>
        </div>
      )
    },
    {
      header: "DATE",
      render: (req: any) => (
        <div className="text-sm text-gray-600">
          {new Date(req.createdAt).toLocaleDateString()}
          <div className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleTimeString()}</div>
        </div>
      )
    },
    {
      header: "ACTIONS",
      render: (req: any) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReview(req._id, "APPROVED");
            }}
            className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-all text-sm font-bold flex items-center gap-2 shadow-md"
          >
            <CheckCircleIcon className="w-4 h-4" />
            Approve
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReview(req._id, "REJECTED");
            }}
            className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all text-sm font-bold flex items-center gap-2 shadow-md"
          >
            <XCircleIcon className="w-4 h-4" />
            Reject
          </button>
        </div>
      )
    }
  ];

  const requestDetailFields = [
    { label: "Request Type", key: "targetType" },
    { label: "Action", key: "actionType" },
    { label: "Requested By", key: "requestedBy.name" },
    { label: "Email", key: "requestedBy.email" },
    { label: "Target ID", key: "targetId", transform: (val: string) => val?.slice(-6).toUpperCase() },
    { label: "Status", key: "status" },
    { label: "Created At", key: "createdAt", transform: (val: string) => new Date(val).toLocaleString() },
    { label: "Proposed Changes", key: "payload", transform: (val: any) => JSON.stringify(val, null, 2) }
  ];

  return (
    <div className="flex min-h-screen bg-[#1E3A4C] dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 bg-[#F8FAFC] dark:bg-gray-900 my-3 mr-3 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-black text-[#1E3A4C] dark:text-white">Approval Requests</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Review and manage action requests from sub-managers</p>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-xl">
            <ClockIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{requests.length} Pending</span>
          </div>
        </div>

        {requests.length === 0 && !loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
            <ClockIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 dark:text-gray-400 font-medium text-lg">No pending requests at the moment.</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">All requests have been processed.</p>
          </div>
        ) : (
          <ReusableTable
            data={requests}
            columns={requestColumns}
            isLoading={loading}
            onRowClick={handleRowClick}
            emptyMessage="No pending approval requests."
          />
        )}

        {/* Detail Modal */}
        {selectedRequest && (
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity ${
              isDetailModalOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            onClick={() => setIsDetailModalOpen(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-[#1E3A4C]">Request Details</h2>
              </div>
              <div className="p-6 space-y-4">
                {requestDetailFields.map((field) => {
                  const value = field.key.split(".").reduce((obj: any, key) => obj?.[key], selectedRequest);
                  const displayValue = field.transform ? field.transform(value) : value || "N/A";
                  return (
                    <div key={field.key} className="border-b border-gray-100 pb-4">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                        {field.label}
                      </label>
                      {field.key === "payload" ? (
                        <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto font-mono text-gray-700">
                          {displayValue}
                        </pre>
                      ) : (
                        <p className="text-sm font-medium text-gray-700">{displayValue}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    handleReview(selectedRequest._id, "REJECTED");
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-red-500 text-white hover:bg-red-600 transition-colors shadow-md flex items-center gap-2"
                >
                  <XCircleIcon className="w-4 h-4" /> Reject
                </button>
                <button
                  onClick={() => {
                    handleReview(selectedRequest._id, "APPROVED");
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-green-500 text-white hover:bg-green-600 transition-colors shadow-md flex items-center gap-2"
                >
                  <CheckCircleIcon className="w-4 h-4" /> Approve
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
