const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");

router.get("/stats", dashboardController.getDashboardStats);
router.get("/maintenance-stats", dashboardController.getMaintenanceStats);
router.get("/occupancy-trends", dashboardController.getOccupancyTrends);

module.exports = router;
