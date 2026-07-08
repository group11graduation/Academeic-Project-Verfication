const Building = require("../models/Building");
const User = require("../models/User");
const Room = require("../models/Room");
const Person = require("../models/Person");
const mongoose = require("mongoose");

exports.getAdminGlobalReport = async (req, res) => {
  try {
    // 1. Fetch Summary Totals
    // Note: We use countDocuments({}) to ensure we count everything in the collection
    const [totalBuildings, totalManagers, totalRooms, totalOccupants] = await Promise.all([
      Building.countDocuments({}),
      User.countDocuments({ role: "MANAGER" }),
      Room.countDocuments({}),
      Person.countDocuments({ type: "TENANT" })
    ]);

    // 2. Building-wise breakdown
    const buildingStats = await Building.aggregate([
      {
        $lookup: {
          // IMPORTANT: Check your MongoDB Compass. 
          // If your model is 'User', the collection is likely 'users' (lowercase + s)
          from: "users", 
          localField: "manager", // This must be the ID field in your Building schema
          foreignField: "_id",
          as: "managerInfo"
        }
      },
      {
        $lookup: {
          // IMPORTANT: Check if your collection is 'people' or 'persons'
          from: "people", 
          localField: "_id",
          foreignField: "building", // Field in Person model that stores Building ID
          as: "occupants"
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          // Extract the name from the joined managerInfo array
          managerName: { 
            $ifNull: [{ $arrayElemAt: ["$managerInfo.name", 0] }, "Unassigned"] 
          },
          // Calculate size of the joined occupants array
          occupantCount: { $size: { $ifNull: ["$occupants", []] } },
        }
      },
      { $sort: { name: 1 } }
    ]);

    // 3. Final Response
    res.json({
      summary: {
        totalBuildings,
        totalManagers,
        totalRooms,
        totalOccupants
      },
      buildings: buildingStats
    });

  } catch (err) {
    console.error("Admin Report Error:", err);
    res.status(500).json({ message: "Admin report error", error: err.message });
  }
};