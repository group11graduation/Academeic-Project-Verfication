// src/api/api.ts
import { api as axiosInstance } from './client';

// --- INTERFACES ---

export interface AdminReport {
  summary: {
    totalBuildings: number;
    totalManagers: number;
    totalRooms: number;
    totalOccupants: number;
  };
  buildings: Array<{
    _id: string;
    name: string;
    managerName: string;
    occupantCount: number;
  }>;
}

export interface NewsItem {
  _id: string;
  title: string;
  content: string;
  category: 'MAINTENANCE' | 'URGENT' | 'GENERAL' | 'EVENT';
  createdAt: string;
}

export interface Building {
  _id: string;
  name: string;
}

export interface DashboardStats {
  occupancyRate: number;
  occupiedRooms: number;
  availableRooms: number;
  monthlyRevenue: number;
  totalRooms: number;
  totalBuildings: number;
  totalFloors: number;
  totalTenants: number;
}

export interface OccupancyTrend {
  month: string;
  occupancyRate: number;
}

export interface MaintenanceStats {
  totalRequests: number;
  statusCounts: {
    pending: number;
    in_progress: number;
    completed: number;
    rejected: number;
  };
  priorityCounts: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
}

// --- API OBJECT ---

export const api = {
  // 1. Admin Global Report
  getAdminReport: async (): Promise<AdminReport> => {
    const res = await axiosInstance.get<AdminReport>('/api/reports/admin');
    return res.data;
  },

  // 2. Announcements / News Feed
  getLatestNews: async (): Promise<NewsItem[]> => {
    const res = await axiosInstance.get<NewsItem[]>('/api/auth/news');
    return res.data;
  },

  // 3. Buildings List
  getBuildings: async (): Promise<Building[]> => {
    const res = await axiosInstance.get<Building[]>('/api/buildings');
    return res.data;
  },

  // 4. General Stats (Used by Manager or Admin)
  getDashboardStats: async (buildingId?: string): Promise<DashboardStats> => {
    const res = await axiosInstance.get<DashboardStats>('/api/dashboard/stats', {
      params: buildingId ? { buildingId } : {},
    });
    return res.data;
  },

  // 5. Occupancy Visuals
  getOccupancyTrends: async (buildingId?: string): Promise<OccupancyTrend[]> => {
    const res = await axiosInstance.get<OccupancyTrend[]>('/api/dashboard/occupancy-trends', {
      params: buildingId ? { buildingId } : {},
    });
    return res.data;
  },

  // 6. Maintenance Logic
  getMaintenanceStats: async (buildingId?: string): Promise<MaintenanceStats> => {
    const res = await axios.get<MaintenanceStats>('/api/dashboard/maintenance-stats', {
      ...getAuthHeaders(),
      params: buildingId ? { buildingId } : {},
    });
    return res.data;
  },

  // 7. Manager Specific Report (from your earlier controller)
  getManagerReport: async (): Promise<any> => {
    const res = await axios.get('/api/reports/manager', getAuthHeaders());
    return res.data;
  }
};