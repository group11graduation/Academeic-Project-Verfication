import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Badge } from '../../components/Badge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { PlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';

// ----- Define types -----
type StatusType = 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected';
type PriorityType = 'low' | 'medium' | 'high' | 'urgent';

interface Building {
  _id: string;
  name: string;
}

interface Room {
  _id: string;
  roomNumber: string;
}

interface User {
  _id: string;
  name: string;
}

interface MaintenanceRequest {
  _id: string;
  title: string;
  description: string;
  priority: PriorityType;
  status: StatusType;
  building?: Building;
  room?: Room;
  _creationTime: string;
  estimatedCost?: number;
  assignedTo?: string;
  notes?: string;
}

interface Approval {
  _id: string;
  request?: MaintenanceRequest;
  requester?: User;
}

// ----- Mock API functions (replace with your real API) -----
const useQuery = <T,>(fn: () => T, args?: any): T | undefined => {
  // Replace this with real API call
  return undefined;
};
const useMutation = <T,>(fn: (data: T) => void) => {
  // Replace this with real API call
  return async (data: T) => {};
};

// ----- Maintenance Component -----
export function Maintenance() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusType | ''>('');

  // Queries (replace with real API)
  const requests = useQuery<MaintenanceRequest[]>(() => [], statusFilter ? { status: statusFilter } : {});
  const buildings = useQuery<Building[]>(() => []);
  const pendingApprovals = useQuery<Approval[]>(() => []);

  // Mutations (replace with real API)
  const createRequest = useMutation<any>(() => {});
  const updateStatus = useMutation<any>(() => {});
  const processApproval = useMutation<any>(() => {});

  // Form State
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    priority: PriorityType;
    buildingId: string;
    roomId: string;
    estimatedCost: number;
  }>({
    title: '',
    description: '',
    priority: 'medium',
    buildingId: '',
    roomId: '',
    estimatedCost: 0,
  });

  const [updateData, setUpdateData] = useState<{
    status: StatusType;
    assignedTo: string;
    actualCost: number;
    notes: string;
  }>({
    status: 'pending',
    assignedTo: '',
    actualCost: 0,
    notes: '',
  });

  // Loading state
  if (!requests || !buildings || !pendingApprovals) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Handlers
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRequest({
        ...formData,
      });
      toast.success('Maintenance request created successfully');
      setIsCreateModalOpen(false);
      resetForm();
    } catch {
      toast.error('Failed to create maintenance request');
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      await updateStatus({
        requestId: selectedRequest._id,
        ...updateData,
      });
      toast.success('Request status updated successfully');
      setIsUpdateModalOpen(false);
      setSelectedRequest(null);
    } catch {
      toast.error('Failed to update request status');
    }
  };

  const handleProcessApproval = async (approvalId: string, status: 'approved' | 'rejected') => {
    try {
      await processApproval({
        approvalId,
        status,
        comments: status === 'rejected' ? 'Request rejected' : 'Request approved',
      });
      toast.success(`Request ${status} successfully`);
    } catch {
      toast.error(`Failed to ${status} request`);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      buildingId: '',
      roomId: '',
      estimatedCost: 0,
    });
  };

  const openUpdateModal = (request: MaintenanceRequest) => {
    setSelectedRequest(request);
    setUpdateData({
      status: request.status,
      assignedTo: request.assignedTo || '',
      actualCost: request.estimatedCost || 0,
      notes: request.notes || '',
    });
    setIsUpdateModalOpen(true);
  };

  const getPriorityBadgeVariant = (priority: PriorityType) => {
    switch (priority) {
      case 'urgent': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'default';
    }
  };

  const getStatusBadgeVariant = (status: StatusType) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'info';
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'danger';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Maintenance</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage maintenance requests and approvals
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingApprovals.map((approval) => (
                <div key={approval._id} className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {approval.request?.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Requested by: {approval.requester?.name || 'Unknown'}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleProcessApproval(approval._id, 'approved')}
                    >
                      <CheckIcon className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleProcessApproval(approval._id, 'rejected')}
                    >
                      <XMarkIcon className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center space-x-4">
        <Select
          label="Filter by Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusType | '')}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
      </div>

      {/* Maintenance Requests */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {requests.map((request) => (
          <Card key={request._id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {request.title}
                </CardTitle>
                <div className="flex space-x-1">
                  <Badge variant={getPriorityBadgeVariant(request.priority)}>
                    {request.priority}
                  </Badge>
                  <Badge variant={getStatusBadgeVariant(request.status)}>
                    {request.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {request.description}
                </p>
                
                <div className="text-sm">
                  <p className="text-gray-600 dark:text-gray-400">
                    Building: {request.building?.name}
                  </p>
                  {request.room && (
                    <p className="text-gray-600 dark:text-gray-400">
                      Room: {request.room.roomNumber}
                    </p>
                  )}
                  <p className="text-gray-600 dark:text-gray-400">
                    Requested: {new Date(request._creationTime).toLocaleDateString()}
                  </p>
                  {request.estimatedCost && (
                    <p className="text-gray-600 dark:text-gray-400">
                      Est. Cost: ${request.estimatedCost}
                    </p>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openUpdateModal(request)}
                  className="w-full"
                >
                  Update Status
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Request Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Maintenance Request"
      >
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Brief description of the issue"
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full h-24 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              placeholder="Detailed description of the maintenance issue"
              required
            />
          </div>

          <Select
            label="Priority"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value as PriorityType })}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
            required
          />

          <Select
            label="Building"
            value={formData.buildingId}
            onChange={(e) => setFormData({ ...formData, buildingId: e.target.value })}
            options={[
              { value: '', label: 'Select Building' },
              ...buildings.map(b => ({ value: b._id, label: b.name }))
            ]}
            required
          />

          <Input
            label="Room ID (Optional)"
            value={formData.roomId}
            onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
            placeholder="Enter room ID if applicable"
          />

          <Input
            label="Estimated Cost ($)"
            type="number"
            value={formData.estimatedCost}
            onChange={(e) => setFormData({ ...formData, estimatedCost: Number(e.target.value) })}
            placeholder="Optional"
          />

          <div className="flex space-x-3 pt-4">
            <Button type="submit" className="flex-1">Create Request</Button>
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        title="Update Request Status"
      >
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Updating: {selectedRequest?.title}
          </p>

          <Select
            label="Status"
            value={updateData.status}
            onChange={(e) => setUpdateData({ ...updateData, status: e.target.value as StatusType })}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'rejected', label: 'Rejected' },
            ]}
            required
          />

          <Input
            label="Assigned To (User ID)"
            value={updateData.assignedTo}
            onChange={(e) => setUpdateData({ ...updateData, assignedTo: e.target.value })}
            placeholder="Enter user ID"
          />

          <Input
            label="Actual Cost ($)"
            type="number"
            value={updateData.actualCost}
            onChange={(e) => setUpdateData({ ...updateData, actualCost: Number(e.target.value) })}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notes
            </label>
            <textarea
              value={updateData.notes}
              onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
              className="w-full h-20 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              placeholder="Additional notes or comments"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button type="submit" className="flex-1">Update Status</Button>
            <Button type="button" variant="outline" onClick={() => setIsUpdateModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
