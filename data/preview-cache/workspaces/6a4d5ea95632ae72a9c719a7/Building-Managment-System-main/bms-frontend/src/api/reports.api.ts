import { api } from "./client";

const API_URL = "/api";

export const getManagerBuildings = async () => {
  const response = await api.get(`${API_URL}/reports/manager/buildings`);
  return response.data;
};

export const getManagerReport = async (buildingId?: string) => {
  const params = buildingId ? { buildingId } : {};
  const response = await api.get(`${API_URL}/reports/manager`, { params });
  return response.data;
};

export const getManagerPayments = async (buildingId?: string) => {
  const params = buildingId ? { buildingId } : {};
  const response = await api.get(`${API_URL}/reports/manager/payments`, { params });
  return response.data;
};

export const getManagerRoomPayments = async (buildingId?: string) => {
  const params = buildingId ? { buildingId } : {};
  const response = await api.get(`${API_URL}/reports/manager/room-payments`, { params });
  return response.data;
};

export const getManagerPaymentStats = async (buildingId?: string) => {
  const params = buildingId ? { buildingId } : {};
  const response = await api.get(`${API_URL}/reports/manager/payment-stats`, { params });
  return response.data;
};