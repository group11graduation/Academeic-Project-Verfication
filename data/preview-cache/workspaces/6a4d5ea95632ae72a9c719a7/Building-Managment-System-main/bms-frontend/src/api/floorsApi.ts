// src/api/floorsApi.ts
import { api } from "./client";

export interface Floor {
  _id: string;
  buildingId: string;
  floorNumber: number;
  name: string;
  totalRooms: number;
  description?: string;
  _creationTime: string;
}

export interface Building {
  _id: string;
  name: string;
}

export const getFloors = async (buildingId: string): Promise<Floor[]> => {
  const res = await api.get(`/api/floors?buildingId=${buildingId}`);
  return res.data;
};

export const getBuildings = async (): Promise<Building[]> => {
  const res = await api.get("/api/buildings");
  return res.data;
};

export const createFloor = async (data: {
  buildingId: string;
  floorNumber: number;
  name: string;
  totalRooms: number;
  description?: string;
}) => {
  const res = await api.post("/api/floors", data);
  return res.data;
};

export const updateFloor = async (floorId: string, data: {
  floorNumber: number;
  name: string;
  totalRooms: number;
  description?: string;
}) => {
  const res = await api.put(`/api/floors/${floorId}`, data);
  return res.data;
};
