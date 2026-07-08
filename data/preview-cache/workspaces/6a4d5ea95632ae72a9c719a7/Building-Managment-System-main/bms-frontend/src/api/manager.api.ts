import { api } from "./client";

const API_URL = "/api/manager";

// --- PROFILE & AUTH ---
export const getProfile = async () => {
  const response = await api.get(`${API_URL}/auth/me`);
  return response.data;
};

export const updatePassword = async (passwords: any) => {
  return await api.put(`${API_URL}/auth/update-password`, passwords);
};

// --- SUB-MANAGER MANAGEMENT ---
export const getSubManagers = (buildingId?: string) => {
  const params = buildingId ? { buildingId } : {};
  return api.get(`${API_URL}/sub-managers`, { params }).then(res => res.data);
};

export const createSubManager = (data: any) => 
  api.post(`${API_URL}/create-sub-manager`, data).then(res => res.data);

export const updateSubManager = (id: string, data: any) => 
  api.patch(`${API_URL}/Update-sub-managers/${id}`, data).then(res => res.data);

export const deleteSubManager = (id: string) => 
  api.delete(`${API_URL}/delete-sub-managers/${id}`).then(res => res.data);

// --- FLOOR OPERATIONS ---
export const getFloors = (buildingId?: string) => {
  const params = buildingId ? { buildingId } : {};
  return api.get(`${API_URL}/floors`, { params }).then(res => res.data);
};

export const addFloor = (data: any) => 
  api.post(`${API_URL}/add-floor`, data).then(res => res.data);

export const updateFloor = (id: string, data: any) => 
  api.patch(`${API_URL}/update-floor/${id}`, data).then(res => res.data);

export const deleteFloor = (id: string) => 
  api.delete(`${API_URL}/delete-floor/${id}`).then(res => res.data);

// --- ROOM OPERATIONS ---
export const getRooms = async (availableOnly: boolean = false, buildingId?: string) => {
  const params: any = { availableOnly };
  if (buildingId) params.buildingId = buildingId;
  const response = await api.get(`${API_URL}/rooms`, { params });
  return response.data;
};

export const addRoom = (data: any) => 
  api.post(`${API_URL}/add-room`, data).then(res => res.data);

export const updateRoom = (id: string, data: any) => 
  api.patch(`${API_URL}/update-room/${id}`, data).then(res => res.data);

export const deleteRoom = (id: string) => 
  api.delete(`${API_URL}/delete-room/${id}`).then(res => res.data);

// --- PERSON OPERATIONS ---
export const getPeople = (buildingId?: string) => {
  const params = buildingId ? { buildingId } : {};
  return api.get(`${API_URL}/people`, { params }).then(res => res.data);
};

export const assignPerson = (data: any) => 
  api.post(`${API_URL}/assign-person`, data).then(res => res.data);

export const updatePerson = (id: string, data: any) => 
  api.patch(`${API_URL}/update-person/${id}`, data).then(res => res.data);

export const deletePerson = (id: string) => 
  api.delete(`${API_URL}/delete-person/${id}`).then(res => res.data);

// --- APPROVAL OPERATIONS ---
export const getPendingRequests = () => 
  api.get(`${API_URL}/approvals/pending`).then(res => res.data);

export const reviewRequest = (id: string, status: 'APPROVED' | 'REJECTED', reason?: string) => 
  api.patch(`${API_URL}/approvals/${id}`, { status, reason }).then(res => res.data);

// --- BUILDING APPROVAL OPERATIONS (for Manager) ---
export const getManagerBuildingApprovals = () => 
  api.get(`${API_URL}/building-approvals`).then(res => res.data);

export const approveBuildingCreation = (id: string, status: "APPROVED" | "REJECTED", reason?: string) => 
  api.patch(`${API_URL}/building-approvals/${id}/approve`, { status, reason }).then(res => res.data);

// --- ROOM PAYMENT OPERATIONS (for tenant payments) ---
export const getRoomPayments = (params?: { status?: string; personId?: string; roomId?: string; period?: string; buildingId?: string }) => 
  api.get(`${API_URL}/room-payments`, { params }).then(res => res.data);

export const createRoomPayment = (data: any) => 
  api.post(`${API_URL}/room-payments`, data).then(res => res.data);

export const markRoomPaymentAsPaid = (paymentId: string, data: { paidAmount?: number; paymentMethod?: string; notes?: string; buildingId?: string }) => 
  api.patch(`${API_URL}/room-payments/${paymentId}/paid`, data).then(res => res.data);

export const getRoomPaymentStats = (buildingId?: string) => {
  const params = buildingId ? { buildingId } : {};
  return api.get(`${API_URL}/room-payments/stats`, { params }).then(res => res.data);
};

export const autoCreateRoomPayments = (buildingId?: string) => 
  api.post(`${API_URL}/room-payments/auto-create`, { buildingId }).then(res => res.data);

export const deleteRoomPayment = (paymentId: string, buildingId?: string) => {
  const params = buildingId ? { buildingId } : {};
  return api.delete(`${API_URL}/room-payments/${paymentId}`, { params }).then(res => res.data);
};

// --- APARTMENT OPERATIONS ---
export const getApartments = (buildingId?: string) => {
  const params: any = { isApartment: true };
  if (buildingId) params.buildingId = buildingId;
  return api.get(`${API_URL}/rooms`, { params }).then(res => res.data);
};

export const addApartment = (data: any) => 
  api.post(`${API_URL}/add-room`, { ...data, isApartment: true }).then(res => res.data);

export const getApartmentRooms = (apartmentId: string, buildingId?: string) => {
  const params: any = { parentApartment: apartmentId };
  if (buildingId) params.buildingId = buildingId;
  return api.get(`${API_URL}/rooms`, { params }).then(res => res.data);
};

export const addRoomToApartment = (apartmentId: string, data: any) => 
  api.post(`${API_URL}/add-room`, { ...data, parentApartment: apartmentId, isApartment: false }).then(res => res.data);