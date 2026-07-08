const express = require("express");
const router = express.Router();

const { 
  getManagerReport,
  getManagerBuildings,
  getManagerPayments, 
  getManagerRoomPayments, 
  getManagerPaymentStats 
} = require("../controllers/reports.controller");

const auth = require("../middleware/auth");
const role = require("../middleware/role");

// Get all buildings assigned to manager
router.get(
  "/manager/buildings",
  auth,
  role("MANAGER", "SUB_MANAGER"),
  getManagerBuildings
);

//  Manager / Sub Manager dashboard report
router.get(
  "/manager",
  auth,
  role("MANAGER", "SUB_MANAGER"),
  getManagerReport
);

// Manager payment tracking
router.get(
  "/manager/payments",
  auth,
  role("MANAGER", "SUB_MANAGER"),
  getManagerPayments
);

router.get(
  "/manager/room-payments",
  auth,
  role("MANAGER", "SUB_MANAGER"),
  getManagerRoomPayments
);

router.get(
  "/manager/payment-stats",
  auth,
  role("MANAGER", "SUB_MANAGER"),
  getManagerPaymentStats
);

module.exports = router;
