// src/api/maintenanceApi.ts
import { api } from "./client";

export interface MaintenanceRequest {
  _id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  buildingId: string;
  building?: { _id: string; name: string };
  roomId?: string;
  room?: { _id: string; roomNumber: string };
  requesterId?: string;
  requester?: { _id: string; name: string };
  assignedTo?: string;
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  _creationTime: string;
}

export interface Building {
  _id: string;
  name: string;
}

export interface Approval {
  _id: string;
  request: MaintenanceRequest;
  requester?: { _id: string; name: string };
}

export const getMaintenanceRequests = async (status?: string) => {
  const res = await api.get('/api/maintenance', { params: { status } });
  return res.data as MaintenanceRequest[];
};

export const getBuildings = async () => {
  const res = await api.get('/api/buildings');
  return res.data as Building[];
};

export const getPendingApprovals = async () => {
  const res = await api.get('/api/maintenance/pending-approvals');
  return res.data as Approval[];
};

export const createMaintenanceRequest = async (data: Partial<MaintenanceRequest>) => {
  const res = await api.post('/api/maintenance', data);
  return res.data;
};

export const updateMaintenanceStatus = async (requestId: string, data: Partial<MaintenanceRequest>) => {
  const res = await api.put(`/api/maintenance/${requestId}`, data);
  return res.data;
};

export const processApproval = async (approvalId: string, status: 'approved' | 'rejected', comments?: string) => {
  const res = await api.post(`/api/maintenance/approvals/${approvalId}`, { status, comments });
  return res.data;
};
