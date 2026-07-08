// src/api/managerApi.ts
import { api } from "./client";

export interface Manager {
  _id: string;
  profile: {
    firstName: string;
    lastName: string;
  };
  email: string;
}

export const getManagers = async (): Promise<Manager[]> => {
  const response = await api.get("/api/users?role=manager");
  return response.data;
};
