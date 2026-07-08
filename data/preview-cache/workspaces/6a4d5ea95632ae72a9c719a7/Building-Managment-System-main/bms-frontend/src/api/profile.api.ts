// src/api/profile.api.ts
import { api as axiosInstance } from './client';

export interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  buildingId?: string;
  role: string;
  isActive: boolean;
}

export interface User {
  profile: UserProfile;
  email?: string;
}

export interface Building {
  _id: string;
  name: string;
}

export const api = {
  getCurrentUser: async (): Promise<User> => {
    const res = await axiosInstance.get<User>('/api/users/me');
    return res.data;
  },

  updateUserProfile: async (profileId: string, data: Partial<UserProfile>) => {
    const res = await axiosInstance.put<UserProfile>(`/api/users/${profileId}`, data);
    return res.data;
  },

  getBuildings: async (): Promise<Building[]> => {
    const res = await axiosInstance.get<Building[]>('/api/buildings');
    return res.data;
  },
};
