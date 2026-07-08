const Building = require("../models/Building");
const Floor = require("../models/Floor");
const Room = require("../models/Room");
const Maintenance = require("../models/Maintenance");
const Person = require("../models/Person");
const mongoose = require("mongoose");

exports.getDashboardStats = async (req, res) => {
  try {
    // Total buildings
    const totalBuildings = await Building.countDocuments();

    // Total floors
    const totalFloors = await Floor.countDocuments();

    // Total rooms
    const totalRooms = await Room.countDocuments();

    // Rooms by status
    const occupiedRooms = await Room.countDocuments({ status: "OCCUPIED" });
    const availableRooms = await Room.countDocuments({ status: "AVAILABLE" });
    const maintenanceRooms = await Room.countDocuments({ status: "MAINTENANCE" });

    // Total tenants
    const totalTenants = await Person.countDocuments({ type: "TENANT" });

    // Total maintenance requests
    const totalMaintenanceRequests = await Maintenance.countDocuments();

    // Occupancy rate
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // Monthly revenue (dummy calculation, adjust as needed)
    const monthlyRevenue = occupiedRooms * 1000; // example: $1000 per occupied room

    // Recent maintenance requests
    const recentRequests = await Maintenance.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id title createdAt status building floor room")
      .lean();

    res.json({
      totalBuildings,
      totalRooms,
      totalTenants,
      totalMaintenanceRequests,
      occupancyRate,
      monthlyRevenue,
      occupiedRooms,
      availableRooms,
      maintenanceRooms,
      recentRequests: recentRequests.map(r => ({
        _id: r._id,
        title: r.title,
        _creationTime: r.createdAt,
        priority: r.priority || "medium",
        status: r.status.toLowerCase() // convert to lowercase to match frontend
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};

exports.getMaintenanceStats = async (req, res) => {
  try {
    const totalPending = await Maintenance.countDocuments({ status: "PENDING" });
    const totalInProgress = await Maintenance.countDocuments({ status: "IN_PROGRESS" });
    const totalCompleted = await Maintenance.countDocuments({ status: "COMPLETED" });

    // Priority counts (assumes `priority` field exists)
    const urgent = await Maintenance.countDocuments({ priority: "urgent" });
    const high = await Maintenance.countDocuments({ priority: "high" });
    const medium = await Maintenance.countDocuments({ priority: "medium" });
    const low = await Maintenance.countDocuments({ priority: "low" });

    res.json({
      statusCounts: {
        pending: totalPending,
        in_progress: totalInProgress,
        completed: totalCompleted
      },
      priorityCounts: {
        urgent,
        high,
        medium,
        low
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch maintenance stats" });
  }
};

exports.getOccupancyTrends = async (req, res) => {
  try {
    // Example: last 6 months
    const now = new Date();
    const labels = [];
    const occupancy = [];

    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      const totalRooms = await Room.countDocuments();
      const occupiedRooms = await Room.countDocuments({
        status: "OCCUPIED",
        updatedAt: { $gte: monthStart, $lte: monthEnd }
      });

      labels.push(month.toLocaleString("default", { month: "short" }));
      occupancy.push(totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0);
    }

    res.json({ labels, occupancy });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch occupancy trends" });
  }
};
