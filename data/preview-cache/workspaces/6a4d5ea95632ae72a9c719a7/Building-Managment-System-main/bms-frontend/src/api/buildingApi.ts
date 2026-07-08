// src/api/buildingApi.ts
import { api } from "./client";

export interface Building {
  _id: string;
  name: string;
  address: string;
  description?: string;
  totalFloors: number;
  status: "active" | "inactive";
}

export interface BuildingStats {
  totalFloors: number;
  totalRooms: number;
  occupiedRooms: number;
  occupancyRate: number;
}

export const getBuildings = async (): Promise<Building[]> => {
  const response = await api.get("/api/buildings");
  return response.data;
};

export const createBuilding = async (data: {
  name: string;
  address: string;
  description?: string;
  totalFloors: number;
  managerId: string;
}) => {
  const response = await api.post("/api/buildings", data);
  return response.data;
};

export const getBuildingStats = async (buildingId: string): Promise<BuildingStats> => {
  const response = await api.get(`/api/buildings/${buildingId}/stats`);
  return response.data;
};
