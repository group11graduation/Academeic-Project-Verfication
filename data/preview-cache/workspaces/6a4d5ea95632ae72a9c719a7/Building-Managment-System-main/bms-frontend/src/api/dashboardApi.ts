import { api } from "./client";

export interface DashboardStats {
  totalBuildings: number;
  totalRooms: number;
  totalTenants: number;
  totalMaintenanceRequests: number;
  occupancyRate: number;
  monthlyRevenue: number;
  occupiedRooms: number;
  availableRooms: number;
  maintenanceRooms: number;
  recentRequests: {
    _id: string;
    title: string;
    _creationTime: string;
    priority: "urgent" | "high" | "medium" | "low";
    status: "completed" | "in_progress" | "pending";
  }[];
}

export interface MaintenanceStats {
  statusCounts: {
    pending: number;
    in_progress: number;
    completed: number;
  };
  priorityCounts: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface OccupancyTrends {
  labels: string[];
  occupancy: number[];
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const res = await api.get("/api/dashboard/stats");
  const data: DashboardStats = res.data;

  // Ensure defaults so frontend never crashes
  return {
    totalBuildings: data.totalBuildings ?? 0,
    totalRooms: data.totalRooms ?? 0,
    totalTenants: data.totalTenants ?? 0,
    totalMaintenanceRequests: data.totalMaintenanceRequests ?? 0,
    occupancyRate: data.occupancyRate ?? 0,
    monthlyRevenue: data.monthlyRevenue ?? 0,
    occupiedRooms: data.occupiedRooms ?? 0,
    availableRooms: data.availableRooms ?? 0,
    maintenanceRooms: data.maintenanceRooms ?? 0,
    recentRequests: data.recentRequests?.map(r => ({
      _id: r._id,
      title: r.title,
      _creationTime: r._creationTime,
      priority: r.priority ?? "medium",
      status: r.status ?? "pending"
    })) ?? []
  };
};

export const getMaintenanceStats = async (): Promise<MaintenanceStats> => {
  const res = await api.get("/api/dashboard/maintenance-stats");
  const data: MaintenanceStats = res.data;

  return {
    statusCounts: {
      pending: data.statusCounts?.pending ?? 0,
      in_progress: data.statusCounts?.in_progress ?? 0,
      completed: data.statusCounts?.completed ?? 0
    },
    priorityCounts: {
      urgent: data.priorityCounts?.urgent ?? 0,
      high: data.priorityCounts?.high ?? 0,
      medium: data.priorityCounts?.medium ?? 0,
      low: data.priorityCounts?.low ?? 0
    }
  };
};

export const getOccupancyTrends = async (): Promise<OccupancyTrends> => {
  const res = await api.get("/api/dashboard/occupancy-trends");
  const data: OccupancyTrends = res.data;

  return {
    labels: data.labels ?? [],
    occupancy: data.occupancy ?? []
  };
};
