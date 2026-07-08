import React, { useEffect, useState } from "react";
import * as api from "../../api/manager.api";
import { toast } from "sonner";

export function ApprovalsPage() {
  const [requests, setRequests] = useState([]);

  const loadRequests = async () => {
    const data = await api.getPendingRequests();
    setRequests(data);
  };

  useEffect(() => { loadRequests(); }, []);

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.reviewRequest(id, status);
      toast.success(`Action ${status.toLowerCase()} successfully`);
      loadRequests();
    } catch (err) { toast.error("Failed to process request"); }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-black mb-6">Pending Approvals</h1>
      <div className="space-y-4">
        {requests.map((req: any) => (
          <div key={req._id} className="bg-white p-6 rounded-2xl shadow-sm border flex justify-between items-center">
            <div>
              <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-1 rounded">
                {req.actionType} {req.targetType}
              </span>
              <p className="mt-2 font-bold">Requested by: {req.requestedBy?.name}</p>
              <p className="text-sm text-gray-500">Date: {new Date(req.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleReview(req._id, 'APPROVED')} className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold">Approve</button>
              <button onClick={() => handleReview(req._id, 'REJECTED')} className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold">Reject</button>
            </div>
          </div>
        ))}
        {requests.length === 0 && <p className="text-gray-400">No pending requests.</p>}
      </div>
    </div>
  );
}